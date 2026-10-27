"""Local, object-aware video matting. Never modifies the supplied MP4 files.
Requires numpy, opencv-python-headless, onnxruntime, pymatting, Pillow,
imageio-ffmpeg and the MIT BiRefNet-General-Lite ONNX weights.
Intermediate frames, masks and QA reports belong in ignored output/.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy.ndimage import distance_transform_edt
from pymatting import estimate_alpha_cf, estimate_foreground_ml

DECOR = {
    'lion': [(20, 100, 310, 460), (1035, 0, 1190, 105)],
    'kitten': [(245, 45, 400, 195), (890, 35, 1040, 180),
               (280, 310, 430, 465), (925, 325, 1055, 475)],
}


def decorations(rgb, matte, kind):
    # Only small, explicitly identified decorative objects use color seeds.
    # Animal fur, white gift panels and toys always use semantic object masks.
    for x0, y0, x1, y1 in DECOR[kind]:
        crop = rgb[y0:y1, x0:x1].astype(np.float32)
        edges = np.vstack([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3),
                           rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
        distance = np.linalg.norm(crop - np.median(edges, axis=0), axis=2)
        n, labels, stats, _ = cv2.connectedComponentsWithStats((distance > 22).astype(np.uint8))
        clean = np.zeros(distance.shape, np.uint8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] > 35:
                clean[labels == i] = 1
        contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(clean, contours, -1, 1, -1)
        matte[y0:y1, x0:x1] = np.maximum(matte[y0:y1, x0:x1], cv2.GaussianBlur(clean.astype(np.float32), (3, 3), .6))
    return matte


def predict(session, rgb, kind):
    x = cv2.resize(rgb, (1024, 1024)).astype(np.float32) / 255
    x = (x - np.array([.485, .456, .406], np.float32)) / np.array([.229, .224, .225], np.float32)
    logits = session.run(None, {session.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    mask = 1 / (1 + np.exp(-np.clip(logits, -50, 50)))
    mask = (mask - mask.min()) / max(float(mask.max() - mask.min()), 1e-6)
    return decorations(rgb, cv2.resize(mask, (rgb.shape[1], rgb.shape[0])), kind)


def grey(rgb):
    return cv2.cvtColor(cv2.resize(rgb, (640, 360)), cv2.COLOR_RGB2GRAY)


def warp(mask, previous, current, flow_engine):
    # Current-to-previous dense flow; remapping keeps boundaries attached to
    # the actual moving fur/toy rather than averaging unaligned silhouettes.
    flow = flow_engine.calc(grey(current), grey(previous), None)
    flow = cv2.resize(flow, (1280, 720)) * 2
    xx, yy = np.meshgrid(np.arange(1280, dtype=np.float32), np.arange(720, dtype=np.float32))
    return cv2.remap(mask, xx + flow[:, :, 0], yy + flow[:, :, 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)



def protect_gift(mask, kind, index):
    core = np.zeros(mask.shape, np.uint8)
    if kind == 'lion':
        # White panels are indistinguishable from paper by color alone.
        # These tracked, inset object-space polygons mark their real interior.
        poses = {
            0: [(153,612),(275,650),(435,585),(435,750),(275,770),(153,710)],
            64: [(171,612),(286,650),(442,590),(442,750),(286,770),(171,710)],
            80: [(195,607),(305,619),(452,588),(452,740),(305,742),(195,685)],
            96: [(224,551),(336,527),(480,547),(480,750),(336,760),(224,694)],
            120: [(224,551),(336,527),(480,547),(480,750),(336,760),(224,694)],
            239: [(224,551),(336,527),(480,547),(480,750),(336,760),(224,694)],
        }
        keys = list(poses)
        for a,b in zip(keys[:-1],keys[1:]):
            if a <= index <= b:
                t=(index-a)/(b-a)
                polygon=(1-t)*np.array(poses[a])+t*np.array(poses[b])
                cv2.fillPoly(core,[np.int32(polygon)],1)
                break
    return np.maximum(mask,core),core


def reject_uncertain_paper(rgb, mask, core):
    known = mask < .01
    # Reconstruct the local background from confirmed background pixels.
    indices = distance_transform_edt(~known, return_distances=False, return_indices=True)
    background = rgb[tuple(indices)].astype(np.float32)
    background = cv2.GaussianBlur(background,(0,0),12)
    difference = np.linalg.norm(rgb.astype(np.float32)-background,axis=2)
    mask[(difference < 8) & (mask < .98) & (core == 0)] = 0
    return mask

def process(kind, source, model, work, destination, interval):
    root = work / kind
    raw, masks, rgba = [root / name for name in ['raw', 'masks', 'rgba']]
    for folder in [raw, masks, rgba, destination]: folder.mkdir(parents=True, exist_ok=True)
    video = cv2.VideoCapture(str(source))
    fps, count = video.get(cv2.CAP_PROP_FPS), int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    assert video.get(3) == 1280 and video.get(4) == 720 and fps == 24, 'Inspect source dimensions before changing the workflow'
    for i in range(count):
        ok, frame = video.read()
        if not ok: raise RuntimeError(f'Cannot decode frame {i}')
        if not (raw / f'{i:04}.png').exists(): cv2.imwrite(str(raw / f'{i:04}.png'), frame)
    video.release()
    def frame(i): return cv2.cvtColor(cv2.imread(str(raw / f'{i:04}.png')), cv2.COLOR_BGR2RGB)
    options = ort.SessionOptions(); options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])
    keys = sorted(set(range(0, count, interval)) | {count - 1})
    for i in keys:
        path = masks / f'{i:04}.png'
        if not path.exists(): Image.fromarray(np.uint8(np.clip(predict(session, frame(i), kind), 0, 1) * 255)).save(path)
        print(f'{kind}: semantic keyframe {i + 1}/{count}', flush=True)
    del session
    engine = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flower_reference = None
    if kind == 'kitten':
        first_mask = np.asarray(Image.open(masks / '0000.png')).astype(np.float32) / 255
        flower_reference = np.zeros(first_mask.shape, np.float32)
        flower_reference[440:700, 180:440] = first_mask[440:700, 180:440]
    first_frame = frame(0)
    bounds = [1280, 720, 0, 0]
    for left, right in zip(keys[:-1], keys[1:]):
        frames = [frame(i) for i in range(left, right + 1)]
        a = np.asarray(Image.open(masks / f'{left:04}.png')).astype(np.float32) / 255
        b = np.asarray(Image.open(masks / f'{right:04}.png')).astype(np.float32) / 255
        forward, backward = [a], [b]
        for j in range(1, len(frames)): forward.append(warp(forward[-1], frames[j - 1], frames[j], engine))
        for j in range(len(frames) - 2, -1, -1): backward.append(warp(backward[-1], frames[j + 1], frames[j], engine))
        backward.reverse()
        for j, rgb in enumerate(frames):
            i = left + j
            path = rgba / f'{i:04}.png'
            if path.exists():
                alpha = np.asarray(Image.open(path))[:, :, 3]
            else:
                t = j / (right - left)
                mask = decorations(rgb, (1 - t) * forward[j] + t * backward[j], kind)
                mask, core = protect_gift(mask, kind, i)
                if kind == 'lion':
                    mask = reject_uncertain_paper(rgb, mask, core)
                elif flower_reference is not None:
                    if i > 60:
                        # This ROI is open air above the pink lid/doll, never fur.
                        # Earlier object-box clipping accidentally retained paper here.
                        border = np.vstack([rgb[:8].reshape(-1,3),rgb[-8:].reshape(-1,3),rgb[:,:8].reshape(-1,3),rgb[:,-8:].reshape(-1,3)])
                        paper = np.median(border,axis=0)
                        distance = np.linalg.norm(rgb[315:480,925:1065].astype(np.float32)-paper,axis=2)
                        region = mask[315:480,925:1065]
                        region[distance < 22] = 0
                    flower = warp(flower_reference, first_frame, rgb, engine)
                    mask = np.maximum(mask, flower)
                # Closed-form matting uses the current RGB frame and an object
                # trimap. It preserves white fur and resolves soft, mixed edges.
                small = cv2.resize(rgb, (896, 504)).astype(np.float64) / 255
                m = cv2.resize(mask, (896, 504))
                fg = cv2.erode((m > .5).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                bg = cv2.dilate((m > .03).astype(np.uint8), np.ones((5, 5), np.uint8)) == 0
                trimap = np.full(m.shape, .5); trimap[fg] = 1; trimap[bg] = 0
                alpha = estimate_alpha_cf(small, trimap)
                foreground = estimate_foreground_ml(small, alpha)
                pixels = np.uint8(np.clip(np.dstack([foreground, alpha]), 0, 1) * 255)
                pixels[pixels[:, :, 3] == 0, :3] = 0
                Image.fromarray(pixels).save(path)
                alpha = pixels[:, :, 3]
            yy, xx = np.where(alpha > 3)
            bounds = [min(bounds[0], int(xx.min())), min(bounds[1], int(yy.min())), max(bounds[2], int(xx.max()) + 1), max(bounds[3], int(yy.max()) + 1)]
        print(f'{kind}: matted through {right + 1}/{count}', flush=True)
    # A single, fixed crop for the entire clip. Even dimensions for VP9 4:2:0.
    x0, y0, x1, y1 = bounds
    x0, y0 = max(0, x0 - 10) // 2 * 2, max(0, y0 - 10) // 2 * 2
    x1, y1 = min(896, x1 + 10) // 2 * 2, min(504, y1 + 10) // 2 * 2
    final = root / 'final'; final.mkdir(exist_ok=True)
    for i in range(count): Image.open(rgba / f'{i:04}.png').crop((x0, y0, x1, y1)).save(final / f'{i:04}.png')
    for label, i in [('first', 0), ('last', count - 1)]:
        Image.open(final / f'{i:04}.png').save(destination / f'{kind}-{label}.webp', lossless=True, method=6)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-framerate', '24', '-i', str(final / '%04d.png'), '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', '25', '-row-mt', '1', str(destination / f'{kind}.webm')], check=True)
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-framerate', '24', '-i', str(final / '%04d.png'), '-an', '-vf', 'scale=512:-1', '-c:v', 'libwebp_anim', '-quality', '76', '-compression_level', '4', '-loop', '1', str(destination / f'{kind}.webp')], check=True)
    # ANIM's default canvas is opaque white in FFmpeg; explicitly clear it.
    animation = destination / f'{kind}.webp'
    data = bytearray(animation.read_bytes())
    offset = 12
    while offset + 8 <= len(data):
        size = int.from_bytes(data[offset + 4:offset + 8], 'little')
        if data[offset:offset + 4] == b'ANIM':
            data[offset + 8:offset + 12] = bytes(4)
            break
        offset += 8 + size + (size % 2)
    animation.write_bytes(data)
    report = {'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'fps': fps, 'frames': count, 'duration': count / fps, 'width': x1 - x0, 'height': y1 - y0, 'crop': [x0, y0, x1, y1], 'method': 'BiRefNet-General-Lite key masks; bidirectional DIS flow; closed-form alpha matting; multilevel foreground decontamination'}
    (root / 'report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--lion', type=Path, required=True)
    parser.add_argument('--kitten', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--work', type=Path, default=Path('output/character-video/processed'))
    parser.add_argument('--destination', type=Path, default=Path('public/animations'))
    parser.add_argument('--kind', choices=['lion', 'kitten'])
    parser.add_argument('--interval', type=int, default=8)
    args = parser.parse_args()
    for kind in ([args.kind] if args.kind else ['lion', 'kitten']): process(kind, getattr(args, kind), args.model, args.work, args.destination, args.interval)

"""Verify every delivered WebP/VP9 frame; save local evidence, not build artifacts."""
import argparse
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import cv2
from PIL import Image, ImageDraw

work = Path('output/character-video/processed')
assets = Path('public/animations')
parser = argparse.ArgumentParser()
parser.add_argument('--kind', choices=['lion', 'kitten', 'together'])
args = parser.parse_args()
report = {}
photo = Image.open('public/art/franco.webp').convert('RGB')
for kind in ([args.kind] if args.kind else ['lion', 'kitten']):
    root = work / kind
    info = json.loads((root / 'report.json').read_text())
    frames = sorted((root / 'final').glob('[0-9][0-9][0-9][0-9].png'))
    stats, areas = [], []
    for path in frames:
        alpha = np.asarray(Image.open(path))[:, :, 3]
        stats.append({'zero': int((alpha == 0).sum()), 'opaque': int((alpha == 255).sum()), 'partial': int(((alpha > 0) & (alpha < 255)).sum())})
        areas.append(int((alpha > 127).sum()))
    assert len(frames) == info['frames'] and all(s['zero'] > 1000 and s['opaque'] > 1000 and s['partial'] > 100 for s in stats)
    animation = Image.open(assets / f'{kind}.webp')
    assert animation.n_frames == info['frames'] and animation.info['loop'] == 1 and animation.info['background'] == (0, 0, 0, 0)
    durations = 0
    for i in range(animation.n_frames):
        animation.seek(i)
        alpha = np.asarray(animation.convert('RGBA'))[:, :, 3]
        assert (alpha == 0).sum() > 1000 and (alpha > 247).sum() > 1000, f'Bad WebP alpha at {kind}:{i}'
        animation.load()
        durations += animation.info.get('duration', 0)
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', str(assets / f'{kind}.webm'), '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1']
    process = subprocess.Popen(command, stdout=subprocess.PIPE)
    frame_bytes = info['width'] * info['height'] * 4
    decoded = 0
    while True:
        data = process.stdout.read(frame_bytes)
        if not data: break
        assert len(data) == frame_bytes
        alpha = np.frombuffer(data, np.uint8).reshape(-1, 4)[:, 3]
        assert (alpha == 0).sum() > 1000 and (alpha > 247).sum() > 1000, f'Bad VP9 alpha at {kind}:{decoded}'
        decoded += 1
    assert process.wait() == 0 and decoded == info['frames']
    if kind == 'kitten':
        # The flower cluster must never vanish, including the formerly bad 17th frame.
        for path in sorted((root / 'rgba').glob('[0-9][0-9][0-9][0-9].png')):
            alpha = np.asarray(Image.open(path))[:, :, 3]
            assert (alpha[340:470, 145:300] > 247).sum() > 1800, f'Missing flowers: {path.name}'
    retained = []
    if kind == 'kitten':
        for path in sorted((root / 'masks').glob('[0-9][0-9][0-9][0-9].png')):
            mask = cv2.resize(np.asarray(Image.open(path)), (896, 504))
            confident = cv2.erode((mask > 252).astype(np.uint8), np.ones((5,5),np.uint8)) > 0
            alpha = np.asarray(Image.open(root / 'rgba' / path.name))[:, :, 3]
            # Tail regions on both sides must survive flower tracking and matting.
            regions = [(245,465,230,395)] if int(path.stem) >= 40 else [(245,420,530,650)]
            for y0,y1,x0,x1 in regions:
                expected = confident[y0:y1,x0:x1]
                if expected.sum() > 100:
                    coverage = float((alpha[y0:y1,x0:x1][expected] > 247).mean())
                    retained.append(coverage)
                    assert coverage > .995, f'Tail foreground lost: {path.name}: {coverage}'
    interiors = []
    if kind == 'together':
        # Both light fur and dark mane must retain every confident interior.
        for path in sorted((root / 'masks').glob('[0-9][0-9][0-9][0-9].png')):
            mask = cv2.resize(np.asarray(Image.open(path)), (896, 512))
            core = cv2.erode((mask > 252).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            alpha = np.asarray(Image.open(root / 'rgba' / path.name))[:, :, 3]
            coverage = float((alpha[core] > 247).mean())
            interiors.append(coverage)
            assert coverage > .995, f'Character interior lost: {path.name}: {coverage}'
    info['alphaVerification'] = {
        'minimumSemanticInteriorRetention': min(interiors) if interiors else None,
        'minimumTailForegroundRetention': min(retained) if retained else None,
        'masterFrames': len(frames), 'webpFrames': animation.n_frames, 'vp9Frames': decoded,
        'webpDurationMs': durations,
        'allFramesHaveTransparentBackgroundAndOpaqueObjects': True,
        'allMasterFramesHaveAntialiasedEdges': True,
        'maxAdjacentSilhouetteAreaChange': float((np.abs(np.diff(areas)) / np.array(areas[:-1])).max()),
    }
    info['files'] = {p.name: p.stat().st_size for p in assets.glob(f'{kind}*')}
    report[kind] = info
    sheet = Image.new('RGB', (1200, 1320), '#ddd')
    draw = ImageDraw.Draw(sheet)
    for row in range(6):
        for col, i in enumerate([0, round((len(frames)-1)*.4), round((len(frames)-1)*.7), len(frames)-1]):
            if row < 4:
                background = Image.new('RGBA', (300, 200), ['#fff', '#08080b', '#e3a9bd', '#73b8dd'][row])
            elif row == 4:
                pixels = np.zeros((200, 300, 4), np.uint8); pixels[:, :, 3] = 255
                for x in range(300): pixels[:, x, :3] = np.array([110, 165, 215]) * (1 - x / 299) + np.array([240, 175, 200]) * (x / 299)
                background = Image.fromarray(pixels)
            else:
                background = photo.resize((300, 200)).convert('RGBA')
            image = Image.open(frames[i]); image.thumbnail((285, 190))
            background.alpha_composite(image, ((300 - image.width) // 2, (200 - image.height) // 2))
            sheet.paste(background.convert('RGB'), (col * 300, row * 220))
            draw.text((col * 300 + 5, row * 220 + 202), f'{kind}: {i / 24:.2f}s', fill='#333')
    sheet.save(root / 'six-backgrounds.jpg')
    print(kind, info['alphaVerification'], flush=True)
output = Path('output/character-video/alpha-report.json')
previous = json.loads(output.read_text()) if output.exists() else {}
previous.update(report)
output.write_text(json.dumps(previous, indent=2))

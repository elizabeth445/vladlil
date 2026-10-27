"""Tracked local repairs of the existing transparent video masters.
The source MP4s and original rgba/ frames are never overwritten. Restored
patches contain only crown tips, toy/gift bottoms and the doll's box wall.
"""
import argparse
import json
import runpy
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d

WORK = Path('output/character-video/processed')
PATCHES = Path('assets/animation-restoration')
CONFIG = json.loads((PATCHES / 'patches.json').read_text())
TOP = CONFIG['paddingTop']
BOTTOM = CONFIG['paddingBottom']
SIFT = cv2.SIFT_create(nfeatures=3500, contrastThreshold=.008)


def read(path):
    return np.asarray(Image.open(path).convert('RGBA'))


def descriptors(frame, roi):
    mask = np.zeros(frame.shape[:2], np.uint8)
    x0, y0, x1, y1 = roi
    mask[y0:y1, x0:x1] = 255
    return SIFT.detectAndCompute(cv2.cvtColor(frame[:, :, :3], cv2.COLOR_RGB2GRAY), mask)


def tracks(frames, reference, roi, search):
    keypoints, description = descriptors(frames[reference], roi)
    matrices, counts = [], []
    for frame in frames:
        points, desc = descriptors(frame, search)
        good = [m for m, n in cv2.BFMatcher().knnMatch(description, desc, k=2) if m.distance < .76 * n.distance]
        matrix = valid = None
        if len(good) >= 4:
            matrix, valid = cv2.estimateAffinePartial2D(
                np.float32([keypoints[m.queryIdx].pt for m in good]),
                np.float32([points[m.trainIdx].pt for m in good]),
                method=cv2.RANSAC, ransacReprojThreshold=2.2)
        count = int(valid.sum()) if valid is not None else 0
        if matrix is None or count < 4 or not .65 < np.linalg.det(matrix[:, :2]) < 1.5:
            matrices.append(None)
        else:
            matrices.append(matrix)
        counts.append(count)
    good = [i for i, matrix in enumerate(matrices) if matrix is not None]
    assert good, 'No reliable object anchors'
    result = np.zeros((len(frames), 2, 3))
    for row in range(2):
        for col in range(3):
            values = np.interp(np.arange(len(frames)), good, [matrices[i][row, col] for i in good])
            result[:, row, col] = gaussian_filter1d(values, 1)
    return result, counts


def patch(name, matrix, size, padded=True):
    info = CONFIG['patches'][name]
    image = read(PATCHES / info['file']).astype(np.float32) / 255
    image[:, :, :3] *= image[:, :, 3:4]
    x0, y0, _, _ = info['bounds']
    # Patch coordinates refer to the padded reference. Tracking uses original
    # scene coordinates; compose both offsets before a single resampling.
    offset = np.array([x0, y0 - (TOP if padded else 0)])
    transform = matrix.copy()
    transform[:, 2] += matrix[:, :2] @ offset
    if padded:
        transform[1, 2] += TOP
    pixels = cv2.warpAffine(image, transform, size, flags=cv2.INTER_CUBIC)
    pixels = np.clip(pixels, 0, 1)
    np.divide(pixels[:, :, :3], pixels[:, :, 3:4], out=pixels[:, :, :3], where=pixels[:, :, 3:4] > 1e-6)
    return np.uint8(np.clip(pixels, 0, 1) * 255)


def composite(base, overlay, weight):
    overlay = overlay.copy()
    overlay[:, :, 3] = np.uint8(overlay[:, :, 3].astype(float) * weight)
    return np.asarray(Image.alpha_composite(Image.fromarray(base), Image.fromarray(overlay)))


def fade(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def lion():
    root = WORK / 'lion'
    frames = [read(root / 'rgba' / f'{i:04}.png') for i in range(240)]
    first, a = tracks(frames, 0, (395, 0, 550, 75), (330, 0, 620, 105))
    last, b = tracks(frames, 239, (410, 0, 550, 72), (330, 0, 620, 105))
    cars, c = tracks(frames, 239, (175, 415, 355, 504), (120, 310, 440, 504))
    gifts, d = tracks(frames, 0, (100, 385, 315, 504), (75, 350, 370, 504))
    identity = np.float64([[1, 0, 0], [0, 1, 0]])
    folder = root / 'refined'; folder.mkdir(exist_ok=True)
    for i, frame in enumerate(frames):
        canvas = np.zeros((504 + TOP + BOTTOM, 896, 4), np.uint8)
        canvas[TOP:TOP + 504] = frame
        # Existing pixels remain above the added fragments; only the missing
        # areas beyond the old camera boundary receive restored artwork.
        weight = fade((i - 56) / 40)
        for name, matrix, opacity in [('crown-first', first[i], 1 - weight), ('crown-last', last[i], weight), ('star-top', identity, 1)]:
            layer = patch(name, matrix, (896, canvas.shape[0]))
            layer[TOP:] = 0
            canvas = composite(canvas, layer, opacity)
        bottom = np.zeros_like(canvas)
        for name, matrix, opacity in [('gift-bottom', gifts[i], 1 - fade((i - 72) / 24)), ('car-bottom', cars[i], fade((i - 100) / 24))]:
            layer = patch(name, matrix, (896, canvas.shape[0]))
            layer[:TOP + 504] = 0
            bottom = composite(bottom, layer, opacity)
        canvas = np.asarray(Image.alpha_composite(Image.fromarray(bottom), Image.fromarray(canvas)))
        Image.fromarray(canvas).save(folder / f'{i:04}.png')
    return {'crownFirstMinimumInliers': min(a), 'crownLastMinimumInliers': min(b), 'carMinimumInliersAfter124': min(c[124:]), 'giftMinimumInliersBefore72': min(d[:72])}


def kitten():
    root = WORK / 'kitten'
    frames = [read(root / 'rgba' / f'{i:04}.png') for i in range(240)]
    # Track the rigid gift face, excluding the impossible lower legs.
    matrices, counts = tracks(frames, 239, (540, 374, 712, 429), (500, 350, 750, 440))
    folder = root / 'refined'; folder.mkdir(exist_ok=True)
    yy, xx = np.mgrid[:504, :896]
    # A soft local window stops well below the rim/arm and preserves the
    # kitten's grounded paws. It also clears protruding feet outside the wall.
    window = np.minimum.reduce([fade((xx - 520) / 6), fade((650 - xx) / 6), fade((yy - 415) / 8), fade((492 - yy) / 6)])
    for i, frame in enumerate(frames):
        if i < 128:
            result = frame
        else:
            replacement = patch('box-front', matrices[i], (896, 504), padded=False)
            mask = cv2.warpAffine(window.astype(np.float32), matrices[i], (896, 504)) * fade((i - 128) / 16)
            # Premultiplied crossfade replaces RGBA, including old feet's alpha.
            original = frame.astype(np.float32) / 255
            corrected = replacement.astype(np.float32) / 255
            original[:, :, :3] *= original[:, :, 3:4]
            corrected[:, :, :3] *= corrected[:, :, 3:4]
            mixed = original * (1 - mask[:, :, None]) + corrected * mask[:, :, None]
            np.divide(mixed[:, :, :3], mixed[:, :, 3:4], out=mixed[:, :, :3], where=mixed[:, :, 3:4] > 1e-6)
            result = np.uint8(np.clip(mixed, 0, 1) * 255)
        Image.fromarray(result).save(folder / f'{i:04}.png')
    return {'boxMinimumInliersAfter128': min(counts[128:])}


def export():
    encode = runpy.run_path(str(Path(__file__).with_name('prepare-character-videos.py')))['encode_scene']
    for kind, crop in [('lion', (18, 0, 818, 624)), ('kitten', (138, 28, 796, 500))]:
        root = WORK / kind
        final = root / 'final'
        for i in range(240):
            Image.open(root / 'refined' / f'{i:04}.png').crop(crop).save(final / f'{i:04}.png')
        encode(final, Path('public/animations'), kind, 240)
        report = json.loads((root / 'report.json').read_text())
        report.update(width=crop[2] - crop[0], height=crop[3] - crop[1], crop=list(crop))
        report['restoration'] = {
            'tool': 'Built-in imagegen; localized transparent patches only',
            'patches': 'assets/animation-restoration/patches.json',
            'tracking': 'SIFT + RANSAC similarity; temporally smoothed anchors',
            'scope': 'Missing crown/star tips and toy/gift bottoms' if kind == 'lion' else 'Doll feet replaced by the tracked front gift wall before they emerge',
            'originalPixelsPreserved': 'Entire original scene inside the source camera boundary' if kind == 'lion' else 'All pixels outside the tracked lower gift wall window',
        }
        (root / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--export-only', action='store_true')
    args = parser.parse_args()
    if not args.export_only:
        report = {'lion': lion(), 'kitten': kitten()}
        Path('output/story-refinement/tracking.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)
    export()

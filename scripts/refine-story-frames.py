"""Tracked local repairs of the existing transparent video masters.
The source MP4s and original rgba/ frames are never overwritten. Restored
patches contain whole accessories, the gift base and the doll's box wall.
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


def head_attachment(frames):
    """Lock a single rigid crown to the original forehead contact footprint.

    The three blue settings remain readable when the gold tips are clipped.
    They locate the crown seat absolutely in every frame, avoiding accumulated
    face-feature drift after turns/blinks. Never use the changing tip outline.
    """
    centers, right_points, spans, areas = [], [], [], []
    for i, frame in enumerate(frames):
        r, g, b = [frame[:, :, c].astype(np.float32) for c in range(3)]
        mask = ((g - r > 5) & (b - r > 12) & (g > 65) & (frame[:, :, 3] > 200)).astype(np.uint8)
        mask[95:] = 0; mask[:, :250] = 0; mask[:, 650:] = 0
        _, _, stats, points = cv2.connectedComponentsWithStats(mask, 8)
        stones = [(int(stat[4]), point) for stat, point in zip(stats[1:], points[1:]) if stat[4] > 10]
        assert stones, f'Missing crown-seat settings: {i}'
        area, center = max(stones, key=lambda item: item[0])
        right = [item for item in stones if item[1][0] > center[0] + 15]
        left = [item for item in stones if item[1][0] < center[0] - 15]
        assert area >= 80 and right, f'Unreliable crown-seat footprint: {i}'
        right = max(right, key=lambda item: item[0])[1]
        centers.append(center); right_points.append(right); areas.append(area)
        spans.append(np.linalg.norm(right - max(left, key=lambda item: item[0])[1]) if left else np.nan)

    centers, right_points, spans = map(np.asarray, (centers, right_points, spans))
    known = np.flatnonzero(np.isfinite(spans))
    spans = np.interp(np.arange(len(frames)), known, spans[known])
    directions = right_points - centers
    raw_angle = np.unwrap(np.arctan2(directions[:, 1], directions[:, 0]))
    angle = gaussian_filter1d(raw_angle - raw_angle[0], 2)
    scale = np.exp(gaussian_filter1d(np.log(spans / spans[0]), 2))
    centers = gaussian_filter1d(centers, 2, axis=0)
    result = np.zeros((len(frames), 2, 3))
    result[:, 0, 0] = result[:, 1, 1] = scale * np.cos(angle)
    result[:, 1, 0] = scale * np.sin(angle)
    result[:, 0, 1] = -result[:, 1, 0]
    # One fixed crown-to-forehead offset; no integration or independent bounce.
    reference_center = np.asarray([477.2, 39.0])
    result[:, :, 2] = centers - np.einsum('nij,j->ni', result[:, :, :2], reference_center)
    seat = np.array([485., 65.])
    anchors = np.einsum('nij,j->ni', result, np.r_[seat, 1])
    np.savez(WORK / 'lion' / 'head-attachment.npz', matrices=result, markerAreas=areas,
             seat=seat, anchors=anchors, markerCenters=centers, angle=angle, scale=scale)
    return result, areas


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


def fade(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def window(matrix, size, polygon, feather=8):
    """Object-space replacement window; never splits a restored surface."""
    mask = np.zeros((624, 896), np.uint8)
    cv2.fillPoly(mask, [np.int32(polygon)], 1)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    mask = fade(distance / feather).astype(np.float32)
    transform = matrix.copy()
    transform[:, 2] -= matrix[:, :2] @ np.array([0, TOP])
    transform[1, 2] += TOP
    return cv2.warpAffine(mask, transform, size, flags=cv2.INTER_LINEAR)


def replace(base, layer, mask):
    # Interpolate premultiplied color AND coverage, clearing the old silhouette
    # where needed. Alpha-over would retain ghosts of the former cut contour.
    a, b = base.astype(np.float32) / 255, layer.astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    b[:, :, :3] *= b[:, :, 3:4]
    result = a * (1 - mask[:, :, None]) + b * mask[:, :, None]
    np.divide(result[:, :, :3], result[:, :, 3:4], out=result[:, :, :3], where=result[:, :, 3:4] > 1e-6)
    result = np.uint8(np.rint(np.clip(result, 0, 1) * 255))
    result[mask <= 1e-6] = base[mask <= 1e-6]
    return result


def lion():
    root = WORK / 'lion'
    frames = [read(root / 'rgba' / f'{i:04}.png') for i in range(240)]
    first, a = head_attachment(frames)
    # Crown-only tracks are used solely to erase the old gold. They never
    # position the replacement or change its fixed attachment to the head.
    old_first, _ = tracks(frames, 0, (395, 0, 550, 75), (330, 0, 620, 105))
    former, _ = tracks(frames, 239, (410, 0, 550, 72), (330, 0, 620, 105))
    cars, c = tracks(frames, 239, (175, 415, 355, 504), (120, 310, 440, 504))
    gifts, d = tracks(frames, 0, (100, 385, 315, 504), (75, 350, 370, 504))
    identity = np.float64([[1, 0, 0], [0, 1, 0]])
    crown_outline = [(394, 65), (420, 63), (429, 72), (440, 33), (469, 30), (479, 46),
                     (484, 22), (511, 22), (519, 58), (542, 87), (547, 110), (452, 149),
                     (430, 125), (414, 111), (395, 93)]
    folder = root / 'refined'; folder.mkdir(exist_ok=True)
    for i, frame in enumerate(frames):
        canvas = np.zeros((504 + TOP + BOTTOM, 896, 4), np.uint8)
        canvas[TOP:TOP + 504] = frame
        size = (896, canvas.shape[0])
        crown = patch('crown-whole', first[i], size)
        crown_mask = window(first[i], size, crown_outline, 5)
        # The AI source changes the crown's silhouette as the head turns.
        # Clear that former outline too, so no old squared-off point peeks out.
        crown_mask = np.maximum(crown_mask, window(former[i], size, [(411, 45), (549, 45), (549, 116), (438, 149), (411, 130)], 8))
        crown_mask = np.maximum(crown_mask, window(old_first[i], size, crown_outline, 5))
        canvas = replace(canvas, crown, crown_mask)
        star = patch('star-whole', identity, size)
        canvas = replace(canvas, star, window(identity, size, [(730, 20), (825, 20), (825, 115), (730, 115)], 8))
        # Blend the gift in a broad overlap on its paper panels. The former
        # camera edge is fully inside the replacement, with no hard row cut.
        gift = patch('gift-bottom', gifts[i], size)
        gift_mask = window(gifts[i], size, [(90, 520), (330, 520), (330, 624), (90, 624)], 10)
        yy, _ = np.mgrid[:canvas.shape[0], :896]
        gift_mask *= fade((yy - (TOP + 504 - 38)) / 30)
        canvas = replace(canvas, gift, gift_mask * (1 - fade((i - 72) / 24)))
        car = patch('car-whole', cars[i], size)
        car_mask = window(cars[i], size, [(165, 545), (171, 511), (204, 500), (211, 469), (235, 459), (304, 459), (331, 477), (342, 510), (363, 528), (363, 577), (340, 595), (235, 601), (170, 573)], 6)
        # The original jump owns frames 0–123. The repair is enabled only
        # once the car has landed and its own features reliably match. Earlier
        # gift-panel matches placed a second car underneath the airborne one.
        canvas = replace(canvas, car, car_mask * fade((i - 123) / 5))
        Image.fromarray(canvas).save(folder / f'{i:04}.png')
    return {'minimumCrownSeatMarkerArea': min(a), 'crownAttachment': 'Fixed rigid pose in head-local coordinates', 'carMinimumInliersAfter124': min(c[124:]), 'giftMinimumInliersBefore72': min(d[:72])}


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


def export(kinds):
    encode = runpy.run_path(str(Path(__file__).with_name('prepare-character-videos.py')))['encode_scene']
    for kind, crop in [('lion', (18, 0, 818, 624)), ('kitten', (138, 28, 796, 500))]:
        if kind not in kinds:
            continue
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
            'tracking': 'Absolute forehead contact footprint from crown-seat settings; rigid non-accumulating pose' if kind == 'lion' else 'SIFT + RANSAC similarity; temporally smoothed anchors',
            'scope': 'Whole crown, star and car; broad feathered gift-panel overlap' if kind == 'lion' else 'Doll feet replaced by the tracked front gift wall before they emerge',
            'originalPixelsPreserved': 'Original character outside accessory repair windows' if kind == 'lion' else 'All pixels outside the tracked lower gift wall window',
        }
        (root / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--export-only', action='store_true')
    parser.add_argument('--kind', choices=['lion', 'kitten'])
    args = parser.parse_args()
    kinds = [args.kind] if args.kind else ['lion', 'kitten']
    if not args.export_only:
        report = {kind: (lion if kind == 'lion' else kitten)() for kind in kinds}
        Path('output/story-refinement/tracking.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)
    export(kinds)

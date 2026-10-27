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


def verify_crown_attachment(root):
    """Measure rendered gold and reviewed absolute forehead contact points."""
    poses = np.load(root / 'head-attachment.npz')
    matrices = poses['matrices']
    sift = cv2.SIFT_create(nfeatures=2500, contrastThreshold=.008)
    first = np.asarray(Image.open(root / 'refined/0000.png'))
    mask = np.zeros(first.shape[:2], np.uint8)
    mask[14:136, 390:552] = 255
    keypoints, description = sift.detectAndCompute(cv2.cvtColor(first[:, :, :3], cv2.COLOR_RGB2GRAY), mask)

    def padded(matrix):
        result = np.eye(3); result[:2] = matrix
        result[1, 2] += 64
        result[:2, 2] -= result[:2, :2] @ np.array([0, 64])
        return result

    inverse = np.linalg.inv(padded(matrices[0]))
    errors, counts = [], []
    for i, matrix in enumerate(matrices):
        frame = np.asarray(Image.open(root / 'refined' / f'{i:04}.png'))
        relative = (padded(matrix) @ inverse)[:2]
        region = cv2.warpAffine(mask, relative, (896, 624))
        points, desc = sift.detectAndCompute(cv2.cvtColor(frame[:, :, :3], cv2.COLOR_RGB2GRAY), region)
        good = [m for m, n in cv2.BFMatcher().knnMatch(description, desc, k=2) if m.distance < .72 * n.distance]
        a = np.float32([keypoints[m.queryIdx].pt for m in good])
        b = np.float32([points[m.trainIdx].pt for m in good])
        _, inliers = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=1)
        assert inliers is not None and inliers.sum() >= 24, f'Crown no longer readable: {i}'
        predicted = cv2.transform(a[:, None, :], relative)[:, 0, :]
        error = float(np.median(np.linalg.norm(predicted[inliers[:, 0] > 0] - b[inliers[:, 0] > 0], axis=1)))
        assert error < .75, f'Crown slides relative to head: {i}: {error}px'
        errors.append(error); counts.append(int(inliers.sum()))
    maximum_turn = float(np.degrees(np.abs(np.diff(poses['angle']))).max())
    assert maximum_turn < 3, f'Abrupt crown/head rotation: {maximum_turn}'
    # Reviewed in the original source poses, including the lean, return and
    # post-blink rest. Relative-only tests missed accumulated lateral drift.
    contacts = {0: (485, 65), 48: (437, 60), 72: (326, 93), 108: (501, 46),
                132: (471, 66), 180: (470, 66), 239: (471, 63)}
    contact_error = max(float(np.linalg.norm(poses['anchors'][i] - point)) for i, point in contacts.items())
    assert contact_error < 4, f'Crown slipped off reviewed forehead contact: {contact_error}px'
    return {'maximumRenderedCrownMedianDriftPx': max(errors), 'minimumRenderedCrownFeatureMatches': min(counts),
            'maximumReviewedForeheadContactErrorPx': contact_error,
            'minimumCrownSeatMarkerAreaPx': int(poses['markerAreas'].min()), 'maximumAdjacentRotationDegrees': maximum_turn}


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
    refinement = {}
    if info.get('restoration') and kind == 'lion':
        star_steps = []
        for i, path in enumerate(frames):
            alpha = np.asarray(Image.open(path))[:, :, 3]
            assert not alpha[0].any() and not alpha[-1].any(), f'Restored object touches camera boundary: {i}'
            original = np.asarray(Image.open(root / 'rgba' / path.name))
            restored = np.asarray(Image.open(root / 'refined' / path.name))
            # The restored accessories now overlap their old contours. The
            # central face/chest must remain the original animation throughout.
            assert np.array_equal(original[190:385, 380:700], restored[254:449, 380:700]), f'Lion face/chest changed: {i}'
            if 96 <= i <= 123:
                assert np.array_equal(original[250:504, 120:370], restored[314:568, 120:370]), f'Extra car layer during original jump: {i}'
            valid = (restored[63, 730:825, 3] > 248) & (restored[64, 730:825, 3] > 248)
            step = float(np.median(np.abs(restored[64, 730:825, :3][valid].astype(float) - restored[63, 730:825, :3][valid])))
            star_steps.append(step)
            assert step < 8, f'Horizontal color seam through star: {i}: {step}'
        refinement = {'allFramesClearTopAndBottom': True, 'originalFaceAndChestPixelsPreserved': True,
                      'originalSingleCarJumpPreservedUntilLanding': True,
                      'accessoriesRenderedWholeAcrossFormerCameraBoundary': True,
                      'maximumStarMedianColorStepAtFormerJoin': max(star_steps)}
        refinement['rigidCrownAttachment'] = verify_crown_attachment(root)
    elif info.get('restoration') and kind == 'kitten':
        for i in range(176, 240):
            area = np.asarray(Image.open(root / 'refined' / f'{i:04}.png'))[435:480, 540:625]
            rgb = area[:, :, :3].astype(float)
            # The old ivory stockings crossed this solid pink front panel.
            stockings = (rgb.min(2) > 175) & (rgb.max(2) - rgb.min(2) < 30) & (area[:, :, 3] > 200)
            assert stockings.sum() < 10, f'Protruding doll stockings remain: {i}'
        refinement = {'noIvoryStockingsAcrossFinalGiftWall': True}
    info['alphaVerification'] = {
        'restorationChecks': refinement or None,
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

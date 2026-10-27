// Native macOS HEVC-with-alpha encoder. Input PNGs retain their alpha channel.
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import VideoToolbox

let args = CommandLine.arguments
 guard args.count == 4 else { fatalError("Usage: encode-character-alpha frames-directory output.mov fps") }
let folder = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
let fps = Int32(args[3])!
let files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.range(of: #"^\d{4}\.png$"#, options: .regularExpression) != nil }.sorted { $0.lastPathComponent < $1.lastPathComponent }
guard let first = files.first, let imageSource = CGImageSourceCreateWithURL(first as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else { fatalError("Missing input PNG frames") }
let width = image.width, height = image.height
try? FileManager.default.removeItem(at: output)
let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
    AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 1_500_000, AVVideoExpectedSourceFrameRateKey: fps, kVTCompressionPropertyKey_TargetQualityForAlpha as String: 0.8]
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true, kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
guard writer.canAdd(input) else { fatalError("HEVC-with-alpha encoder unavailable") }
writer.add(input)
guard writer.startWriting() else { fatalError("Cannot start encoder: \(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)
for (i, file) in files.enumerated() {
    while !input.isReadyForMoreMediaData {
        if writer.status == .failed { fatalError("Encoding failed: \(String(describing: writer.error))") }
        Thread.sleep(forTimeInterval: 0.002)
    }
    try autoreleasepool {
        guard let source = CGImageSourceCreateWithURL(file as CFURL, nil), let frame = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw NSError(domain: "InvalidPNG", code: i) }
        var pixelBuffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pixelBuffer)
        let buffer = pixelBuffer!
        CVPixelBufferLockBaseAddress(buffer, [])
        let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue)!
        context.clear(CGRect(x: 0, y: 0, width: width, height: height))
        context.draw(frame, in: CGRect(x: 0, y: 0, width: width, height: height))
        CVPixelBufferUnlockBaseAddress(buffer, [])
        guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(i), timescale: fps)) else { throw NSError(domain: "AppendFailed", code: i) }
    }
}
input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: Int64(files.count), timescale: fps))
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else { fatalError("Encoding failed: \(String(describing: writer.error))") }
print("Encoded \(files.count) alpha frames, \(width)×\(height): \(output.lastPathComponent)")

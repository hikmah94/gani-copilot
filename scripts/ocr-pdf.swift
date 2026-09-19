import Foundation
import PDFKit
import Vision
import AppKit

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: swift ocr-pdf.swift input.pdf output.txt\n", stderr)
  exit(2)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: input) else {
  fputs("Unable to open PDF\n", stderr)
  exit(1)
}

var output = ""
for index in 0..<document.pageCount {
  autoreleasepool {
    guard let page = document.page(at: index) else { return }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 1.6
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    guard let image = context.makeImage() else { return }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-NG", "en-US"]
    try? VNImageRequestHandler(cgImage: image).perform([request])
    let lines = (request.results ?? []).sorted {
      if abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.01 { return $0.boundingBox.midY > $1.boundingBox.midY }
      return $0.boundingBox.minX < $1.boundingBox.minX
    }.compactMap { $0.topCandidates(1).first?.string }
    output += "\n\n=== PAGE \(index + 1) ===\n" + lines.joined(separator: "\n")
    fputs("OCR page \(index + 1)/\(document.pageCount)\n", stderr)
  }
}

try output.write(toFile: CommandLine.arguments[2], atomically: true, encoding: .utf8)

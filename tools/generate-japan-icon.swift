import AppKit
let size = 1024
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 3, hasAlpha: false, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor(calibratedRed: 0.96, green: 0.95, blue: 0.92, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: size, height: size)).fill()
NSColor(calibratedRed: 0.74, green: 0.13, blue: 0.18, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 525, y: 593, width: 282, height: 282)).fill()
let notebook = NSBezierPath(roundedRect: NSRect(x: 230, y: 160, width: 506, height: 618), xRadius: 36, yRadius: 36)
NSColor(calibratedRed: 0.08, green: 0.14, blue: 0.21, alpha: 1).setFill()
notebook.fill()
NSColor.white.setFill()
NSBezierPath(roundedRect: NSRect(x: 278, y: 200, width: 414, height: 529), xRadius: 18, yRadius: 18).fill()
NSColor(calibratedRed: 0.74, green: 0.13, blue: 0.18, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 403, y: 477, width: 166, height: 166)).fill()
NSColor(calibratedRed: 0.08, green: 0.14, blue: 0.21, alpha: 1).setStroke()
for y in [361.0, 297.0] {
    let line = NSBezierPath()
    line.move(to: NSPoint(x: 359, y: y)); line.line(to: NSPoint(x: 610, y: y))
    line.lineWidth = 20; line.lineCapStyle = .round; line.stroke()
}
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))

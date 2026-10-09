import AppKit
import ImageIO
import UniformTypeIdentifiers
let size = 1024
// AppKit cannot draw into a packed 24-bit RGB bitmap. Use an opaque 32-bit
// Core Graphics surface, then export its image without an alpha channel.
let context = CGContext(data: nil, width: size, height: size,
                        bitsPerComponent: 8, bytesPerRow: size * 4,
                        space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
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
let image = context.makeImage()!
let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, image, nil)
precondition(CGImageDestinationFinalize(destination), "Icon export failed")

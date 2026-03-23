import SwiftUI
import SafariServices

/// A wrapper for SFSafariViewController that allows us to present a
/// Safari view inside SwiftUI.  Use `.sheet(item:)` with a URL
/// conforming to `Identifiable` to present this view.
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        let controller = SFSafariViewController(url: url, configuration: config)
        return controller
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
        // Nothing to update.
    }
}
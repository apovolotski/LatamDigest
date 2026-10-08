# Latam Digest

Native SwiftUI news and monitoring workspace for iOS 17 and later. The app reads public country/category feeds and keeps watchlists, reading lists, notes, dossiers, and snapshots on the device.

## Japanese edition

Open `JapanDigest.xcodeproj` for **日本ニュース手帖**, the Japanese news reading and notebook app. See [Japanese edition guide](JAPAN-EDITION.md) for source selection, Japanese interface, tests, and release preparation.

## Open and build

Open `LatamDigest.xcodeproj` and select the `LatamDigest` scheme. Choose an installed iPhone or iPad simulator. Signing uses the existing project team for device builds.

```sh
xcodebuild -project LatamDigest.xcodeproj -scheme LatamDigest -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -project LatamDigest.xcodeproj -scheme LatamDigest -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

Keep DerivedData and archives outside cloud-synced folders if codesigning reports resource forks or Finder information.

## Version 1.1

- Search headlines, snippets, and sources; accents and letter case do not affect matches.
- Access saved stories and recent reading from the Library button on the dashboard.
- Pull to refresh country feeds and the dashboard; cached copies show their fetch time.
- Requests follow view lifecycles and cannot overwrite a newer feed selection.
- Article links are limited to HTTP/HTTPS, duplicates are removed, and identity survives feed regeneration.
- Daily notifications are localized reminders. They do not pretend that headlines fetched during setup are new every day.
- Reminder opt-out and reading-history deletion are available in Settings.
- A privacy manifest declares local UserDefaults access; the client contains no AI API credentials or direct AI calls.

## Data pipeline

The default feed is `https://raw.githubusercontent.com/apovolotski/LatamDigest/main/docs/api`.
`LATAM_BACKEND_URL` can select a different HTTPS backend. Static JSON routing supports the default host and GitHub Pages; custom live backends expose `/countries/:code/top`, `/latest`, and `/category/:category`.

```sh
cd backend
npm ci
npm run check
npm test
npm audit --omit=dev
npm run generate:static
```

Use Node.js 24 or later. The scheduled GitHub Actions workflow checks the pipeline before generating feeds. Failed requests preserve the prior feed for up to seven days and retain its original timestamp in the manifest; a total outage fails the workflow rather than publishing an empty replacement. The app's last-checked time describes its fetch, not the publication date of every story.

## Credentials

The original conversation and exported source exposed an OpenAI API key. Revoke that key in the owning OpenAI project. Removing it from files does not revoke it or remove conversation copies.

Never place AI credentials in an iOS environment, asset, plist, source file, or public feed. The active static RSS pipeline does not need an OpenAI key. If enabling the optional AI worker, configure a fresh key only in the backend host's secret store; public requests only read its cache and cannot request billable generation. See `backend/README.md`.

App Store Connect credentials, signing files, archives, and IPA files are excluded from Git. No source-history rewrite was required: a credential scan found no matching OpenAI key in the repository's available history.

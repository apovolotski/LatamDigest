# Google Play release evidence

- App: Latam Digest
- Package: com.apovolotski.latamdigest (availability confirmed in Play Console)
- Version: 1.0 / code 1
- Pricing proposal: free; no IAP, ads, subscriptions or login
- Category: News & Magazines
- Default listing: English (United Kingdom)
- Privacy: https://apovolotski.github.io/LatamDigest/privacy.html
- Support: https://apovolotski.github.io/LatamDigest/support.html
- Public support email already published by the developer: alexander.povolotski@gmail.com

## Binary data inventory

Internet access is used to download public news JSON from GitHub. That host receives ordinary network metadata including IP and requested feed. Research, notes, tasks, dossiers, history and preferences remain in app-private storage. Android backup is disabled. The app has no analytics, advertising, account, location, camera, microphone or contacts APIs. User-initiated sharing uses Android's share sheet; opening sources launches the user's browser and its own privacy rules apply. POST_NOTIFICATIONS is optional for local reading reminders. BOOT_COMPLETED restores only a reminder already enabled by the user.

Do not claim that third-party feed hosts receive no data. Review Google's current data-safety definitions against this inventory before submitting. Content is news from original publishers, may include crime/conflict, and is not directed to children. Complete the actual content-rating questionnaire truthfully; do not invent a rating.

## Submission gates

- Unit tests, lint and device smoke tests pass; screenshots reflect the actual final binary.
- Signed AAB verified and upload key retained securely outside Git.
- Updated privacy page deployed and checked.
- Play app-signing terms and export-compliance certification require developer confirmation at the final creation step.
- Any account/device verification, tester opt-in period, production eligibility and Google review remain external gates; app creation/upload does not mean public availability.

No app has been created or submitted yet.

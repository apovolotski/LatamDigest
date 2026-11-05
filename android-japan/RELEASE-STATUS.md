# Android release status — 日本ニュース手帖

Verified November 5, 2026.

## Google Play submission

Version 1.0, version code 1, package `com.apovolotski.japandigest`, was uploaded successfully and submitted to the **Closed testing – Alpha** track. Publishing overview shows **Changes in review** after the automated quick checks finished. Google states: “Your changes are now in review.” Submission ID **1**, submitted November 5, 2026 at **3:19 pm America/Toronto**. This is a test-release submission, not an approved or public production release. Managed publishing is off, so approved changes can publish to the configured closed test automatically.

Verified developer: **Alexander Povolotskiy**, Google Play account 5217672764285117070. App ID 4975438358362192066. Closed-test countries: Japan and Canada. The Japanese store listing includes the original icon, feature graphic and three actual Android screenshots (news, notebooks and topics).

Console: https://play.google.com/console/u/0/developers/5217672764285117070/app/4975438358362192066/publishing

An unused internal-testing draft also contains version 1. It was not rolled out. Volunteers should use the closed test below; internal testing does not count toward production eligibility.

## Share these tester instructions

1. Join the public enrollment group using the Google account used for Google Play: https://groups.google.com/g/nihon-news-notebook-android-testers/about
2. Using the same account, opt in: https://play.google.com/apps/testing/com.apovolotski.japandigest
3. Install from Google Play after Google approves the closed-test release. Downloads may be unavailable while review is pending. A Japan or Canada Play account and Android 8.0 or newer are required.
4. Use the app and send feedback through the support page. Remain opted in throughout the required test period.

The group is configured for anyone to join. Member lists, conversations and posting are restricted to owners; no volunteer emails were collected, invited or messaged. Creating the group does not create test participants. Google requires **at least 12 testers continuously opted in for 14 days**, followed by a production-access application. Production eligibility and approval are not yet achieved; there is no guaranteed release date.

## Validation

Successful build: https://github.com/apovolotski/LatamDigest/actions/runs/42093164869

Tested source: `7ba7762651a0d0721333a09adbbe45a9d0de56b4`. The merge into main at `8d11d3e7e5df1c1ec7a2ea31729050468671f83e` has identical Android app and CI source.

- 11 tests passed: eight feed/security/search tests, two storage tests and one Android 16 emulator integration test.
- The emulator test loaded real Japanese headlines, navigated all four tabs, created a Japanese notebook and verified persistence after activity recreation.
- Debug and release builds succeeded; Android lint reported no errors.
- Release AAB and APK signatures verified. Native libraries and APK alignment checked for 16 KB page compatibility.
- Android 8.0 minimum, Android 16 target, Japanese app label, HTTPS-only and explicit backup/device-transfer exclusions verified in the compiled manifest.

Local emulator boot could not complete under concurrent Mac resource load. Device testing succeeded in GitHub CI; no physical-device testing is claimed. Google reports a non-blocking warning about missing native debug symbols for bundled third-party libraries; the Java/Kotlin obfuscation mapping is attached.

## Release files and signing

Signed bundle: `JapanDigest-Android-1.0.aab`, SHA-256 `a96fa0c70f6d603b955950451cd7c32a6223e145f2e822ec3727380dcf1facac`.

Signed preview APK: `JapanDigest-Android-1.0.apk`, SHA-256 `442108efa13a29e9edfe1a16493adb29977f91bd477859b691a658c963a0a73f`.

The upload key is stored privately outside the repository at `~/.local/share/japan-digest-signing/`. Back up that directory securely; do not publish it. Google manages the separate app-distribution signing key. The preview APK uses the upload key, so moving from a directly installed preview to Google Play may require uninstalling it, which deletes local notebooks and saved data. Prefer the Play test installation.

## Store declarations and privacy

The app has no ads, purchases, analytics, account registration or advertising ID. News aggregation is declared under the verified individual developer entity. Target audience: 18 and older. IARC assigned ESRB Everyone 10+ and PEGI Parental guidance. These content ratings are distinct from the intended audience.

The Data safety declaration conservatively discloses required app-interaction requests to Google for news functionality as collected/shared. Selected publisher RSS requests and ordinary connection information reach Google; search text, reading history, notebooks and notes stay on the device. No deletion request for Google's connection logs is promised. HTTPS is used. The owner does not operate a collection backend.

Privacy (verified live): https://apovolotski.github.io/LatamDigest/japan/android-privacy.html

Support (verified live): https://apovolotski.github.io/LatamDigest/japan/android-support.html

The app is a free personal, non-commercial RSS reader. No publisher affiliation, license or commercial redistribution rights are claimed. Google/publisher terms continue to apply. No article bodies, descriptions, photos or publisher logos are copied into the app.

No OpenAI API key is used by this Android edition. The previously exposed key remains compromised and must be revoked/rotated by its owner; this release does not establish that it has been revoked. Future AI features require a backend-held secret.

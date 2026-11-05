# 日本ニュース手帖 — Android

Native Kotlin and Jetpack Compose edition of the Japanese iOS app. Application ID: `com.apovolotski.japandigest`. Version 1.0 (1), Android 8.0/API 26 minimum, Android 16/API 36 target. Japanese UI is used independently of the device language. The original iOS projects are retained.

## Features

- Six Japanese publishers, on-device Google News RSS fetching, source filtering, normalized full/half-width search, ten keyword topics, explicit unavailable/cache indicators.
- Headline/source/date/link only; no copied article bodies, descriptions, images, logos, AI keys, ads, analytics, purchases or account registration.
- Local saved headlines (500), reading history (200), personal notebooks (100, each 100 article links), notes, conclusions, next actions, assessment and optional review date.
- Atomic private storage; corrupt/unsupported state is preserved read-only instead of silently overwritten. Backups and cloud sync are disabled. Offline feed cache expires after seven days; saved headlines and notebooks remain available locally.
- Optional inexact daily local reminder, disabled by default, runtime notification permission, reboot/timezone rescheduling, no exact-alarm permission.
- HTTPS-only networking, bounded downloads and cache, restrictive link/domain checks, UTF-8-only RSS, DTD/entity rejection, XML depth/field limits, cancellation and date validation.

## Build

Install JDK 17 and Android SDK platform 36/build tools 35.0.0. Set `ANDROID_HOME` and `JAVA_HOME` or configure Android Studio. Then:

```sh
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
./gradlew :app:connectedDebugAndroidTest
```

To sign the Play bundle, set `JAPAN_UPLOAD_KEYSTORE`, `JAPAN_UPLOAD_STORE_PASSWORD`, `JAPAN_UPLOAD_KEY_ALIAS` and `JAPAN_UPLOAD_KEY_PASSWORD` in the process environment, outside Git. Run `./gradlew :app:bundleRelease :app:assembleRelease`. No debug-key fallback is used for release. Keep the upload keystore and password in private backups; Google Play manages the separate distribution key.

## Google Play

Verified developer account: Alexander Povolotskiy. The app was created with user-approved Play signing terms on November 5, 2026. App ID: `4975438358362192066`. Japanese primary language, free app. Console: https://play.google.com/console/u/0/developers/5217672764285117070/app/4975438358362192066/app-dashboard

Google explicitly requires a closed testing release with at least 12 eligible testers continuously opted in for 14 days before this app can apply for production access. Creating an app or a testing link does not satisfy that requirement. Internal testing and internal app sharing do not count toward the required closed test. Production/public publication has not occurred.

Japanese listing copy and original store artwork are in `store/ja-JP/`. Use actual Android captures for phone/tablet screenshots; iOS screenshots must not be reused as Android evidence.

Android privacy: https://apovolotski.github.io/LatamDigest/japan/android-privacy.html

Android support: https://apovolotski.github.io/LatamDigest/japan/android-support.html

RSS use is limited to personal, non-commercial reading in accordance with the existing documented feed-use basis at `../release/JapanDigest-content-use.md`. No separate publisher license or commercial redistribution rights are claimed.

Build, test, upload and sharing results will be recorded in `RELEASE-STATUS.md` after verification.

# Latam Digest for Android

Native Java Android client, application ID `com.apovolotski.latamdigest`, minimum Android 8 (API 26), target Android 16 (API 36). Uses the same public feed service as iOS. Research and preferences are device-local; no account, ads, tracking SDK, or backend write API.

## Build

Install JDK 17 and Android SDK platform 36. Set `ANDROID_HOME` or an untracked `local.properties` with `sdk.dir`. Then run:

```
./gradlew testDebugUnitTest lintDebug assembleDebug
./gradlew connectedDebugAndroidTest
./gradlew bundleRelease
```

Release signing uses `LATAM_UPLOAD_KEYSTORE`, `LATAM_UPLOAD_STORE_PASSWORD`, `LATAM_UPLOAD_KEY_ALIAS`, and `LATAM_UPLOAD_KEY_PASSWORD`. Never commit keys, passwords, `local.properties`, or signed release credentials. Use a separately backed-up upload key and Google Play app signing.

## Behavior

Feeds require safe HTTP(S) article URLs, nonempty titles and publishers, original article dates within 14 days and a manifest feed timestamp younger than 24 hours. Offline reads never renew timestamps. A manifest recheck rejects refresh races; cache entries are only written after validation. Live displays recheck age when resumed and every minute. Saved records remain explicitly historical.

The Android UI supports country/category search, saved stories and notes, dossiers with conclusions and recommendations, topic watchlists and monitoring plans, tasks, reading snapshots, source/dossier sharing, local daily reminders and local-data deletion. Source language is preserved. Version 1 includes English, Spanish and Portuguese navigation and shared UI labels; explanatory text currently falls back to English. Regional signals mirror the iOS keyword/recency method and are explicitly labelled as reading aids.  no cross-device data migration or sync is claimed.

Store metadata lives in `store-listing/`. Store declarations must match the final binary and published privacy policy. Publication requires the developer's Play terms/export declarations, account eligibility, any required closed testing, and Google's review.

# 日本ニュース手帖 — Japanese edition

日本のニュースを、自分の手帖に。

Open `JapanDigest.xcodeproj` and select the `JapanDigest` scheme. The application display name is **日本ニュース手帖**. Its bundle identifier is `com.apovolotski.JapanDigest`, version 1.0 (1), with iOS 17 or later support. `JAPAN_EDITION` selects the Japanese product from shared Swift sources. The original Latam Digest project retains its app identity and original screens.

## Japanese reading experience

- **新着**: Japanese headlines, newest first, with publisher filtering, search, pull to refresh, and explicit cache/unavailable-source indicators.
- **テーマ**: Ten Japanese keyword categories: politics/diplomacy, economy, business, society/disaster prevention, technology, culture, sports, health, energy, and work. Classification is an aid to browsing, not an editorial or AI assessment.
- **ライブラリ**: Locally saved headlines and reading history; full-width and half-width searches match.
- **手帖**: Personal notebooks with notes, conclusions, review dates, and linked source articles. An article can create a notebook or be added to an existing notebook.
- **設定**: Choose publishers, opt into a single daily local reminder, choose its local time, and clear reading history.

The Japanese interface remains Japanese when the device language is English. Dates, relative times, reminders, and the reachable shared notebook/library screens use Japanese. No account, AI key, or backend deployment is required.

## News sources and delivery

The source catalog is explicitly limited to NHKニュース (`news.web.nhk`), 朝日新聞 (`asahi.com`), 毎日新聞 (`mainichi.jp`), 読売新聞 (`yomiuri.co.jp`), 日本経済新聞 (`nikkei.com`), and 47NEWS (`47news.jp`). 47NEWS contains reporting from Kyodo and regional newspapers; it is labeled 47NEWS rather than misrepresenting every article as Kyodo content.

The device requests public Google News RSS searches with `hl=ja`, `gl=JP`, `ceid=JP:ja`, a source-domain restriction, and a seven-day search window. The parser checks publisher-domain attribution, Japanese characters in the headline, publication dates, safe HTTPS Google News article links, stable identity, duplicates, feed format, and size. Foreign-language results without Japanese characters and results attributed outside the chosen publisher are discarded. Public RSS availability is not a contractual API guarantee and may change.

Only feed headlines, source names, publication dates, and links are retained on the device. No article body, description, logo, image, translation, AI summary, or publisher text corpus is downloaded or redistributed in Git. Opening an article uses the Google News link in Safari and redirects to publisher coverage. Subscription requirements and publisher controls remain in place. News views explain the delivery mechanism and lack of affiliation.

News fetches use HTTPS, bounded request/resource timeouts, transient retries, cancellation, and bounded disk cache fallback. Offline access covers cached headline information and local notebooks; complete articles need a connection. Feed copies expire after seven days. A consolidated daily reminder avoids sending one notification per publisher.

## Build and tests

```bash
xcodebuild test -project JapanDigest.xcodeproj -scheme JapanDigest \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -derivedDataPath /tmp/japan-digest-build CODE_SIGNING_ALLOWED=NO
```

`JapanDigestTests` validates language/identity, queries, attribution, Japanese metadata, stable IDs/deduplication, unsafe links, old/future dates, malformed XML/entities, topic/search behavior, Japanese reminder content, offline cache isolation, and cancellation. `JapanDigestUITests` exercises Japanese onboarding, all four tabs, and reminder defaults on an English-locale simulator. Original Latam tests remain independent.

The icon is original notebook geometry in crimson, ink, and warm white. Recreate it with:

```bash
swift tools/generate-japan-icon.swift LatamDigest/Assets.xcassets/JapanIcon.appiconset/JapanIcon.png
```

## App Store preparation

This is a separate app identity, not a replacement binary for the submitted Latam Digest 1.1 release. It needs its own App Store Connect app record, Japanese primary language, suitable news category, Japanese screenshots/support/privacy URLs, content-rights declarations, current age rating, signing registration, and review submission before public release. Publisher/aggregator usage permissions must be established for the intended distribution; accessing a public feed is not a representation that a distribution license has been obtained. No publisher permission or new App Store listing has been represented as verified.

A Japanese metadata draft is in `release/JapanDigest-AppStore-ja.txt`. Physical-device behavior and publisher paywall outcomes require separate verification before release.

## Verified on October 8, 2026

- Xcode 27 simulator build and unsigned device Release archive succeeded; archive identity, Japanese display name/development region, iOS 17 minimum, privacy manifest, and encryption flag were checked.
- 10 Japanese unit/regression tests and 1 Japanese navigation UI test passed on iPhone 17 Pro, iOS 26.5, with an English OS locale.
- All 11 original Latam unit/regression tests passed after the shared code changes.
- The running Japanese app fetched and accepted 60 Japanese headlines per source, 360 total, with publisher attribution and no copied descriptions.
- Simulator interaction verified NHK publisher filtering, article details, and creating a notebook with the selected live article attached.
- A source scan found no matching OpenAI credential.
- The device archive is unsigned. No Japanese App Store app record, signing registration, upload, or review submission was performed in this task.

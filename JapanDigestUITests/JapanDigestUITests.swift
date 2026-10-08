import XCTest

final class JapanDigestUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor func testJapaneseOnboardingNavigationAndSettings() {
        let app = XCUIApplication()
        // Japanese is the default even when the OS runs in English. Keep this run independent of persistent state.
        app.launchArguments = ["--japan-ui-test-reset", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.staticTexts["日本ニュース手帖"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.switches["NHKニュース"].exists)
        capture(app, name: "01-Japanese-onboarding")
        for _ in 0..<5 {
            if app.buttons["japan-start"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.buttons["japan-start"].waitForExistence(timeout: 5))
        app.buttons["japan-start"].tap()
        XCTAssertTrue(app.buttons["新着"].firstMatch.waitForExistence(timeout: 10))
        let loading = app.staticTexts["ニュースを取得中…"]
        if loading.exists {
            let finished = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: loading)
            _ = XCTWaiter.wait(for: [finished], timeout: 60)
        }
        capture(app, name: "02-Japanese-news")
        app.buttons["japan-settings"].tap()
        for _ in 0..<5 {
            if app.switches["毎日の通知"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.switches["毎日の通知"].exists)
        XCTAssertEqual(app.switches["毎日の通知"].value as? String, "0")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["テーマ"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["政治・外交"].exists)
        capture(app, name: "03-Japanese-topics")
        app.buttons["ライブラリ"].firstMatch.tap()
        XCTAssertTrue(app.buttons["保存済み"].exists)
        app.buttons["閲覧履歴"].tap()
        XCTAssertTrue(app.searchFields.firstMatch.exists)
        app.buttons["手帖"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["手帖がありません"].exists)
        let proof = XCTAttachment(screenshot: app.screenshot())
        proof.name = "Japanese notebook"
        proof.lifetime = .keepAlways
        add(proof)
    }

    @MainActor private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

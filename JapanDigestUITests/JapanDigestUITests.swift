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
        for _ in 0..<5 {
            if app.buttons["japan-start"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.buttons["japan-start"].waitForExistence(timeout: 5))
        app.buttons["japan-start"].tap()
        XCTAssertTrue(app.tabBars.buttons["新着"].waitForExistence(timeout: 10))
        app.buttons["japan-settings"].tap()
        for _ in 0..<5 {
            if app.switches["毎日の通知"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.switches["毎日の通知"].exists)
        XCTAssertEqual(app.switches["毎日の通知"].value as? String, "0")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.tabBars.buttons["テーマ"].tap()
        XCTAssertTrue(app.staticTexts["政治・外交"].exists)
        app.tabBars.buttons["ライブラリ"].tap()
        XCTAssertTrue(app.buttons["保存済み"].exists)
        app.buttons["閲覧履歴"].tap()
        XCTAssertTrue(app.searchFields.firstMatch.exists)
        app.tabBars.buttons["手帖"].tap()
        XCTAssertTrue(app.staticTexts["手帖がありません"].exists)
        let proof = XCTAttachment(screenshot: app.screenshot())
        proof.name = "Japanese notebook"
        proof.lifetime = .keepAlways
        add(proof)
    }
}

import XCTest

final class LatamDigestUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    func testLibraryAndSettingsNavigation() throws {
        let app = XCUIApplication()
        // Argument-domain preferences are temporary and do not overwrite persisted user settings.
        app.launchArguments = ["-hasCompletedOnboarding", "YES", "-preferredLanguage", "en", "-selectedCountries", "MX,BR", "-dailyRemindersEnabled", "NO"]
        app.launch()
        XCTAssertTrue(app.buttons["app-settings"].waitForExistence(timeout: 15))
        app.buttons["app-settings"].tap()
        for _ in 0..<8 {
            if app.switches["Daily reminders"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.switches["Daily reminders"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.switches["Daily reminders"].value as? String, "0")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["open-reading-library"].tap()
        XCTAssertTrue(app.descendants(matching: .any)["reading-library"].exists)
        XCTAssertTrue(app.buttons["Saved"].exists)
        app.buttons["Recently read"].tap()
        XCTAssertTrue(app.searchFields.firstMatch.exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Reading library"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}

package com.apovolotski.latamdigest;

import static org.junit.Assert.*;

import java.time.Instant;
import org.junit.Test;

public class FeedRulesTest {
  @Test
  public void rejectsExecutableAndCredentialUrls() {
    assertFalse(FeedRules.safeUrl("javascript:alert(1)"));
    assertFalse(FeedRules.safeUrl("https://user:secret@example.com"));
    assertFalse(FeedRules.safeUrl("file:///private/a"));
    assertTrue(FeedRules.safeUrl("https://example.com/report"));
  }

  @Test
  public void cacheExpiresWithoutRenewal() {
    long now = Instant.parse("2026-11-05T14:28:00Z").toEpochMilli();
    assertFalse(FeedRules.currentFeed("2026-11-04T14:28:00Z", now));
    assertTrue(FeedRules.currentFeed("2026-11-04T14:29:00Z", now));
    assertFalse(FeedRules.currentFeed("broken", now));
  }

  @Test
  public void articleDatesRetainedAndBounded() {
    long now = Instant.parse("2026-11-05T14:28:00Z").toEpochMilli();
    assertFalse(FeedRules.currentArticle("2026-10-21T14:28:00Z", now));
    assertFalse(FeedRules.currentArticle("2026-12-01T00:00:00Z", now));
    assertTrue(FeedRules.currentArticle("2026-11-03T00:00:00Z", now));
  }

  @Test
  public void accentInsensitiveSearch() {
    assertEquals("eleccion peru", FeedRules.searchable("ELECCIÓN Perú"));
  }
}

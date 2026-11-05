package com.apovolotski.latamdigest;

import static org.junit.Assert.*;

import java.time.Instant;
import java.util.*;
import org.json.*;
import org.junit.Test;

public class NewsClientTest {
  final long now = Instant.parse("2026-11-05T12:00:00Z").toEpochMilli();

  static class Memory implements NewsClient.Cache {
    final Map<String, String> values = new HashMap<>();

    public String read(String k) {
      return values.get(k);
    }

    public void write(String k, String v) {
      values.put(k, v);
    }
  }

  String manifest(String timestamp) throws Exception {
    return new JSONObject()
        .put(
            "countries",
            new JSONArray()
                .put(
                    new JSONObject()
                        .put("id", "MX")
                        .put(
                            "feeds",
                            new JSONObject()
                                .put(
                                    "top",
                                    new JSONObject()
                                        .put("count", 1)
                                        .put("updatedAt", timestamp)
                                        .put("stale", false)))))
        .toString();
  }

  String articles(String url, String time) throws Exception {
    return new JSONArray()
        .put(
            new JSONObject()
                .put("url", url)
                .put("title", "A current story")
                .put("sourceName", "Publisher")
                .put("publishedAt", time))
        .toString();
  }

  NewsClient.Transport online(String time) {
    return path ->
        path.equals("manifest.json")
            ? manifest(time)
            : articles("https://example.com/story", "2026-11-05T10:00:00Z");
  }

  @Test
  public void offlineCopyDoesNotRenewPublicationOrCheckedTime() throws Exception {
    Memory m = new Memory();
    NewsClient.Result first =
        new NewsClient(m, online("2026-11-05T11:00:00Z"), () -> now).load("MX", "top");
    String bytes = m.read("feed-MX-top");
    NewsClient.Result offline =
        new NewsClient(
                m,
                p -> {
                  throw new java.io.IOException("offline");
                },
                () -> now + 3600000)
            .load("MX", "top");
    assertTrue(offline.cached());
    assertEquals(first.published(), offline.published());
    assertEquals(first.checked(), offline.checked());
    assertEquals(bytes, m.read("feed-MX-top"));
  }

  @Test
  public void expiredOfflineCacheFails() throws Exception {
    Memory m = new Memory();
    new NewsClient(m, online("2026-11-05T11:00:00Z"), () -> now).load("MX", "top");
    try {
      new NewsClient(
              m,
              p -> {
                throw new java.io.IOException("offline");
              },
              () -> now + 24 * FeedRules.DAY / 24)
          .load("MX", "top");
      fail();
    } catch (java.io.IOException expected) {
      assertEquals("offline", expected.getMessage());
    }
  }

  @Test
  public void rejectsUnsafeFeedWithoutCaching() throws Exception {
    Memory m = new Memory();
    try {
      new NewsClient(
              m,
              p ->
                  p.equals("manifest.json")
                      ? manifest("2026-11-05T11:00:00Z")
                      : articles("javascript:alert(1)", "2026-11-05T10:00:00Z"),
              () -> now)
          .load("MX", "top");
      fail();
    } catch (java.io.IOException expected) {
      assertTrue(m.values.isEmpty());
    }
  }

  @Test
  public void refusesPublicationRace() throws Exception {
    Memory m = new Memory();
    int[] reads = {0};
    try {
      new NewsClient(
              m,
              p ->
                  p.equals("manifest.json")
                      ? manifest(++reads[0] == 1 ? "2026-11-05T11:00:00Z" : "2026-11-05T11:30:00Z")
                      : articles("https://example.com/story", "2026-11-05T10:00:00Z"),
              () -> now)
          .load("MX", "top");
      fail();
    } catch (java.io.IOException expected) {
      assertTrue(expected.getMessage().contains("changed"));
      assertTrue(m.values.isEmpty());
    }
  }

  @Test
  public void rejectsOldArticleEvenWithFreshFeedTimestamp() throws Exception {
    Memory m = new Memory();
    try {
      new NewsClient(
              m,
              p ->
                  p.equals("manifest.json")
                      ? manifest("2026-11-05T11:00:00Z")
                      : articles("https://example.com/story", "2026-10-01T10:00:00Z"),
              () -> now)
          .load("MX", "top");
      fail();
    } catch (java.io.IOException expected) {
      assertTrue(m.values.isEmpty());
    }
  }
}

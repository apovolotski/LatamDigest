package com.apovolotski.latamdigest;

import static org.junit.Assert.*;

import java.time.Instant;
import java.util.*;
import org.json.*;
import org.junit.Test;

public class SignalEngineTest {
  @Test
  public void weightsCurrentEvidenceAndExcludesExpiredCountry() throws Exception {
    long now = Instant.parse("2026-11-05T12:00:00Z").toEpochMilli();
    JSONArray stories = new JSONArray();
    for (int i = 0; i < 3; i++)
      stories.put(
          new JSONObject()
              .put("title", "Economía: inflation report " + i)
              .put("publishedAt", "2026-11-05T11:00:00Z"));
    Map<String, NewsClient.Result> feeds = new HashMap<>();
    feeds.put(
        "MX",
        new NewsClient.Result(stories, "2026-11-05T11:30:00Z", "2026-11-05T11:40:00Z", false, ""));
    feeds.put(
        "AR",
        new NewsClient.Result(stories, "2026-11-04T10:00:00Z", "2026-11-05T11:40:00Z", true, ""));
    JSONArray result =
        SignalEngine.signals(
            feeds,
            new HashSet<>(Arrays.asList("economy", "sports")),
            new JSONObject()
                .put("economy", new JSONArray().put("econom"))
                .put("sports", new JSONArray().put("football")),
            now);
    assertEquals(1, result.length());
    JSONObject signal = result.getJSONObject(0);
    assertEquals("MX", signal.getString("country"));
    assertEquals(9, signal.getInt("score"));
    assertEquals("Elevated", signal.getString("intensity"));
    assertEquals("New", signal.getString("momentum"));
  }
}

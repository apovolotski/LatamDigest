package com.apovolotski.latamdigest;

import java.util.*;
import org.json.*;

/**
 * Mirrors the iOS recency-weighted reading signals. These are editorial aids, not verified risk
 * scores.
 */
final class SignalEngine {
  static JSONArray signals(
      Map<String, NewsClient.Result> feeds, Set<String> topics, JSONObject keywords, long now)
      throws JSONException {
    List<JSONObject> results = new ArrayList<>();
    for (var entry : feeds.entrySet()) {
      if (!FeedRules.currentFeed(entry.getValue().published(), now)) continue;
      for (String topic : topics) {
        JSONArray words = keywords.optJSONArray(topic);
        if (words == null) continue;
        JSONArray evidence = new JSONArray();
        int score = 0, recent = 0, day = 0;
        long latest = 0;
        JSONArray articles = entry.getValue().articles();
        for (int i = 0; i < articles.length(); i++) {
          JSONObject a = articles.getJSONObject(i);
          long at = FeedRules.timestamp(a.optString("publishedAt"));
          if (!FeedRules.currentArticle(a.optString("publishedAt"), now)) continue;
          String hay = FeedRules.searchable(a.optString("title") + " " + a.optString("snippet"));
          boolean match = false;
          for (int w = 0; w < words.length(); w++)
            match |= hay.contains(FeedRules.searchable(words.getString(w)));
          if (!match) continue;
          evidence.put(a);
          long age = now - at;
          score += age < 6 * 3600000 ? 3 : age < 24 * 3600000 ? 2 : 1;
          if (age <= 6 * 3600000) recent++;
          if (age <= 24 * 3600000) day++;
          latest = Math.max(at, latest);
        }
        if (evidence.length() > 0)
          results.add(
              new JSONObject()
                  .put("country", entry.getKey())
                  .put("topic", topic)
                  .put("score", score)
                  .put("intensity", score >= 8 ? "Elevated" : score >= 4 ? "Active" : "Watch")
                  .put(
                      "momentum",
                      recent >= 2 ? "New" : day >= 3 ? "Rising" : day >= 1 ? "Steady" : "Cooling")
                  .put("evidence", evidence)
                  .put("updatedAt", java.time.Instant.ofEpochMilli(latest).toString())
                  .put("feedPublishedAt", entry.getValue().published())
                  .put("cached", entry.getValue().cached()));
      }
    }
    results.sort((a, b) -> Integer.compare(b.optInt("score"), a.optInt("score")));
    return new JSONArray(results);
  }
}

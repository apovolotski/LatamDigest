package com.apovolotski.latamdigest;

import android.content.Context;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

final class NewsClient {
  static final String BASE =
      "https://raw.githubusercontent.com/apovolotski/LatamDigest/main/docs/api/";

  record Result(
      JSONArray articles, String published, String checked, boolean cached, String warning) {}

  interface Cache {
    String read(String key);

    void write(String key, String value);
  }

  interface Transport {
    String fetch(String path) throws Exception;
  }

  private final Cache cache;
  private final Transport transport;
  private final java.util.function.LongSupplier clock;

  NewsClient(Context c) {
    this(
        new Cache() {
          final android.content.SharedPreferences prefs =
              c.getApplicationContext().getSharedPreferences("feeds", 0);

          public String read(String key) {
            return prefs.getString(key, null);
          }

          public void write(String key, String value) {
            prefs.edit().putString(key, value).apply();
          }
        },
        NewsClient::get,
        System::currentTimeMillis);
  }

  NewsClient(Cache cache, Transport transport, java.util.function.LongSupplier clock) {
    this.cache = cache;
    this.transport = transport;
    this.clock = clock;
  }

  static byte[] readBytes(InputStream input) throws IOException {
    try (InputStream in = input;
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      byte[] b = new byte[8192];
      int n;
      while ((n = in.read(b)) != -1) out.write(b, 0, n);
      return out.toByteArray();
    }
  }

  static String get(String path) throws Exception {
    HttpURLConnection c = (HttpURLConnection) new URL(BASE + path).openConnection();
    c.setConnectTimeout(15000);
    c.setReadTimeout(20000);
    c.setInstanceFollowRedirects(false);
    try {
      if (c.getResponseCode() != 200)
        throw new IOException("Feed service unavailable (" + c.getResponseCode() + ")");
      try (InputStream in = c.getInputStream();
          ByteArrayOutputStream out = new ByteArrayOutputStream()) {
        byte[] b = new byte[8192];
        int n;
        while ((n = in.read(b)) != -1) {
          if (out.size() + n > 3000000) throw new IOException("Feed response exceeds limit");
          out.write(b, 0, n);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
      }
    } finally {
      c.disconnect();
    }
  }

  private JSONObject status(JSONObject m, String country, String category) throws Exception {
    JSONArray cs = m.getJSONArray("countries");
    for (int i = 0; i < cs.length(); i++)
      if (cs.getJSONObject(i).getString("id").equals(country))
        return cs.getJSONObject(i).getJSONObject("feeds").getJSONObject(category);
    throw new IOException("Unknown country");
  }

  private JSONArray validate(JSONArray input, long now) throws Exception {
    JSONArray output = new JSONArray();
    Set<String> urls = new HashSet<>();
    for (int i = 0; i < input.length(); i++) {
      JSONObject a = input.getJSONObject(i);
      String url = a.getString("url");
      if (!FeedRules.safeUrl(url)
          || !FeedRules.currentArticle(a.getString("publishedAt"), now)
          || a.getString("title").trim().isEmpty()
          || a.getString("sourceName").trim().isEmpty())
        throw new IOException("Feed failed safety or date checks");
      if (urls.add(url)) output.put(a);
    }
    if (output.length() == 0) throw new IOException("No eligible stories available");
    return output;
  }

  Result load(String country, String category) throws Exception {
    if (!country.matches("[A-Z]{2}")
        || !Arrays.asList(
                "top",
                "latest",
                "politics",
                "business",
                "economy",
                "crime",
                "tech",
                "culture",
                "sports",
                "world")
            .contains(category)) throw new IOException("Invalid feed selection");
    String key = "feed-" + country + "-" + category;
    long now = clock.getAsLong();
    try {
      JSONObject first =
          status(new JSONObject(transport.fetch("manifest.json")), country, category);
      String updated = first.getString("updatedAt");
      if (!FeedRules.currentFeed(updated, now))
        throw new IOException("Publisher feed has expired; waiting for refresh");
      String body =
          transport.fetch(
              "countries/"
                  + country
                  + "/"
                  + (Arrays.asList("top", "latest").contains(category) ? "" : "category/")
                  + category
                  + ".json");
      JSONArray articles = validate(new JSONArray(body), now);
      JSONObject second =
          status(new JSONObject(transport.fetch("manifest.json")), country, category);
      if (!first.toString().equals(second.toString()))
        throw new IOException("Publication changed during loading; please refresh");
      if (first.getInt("count") != articles.length()) throw new IOException("Feed count mismatch");
      String checked = java.time.Instant.ofEpochMilli(clock.getAsLong()).toString();
      JSONObject saved =
          new JSONObject()
              .put("articles", articles)
              .put("updatedAt", updated)
              .put("checkedAt", checked);
      cache.write(key, saved.toString());
      return new Result(
          articles,
          updated,
          checked,
          first.optBoolean("stale"),
          first.optBoolean("stale") ? "Publisher is using a recent verified cache." : "");
    } catch (Exception error) {
      String stored = cache.read(key);
      if (stored != null) {
        JSONObject saved = new JSONObject(stored);
        String updated = saved.getString("updatedAt");
        if (FeedRules.currentFeed(updated, now))
          return new Result(
              validate(saved.getJSONArray("articles"), now),
              updated,
              saved.getString("checkedAt"),
              true,
              "Connection unavailable. Showing the last valid copy.");
      }
      throw error;
    }
  }
}

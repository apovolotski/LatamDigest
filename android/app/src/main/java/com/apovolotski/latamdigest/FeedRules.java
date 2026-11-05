package com.apovolotski.latamdigest;

import java.net.URI;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;

public final class FeedRules {
  public static final long DAY = 86400000L;

  public static boolean safeUrl(String value) {
    try {
      URI uri = new URI(value);
      return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
          && uri.getHost() != null
          && uri.getUserInfo() == null;
    } catch (Exception e) {
      return false;
    }
  }

  public static long timestamp(String value) {
    try {
      return Instant.parse(value).toEpochMilli();
    } catch (Exception e) {
      return 0;
    }
  }

  public static boolean currentFeed(String updated, long now) {
    long at = timestamp(updated);
    return at > 0 && at <= now + 300000 && now - at < DAY;
  }

  public static boolean currentArticle(String date, long now) {
    long at = timestamp(date);
    return at > 0 && at <= now + 300000 && now - at <= 14 * DAY;
  }

  public static String searchable(String value) {
    return Normalizer.normalize(value, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT);
  }
}

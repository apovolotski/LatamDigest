package com.apovolotski.latamdigest;

import static org.junit.Assert.*;

import android.content.*;
import android.graphics.Bitmap;
import android.view.*;
import android.widget.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import org.json.*;
import org.junit.Test;

/**
 * Captures actual native screens using a current public story and clearly named example research.
 */
public class StoreScreenshotTest {
  private TextView find(View v, String title) {
    if (v instanceof TextView && title.equals(((TextView) v).getText().toString()))
      return (TextView) v;
    if (v instanceof ViewGroup)
      for (int i = 0; i < ((ViewGroup) v).getChildCount(); i++) {
        TextView t = find(((ViewGroup) v).getChildAt(i), title);
        if (t != null) return t;
      }
    return null;
  }

  private void capture(String name) throws Exception {
    var instrumentation = InstrumentationRegistry.getInstrumentation();
    instrumentation.waitForIdleSync();
    Bitmap image = instrumentation.getUiAutomation().takeScreenshot();
    assertNotNull(image);
    try (FileOutputStream out =
        new FileOutputStream(
            new File(
                instrumentation.getTargetContext().getExternalFilesDir(null), name + ".png"))) {
      image.compress(Bitmap.CompressFormat.PNG, 100, out);
    }
    image.recycle();
    // Gradle uninstalls the tested app after the run. Stage screenshots in a
    // shell-owned directory before that removes the app-specific files.
    String source = new File(instrumentation.getTargetContext().getExternalFilesDir(null), name + ".png").getAbsolutePath();
    try (android.os.ParcelFileDescriptor command = instrumentation.getUiAutomation()
        .executeShellCommand("mkdir -p /sdcard/Download/latam-store && cp " + source + " /sdcard/Download/latam-store/" + name + ".png");
        FileInputStream result = new FileInputStream(command.getFileDescriptor())) {
      while (result.read() != -1) { }
    }
  }

  @Test
  public void captureReleaseScreens() throws Exception {
    var instrumentation = InstrumentationRegistry.getInstrumentation();
    Context c = instrumentation.getTargetContext();
    NewsClient.Result result = new NewsClient(c).load("MX", "top");
    JSONObject article = result.articles().getJSONObject(0);
    String url = article.getString("url"), articleTitle = article.getString("title");
    JSONObject dossier =
        new JSONObject()
            .put("title", "Example: regional briefing")
            .put("assessment", "Exploratory")
            .put("note", "Compare reporting across original sources.")
            .put("evidence", new JSONArray().put(article));
    c.getSharedPreferences("workspace", 0)
        .edit()
        .clear()
        .putString("country", "MX")
        .putString("category", "top")
        .putString("screen", "Library")
        .putString("saved", new JSONObject().put(url, article).toString())
        .putString(
            "notes",
            new JSONObject()
                .put(url, "Review the original reporting before drawing a conclusion.")
                .toString())
        .putString("dossiers", new JSONArray().put(dossier).toString())
        .putString(
            "tasks",
            new JSONArray()
                .put(
                    new JSONObject()
                        .put("title", "Compare source coverage")
                        .put("detail", "Check dates and distinguish reporting from opinion.")
                        .put("done", false))
                .toString())
        .commit();
    try (ActivityScenario<MainActivity> scene = ActivityScenario.launch(MainActivity.class)) {
      capture("01-library");
      scene.onActivity(a -> find(a.getWindow().getDecorView(), "Workspace").performClick());
      capture("02-workspace");
      scene.onActivity(a -> find(a.getWindow().getDecorView(), "Feeds").performClick());
      long until = System.currentTimeMillis() + 60000;
      boolean[] ready = {false};
      while (System.currentTimeMillis() < until && !ready[0]) {
        Thread.sleep(500);
        scene.onActivity(a -> ready[0] = find(a.getWindow().getDecorView(), articleTitle) != null);
      }
      assertTrue("Live feed loaded", ready[0]);
      capture("03-feeds");
    }
  }
}

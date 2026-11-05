package com.apovolotski.latamdigest;

import static org.junit.Assert.*;

import android.content.*;
import android.view.*;
import android.widget.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.*;

/** Exercises real view callbacks and durable local records on Android. */
public class WorkspaceTest {
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

  private void tap(MainActivity a, String title) {
    TextView v = find(a.getWindow().getDecorView(), title);
    assertNotNull(title, v);
    v.performClick();
  }

  private Context context() {
    return InstrumentationRegistry.getInstrumentation().getTargetContext();
  }

  @Before
  public void clearTestData() {
    context().getSharedPreferences("workspace", 0).edit().clear().commit();
    context().getSharedPreferences("feeds", 0).edit().clear().commit();
  }

  @Test
  public void workspaceRecordsSurviveRelaunch() throws Exception {
    Context c = context();
    String record =
        new JSONArray()
            .put(
                new JSONObject()
                    .put("title", "Research task")
                    .put("detail", "Check original source date")
                    .put("done", false))
            .toString();
    c.getSharedPreferences("workspace", 0)
        .edit()
        .putString("tasks", record)
        .putString("screen", "Today")
        .commit();
    try (ActivityScenario<MainActivity> scene = ActivityScenario.launch(MainActivity.class)) {
      scene.onActivity(
          a -> {
            tap(a, "Workspace");
            assertNotNull(find(a.getWindow().getDecorView(), "Research task"));
            tap(a, "Research task");
          });
      assertTrue(
          new JSONArray(c.getSharedPreferences("workspace", 0).getString("tasks", "[]"))
              .getJSONObject(0)
              .getBoolean("done"));
      scene.recreate();
      scene.onActivity(
          a ->
              assertTrue(
                  ((CheckBox) find(a.getWindow().getDecorView(), "Research task")).isChecked()));
    }
  }

  @Test
  public void libraryLabelsHistoricalRecordsAndPersistsRemoval() throws Exception {
    Context c = context();
    JSONObject article =
        new JSONObject()
            .put("url", "https://example.com/research")
            .put("title", "Archived research source")
            .put("sourceName", "Example")
            .put("publishedAt", "2020-01-01T00:00:00Z");
    c.getSharedPreferences("workspace", 0)
        .edit()
        .putString("saved", new JSONObject().put(article.getString("url"), article).toString())
        .putString("screen", "Library")
        .commit();
    try (ActivityScenario<MainActivity> scene = ActivityScenario.launch(MainActivity.class)) {
      scene.onActivity(
          a -> {
            assertNotNull(find(a.getWindow().getDecorView(), "Archived research source"));
            assertNotNull(
                find(a.getWindow().getDecorView(), "Saved record · original publication date"));
            tap(a, "Unsave");
          });
      assertEquals(
          0,
          new JSONObject(c.getSharedPreferences("workspace", 0).getString("saved", "{}")).length());
    }
  }

  @Test
  public void principalScreensLaunchWithoutNetwork() {
    try (ActivityScenario<MainActivity> scene = ActivityScenario.launch(MainActivity.class)) {
      scene.onActivity(
          a -> {
            tap(a, "Workspace");
            assertNotNull(find(a.getWindow().getDecorView(), "Research workspace"));
            tap(a, "Library");
            assertNotNull(find(a.getWindow().getDecorView(), "Reading library"));
            tap(a, "Settings");
            assertNotNull(find(a.getWindow().getDecorView(), "Daily reading reminder"));
          });
    }
  }
}

package com.apovolotski.latamdigest;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.text.*;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

public class MainActivity extends Activity {
  private final int INK = Color.rgb(23, 43, 48),
      TEAL = Color.rgb(0, 108, 103),
      MUTED = Color.rgb(88, 108, 113);
  private LinearLayout root, body, nav;
  private EditText search;
  private TextView status;
  private android.content.SharedPreferences prefs;
  private JSONArray countries = new JSONArray(), articles = new JSONArray();
  private JSONObject saved = new JSONObject(),
      notes = new JSONObject(),
      history = new JSONObject(),
      plans = new JSONObject();
  private JSONArray dossiers = new JSONArray(),
      tasks = new JSONArray(),
      snapshots = new JSONArray();
  private Set<String> watched = new HashSet<>();
  private final Map<String, NewsClient.Result> regionalFeeds = new HashMap<>();
  private Set<String> regionalCountries = new HashSet<>();
  private JSONObject topicKeywords = new JSONObject(), translations = new JSONObject();
  private String language = "en";
  private JSONArray regionalSignals = new JSONArray();
  private boolean regionalLoading = false;
  private String regionalStatus = "Choose countries and refresh your briefing.";
  private String screen = "Today", country = "MX", category = "top", query = "";
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private Future<?> request;
  private int generation = 0;
  private boolean loading = false, storageHealthy = true;
  private final Handler freshnessHandler = new Handler(Looper.getMainLooper());
  private final Runnable freshnessCheck =
      new Runnable() {
        public void run() {
          expireVisibleFeed();
          freshnessHandler.postDelayed(this, 60000);
        }
      };
  private NewsClient.Result loaded;
  private final String[] topics = {
    "politics",
    "economy",
    "business",
    "crime",
    "tech",
    "culture",
    "sports",
    "health",
    "energy",
    "labor"
  };
  private final String[] categories = {
    "top",
    "latest",
    "politics",
    "economy",
    "business",
    "crime",
    "tech",
    "culture",
    "sports",
    "world"
  };

  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    prefs = getSharedPreferences("workspace", 0);
    try {
      countries =
          new JSONArray(
              new String(
                  NewsClient.readBytes(getAssets().open("countries.json")),
                  java.nio.charset.StandardCharsets.UTF_8));
      saved = new JSONObject(prefs.getString("saved", "{}"));
      notes = new JSONObject(prefs.getString("notes", "{}"));
      history = new JSONObject(prefs.getString("history", "{}"));
      plans = new JSONObject(prefs.getString("plans", "{}"));
      dossiers = new JSONArray(prefs.getString("dossiers", "[]"));
      tasks = new JSONArray(prefs.getString("tasks", "[]"));
      snapshots = new JSONArray(prefs.getString("snapshots", "[]"));
    } catch (Exception e) {
      storageHealthy = false;
      toast("Some local data could not be loaded. Your saved files have not been erased.");
    }
    watched =
        new HashSet<>(
            prefs.getStringSet("watched", new HashSet<>(Arrays.asList("politics", "economy"))));
    country = prefs.getString("country", "MX");
    category = prefs.getString("category", "top");
    screen = prefs.getString("screen", "Today");
    regionalCountries =
        new HashSet<>(
            prefs.getStringSet(
                "regionalCountries", new HashSet<>(Arrays.asList("MX", "BR", "AR"))));
    try {
      topicKeywords =
          new JSONObject(
              new String(
                  NewsClient.readBytes(getAssets().open("topics.json")),
                  java.nio.charset.StandardCharsets.UTF_8));
    } catch (Exception ignored) {
    }
    language = prefs.getString("language", Locale.getDefault().getLanguage());
    try {
      JSONObject all =
          new JSONObject(
              new String(
                  NewsClient.readBytes(getAssets().open("ui-translations.json")),
                  java.nio.charset.StandardCharsets.UTF_8));
      translations = all.optJSONObject(language);
      if (translations == null) translations = new JSONObject();
    } catch (Exception ignored) {
    }
    build();
    ReminderReceiver.schedule(this);
    if (Build.VERSION.SDK_INT >= 33)
      getOnBackInvokedDispatcher()
          .registerOnBackInvokedCallback(
              android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
              () -> {
                if (!screen.equals("Today")) switchTo("Today");
                else finish();
              });
  }

  private String tr(String value) {
    return translations.optString(value, value);
  }

  private int dp(float n) {
    return (int) (n * getResources().getDisplayMetrics().density + .5f);
  }

  private String label(String s) {
    return tr(
        s.equals("top")
            ? "Top stories"
            : s.equals("latest")
                ? "Latest"
                : s.equals("crime")
                    ? "Public safety"
                    : s.equals("tech")
                        ? "Technology"
                        : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1));
  }

  private TextView text(String s, int size, int color) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setPadding(0, dp(5), 0, dp(5));
    t.setTextIsSelectable(true);
    return t;
  }

  private void heading(String s) {
    TextView t = text(s, 26, INK);
    t.setTypeface(null, Typeface.BOLD);
    body.addView(t);
  }

  private GradientDrawable background(int color, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(radius));
    return d;
  }

  private LinearLayout card() {
    LinearLayout c = new LinearLayout(this);
    c.setOrientation(LinearLayout.VERTICAL);
    c.setPadding(dp(16), dp(12), dp(16), dp(12));
    c.setBackground(background(Color.WHITE, 16));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.setMargins(0, dp(6), 0, dp(6));
    body.addView(c, lp);
    return c;
  }

  private Button button(String s, Runnable run) {
    Button b = new Button(this);
    b.setText(tr(s));
    b.setAllCaps(false);
    b.setTextColor(TEAL);
    b.setOnClickListener(v -> run.run());
    return b;
  }

  private void toast(String s) {
    Toast.makeText(this, s, Toast.LENGTH_LONG).show();
  }

  private void save() {
    if (!storageHealthy) {
      toast(
          "Local storage needs recovery. Existing data has been preserved; changes cannot be"
              + " saved.");
      return;
    }
    prefs
        .edit()
        .putString("saved", saved.toString())
        .putString("notes", notes.toString())
        .putString("history", history.toString())
        .putString("plans", plans.toString())
        .putString("dossiers", dossiers.toString())
        .putString("tasks", tasks.toString())
        .putString("snapshots", snapshots.toString())
        .putStringSet("watched", watched)
        .apply();
  }

  private void build() {
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.rgb(245, 247, 247));
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets x =
                insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            v.setPadding(x.left, x.top, x.right, x.bottom);
          } else {
            v.setPadding(
                insets.getSystemWindowInsetLeft(),
                insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(),
                insets.getSystemWindowInsetBottom());
          }
          return insets;
        });
    setContentView(root);
    LinearLayout top = new LinearLayout(this);
    top.setPadding(dp(20), dp(8), dp(12), dp(8));
    top.setGravity(Gravity.CENTER_VERTICAL);
    TextView brand = text(tr("LATAM / DIGEST"), 20, TEAL);
    brand.setTypeface(null, Typeface.BOLD);
    top.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
    top.addView(button("Settings", () -> switchTo("Settings")));
    root.addView(top);
    ScrollView sc = new ScrollView(this);
    sc.setFillViewport(true);
    body = new LinearLayout(this);
    body.setOrientation(LinearLayout.VERTICAL);
    body.setPadding(dp(20), dp(10), dp(20), dp(20));
    sc.addView(body);
    root.addView(sc, new LinearLayout.LayoutParams(-1, 0, 1));
    HorizontalScrollView hs = new HorizontalScrollView(this);
    hs.setHorizontalScrollBarEnabled(false);
    nav = new LinearLayout(this);
    for (String name : new String[] {"Today", "Feeds", "Library", "Workspace"}) {
      Button b = button(name, () -> switchTo(name));
      if (screen.equals(name)) b.setTypeface(null, Typeface.BOLD);
      b.setTextSize(12);
      b.setMinWidth(0);
      b.setMinimumWidth(0);
      b.setPadding(dp(4), dp(4), dp(4), dp(4));
      if (screen.equals(name)) {
        b.setTextColor(Color.WHITE);
        b.setBackground(background(TEAL, 8));
      }
      nav.addView(b, new LinearLayout.LayoutParams(0, dp(52), 1));
    }
    nav.setPadding(dp(8), dp(4), dp(8), dp(8));
    root.addView(nav, new LinearLayout.LayoutParams(-1, -2));
    render();
  }

  private void switchTo(String page) {
    generation++;
    if (request != null) request.cancel(true);
    loading = false;
    screen = page;
    prefs.edit().putString("screen", page).apply();
    build();
  }

  private void render() {
    body.removeAllViews();
    switch (screen) {
      case "Feeds":
        feeds();
        break;
      case "Library":
        library();
        break;
      case "Workspace":
        workspace();
        break;
      case "Settings":
        settings();
        break;
      default:
        today();
    }
  }

  private String date(String s) {
    try {
      return DateTimeFormatter.ofPattern("MMM d, yyyy · HH:mm")
          .withZone(ZoneId.systemDefault())
          .format(Instant.parse(s));
    } catch (Exception e) {
      return s;
    }
  }

  private void today() {
    heading(tr("Your regional briefing"));
    body.addView(text(tr("Read the sources. Keep your perspective."), 16, MUTED));
    LinearLayout c = card();
    c.addView(
        text(saved.length() + " saved stories  ·  " + dossiers.length() + " dossiers", 18, INK));
    c.addView(button("Explore country feeds", () -> switchTo("Feeds")));
    heading(tr("Regional signals"));
    body.addView(
        text(
            "Reading signals use keyword matches and article recency. They are not verified"
                + " assessments of a country.",
            14,
            MUTED));
    body.addView(button("Countries & topics", this::chooseRegion));
    body.addView(button(regionalLoading ? "Refreshing…" : "Refresh briefing", this::loadRegion));
    body.addView(text(regionalStatus, 13, MUTED));
    try {
      regionalSignals =
          SignalEngine.signals(regionalFeeds, watched, topicKeywords, System.currentTimeMillis());
    } catch (Exception ignored) {
    }
    for (int i = 0; i < regionalSignals.length(); i++) {
      JSONObject signal = regionalSignals.optJSONObject(i);
      LinearLayout box = card();
      box.addView(
          text(signal.optString("country") + " · " + label(signal.optString("topic")), 19, INK));
      box.addView(
          text(
              signal.optString("intensity")
                  + " · "
                  + signal.optString("momentum")
                  + " · "
                  + signal.optJSONArray("evidence").length()
                  + " sources",
              14,
              TEAL));
      box.addView(
          text(
              "Published "
                  + date(signal.optString("feedPublishedAt"))
                  + (signal.optBoolean("cached") ? " · Cached" : ""),
              12,
              MUTED));
      box.addView(
          button(
              "Review sources",
              () -> {
                body.removeAllViews();
                heading(signal.optString("country") + " · " + label(signal.optString("topic")));
                JSONArray sources = signal.optJSONArray("evidence");
                for (int j = 0; j < sources.length(); j++)
                  articleCard(sources.optJSONObject(j), false);
                body.addView(button("Back to briefing", this::render));
              }));
    }
    heading(tr("Watchlist"));
    body.addView(
        text(
            "Choose the topics you want to follow. Headlines remain in their original language.",
            14,
            MUTED));
    for (String k : topics) {
      CheckBox b = new CheckBox(this);
      b.setText(label(k));
      b.setChecked(watched.contains(k));
      b.setOnCheckedChangeListener(
          (v, yes) -> {
            if (yes) watched.add(k);
            else watched.remove(k);
            save();
          });
      body.addView(b);
    }
    heading(tr("Continue reading"));
    if (history.length() == 0) body.addView(text(tr("Stories you open appear here."), 15, MUTED));
    else {
      Iterator<String> it = history.keys();
      int count = 0;
      while (it.hasNext() && count++ < 5) {
        JSONObject a = history.optJSONObject(it.next());
        if (a != null) articleCard(a, true);
      }
    }
  }

  private void chooseRegion() {
    String[] names = new String[countries.length()];
    boolean[] checked = new boolean[countries.length()];
    for (int i = 0; i < countries.length(); i++) {
      JSONObject c = countries.optJSONObject(i);
      names[i] = new Locale("", c.optString("id")).getDisplayCountry(new Locale(language));
      checked[i] = regionalCountries.contains(c.optString("id"));
    }
    new AlertDialog.Builder(this)
        .setTitle(tr("Briefing countries"))
        .setMultiChoiceItems(names, checked, (d, i, on) -> checked[i] = on)
        .setNegativeButton(tr("Cancel"), null)
        .setPositiveButton(
            "Save",
            (d, w) -> {
              regionalCountries.clear();
              for (int i = 0; i < checked.length; i++)
                if (checked[i]) regionalCountries.add(countries.optJSONObject(i).optString("id"));
              prefs.edit().putStringSet("regionalCountries", regionalCountries).apply();
              regionalFeeds.keySet().retainAll(regionalCountries);
              render();
            })
        .show();
  }

  private void loadRegion() {
    if (regionalLoading) return;
    regionalLoading = true;
    regionalStatus = "Loading selected country feeds…";
    final Set<String> selected = new HashSet<>(regionalCountries);
    render();
    io.submit(
        () -> {
          Map<String, NewsClient.Result> result = new HashMap<>();
          List<String> failed = new ArrayList<>();
          for (String code : selected) {
            try {
              result.put(code, new NewsClient(this).load(code, "top"));
            } catch (Exception e) {
              failed.add(code);
            }
          }
          runOnUiThread(
              () -> {
                if (isDestroyed()) return;
                regionalLoading = false;
                regionalFeeds.clear();
                for (var entry : result.entrySet())
                  if (regionalCountries.contains(entry.getKey()))
                    regionalFeeds.put(entry.getKey(), entry.getValue());
                regionalStatus =
                    result.size()
                        + " country feeds checked"
                        + (failed.isEmpty() ? "" : " · Unavailable: " + String.join(", ", failed));
                if (screen.equals("Today")) render();
              });
        });
  }

  private void feeds() {
    heading(tr("Country feeds"));
    String[] names = new String[countries.length()];
    int selected = 0;
    for (int i = 0; i < countries.length(); i++) {
      JSONObject c = countries.optJSONObject(i);
      names[i] = new Locale("", c.optString("id")).getDisplayCountry(new Locale(language));
      if (c.optString("id").equals(country)) selected = i;
    }
    Spinner cs = new Spinner(this);
    cs.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
    cs.setSelection(selected);
    body.addView(cs);
    cs.setOnItemSelectedListener(
        new AdapterView.OnItemSelectedListener() {
          public void onNothingSelected(AdapterView<?> p) {}

          public void onItemSelected(AdapterView<?> p, View v, int i, long id) {
            String next = countries.optJSONObject(i).optString("id");
            if (!next.equals(country)) {
              country = next;
              changedSelection();
            }
          }
        });
    Spinner cats = new Spinner(this);
    String[] titles = Arrays.stream(categories).map(this::label).toArray(String[]::new);
    cats.setAdapter(
        new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, titles));
    cats.setSelection(Math.max(0, Arrays.asList(categories).indexOf(category)));
    body.addView(cats);
    cats.setOnItemSelectedListener(
        new AdapterView.OnItemSelectedListener() {
          public void onNothingSelected(AdapterView<?> p) {}

          public void onItemSelected(AdapterView<?> p, View v, int i, long id) {
            if (!categories[i].equals(category)) {
              category = categories[i];
              changedSelection();
            }
          }
        });
    search = new EditText(this);
    search.setSingleLine(true);
    search.setHint(tr("Search headlines and sources"));
    search.setText(query);
    body.addView(search);
    search.addTextChangedListener(
        new TextWatcher() {
          public void beforeTextChanged(CharSequence s, int st, int count, int after) {}

          public void onTextChanged(CharSequence s, int start, int before, int count) {
            query = s.toString();
            drawArticles();
          }

          public void afterTextChanged(Editable e) {}
        });
    body.addView(button("Refresh", this::loadFeed));
    status =
        text(
            loading
                ? "Loading…"
                : loaded == null
                    ? "Tap Refresh to load this feed."
                    : (loaded.cached() ? "Cached feed · " : "Published · ")
                        + date(loaded.published())
                        + "\nLast checked · "
                        + date(loaded.checked())
                        + (loaded.warning().isEmpty() ? "" : "\n" + loaded.warning()),
            13,
            MUTED);
    body.addView(status);
    LinearLayout list = new LinearLayout(this);
    list.setOrientation(LinearLayout.VERTICAL);
    list.setTag("articles");
    body.addView(list);
    drawArticles();
    if (loaded == null && !loading) loadFeed();
  }

  private void changedSelection() {
    generation++;
    if (request != null) request.cancel(true);
    loading = false;
    loaded = null;
    articles = new JSONArray();
    prefs.edit().putString("country", country).putString("category", category).apply();
    render();
  }

  private void loadFeed() {
    final int token = ++generation;
    final String c = country, k = category;
    loading = true;
    if (status != null) status.setText("Loading…");
    if (request != null) request.cancel(true);
    request =
        io.submit(
            () -> {
              try {
                NewsClient.Result result = new NewsClient(this).load(c, k);
                runOnUiThread(
                    () -> {
                      if (token != generation || isFinishing() || isDestroyed()) return;
                      loading = false;
                      loaded = result;
                      articles = result.articles();
                      if (screen.equals("Feeds")) render();
                    });
              } catch (Exception e) {
                runOnUiThread(
                    () -> {
                      if (token != generation || isFinishing() || isDestroyed()) return;
                      loading = false;
                      loaded = null;
                      articles = new JSONArray();
                      if (status != null)
                        status.setText(
                            "Unable to show a current feed. "
                                + e.getMessage()
                                + "\nSaved stories remain available in Library.");
                      drawArticles();
                    });
              }
            });
  }

  private void drawArticles() {
    LinearLayout list = body.findViewWithTag("articles");
    if (list == null) return;
    list.removeAllViews();
    LinearLayout old = body;
    body = list;
    int matches = 0;
    for (int i = 0; i < articles.length(); i++) {
      JSONObject a = articles.optJSONObject(i);
      String hay =
          FeedRules.searchable(
              a.optString("title")
                  + " "
                  + a.optString("snippet")
                  + " "
                  + a.optString("sourceName"));
      if (hay.contains(FeedRules.searchable(query))) {
        articleCard(a, false);
        matches++;
      }
    }
    if (matches == 0 && articles.length() > 0)
      list.addView(text(tr("No matching stories."), 16, MUTED));
    body = old;
  }

  private void articleCard(JSONObject a, boolean archived) {
    String url = a.optString("url");
    LinearLayout c = card();
    c.addView(
        text(a.optString("sourceName") + " · " + date(a.optString("publishedAt")), 12, MUTED));
    TextView title = text(a.optString("title"), 19, INK);
    title.setTypeface(null, Typeface.BOLD);
    c.addView(title);
    if (!a.optString("snippet").trim().isEmpty())
      c.addView(text(a.optString("snippet"), 14, MUTED));
    if (archived) c.addView(text(tr("Saved record · original publication date"), 12, MUTED));
    String note = notes.optString(url);
    if (!note.trim().isEmpty()) c.addView(text("Your note: " + note, 14, TEAL));
    LinearLayout row = new LinearLayout(this);
    row.addView(button("Read source", () -> openArticle(a)));
    row.addView(
        button(
            saved.has(url) ? "Unsave" : "Save",
            () -> {
              if (saved.has(url)) saved.remove(url);
              else
                try {
                  saved.put(url, a);
                } catch (Exception ignored) {
                }
              save();
              if (screen.equals("Feeds")) drawArticles();
              else render();
            }));
    c.addView(row);
    LinearLayout more = new LinearLayout(this);
    more.addView(button("Note", () -> editNote(a)));
    more.addView(button("Dossier", () -> addEvidence(a)));
    more.addView(
        button(
            "Share",
            () -> {
              if (!FeedRules.safeUrl(url)) return;
              Intent send = new Intent(Intent.ACTION_SEND);
              send.setType("text/plain");
              send.putExtra(Intent.EXTRA_TEXT, a.optString("title") + "\n" + url);
              startActivity(Intent.createChooser(send, "Share source"));
            }));
    c.addView(more);
  }

  private void openArticle(JSONObject a) {
    String url = a.optString("url");
    if (!FeedRules.safeUrl(url)) {
      toast("This link cannot be opened safely.");
      return;
    }
    try {
      history.put(url, a);
      save();
      startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    } catch (Exception e) {
      toast("No browser available to open this source.");
    }
  }

  private void editNote(JSONObject a) {
    EditText field = new EditText(this);
    field.setMinLines(3);
    field.setText(notes.optString(a.optString("url")));
    new AlertDialog.Builder(this)
        .setTitle(tr("Your note"))
        .setView(field)
        .setNegativeButton(tr("Cancel"), null)
        .setPositiveButton(
            "Save",
            (d, n) -> {
              try {
                notes.put(a.optString("url"), field.getText().toString());
                saved.put(a.optString("url"), a);
                save();
                render();
              } catch (Exception ignored) {
              }
            })
        .show();
  }

  private void library() {
    heading(tr("Reading library"));
    body.addView(
        text(
            "Saved stories and notes stay on this device. Saved records may be older than live"
                + " feeds.",
            14,
            MUTED));
    if (saved.length() == 0)
      body.addView(text(tr("Save a story from a country feed to begin."), 16, MUTED));
    Iterator<String> keys = saved.keys();
    while (keys.hasNext()) articleCard(saved.optJSONObject(keys.next()), true);
  }

  private EditText field(LinearLayout form, String hint, String value) {
    EditText e = new EditText(this);
    e.setHint(tr(hint));
    e.setText(value);
    e.setMinLines(1);
    form.addView(e);
    return e;
  }

  private void workspace() {
    heading(tr("Research workspace"));
    body.addView(button("Create dossier", () -> editDossier(-1)));
    for (int i = 0; i < dossiers.length(); i++) {
      final int index = i;
      JSONObject d = dossiers.optJSONObject(i);
      LinearLayout c = card();
      c.addView(text(d.optString("title"), 20, INK));
      c.addView(
          text(
              d.optString("assessment", "Exploratory")
                  + " · "
                  + d.optJSONArray("evidence").length()
                  + " sources",
              13,
              MUTED));
      if (!d.optString("note").trim().isEmpty()) c.addView(text(d.optString("note"), 14, INK));
      c.addView(button("Open dossier", () -> showDossier(index)));
    }
    heading(tr("Monitoring plans"));
    for (String topic : topics)
      if (watched.contains(topic)) {
        JSONObject plan = plans.optJSONObject(topic);
        LinearLayout pc = card();
        pc.addView(text(label(topic), 19, INK));
        if (plan != null) {
          pc.addView(
              text(
                  plan.optString("status")
                      + " · "
                      + plan.optString("priority")
                      + " priority · "
                      + plan.optString("confidence")
                      + " confidence",
                  13,
                  MUTED));
          pc.addView(text(plan.optString("thesis"), 15, INK));
          if (!plan.optString("review").isEmpty())
            pc.addView(text("Review: " + plan.optString("review"), 13, MUTED));
        }
        pc.addView(button("Edit monitoring plan", () -> editPlan(topic)));
      }
    heading(tr("Tasks"));
    body.addView(button("Add task", () -> editTask()));
    for (int i = 0; i < tasks.length(); i++) {
      final int index = i;
      JSONObject task = tasks.optJSONObject(i);
      LinearLayout row = card();
      CheckBox check = new CheckBox(this);
      check.setText(
          task.optString("title")
              + (task.optString("due").isEmpty() ? "" : " · " + task.optString("due")));
      check.setChecked(task.optBoolean("done"));
      check.setOnCheckedChangeListener(
          (v, yes) -> {
            try {
              task.put("done", yes);
              save();
            } catch (Exception ignored) {
            }
          });
      row.addView(check);
      if (!task.optString("detail").isEmpty())
        row.addView(text(task.optString("detail"), 14, MUTED));
      row.addView(
          button(
              "Delete",
              () ->
                  confirmDelete(
                      () -> {
                        tasks.remove(index);
                        save();
                        render();
                      })));
    }
    heading(tr("Snapshots"));
    body.addView(
        button(
            "Capture reading snapshot",
            () -> {
              try {
                snapshots.put(
                    new JSONObject()
                        .put("createdAt", Instant.now().toString())
                        .put("saved", new JSONObject(saved.toString()))
                        .put("notes", new JSONObject(notes.toString()))
                        .put("plans", new JSONObject(plans.toString()))
                        .put("signals", new JSONArray(regionalSignals.toString()))
                        .put("noteCount", notes.length()));
                save();
                render();
              } catch (Exception ignored) {
              }
            }));
    for (int i = snapshots.length() - 1; i >= 0; i--) {
      final int index = i;
      JSONObject snap = snapshots.optJSONObject(i);
      LinearLayout c = card();
      c.addView(text(date(snap.optString("createdAt")), 17, INK));
      c.addView(
          button(
              "View snapshot",
              () -> {
                body.removeAllViews();
                heading(tr("Reading snapshot"));
                body.addView(text(date(snap.optString("createdAt")), 14, MUTED));
                JSONObject a = snap.optJSONObject("saved");
                JSONObject liveNotes = notes;
                notes =
                    snap.optJSONObject("notes") == null
                        ? new JSONObject()
                        : snap.optJSONObject("notes");
                Iterator<String> it = a.keys();
                while (it.hasNext()) articleCard(a.optJSONObject(it.next()), true);
                notes = liveNotes;
                body.addView(
                    text(
                        "Captured notes: "
                            + snap.optInt("noteCount")
                            + " · This is a historical record, not a live feed.",
                        14,
                        MUTED));
                body.addView(button("Back to workspace", this::render));
              }));
      c.addView(
          button(
              "Delete",
              () ->
                  confirmDelete(
                      () -> {
                        snapshots.remove(index);
                        save();
                        render();
                      })));
    }
  }

  private void editDossier(int index) {
    JSONObject old = index < 0 ? new JSONObject() : dossiers.optJSONObject(index);
    LinearLayout form = new LinearLayout(this);
    form.setPadding(dp(20), dp(8), dp(20), dp(8));
    form.setOrientation(LinearLayout.VERTICAL);
    EditText title = field(form, "Title", old.optString("title")),
        note = field(form, "Notes", old.optString("note")),
        conclusion = field(form, "Conclusion", old.optString("conclusion")),
        recommendation = field(form, "Next steps", old.optString("recommendation"));
    Spinner assessment = new Spinner(this);
    String[] labels = {"Exploratory", "Developing", "Confirmed"};
    assessment.setAdapter(
        new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels));
    assessment.setSelection(
        Math.max(0, Arrays.asList(labels).indexOf(old.optString("assessment"))));
    form.addView(assessment);
    ScrollView scroll = new ScrollView(this);
    scroll.addView(form);
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle(index < 0 ? "Create dossier" : "Edit dossier")
            .setView(scroll)
            .setNegativeButton(tr("Cancel"), null)
            .setPositiveButton(tr("Save"), null)
            .create();
    dialog.setOnShowListener(
        v ->
            dialog
                .getButton(-1)
                .setOnClickListener(
                    x -> {
                      if (title.getText().toString().trim().isEmpty()) {
                        title.setError(tr("Enter a title"));
                        return;
                      }
                      try {
                        JSONObject d =
                            new JSONObject(old.toString())
                                .put("title", title.getText().toString())
                                .put("note", note.getText().toString())
                                .put("conclusion", conclusion.getText().toString())
                                .put("recommendation", recommendation.getText().toString())
                                .put("assessment", labels[assessment.getSelectedItemPosition()])
                                .put("updatedAt", Instant.now().toString());
                        if (!d.has("evidence")) d.put("evidence", new JSONArray());
                        if (index < 0) dossiers.put(d);
                        else dossiers.put(index, d);
                        save();
                        dialog.dismiss();
                        render();
                      } catch (Exception e) {
                        toast("Could not save dossier");
                      }
                    }));
    dialog.show();
  }

  private void showDossier(int index) {
    JSONObject d = dossiers.optJSONObject(index);
    body.removeAllViews();
    heading(d.optString("title"));
    for (String k : new String[] {"assessment", "note", "conclusion", "recommendation"})
      if (!d.optString(k).trim().isEmpty())
        body.addView(text(label(k) + "\n" + d.optString(k), 16, INK));
    body.addView(button("Edit dossier", () -> editDossier(index)));
    body.addView(
        button(
            "Export as text",
            () -> {
              StringBuilder out = new StringBuilder(d.optString("title"));
              for (String k : new String[] {"assessment", "note", "conclusion", "recommendation"})
                out.append("\n\n").append(label(k)).append(": ").append(d.optString(k));
              JSONArray a = d.optJSONArray("evidence");
              for (int j = 0; j < a.length(); j++)
                out.append("\n\n")
                    .append(a.optJSONObject(j).optString("title"))
                    .append("\n")
                    .append(a.optJSONObject(j).optString("url"));
              Intent share = new Intent(Intent.ACTION_SEND);
              share.setType("text/plain");
              share.putExtra(Intent.EXTRA_TEXT, out.toString());
              startActivity(Intent.createChooser(share, "Export dossier"));
            }));
    JSONArray evidence = d.optJSONArray("evidence");
    for (int j = 0; j < evidence.length(); j++) articleCard(evidence.optJSONObject(j), true);
    body.addView(
        button(
            "Delete dossier",
            () ->
                confirmDelete(
                    () -> {
                      dossiers.remove(index);
                      save();
                      render();
                    })));
    body.addView(button("Back to workspace", this::render));
  }

  private void addEvidence(JSONObject a) {
    if (dossiers.length() == 0) {
      toast("Create a dossier in Workspace first.");
      return;
    }
    String[] titles = new String[dossiers.length()];
    for (int i = 0; i < titles.length; i++)
      titles[i] = dossiers.optJSONObject(i).optString("title");
    new AlertDialog.Builder(this)
        .setTitle(tr("Add source to dossier"))
        .setItems(
            titles,
            (dialog, index) -> {
              JSONArray evidence = dossiers.optJSONObject(index).optJSONArray("evidence");
              for (int i = 0; i < evidence.length(); i++)
                if (evidence.optJSONObject(i).optString("url").equals(a.optString("url"))) {
                  toast("This source is already in the dossier.");
                  return;
                }
              evidence.put(a);
              save();
              toast("Source added.");
            })
        .show();
  }

  private void editTask() {
    LinearLayout form = new LinearLayout(this);
    form.setOrientation(LinearLayout.VERTICAL);
    form.setPadding(dp(20), dp(10), dp(20), 0);
    EditText name = field(form, "Task", ""), detail = field(form, "Details", "");
    Spinner topic = choice(form, topics, "politics");
    Button due = button("Choose due date", () -> {});
    final String[] date = {""};
    due.setOnClickListener(
        v -> {
          Calendar c = Calendar.getInstance();
          new DatePickerDialog(
                  this,
                  (p, y, m, d) -> {
                    date[0] = String.format(Locale.ROOT, "%04d-%02d-%02d", y, m + 1, d);
                    due.setText(date[0]);
                  },
                  c.get(Calendar.YEAR),
                  c.get(Calendar.MONTH),
                  c.get(Calendar.DAY_OF_MONTH))
              .show();
        });
    form.addView(due);
    AlertDialog dialog =
        new AlertDialog.Builder(this)
            .setTitle(tr("Add task"))
            .setView(form)
            .setNegativeButton(tr("Cancel"), null)
            .setPositiveButton(tr("Save"), null)
            .create();
    dialog.setOnShowListener(
        v ->
            dialog
                .getButton(-1)
                .setOnClickListener(
                    x -> {
                      if (name.getText().toString().trim().isEmpty()) {
                        name.setError(tr("Enter a task"));
                        return;
                      }
                      try {
                        tasks.put(
                            new JSONObject()
                                .put("title", name.getText().toString())
                                .put("detail", detail.getText().toString())
                                .put("topic", topics[topic.getSelectedItemPosition()])
                                .put("createdAt", Instant.now().toString())
                                .put("due", date[0])
                                .put("done", false));
                        save();
                        dialog.dismiss();
                        render();
                      } catch (Exception ignored) {
                      }
                    }));
    dialog.show();
  }

  private Spinner choice(LinearLayout form, String[] values, String current) {
    Spinner spinner = new Spinner(this);
    spinner.setAdapter(
        new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, values));
    spinner.setSelection(Math.max(0, Arrays.asList(values).indexOf(current)));
    form.addView(spinner);
    return spinner;
  }

  private void editPlan(String topic) {
    JSONObject old = plans.optJSONObject(topic);
    if (old == null) old = new JSONObject();
    LinearLayout form = new LinearLayout(this);
    form.setOrientation(LinearLayout.VERTICAL);
    form.setPadding(dp(20), dp(8), dp(20), dp(8));
    form.addView(text(tr("Status / priority / confidence"), 14, MUTED));
    String[] statuses = {"Observing", "Escalating", "Archived"},
        priorities = {"Background", "Active", "Urgent"},
        confidences = {"Low", "Medium", "High"};
    Spinner state = choice(form, statuses, old.optString("status", "Observing")),
        priority = choice(form, priorities, old.optString("priority", "Active")),
        confidence = choice(form, confidences, old.optString("confidence", "Medium"));
    EditText thesis = field(form, "Working thesis", old.optString("thesis")),
        decision = field(form, "Decision summary", old.optString("decision")),
        note = field(form, "Analyst notes", old.optString("note"));
    final String[] review = {old.optString("review")};
    Button due = button(review[0].isEmpty() ? "Next review date" : review[0], () -> {});
    due.setOnClickListener(
        v -> {
          Calendar c = Calendar.getInstance();
          new DatePickerDialog(
                  this,
                  (p, y, m, d) -> {
                    review[0] = String.format(Locale.ROOT, "%04d-%02d-%02d", y, m + 1, d);
                    due.setText(review[0]);
                  },
                  c.get(Calendar.YEAR),
                  c.get(Calendar.MONTH),
                  c.get(Calendar.DAY_OF_MONTH))
              .show();
        });
    form.addView(due);
    ScrollView scroll = new ScrollView(this);
    scroll.addView(form);
    new AlertDialog.Builder(this)
        .setTitle(label(topic) + " monitoring")
        .setView(scroll)
        .setNegativeButton(tr("Cancel"), null)
        .setPositiveButton(
            "Save",
            (dialog, which) -> {
              try {
                plans.put(
                    topic,
                    new JSONObject()
                        .put("status", statuses[state.getSelectedItemPosition()])
                        .put("priority", priorities[priority.getSelectedItemPosition()])
                        .put("confidence", confidences[confidence.getSelectedItemPosition()])
                        .put("thesis", thesis.getText().toString())
                        .put("decision", decision.getText().toString())
                        .put("note", note.getText().toString())
                        .put("review", review[0])
                        .put("updatedAt", Instant.now().toString()));
                save();
                render();
              } catch (Exception e) {
                toast("Could not save monitoring plan");
              }
            })
        .show();
  }

  private void confirmDelete(Runnable run) {
    new AlertDialog.Builder(this)
        .setTitle(tr("Delete this item?"))
        .setMessage(tr("This removes the item from this device."))
        .setNegativeButton(tr("Cancel"), null)
        .setPositiveButton(tr("Delete"), (d, n) -> run.run())
        .show();
  }

  private void settings() {
    heading(tr("Settings"));
    body.addView(text(tr("Interface language"), 16, INK));
    String[] languageNames = {"English", "Español", "Português"},
        languageCodes = {"en", "es", "pt"};
    Spinner localePicker =
        choice(
            body,
            languageNames,
            languageNames[Math.max(0, Arrays.asList(languageCodes).indexOf(language))]);
    localePicker.setOnItemSelectedListener(
        new AdapterView.OnItemSelectedListener() {
          public void onNothingSelected(AdapterView<?> p) {}

          public void onItemSelected(AdapterView<?> p, View v, int i, long id) {
            if (!languageCodes[i].equals(language)) {
              prefs.edit().putString("language", languageCodes[i]).apply();
              recreate();
            }
          }
        });
    body.addView(
        text(
            "Latam Digest · Android 1.0\n"
                + "News in its original language. Research stored on your device.",
            16,
            MUTED));
    Switch reminder = new Switch(this);
    reminder.setText(tr("Daily reading reminder"));
    reminder.setChecked(prefs.getBoolean("reminder", false));
    reminder.setOnCheckedChangeListener(
        (v, yes) -> {
          prefs.edit().putBoolean("reminder", yes).apply();
          if (yes
              && Build.VERSION.SDK_INT >= 33
              && checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                  != android.content.pm.PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, 10);
          ReminderReceiver.schedule(this);
        });
    body.addView(reminder);
    body.addView(
        button(
            "Reminder time",
            () ->
                new TimePickerDialog(
                        this,
                        (v, h, m) -> {
                          prefs.edit().putInt("hour", h).putInt("minute", m).apply();
                          ReminderReceiver.schedule(this);
                          toast("Reminder time saved. Android may delay delivery to save battery.");
                        },
                        prefs.getInt("hour", 9),
                        prefs.getInt("minute", 0),
                        true)
                    .show()));
    body.addView(
        text(
            "Reminders prompt you to read; they do not claim that new stories have arrived. Android"
                + " controls delivery timing.",
            14,
            MUTED));
    body.addView(
        button(
            "Privacy policy",
            () ->
                startActivity(
                    new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://apovolotski.github.io/LatamDigest/privacy.html")))));
    body.addView(
        button(
            "Support",
            () ->
                startActivity(
                    new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://apovolotski.github.io/LatamDigest/support.html")))));
    body.addView(
        button(
            "Clear reading history",
            () ->
                confirmDelete(
                    () -> {
                      history = new JSONObject();
                      save();
                      toast("Reading history cleared.");
                    })));
    body.addView(
        button(
            "Delete all local data",
            () ->
                new AlertDialog.Builder(this)
                    .setTitle(tr("Delete all local data?"))
                    .setMessage(
                        "Saved stories, notes, dossiers, tasks, snapshots, preferences and cached"
                            + " feeds will be removed.")
                    .setNegativeButton(tr("Cancel"), null)
                    .setPositiveButton(
                        "Delete",
                        (d, n) -> {
                          prefs.edit().clear().commit();
                          getSharedPreferences("feeds", 0).edit().clear().commit();
                          ReminderReceiver.schedule(this);
                          recreate();
                        })
                    .show()));
  }

  @Override
  public void onRequestPermissionsResult(int r, String[] permissions, int[] grants) {
    super.onRequestPermissionsResult(r, permissions, grants);
    if (r == 10
        && (grants.length == 0
            || grants[0] != android.content.pm.PackageManager.PERMISSION_GRANTED)) {
      prefs.edit().putBoolean("reminder", false).apply();
      ReminderReceiver.schedule(this);
      if (screen.equals("Settings")) render();
    }
  }

  private void expireVisibleFeed() {
    boolean regionExpired =
        regionalFeeds
            .entrySet()
            .removeIf(
                e -> !FeedRules.currentFeed(e.getValue().published(), System.currentTimeMillis()));
    if (regionExpired && screen.equals("Today")) render();
    if (loaded != null) {
      long now = System.currentTimeMillis();
      boolean valid = FeedRules.currentFeed(loaded.published(), now);
      for (int i = 0; i < articles.length(); i++)
        valid &= FeedRules.currentArticle(articles.optJSONObject(i).optString("publishedAt"), now);
      if (!valid) {
        loaded = null;
        articles = new JSONArray();
        if (screen.equals("Feeds")) render();
      }
    }
  }

  @Override
  protected void onResume() {
    super.onResume();
    expireVisibleFeed();
    freshnessHandler.postDelayed(freshnessCheck, 60000);
  }

  @Override
  protected void onPause() {
    freshnessHandler.removeCallbacks(freshnessCheck);
    super.onPause();
  }

  // API 33+ uses the native OnBackInvokedDispatcher registered in onCreate.
  // This override remains only for the supported API 26-32 legacy back button.
  @android.annotation.SuppressLint("GestureBackNavigation")
  @Override
  public void onBackPressed() {
    if (!screen.equals("Today")) switchTo("Today");
    else super.onBackPressed();
  }

  @Override
  protected void onDestroy() {
    generation++;
    if (request != null) request.cancel(true);
    io.shutdownNow();
    super.onDestroy();
  }
}

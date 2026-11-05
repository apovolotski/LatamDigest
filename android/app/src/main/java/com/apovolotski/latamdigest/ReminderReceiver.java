package com.apovolotski.latamdigest;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import java.util.Calendar;

public class ReminderReceiver extends BroadcastReceiver {
  static void schedule(Context c) {
    var p = c.getSharedPreferences("workspace", 0);
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    PendingIntent pi =
        PendingIntent.getBroadcast(
            c,
            1,
            new Intent(c, ReminderReceiver.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    am.cancel(pi);
    if (!p.getBoolean("reminder", false)) return;
    Calendar next = Calendar.getInstance();
    next.set(Calendar.HOUR_OF_DAY, p.getInt("hour", 9));
    next.set(Calendar.MINUTE, p.getInt("minute", 0));
    next.set(Calendar.SECOND, 0);
    if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_YEAR, 1);
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
  }

  @Override
  public void onReceive(Context c, Intent i) {
    if (!c.getSharedPreferences("workspace", 0).getBoolean("reminder", false)) return;
    NotificationManager n = c.getSystemService(NotificationManager.class);
    n.createNotificationChannel(
        new NotificationChannel(
            "reading", "Reading reminders", NotificationManager.IMPORTANCE_DEFAULT));
    if (android.os.Build.VERSION.SDK_INT < 33
        || c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
            == PackageManager.PERMISSION_GRANTED) {
      PendingIntent open =
          PendingIntent.getActivity(
              c, 2, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
      n.notify(
          1,
          new Notification.Builder(c, "reading")
              .setSmallIcon(android.R.drawable.ic_menu_today)
              .setContentTitle("Latam Digest")
              .setContentText("Time to review your reading list and country feeds.")
              .setContentIntent(open)
              .setAutoCancel(true)
              .build());
    }
    schedule(c);
  }
}

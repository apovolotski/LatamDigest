package com.apovolotski.japandigest

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.time.ZonedDateTime

object ReminderScheduler {
    private const val CHANNEL = "daily-reading"
    private const val PREFS = "reminder-schedule"
    private fun alarm(context: Context) = PendingIntent.getBroadcast(context, 1,
        Intent(context, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun configure(context: Context, data: UserData) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("enabled", data.reminders).putInt("hour", data.reminderHour).putInt("minute", data.reminderMinute).apply()
        schedule(context)
    }

    fun schedule(context: Context) {
        val manager = context.getSystemService(AlarmManager::class.java)
        manager.cancel(alarm(context))
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("enabled", false)) return
        val hour = prefs.getInt("hour", 7).coerceIn(0, 23)
        val minute = prefs.getInt("minute", 30).coerceIn(0, 59)
        val now = ZonedDateTime.now()
        var next = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
        if (!next.isAfter(now)) next = next.plusDays(1)
        // An inexact local reminder needs no exact-alarm permission and no server.
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.toInstant().toEpochMilli(), alarm(context))
    }

    fun permitted(context: Context): Boolean =
        (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
            context.getSystemService(NotificationManager::class.java).areNotificationsEnabled()

    fun deliver(context: Context) {
        if (!context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", false)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, context.getString(R.string.notification_channel), NotificationManager.IMPORTANCE_DEFAULT))
        if (permitted(context)) {
            val intent = PendingIntent.getActivity(context, 2, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            manager.notify(1, NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notebook).setContentTitle(context.getString(R.string.notification_title))
                .setContentText(context.getString(R.string.notification_body)).setAutoCancel(true).setContentIntent(intent).build())
        }
        schedule(context)
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { ReminderScheduler.deliver(context) }
}
class ReminderResetReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED))
            ReminderScheduler.schedule(context)
    }
}

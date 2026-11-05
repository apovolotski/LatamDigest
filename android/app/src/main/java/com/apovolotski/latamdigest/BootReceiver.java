package com.apovolotski.latamdigest;

import android.content.*;

public class BootReceiver extends BroadcastReceiver {
  public void onReceive(Context c, Intent i) {
    if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) ReminderReceiver.schedule(c);
  }
}

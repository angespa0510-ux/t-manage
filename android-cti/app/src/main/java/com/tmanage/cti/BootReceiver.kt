package com.tmanage.cti

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // 前回サービスがONだった場合のみ自動起動
        val prefs = context.getSharedPreferences("cti_prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("service_enabled", false)) {
            val serviceIntent = Intent(context, CallListenerService::class.java)
            ContextCompat.startForegroundService(context, serviceIntent)
        }
    }
}

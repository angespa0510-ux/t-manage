package com.tmanage.cti

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.IntentFilter
import android.os.IBinder
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat

class CallListenerService : Service() {

    private var callReceiver: CallReceiver? = null

    companion object {
        private const val CHANNEL_ID = "cti_service_channel"
        private const val NOTIFICATION_ID = 1
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // フォアグラウンド通知を表示
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("T-MANAGE CTI")
            .setContentText("📞 着信監視中...")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        // 着信レシーバーを登録
        if (callReceiver == null) {
            callReceiver = CallReceiver()
            val filter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
            registerReceiver(callReceiver, filter)
        }

        // システムに殺されても再起動
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        callReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        callReceiver = null
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "CTI監視サービス",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "着信を監視してT-MANAGEに通知します"
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }
}

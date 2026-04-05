package com.tmanage.cti

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
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
        try {
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

            // Android 14+ はサービスタイプ指定が必要
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }

            // 着信レシーバーを登録
            if (callReceiver == null) {
                callReceiver = CallReceiver()
                val filter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    registerReceiver(callReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
                } else {
                    registerReceiver(callReceiver, filter)
                }
            }

            MainActivity.logCallback?.invoke("サービスを開始しました")
        } catch (e: Exception) {
            MainActivity.logCallback?.invoke("❌ サービス開始エラー: ${e.message}")
            stopSelf()
        }

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

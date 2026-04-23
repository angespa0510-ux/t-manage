package com.tmanage.cti

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class CallReceiver : BroadcastReceiver() {

    companion object {
        // 重複送信防止: 最後に送信した番号と時刻
        private var lastSentPhone: String = ""
        private var lastSentTime: Long = 0
        private const val DEDUP_INTERVAL_MS = 30000 // 30秒以内の同じ番号は無視
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

        if (state == TelephonyManager.EXTRA_STATE_RINGING && number != null) {
            val normalized = normalizePhone(number)

            // 重複チェック: 同じ番号が30秒以内に来たら無視
            val now = System.currentTimeMillis()
            if (normalized == lastSentPhone && (now - lastSentTime) < DEDUP_INTERVAL_MS) {
                MainActivity.logCallback?.invoke("⏭ 重複スキップ: $normalized")
                return
            }

            lastSentPhone = normalized
            lastSentTime = now
            sendToSupabase(context, normalized)
        }
    }

    private fun normalizePhone(phone: String): String {
        return phone.replace(Regex("[\\-\\s　()（）]"), "")
    }

    private fun sendToSupabase(context: Context, phone: String) {
        if (Config.SUPABASE_URL.contains("xxxxxxxxxx")) {
            MainActivity.logCallback?.invoke("⚠ Supabase未設定: $phone")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("${Config.SUPABASE_URL}/rest/v1/cti_calls")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("apikey", Config.SUPABASE_ANON_KEY)
                conn.setRequestProperty("Authorization", "Bearer ${Config.SUPABASE_ANON_KEY}")
                conn.setRequestProperty("Prefer", "return=minimal")
                conn.doOutput = true
                conn.connectTimeout = 5000
                conn.readTimeout = 5000

                val json = """{"phone":"$phone","source":"android","store_id":1}"""
                OutputStreamWriter(conn.outputStream).use { it.write(json) }

                val code = conn.responseCode
                conn.disconnect()

                if (code in 200..299) {
                    MainActivity.logCallback?.invoke("✅ 送信成功: $phone")
                } else {
                    MainActivity.logCallback?.invoke("❌ 送信失敗 (HTTP $code): $phone")
                }
            } catch (e: Exception) {
                MainActivity.logCallback?.invoke("❌ エラー: ${e.message}")
            }
        }
    }
}

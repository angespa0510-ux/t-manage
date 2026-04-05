package com.tmanage.cti

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var btnToggle: Button
    private lateinit var tvStatus: TextView
    private lateinit var tvLog: TextView
    private lateinit var scrollLog: ScrollView

    companion object {
        private const val PERMISSION_REQUEST_CODE = 100
        private const val PREFS_NAME = "cti_prefs"
        private const val KEY_SERVICE_ENABLED = "service_enabled"

        // ログ追記用（他クラスからも呼べるように）
        var logCallback: ((String) -> Unit)? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // UIを動的に構築（XMLレイアウトなしでもシンプルに動作）
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 80, 48, 48)
            setBackgroundColor(0xFFF8F6F3.toInt())
        }

        // タイトル
        val tvTitle = TextView(this).apply {
            text = "📞 T-MANAGE CTI"
            textSize = 24f
            setTextColor(0xFF2C2C2A.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 8)
        }
        layout.addView(tvTitle)

        val tvSubtitle = TextView(this).apply {
            text = "着信時にPCへ顧客情報を表示"
            textSize = 13f
            setTextColor(0xFF888780.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 40)
        }
        layout.addView(tvSubtitle)

        // ステータス表示
        tvStatus = TextView(this).apply {
            text = "⏹ 停止中"
            textSize = 18f
            setTextColor(0xFF888780.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 24)
        }
        layout.addView(tvStatus)

        // ON/OFFボタン
        btnToggle = Button(this).apply {
            text = "▶ サービス開始"
            textSize = 16f
            setBackgroundColor(0xFFC3A782.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(32, 24, 32, 24)
            setOnClickListener { toggleService() }
        }
        layout.addView(btnToggle, android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = 32 })

        // 接続状態
        val tvConnLabel = TextView(this).apply {
            text = "Supabase接続先:"
            textSize = 11f
            setTextColor(0xFF888780.toInt())
            setPadding(0, 16, 0, 4)
        }
        layout.addView(tvConnLabel)

        val tvConn = TextView(this).apply {
            text = if (Config.SUPABASE_URL.contains("xxxxxxxxxx")) "⚠ 未設定（Config.ktを編集してください）" else "✅ ${Config.SUPABASE_URL}"
            textSize = 11f
            setTextColor(if (Config.SUPABASE_URL.contains("xxxxxxxxxx")) 0xFFc45555.toInt() else 0xFF4a7c59.toInt())
            setPadding(0, 0, 0, 24)
        }
        layout.addView(tvConn)

        // ログ表示エリア
        val tvLogLabel = TextView(this).apply {
            text = "📋 着信ログ"
            textSize = 13f
            setTextColor(0xFF2C2C2A.toInt())
            setPadding(0, 0, 0, 8)
        }
        layout.addView(tvLogLabel)

        scrollLog = ScrollView(this).apply {
            setBackgroundColor(0xFFFFFFFF.toInt())
            setPadding(16, 16, 16, 16)
        }
        tvLog = TextView(this).apply {
            text = "着信があるとここに表示されます"
            textSize = 12f
            setTextColor(0xFF888780.toInt())
        }
        scrollLog.addView(tvLog)
        layout.addView(scrollLog, android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))

        setContentView(layout)

        // ログコールバック設定
        logCallback = { msg ->
            runOnUiThread {
                val time = SimpleDateFormat("HH:mm:ss", Locale.JAPAN).format(Date())
                tvLog.append("\n[$time] $msg")
                scrollLog.post { scrollLog.fullScroll(ScrollView.FOCUS_DOWN) }
            }
        }

        // 権限チェック
        checkPermissions()

        // 前回の状態を復元
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (prefs.getBoolean(KEY_SERVICE_ENABLED, false)) {
            startCtiService()
        }
    }

    private fun checkPermissions() {
        val perms = mutableListOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val needed = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    private fun toggleService() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val running = prefs.getBoolean(KEY_SERVICE_ENABLED, false)

        if (running) {
            stopCtiService()
        } else {
            startCtiService()
        }
    }

    private fun startCtiService() {
        val intent = Intent(this, CallListenerService::class.java)
        ContextCompat.startForegroundService(this, intent)

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putBoolean(KEY_SERVICE_ENABLED, true).apply()

        tvStatus.text = "🟢 監視中"
        tvStatus.setTextColor(0xFF4a7c59.toInt())
        btnToggle.text = "⏹ サービス停止"
        btnToggle.setBackgroundColor(0xFFc45555.toInt())

        logCallback?.invoke("サービスを開始しました")
    }

    private fun stopCtiService() {
        val intent = Intent(this, CallListenerService::class.java)
        stopService(intent)

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putBoolean(KEY_SERVICE_ENABLED, false).apply()

        tvStatus.text = "⏹ 停止中"
        tvStatus.setTextColor(0xFF888780.toInt())
        btnToggle.text = "▶ サービス開始"
        btnToggle.setBackgroundColor(0xFFC3A782.toInt())

        logCallback?.invoke("サービスを停止しました")
    }

    override fun onDestroy() {
        super.onDestroy()
        logCallback = null
    }
}

package com.guocui.mahjong

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File

class MainActivity : Activity() {

    companion object {
        private const val VIRTUAL_HOST = "appassets.androidplatform.net"
        private const val APP_URL = "https://appassets.androidplatform.net/index.html"
        private const val PREFS_NAME = "guocui_mahjong_prefs"
        private const val KEY_RECORDS = "mahjong_records_v1"
        private const val RECORDS_FILE = "mahjong_records.json"

        private const val REQ_EXPORT_JSON = 8101
        private const val REQ_IMPORT_JSON = 8102
    }

    private lateinit var webView: WebView
    private var pendingExportJson: String = ""
    private var lastBackPressTime: Long = 0L
    private var backCallback: OnBackInvokedCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        requestWindowFeature( android.view.Window.FEATURE_NO_TITLE )
        super.onCreate(savedInstanceState)
        actionBar?.hide()

        // 1. 保持屏幕常亮 + 开启一加 Ace 7 120Hz 高刷新率与全面屏挖孔延伸
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        configureOnePlusHighRefreshAndCutout()

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
        }

        configureWebSettings(webView.settings)
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url ?: return null
                if (uri.host != VIRTUAL_HOST) {
                    return super.shouldInterceptRequest(view, request)
                }
                var relPath = uri.path ?: "/index.html"
                if (relPath.startsWith("/")) {
                    relPath = relPath.substring(1)
                }
                if (relPath.isEmpty()) {
                    relPath = "index.html"
                }

                val corsHeaders = mapOf(
                    "Access-Control-Allow-Origin" to "*",
                    "Access-Control-Allow-Methods" to "GET, HEAD, OPTIONS",
                    "Cache-Control" to "no-store"
                )

                // 拦截虚拟 Service Worker 注册，避免本地打包资源离线冲突
                if (relPath == "sw.js" || relPath == "registerSW.js") {
                    return WebResourceResponse(
                        "application/javascript",
                        "UTF-8",
                        200,
                        "OK",
                        corsHeaders,
                        ByteArrayInputStream("// native offline bundle".toByteArray(Charsets.UTF_8))
                    )
                }

                return try {
                    val assetStream = assets.open("www/$relPath")
                    val mime = guessMimeType(relPath)
                    WebResourceResponse(mime, "UTF-8", 200, "OK", corsHeaders, assetStream)
                } catch (_: Exception) {
                    null
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectCutoutInsetsToCss(root.rootWindowInsets)
            }
        }

        root.addView(
            webView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )

        // 监听一加 Ace 7 前置挖孔与全面屏手势安全区，动态注入到 CSS 变量
        root.setOnApplyWindowInsetsListener { _, insets ->
            injectCutoutInsetsToCss(insets)
            insets
        }

        setContentView(root)
        enableImmersiveFullscreen()
        registerAndroid17BackNavigation()

        webView.loadUrl(APP_URL)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveFullscreen()
        }
    }

    /**
     * 针对一加 Ace 7 (Android 17 / ColorOS) 启用 120Hz 满血高刷与前置摄像头挖孔屏全黑融合
     */
    private fun configureOnePlusHighRefreshAndCutout() {
        val lp = window.attributes
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        try {
            val d = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else windowManager.defaultDisplay
            val modes = d?.supportedModes
            val bestMode = modes?.maxByOrNull { it.refreshRate }
            if (bestMode != null) {
                lp.preferredDisplayModeId = bestMode.modeId
                lp.preferredRefreshRate = bestMode.refreshRate
            } else {
                lp.preferredRefreshRate = 120f
            }
        } catch (_: Exception) {
            lp.preferredRefreshRate = 120f
        }
        window.attributes = lp
    }

    /**
     * 启用 Android 17 Edge-to-Edge 沉浸式横屏全屏模式（隐藏状态栏与小白条，边缘滑入临时唤出）
     */
    private fun enableImmersiveFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
        }
    }

    /**
     * 读取一加 Ace 7 横屏时左/右前置挖孔像素距离，转换为 CSS px 注入给前端牌桌
     */
    private fun injectCutoutInsetsToCss(insets: WindowInsets?) {
        if (insets == null) return
        val density = resources.displayMetrics.density.coerceAtLeast(1f)
        var leftPx = 14
        var rightPx = 14
        var topPx = 4
        var bottomPx = 4

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val cutout = insets.getInsets(WindowInsets.Type.displayCutout())
            leftPx = ((cutout.left / density).toInt() + 6).coerceAtLeast(14)
            rightPx = ((cutout.right / density).toInt() + 6).coerceAtLeast(14)
            topPx = (cutout.top / density).toInt().coerceAtLeast(4)
            bottomPx = (cutout.bottom / density).toInt().coerceAtLeast(4)
        } else {
            val cutout = insets.displayCutout
            if (cutout != null) {
                leftPx = ((cutout.safeInsetLeft / density).toInt() + 6).coerceAtLeast(14)
                rightPx = ((cutout.safeInsetRight / density).toInt() + 6).coerceAtLeast(14)
            }
        }

        val js = """
            (function(){
              var r = document.documentElement.style;
              r.setProperty('--android-inset-left', '${leftPx}px');
              r.setProperty('--android-inset-right', '${rightPx}px');
              r.setProperty('--android-inset-top', '${topPx}px');
              r.setProperty('--android-inset-bottom', '${bottomPx}px');
            })();
        """.trimIndent()
        webView.post {
            webView.evaluateJavascript(js, null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebSettings(settings: WebSettings) {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.textZoom = 100
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
    }

    private fun guessMimeType(path: String): String {
        val lower = path.lowercase()
        return when {
            lower.endsWith(".html") -> "text/html"
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
            lower.endsWith(".css") -> "text/css"
            lower.endsWith(".svg") -> "image/svg+xml"
            lower.endsWith(".json") || lower.endsWith(".webmanifest") -> "application/json"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".ico") -> "image/x-icon"
            lower.endsWith(".woff2") -> "font/woff2"
            else -> "application/octet-stream"
        }
    }

    /**
     * Android 17 (API 37) 预测式返回手势支持
     */
    private fun registerAndroid17BackNavigation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val cb = OnBackInvokedCallback {
                handleBackAction()
            }
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                cb
            )
            backCallback = cb
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        handleBackAction()
    }

    private fun handleBackAction() {
        val now = System.currentTimeMillis()
        if (now - lastBackPressTime < 2000L) {
            finish()
        } else {
            lastBackPressTime = now
            Toast.makeText(this, "再按一次返回退出国粹麻将", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backCallback?.let {
                onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it)
            }
        }
        webView.destroy()
        super.onDestroy()
    }

    /**
     * 处理 Android 17 系统 SAF 文件导出与导入结果
     */
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK || data == null) return
        val uri: Uri = data.data ?: return

        when (requestCode) {
            REQ_EXPORT_JSON -> {
                try {
                    contentResolver.openOutputStream(uri, "wt")?.use { out ->
                        out.write(pendingExportJson.toByteArray(Charsets.UTF_8))
                        out.flush()
                    }
                    val msg = "战绩已成功导出到手机文件"
                    Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
                    val escaped = JSONObject.quote(msg)
                    webView.post {
                        webView.evaluateJavascript(
                            "window.__onAndroidExportSuccess && window.__onAndroidExportSuccess($escaped);",
                            null
                        )
                    }
                } catch (e: Exception) {
                    Toast.makeText(this, "导出失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            REQ_IMPORT_JSON -> {
                try {
                    val content = contentResolver.openInputStream(uri)?.use { input ->
                        input.bufferedReader(Charsets.UTF_8).readText()
                    } ?: ""
                    if (content.isNotBlank()) {
                        saveRecordsInternal(content)
                        val escaped = JSONObject.quote(content)
                        webView.post {
                            webView.evaluateJavascript(
                                "window.__onAndroidImportRecords && window.__onAndroidImportRecords($escaped);",
                                null
                            )
                        }
                        Toast.makeText(this, "战绩文件读取成功", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this, "导入失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun saveRecordsInternal(json: String) {
        try {
            File(filesDir, RECORDS_FILE).writeText(json, Charsets.UTF_8)
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_RECORDS, json)
                .apply()
        } catch (_: Exception) {
        }
    }

    private fun loadRecordsInternal(): String {
        return try {
            val f = File(filesDir, RECORDS_FILE)
            if (f.exists()) {
                f.readText(Charsets.UTF_8)
            } else {
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_RECORDS, "") ?: ""
            }
        } catch (_: Exception) {
            ""
        }
    }

    /**
     * 注入给前端的 Android 原生桥接接口
     */
    inner class AndroidBridge {

        @JavascriptInterface
        fun saveRecords(json: String) {
            saveRecordsInternal(json)
        }

        @JavascriptInterface
        fun loadRecords(): String {
            return loadRecordsInternal()
        }

        @JavascriptInterface
        fun exportRecordsFile(json: String, suggestedName: String) {
            pendingExportJson = json
            saveRecordsInternal(json)
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                        putExtra(
                            Intent.EXTRA_TITLE,
                            suggestedName.ifBlank { "mahjong-records.json" }
                        )
                    }
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, REQ_EXPORT_JSON)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "无法打开文件保存器: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openImportPicker() {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(
                            Intent.EXTRA_MIME_TYPES,
                            arrayOf("application/json", "text/plain", "application/octet-stream")
                        )
                    }
                    @Suppress("DEPRECATION")
                    startActivityForResult(intent, REQ_IMPORT_JSON)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "无法打开文件选择器: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        /**
         * 一加 Ace 7 仿生振感马达（O-Haptics）触觉反馈
         */
        @JavascriptInterface
        fun vibrate(type: String) {
            webView.post {
                val feedback = when (type) {
                    "tick" -> HapticFeedbackConstants.CLOCK_TICK
                    "click" -> HapticFeedbackConstants.CONTEXT_CLICK
                    else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        HapticFeedbackConstants.CONFIRM
                    } else {
                        HapticFeedbackConstants.LONG_PRESS
                    }
                }
                webView.performHapticFeedback(feedback)
            }
        }
    }
}

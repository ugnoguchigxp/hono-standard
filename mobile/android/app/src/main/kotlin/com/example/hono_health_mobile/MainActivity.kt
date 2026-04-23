package com.example.hono_health_mobile

import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import android.os.Handler
import android.os.Looper

class MainActivity : FlutterActivity() {
    private val METHOD_CHANNEL = "com.hono.vitals/method"
    private val EVENT_CHANNEL = "com.hono.vitals/stream"

    private lateinit var vitalsProcessor: VitalsProcessor
    private var eventSink: EventChannel.EventSink? = null

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        vitalsProcessor = VitalsProcessor(this)

        // MethodChannel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "startMeasurement" -> {
                    vitalsProcessor.startCollection()
                    result.success(null)
                }
                "stopMeasurement" -> {
                    val data = vitalsProcessor.stopCollection()
                    result.success(data)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }

        // EventChannel
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL).setStreamHandler(
            object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    eventSink = events
                }

                override fun onCancel(arguments: Any?) {
                    eventSink = null
                }
            }
        )

        // Processorからの更新を通知
        vitalsProcessor.onFrameUpdate = { data ->
            Handler(Looper.getMainLooper()).post {
                eventSink?.success(data)
            }
        }
    }
}

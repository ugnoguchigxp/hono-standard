package com.example.hono_health_mobile

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker.FaceLandmarkerOptions
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import java.io.ByteArrayOutputStream
import java.util.Base64
import kotlin.math.hypot

class VitalsProcessor(private val context: Context) {
    private var faceLandmarker: FaceLandmarker? = null
    private var isCollecting = false
    private var results = mutableMapOf<String, MutableMap<String, MutableList<Double>>>()
    private var geometry = mutableMapOf<String, MutableList<Double>>()
    private var capturedImageBase64: String? = null
    private var frameCount = 0
    
    // ノイズ除去用
    private var lastLandmarks: List<NormalizedLandmark>? = null
    private var motionScore: Double = 0.0
    private var smoothingBuffer = mutableMapOf<String, MutableMap<String, MutableList<Double>>>()
    private val smoothingWindow = 3

    var onFrameUpdate: ((Map<String, Any>) -> Unit)? = null

    init {
        setupLandmarker()
        resetResults()
    }

    private fun setupLandmarker() {
        val baseOptionsBuilder = BaseOptions.builder().setModelAssetPath("face_landmarker.task")
        val optionsBuilder = FaceLandmarkerOptions.builder()
            .setBaseOptions(baseOptionsBuilder.build())
            .setRunningMode(com.google.mediapipe.tasks.vision.core.RunningMode.IMAGE)
            .setNumFaces(1)
        faceLandmarker = FaceLandmarker.createFromOptions(context, optionsBuilder.build())
    }

    private fun resetResults() {
        val regions = listOf("forehead", "left_cheek", "right_cheek", "under_eye_left", "under_eye_right", "lips", "left_cheek_hollow", "right_cheek_hollow")
        results = mutableMapOf()
        smoothingBuffer = mutableMapOf()
        for (region in regions) {
            results[region] = mutableMapOf("r" to mutableListOf(), "g" to mutableListOf(), "b" to mutableListOf())
            smoothingBuffer[region] = mutableMapOf("r" to mutableListOf(), "g" to mutableListOf(), "b" to mutableListOf())
        }
        geometry = mutableMapOf("face_width" to mutableListOf(), "face_height" to mutableListOf(), "eye_aperture" to mutableListOf())
        motionScore = 0.0
        lastLandmarks = null
    }

    fun startCollection() {
        resetResults()
        capturedImageBase64 = null
        frameCount = 0
        isCollecting = true
    }

    fun stopCollection(): Map<String, Any> {
        isCollecting = false
        val finalResult = mutableMapOf<String, Any>()
        finalResult.putAll(results)
        finalResult["geometry"] = geometry
        capturedImageBase64?.let { finalResult["thumbnail"] = it }
        return finalResult
    }

    fun processFrame(bitmap: Bitmap) {
        if (!isCollecting) return
        
        if (frameCount == 0) captureThumbnail(bitmap)
        frameCount++

        val mpImage = BitmapImageBuilder(bitmap).build()
        val result = faceLandmarker?.detect(mpImage)

        if (result != null && result.faceLandmarks().isNotEmpty()) {
            val landmarks = result.faceLandmarks()[0]
            
            // 動き検知
            lastLandmarks?.let { last ->
                val d1 = hypot(landmarks[10].x() - last[10].x(), landmarks[10].y() - last[10].y())
                val d2 = hypot(landmarks[1].x() - last[1].x(), landmarks[1].y() - last[1].y())
                val d3 = hypot(landmarks[152].x() - last[152].x(), landmarks[152].y() - last[152].y())
                motionScore = (d1 + d2 + d3).toDouble()
            }
            lastLandmarks = landmarks

            // ROI抽出と平滑化
            val regions = mapOf("forehead" to 10, "left_cheek" to 234, "right_cheek" to 454, "under_eye_left" to 101, "under_eye_right" to 330, "lips" to 0, "left_cheek_hollow" to 214, "right_cheek_hollow" to 434)
            for ((name, idx) in regions) {
                extractAndSmoothRGB(landmarks[idx], name, bitmap)
            }

            // 幾何学
            val faceWidth = Math.abs(landmarks[454].x() - landmarks[234].x())
            val faceHeight = Math.abs(landmarks[152].y() - landmarks[10].y())
            val leftEyeApt = Math.abs(landmarks[159].y() - landmarks[145].y()) / Math.max(0.01f, Math.abs(landmarks[133].x() - landmarks[33].x()))
            val rightEyeApt = Math.abs(landmarks[386].y() - landmarks[374].y()) / Math.max(0.01f, Math.abs(landmarks[362].x() - landmarks[263].x()))

            geometry["face_width"]?.add(faceWidth.toDouble())
            geometry["face_height"]?.add(faceHeight.toDouble())
            geometry["eye_aperture"]?.add(((leftEyeApt + rightEyeApt) / 2.0).toDouble())

            onFrameUpdate?.invoke(mapOf(
                "status" to "detected",
                "motion_score" to motionScore,
                "landmarks" to mapOf(
                    "forehead" to mapOf("x" to landmarks[10].x(), "y" to landmarks[10].y()),
                    "left_cheek" to mapOf("x" to landmarks[234].x(), "y" to landmarks[234].y()),
                    "right_cheek" to mapOf("x" to landmarks[454].x(), "y" to landmarks[454].y()),
                    "lips" to mapOf("x" to landmarks[0].x(), "y" to landmarks[0].y())
                )
            ))
        } else {
            onFrameUpdate?.invoke(mapOf("status" to "not_detected"))
        }
    }

    private fun extractAndSmoothRGB(landmark: NormalizedLandmark, name: String, bitmap: Bitmap) {
        val x = (landmark.x() * bitmap.width).toInt()
        val y = (landmark.y() * bitmap.height).toInt()
        val roiSize = 15
        val halfSize = roiSize / 2
        var r = 0.0; var g = 0.0; var b = 0.0; var count = 0.0
        for (dy in -halfSize until halfSize) {
            for (dx in -halfSize until halfSize) {
                val px = x + dx; val py = y + dy
                if (px >= 0 && px < bitmap.width && py >= 0 && py < bitmap.height) {
                    val color = bitmap.getPixel(px, py)
                    r += android.graphics.Color.red(color)
                    g += android.graphics.Color.green(color)
                    b += android.graphics.Color.blue(color)
                    count += 1.0
                }
            }
        }
        if (count > 0.0) {
            val curR = r / count; val curG = g / count; val curB = b / count
            smoothingBuffer[name]?.get("r")?.add(curR)
            smoothingBuffer[name]?.get("g")?.add(curG)
            smoothingBuffer[name]?.get("b")?.add(curB)
            if (smoothingBuffer[name]?.get("r")?.size ?: 0 > smoothingWindow) {
                smoothingBuffer[name]?.get("r")?.removeAt(0)
                smoothingBuffer[name]?.get("g")?.removeAt(0)
                smoothingBuffer[name]?.get("b")?.removeAt(0)
            }
            results[name]?.get("r")?.add(smoothingBuffer[name]?.get("r")?.average() ?: curR)
            results[name]?.get("g")?.add(smoothingBuffer[name]?.get("g")?.average() ?: curG)
            results[name]?.get("b")?.add(smoothingBuffer[name]?.get("b")?.average() ?: curB)
        }
    }

    private fun captureThumbnail(bitmap: Bitmap) {
        val targetWidth = 480
        val ratio = targetWidth.toFloat() / bitmap.width
        val resized = Bitmap.createScaledBitmap(bitmap, targetWidth, (bitmap.height * ratio).toInt(), true)
        val stream = ByteArrayOutputStream()
        resized.compress(Bitmap.CompressFormat.JPEG, 50, stream)
        capturedImageBase64 = Base64.getEncoder().encodeToString(stream.toByteArray())
    }
}

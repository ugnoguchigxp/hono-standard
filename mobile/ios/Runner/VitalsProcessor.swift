import Foundation
import MediaPipeTasksVision
import AVFoundation
import UIKit

class VitalsProcessor: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private var faceLandmarker: FaceLandmarker?
    private var isCollecting = false
    private var results: [String: [String: [Double]]] = [:]
    private var geometry: [String: [Double]] = [:]
    private var capturedImageBase64: String?
    private var frameCount = 0
    
    // --- ノイズ除去用変数 ---
    private var lastLandmarks: [NormalizedLandmark]?
    private var motionScore: Double = 0.0
    private var smoothingBuffer: [String: [String: [Double]]] = [:]
    private let smoothingWindow = 3 // 3フレームの移動平均

    var onFrameUpdate: (([String: Any]) -> Void)?

    override init() {
        super.init()
        setupLandmarker()
        resetResults()
    }

    private func setupLandmarker() {
        guard let modelPath = Bundle.main.path(forResource: "face_landmarker", ofType: "task", inDirectory: "Frameworks/App.framework/flutter_assets/assets/models") else {
            return
        }
        let options = FaceLandmarkerOptions()
        options.baseOptions.modelAssetPath = modelPath
        options.runningMode = .video
        options.numFaces = 1
        do {
            faceLandmarker = try FaceLandmarker(options: options)
        } catch {
            print("Failed to initialize FaceLandmarker: \(error)")
        }
    }

    private func resetResults() {
        let regions = ["forehead", "left_cheek", "right_cheek", "under_eye_left", "under_eye_right", "lips", "left_cheek_hollow", "right_cheek_hollow"]
        results = [:]
        smoothingBuffer = [:]
        for r in regions {
            results[r] = ["r": [], "g": [], "b": []]
            smoothingBuffer[r] = ["r": [], "g": [], "b": []]
        }
        geometry = ["face_width": [], "face_height": [], "eye_aperture": []]
        motionScore = 0.0
        lastLandmarks = nil
    }

    func startCollection() {
        resetResults()
        capturedImageBase64 = nil
        frameCount = 0
        isCollecting = true
    }

    func stopCollection() -> [String: Any] {
        isCollecting = false
        var finalResult: [String: Any] = results
        finalResult["geometry"] = geometry
        if let base64 = capturedImageBase64 {
            finalResult["thumbnail"] = base64
        }
        return finalResult
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard isCollecting, let faceLandmarker = faceLandmarker else { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        if frameCount == 0 {
            captureThumbnail(from: pixelBuffer)
        }
        frameCount += 1

        let timestamp = Int(CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds * 1000)
        
        do {
            let mpImage = try MPImage(pixelBuffer: pixelBuffer)
            let result = try faceLandmarker.detect(videoFrame: mpImage, timestampInMilliseconds: timestamp)
            
            if let landmarks = result.faceLandmarks.first {
                processLandmarks(landmarks, in: pixelBuffer)
            } else {
                onFrameUpdate?(["status": "not_detected"])
            }
        } catch {
            print("MediaPipe detection error: \(error)")
        }
    }

    private func captureThumbnail(from pixelBuffer: CVPixelBuffer) {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext(options: nil)
        if let cgImage = context.createCGImage(ciImage, from: ciImage.extent) {
            let uiImage = UIImage(cgImage: cgImage)
            if let resizedImage = self.resizeImage(image: uiImage, targetWidth: 480) {
                if let data = resizedImage.jpegData(compressionQuality: 0.5) {
                    capturedImageBase64 = data.base64EncodedString()
                }
            }
        }
    }

    private func resizeImage(image: UIImage, targetWidth: CGFloat) -> UIImage? {
        let size = image.size
        let ratio = targetWidth / size.width
        let newSize = CGSize(width: targetWidth, height: size.height * ratio)
        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let newImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return newImage
    }

    private func processLandmarks(_ landmarks: [NormalizedLandmark], in pixelBuffer: CVPixelBuffer) {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        
        // --- 動き検知ロジック ---
        if let last = lastLandmarks {
            // 主要な点の移動距離を積算 (額、鼻、顎など)
            let d1 = hypot(landmarks[10].x - last[10].x, landmarks[10].y - last[10].y)
            let d2 = hypot(landmarks[1].x - last[1].x, landmarks[1].y - last[1].y)
            let d3 = hypot(landmarks[152].x - last[152].x, landmarks[152].y - last[152].y)
            motionScore = Double(d1 + d2 + d3)
        }
        lastLandmarks = landmarks

        // ROI抽出と平滑化
        let regions = ["forehead": 10, "left_cheek": 234, "right_cheek": 454, "under_eye_left": 101, "under_eye_right": 330, "lips": 0, "left_cheek_hollow": 214, "right_cheek_hollow": 434]
        
        for (name, idx) in regions {
            extractAndSmoothRGB(landmark: landmarks[idx], name: name, in: pixelBuffer)
        }
        
        // 幾何学的特徴の算出
        let f_width = abs(landmarks[454].x - landmarks[234].x)
        let f_height = abs(landmarks[152].y - landmarks[10].y)
        let leftEyeApt = abs(landmarks[159].y - landmarks[145].y) / max(0.01, abs(landmarks[133].x - landmarks[33].x))
        let rightEyeApt = abs(landmarks[386].y - landmarks[374].y) / max(0.01, abs(landmarks[362].x - landmarks[263].x))
        
        geometry["face_width"]?.append(Double(f_width))
        geometry["face_height"]?.append(Double(f_height))
        geometry["eye_aperture"]?.append(Double((leftEyeApt + rightEyeApt) / 2.0))
        
        onFrameUpdate?([
            "status": "detected",
            "motion_score": motionScore,
            "landmarks": [
                "forehead": ["x": landmarks[10].x, "y": landmarks[10].y],
                "left_cheek": ["x": landmarks[234].x, "y": landmarks[234].y],
                "right_cheek": ["x": landmarks[454].x, "y": landmarks[454].y],
                "lips": ["x": landmarks[0].x, "y": landmarks[0].y]
            ],
            "geometry": [
                "face_width": f_width,
                "face_height": f_height,
                "eye_aperture": (leftEyeApt + rightEyeApt) / 2.0
            ]
        ])
    }

    private func extractAndSmoothRGB(landmark: NormalizedLandmark, name: String, in pixelBuffer: CVPixelBuffer) {
        let w = CVPixelBufferGetWidth(pixelBuffer)
        let h = CVPixelBufferGetHeight(pixelBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        guard let buffer = CVPixelBufferGetBaseAddress(pixelBuffer)?.assumingMemoryBound(to: UInt8.self) else { return }

        let centerX = Int(landmark.x * Float(w))
        let centerY = Int(landmark.y * Float(h))
        let roiSize = 15
        let halfSize = roiSize / 2
        
        var r: Double = 0, g: Double = 0, b: Double = 0, count: Double = 0
        for dy in -halfSize..<halfSize {
            for dx in -halfSize..<halfSize {
                let x = centerX + dx, y = centerY + dy
                if x >= 0 && x < w && y >= 0 && y < h {
                    let offset = y * bytesPerRow + x * 4
                    b += Double(buffer[offset])
                    g += Double(buffer[offset + 1])
                    r += Double(buffer[offset + 2])
                    count += 1
                }
            }
        }
        
        if count > 0 {
            let currentR = r / count
            let currentG = g / count
            let currentB = b / count
            
            // 移動平均フィルタの適用
            smoothingBuffer[name]?["r"]?.append(currentR)
            smoothingBuffer[name]?["g"]?.append(currentG)
            smoothingBuffer[name]?["b"]?.append(currentB)
            
            if smoothingBuffer[name]?["r"]?.count ?? 0 > smoothingWindow {
                smoothingBuffer[name]?["r"]?.removeFirst()
                smoothingBuffer[name]?["g"]?.removeFirst()
                smoothingBuffer[name]?["b"]?.removeFirst()
            }
            
            let avgR = (smoothingBuffer[name]?["r"]?.reduce(0, +) ?? 0) / Double(smoothingBuffer[name]?["r"]?.count ?? 1)
            let avgG = (smoothingBuffer[name]?["g"]?.reduce(0, +) ?? 0) / Double(smoothingBuffer[name]?["g"]?.count ?? 1)
            let avgB = (smoothingBuffer[name]?["b"]?.reduce(0, +) ?? 0) / Double(smoothingBuffer[name]?["b"]?.count ?? 1)
            
            results[name]?["r"]?.append(avgR)
            results[name]?["g"]?.append(avgG)
            results[name]?["b"]?.append(avgB)
        }
    }
}

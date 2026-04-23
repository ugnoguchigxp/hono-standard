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

    // リアルタイム通知用コールバック
    var onFrameUpdate: (([String: Any]) -> Void)?

    override init() {
        super.init()
        setupLandmarker()
        resetResults()
    }

    private func setupLandmarker() {
        guard let modelPath = Bundle.main.path(forResource: "face_landmarker", ofType: "task", inDirectory: "Frameworks/App.framework/flutter_assets/assets/models") else {
            print("Failed to find face_landmarker.task in assets")
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
        results = [
            "forehead": ["r": [], "g": [], "b": []],
            "left_cheek": ["r": [], "g": [], "b": []],
            "right_cheek": ["r": [], "g": [], "b": []],
            "under_eye_left": ["r": [], "g": [], "b": []],
            "under_eye_right": ["r": [], "g": [], "b": []],
            "lips": ["r": [], "g": [], "b": []],
            "left_cheek_hollow": ["r": [], "g": [], "b": []],
            "right_cheek_hollow": ["r": [], "g": [], "b": []]
        ]
        geometry = [
            "face_width": [],
            "face_height": [],
            "eye_aperture": []
        ]
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
        
        // ROI抽出
        extractRGB(landmark: landmarks[10], name: "forehead", in: pixelBuffer)
        extractRGB(landmark: landmarks[234], name: "left_cheek", in: pixelBuffer)
        extractRGB(landmark: landmarks[454], name: "right_cheek", in: pixelBuffer)
        extractRGB(landmark: landmarks[101], name: "under_eye_left", in: pixelBuffer)
        extractRGB(landmark: landmarks[330], name: "under_eye_right", in: pixelBuffer)
        extractRGB(landmark: landmarks[0], name: "lips", in: pixelBuffer)
        extractRGB(landmark: landmarks[214], name: "left_cheek_hollow", in: pixelBuffer)
        extractRGB(landmark: landmarks[434], name: "right_cheek_hollow", in: pixelBuffer)
        
        // 幾何学的特徴の算出
        let f_width = abs(landmarks[454].x - landmarks[234].x)
        let f_height = abs(landmarks[152].y - landmarks[10].y)
        let leftEyeApt = abs(landmarks[159].y - landmarks[145].y) / max(0.01, abs(landmarks[133].x - landmarks[33].x))
        let rightEyeApt = abs(landmarks[386].y - landmarks[374].y) / max(0.01, abs(landmarks[362].x - landmarks[263].x))
        
        geometry["face_width"]?.append(Double(f_width))
        geometry["face_height"]?.append(Double(f_height))
        geometry["eye_aperture"]?.append(Double((leftEyeApt + rightEyeApt) / 2.0))
        
        // UI通知 (主要な点のみ)
        onFrameUpdate?([
            "status": "detected",
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

    private func extractRGB(landmark: NormalizedLandmark, name: String, in pixelBuffer: CVPixelBuffer) {
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
            results[name]?["r"]?.append(r / count)
            results[name]?["g"]?.append(g / count)
            results[name]?["b"]?.append(b / count)
        }
    }
}

import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, FlutterStreamHandler {
  private var vitalsProcessor = VitalsProcessor()
  private var captureSession: AVCaptureSession?
  private var eventSink: FlutterEventSink?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    
    // MethodChannel
    let vitalsChannel = FlutterMethodChannel(name: "com.hono.vitals/method",
                                              binaryMessenger: controller.binaryMessenger)
    vitalsChannel.setMethodCallHandler({ [weak self] (call, result) in
      if call.method == "startMeasurement" {
        self?.startVitalsCollection()
        result(nil)
      } else if call.method == "stopMeasurement" {
        let data = self?.stopVitalsCollection()
        result(data)
      } else {
        result(FlutterMethodNotImplemented)
      }
    })

    // EventChannel
    let eventChannel = FlutterEventChannel(name: "com.hono.vitals/stream",
                                            binaryMessenger: controller.binaryMessenger)
    eventChannel.setStreamHandler(self)

    // Processorからの通知をEventChannelに流す
    vitalsProcessor.onFrameUpdate = { [weak self] data in
        self?.eventSink?(data)
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // --- FlutterStreamHandler ---
  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    self.eventSink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    self.eventSink = nil
    return nil
  }

  private func startVitalsCollection() {
    setupCamera()
    vitalsProcessor.startCollection()
  }

  private func stopVitalsCollection() -> [String: Any] {
    let data = vitalsProcessor.stopCollection()
    captureSession?.stopRunning()
    return data
  }

  private func setupCamera() {
    guard captureSession == nil else {
        captureSession?.startRunning()
        return
    }

    let session = AVCaptureSession()
    session.sessionPreset = .medium

    guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
          let input = try? AVCaptureDeviceInput(device: camera) else { return }

    if session.canAddInput(input) {
        session.addInput(input)
    }

    let output = AVCaptureVideoDataOutput()
    output.setSampleBufferDelegate(vitalsProcessor, queue: DispatchQueue(label: "vitals_queue"))
    if session.canAddOutput(output) {
        session.addOutput(output)
    }

    captureSession = session
    session.startRunning()
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}

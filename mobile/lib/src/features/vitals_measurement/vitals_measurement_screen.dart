import 'dart:async';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'vitals_api.dart';
import 'vitals_native_service.dart';
import 'vitals_overlay.dart';
import 'vitals_history_screen.dart';

class VitalsMeasurementScreen extends StatefulWidget {
  const VitalsMeasurementScreen({super.key});

  @override
  State<VitalsMeasurementScreen> createState() => _VitalsMeasurementScreenState();
}



class _VitalsMeasurementScreenState extends State<VitalsMeasurementScreen> {
  CameraController? _controller;
  bool _isInitialized = false;
  bool _isMeasuring = false;
  double _progress = 0.0;
  Timer? _timer;
  final _nativeService = VitalsNativeService();
  
  Map<String, dynamic>? _lastFrameData;
  StreamSubscription<Map<String, dynamic>>? _streamSubscription;

  @override
  void initState() {
    super.initState();
    _initializeCamera();
    _startListening();
  }

  void _startListening() {
    _streamSubscription = _nativeService.vitalsStream.listen((data) {
      if (mounted) {
        setState(() {
          _lastFrameData = data;
        });
      }
    });
  }

  Future<void> _initializeCamera() async {
    final cameras = await availableCameras();
    final frontCamera = cameras.firstWhere(
      (camera) => camera.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    _controller = CameraController(
      frontCamera,
      ResolutionPreset.medium,
      enableAudio: false,
    );

    try {
      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
    } catch (e) {
      debugPrint('Camera initialization error: $e');
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    _timer?.cancel();
    _streamSubscription?.cancel();
    super.dispose();
  }

  void _startMeasurement() async {
    setState(() {
      _isMeasuring = true;
      _progress = 0.0;
    });

    await _nativeService.startMeasurement();

    const duration = Duration(seconds: 20);
    const interval = Duration(milliseconds: 100);
    int elapsed = 0;

    _timer = Timer.periodic(interval, (timer) {
      elapsed += interval.inMilliseconds;
      if (mounted) {
        setState(() {
          _progress = elapsed / duration.inMilliseconds;
        });
      }

      if (elapsed >= duration.inMilliseconds) {
        timer.cancel();
        _finishMeasurement();
      }
    });
  }

  void _finishMeasurement() async {
    final roiData = await _nativeService.stopMeasurement();
    if (mounted) {
      setState(() {
        _isMeasuring = false;
      });
      if (roiData != null) {
        try {
          final api = VitalsApi();
          final result = await api.analyzeVitals(roiData);
          _showResult(result);
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('解析に失敗しました: $e')));
          }
        }
      }
    }
  }

  void _showResult(Map<String, dynamic> result) {
    final baseline = result['baseline'] as Map<String, dynamic>?;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('詳細解析結果'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildResultSection('基本バイタル', [
                _buildResultRow(
                  '心拍数', 
                  '${(result['heart_rate_bpm'] as num).toStringAsFixed(1)} BPM',
                  baselineValue: baseline?['heart_rate_bpm'],
                ),
                _buildResultRow('呼吸数', '${(result['respiratory_rate'] as num).toStringAsFixed(1)} /分'),
              ]),
              const Divider(),
              _buildResultSection('自律神経・ストレス', [
                _buildResultRow(
                  'ストレス度', 
                  '${(result['stress_level'] as num).toStringAsFixed(1)}',
                  baselineValue: baseline?['stress_level'],
                ),
                _buildResultRow('LF/HF比', '${(result['lf_hf_ratio'] as num).toStringAsFixed(2)}'),
              ]),
              const Divider(),
              _buildResultSection('コンディション推定', [
                _buildResultRow(
                  '疲労度', 
                  '${(result['fatigue_index'] as num).toStringAsFixed(1)} %',
                  baselineValue: baseline?['fatigue_index'],
                ),
                _buildResultRow('眠たさ', '${(result['drowsiness_index'] as num).toStringAsFixed(1)} %'),
                _buildResultRow('酩酊度', '${(result['inebriation_level'] as num).toStringAsFixed(1)} %'),
                _buildResultRow('貧血指標', '${(result['anemia_index'] as num).toStringAsFixed(1)}'),
              ]),
              const Divider(),
              _buildResultSection('美容・健康指標', [
                _buildResultRow('クマ指数', '${(result['dark_circle_index'] as num).toStringAsFixed(1)}'),
                _buildResultRow('むくみ指数', '${(result['edema_index'] as num).toStringAsFixed(1)}'),
                _buildResultRow('目の腫れ', '${(result['puffiness_index'] as num).toStringAsFixed(1)}'),
                _buildResultRow('唇の荒れ', '${(result['lip_index'] as num).toStringAsFixed(1)}'),
                _buildResultRow('頬のこけ', '${(result['sunken_cheek_index'] as num).toStringAsFixed(1)}'),
              ]),
              const SizedBox(height: 8),
              Text('解析品質: ${(result['quality_score'] as num).toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const VitalsHistoryScreen()),
              );
            },
            child: const Text('履歴を見る'),
          ),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('閉じる')),
        ],
      ),
    );
  }

  Widget _buildResultSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey, fontSize: 12)),
        const SizedBox(height: 4),
        ...children,
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildResultRow(String label, String value, {num? baselineValue}) {
    String diffText = '';
    Color diffColor = Colors.grey;

    if (baselineValue != null) {
      final current = double.tryParse(value.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0;
      final diff = current - (baselineValue as num).toDouble();
      if (diff.abs() > 0.1) {
        final sign = diff > 0 ? '+' : '';
        diffText = ' ($sign${diff.toStringAsFixed(1)})';
        diffColor = diff > 0 ? Colors.redAccent : Colors.blueAccent;
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13)),
          Row(
            children: [
              Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
              if (diffText.isNotEmpty)
                Text(diffText, style: TextStyle(fontSize: 11, color: diffColor, fontWeight: FontWeight.w500)),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isDetected = _lastFrameData?['status'] == 'detected';

    return Scaffold(
      appBar: AppBar(
        title: const Text('バイタル計測'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const VitalsHistoryScreen()),
              );
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: AspectRatio(
              aspectRatio: _controller!.value.aspectRatio,
              child: CameraPreview(_controller!),
            ),
          ),
          
          VitalsOverlay(
            lastFrameData: _lastFrameData,
            isMeasuring: _isMeasuring,
          ),
          
          Align(
            alignment: Alignment.bottomCenter,
            child: _buildControls(isDetected),
          ),
        ],
      ),
    );
  }

  Widget _buildControls(bool isDetected) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [Colors.black.withOpacity(0.8), Colors.transparent],
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_isMeasuring) ...[
            LinearProgressIndicator(value: _progress, backgroundColor: Colors.white24, color: Colors.greenAccent),
            const SizedBox(height: 16),
            if ((_lastFrameData?['motion_score'] as num? ?? 0) > 0.01)
              const Text(
                '警告: 頭を動かさないでください',
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
              )
            else
              const Text('解析中... 動かないでください', style: TextStyle(color: Colors.white70)),
          ] else ...[
            ElevatedButton(
              onPressed: isDetected ? _startMeasurement : null,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 16),
                shape: const StadiumBorder(),
                backgroundColor: isDetected ? null : Colors.grey,
              ),
              child: const Text('計測開始 (20秒)', style: TextStyle(fontSize: 18)),
            ),
          ],
        ],
      ),
    );
  }
}




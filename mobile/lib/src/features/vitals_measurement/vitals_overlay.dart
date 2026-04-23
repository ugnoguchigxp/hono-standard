import 'package:flutter/material.dart';

class VitalsOverlay extends StatelessWidget {
  final Map<String, dynamic>? lastFrameData;
  final bool isMeasuring;

  const VitalsOverlay({
    super.key,
    this.lastFrameData,
    required this.isMeasuring,
  });

  @override
  Widget build(BuildContext context) {
    final isDetected = lastFrameData?['status'] == 'detected';

    return Stack(
      children: [
        // ランドマークの描画 (演出)
        if (isDetected)
          Positioned.fill(
            child: CustomPaint(
              painter: VitalsPainter(
                landmarks: Map<String, dynamic>.from(lastFrameData!['landmarks']),
                isMeasuring: isMeasuring,
              ),
            ),
          ),

        // 顔の位置ガイド (オーバレイ)
        Center(
          child: Container(
            width: 280,
            height: 380,
            decoration: BoxDecoration(
              border: Border.all(
                color: isDetected
                    ? (isMeasuring ? Colors.greenAccent : Colors.blueAccent)
                    : Colors.white.withOpacity(0.3),
                width: 3,
              ),
              borderRadius: BorderRadius.circular(140),
            ),
          ),
        ),

        // ステータスメッセージ
        Positioned(
          top: 100,
          left: 0,
          right: 0,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isDetected ? (isMeasuring ? '精密解析中...' : '顔を認識しました') : '枠内に顔を合わせてください',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class VitalsPainter extends CustomPainter {
  final Map<String, dynamic> landmarks;
  final bool isMeasuring;

  VitalsPainter({required this.landmarks, required this.isMeasuring});

  @override
  void paint(Canvas canvas, Size size) {
    final primaryColor = isMeasuring ? Colors.redAccent : Colors.cyanAccent;
    
    final paint = Paint()
      ..color = primaryColor.withOpacity(0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final dotPaint = Paint()
      ..color = primaryColor
      ..style = PaintingStyle.fill;

    final List<Offset> points = [];

    for (final entry in landmarks.entries) {
      final pos = entry.value as Map;
      final x = (pos['x'] as num).toDouble() * size.width;
      final y = (pos['y'] as num).toDouble() * size.height;
      final offset = Offset(x, y);
      points.add(offset);

      // ターゲットマーク: 外円
      canvas.drawCircle(offset, 12, paint);
      // ターゲットマーク: 中心点
      canvas.drawCircle(offset, 2.5, dotPaint);

      // ラベル表示
      final textPainter = TextPainter(
        text: TextSpan(
          text: entry.key.toUpperCase(),
          style: TextStyle(color: primaryColor, fontSize: 8, fontWeight: FontWeight.bold),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(x + 15, y - 5));
    }

    // ランドマーク間を繋ぐ幾何学ライン（ハイテク感の演出）
    if (isMeasuring && points.length >= 2) {
      final linePaint = Paint()
        ..color = primaryColor.withOpacity(0.15)
        ..strokeWidth = 1.0;
      
      for (int i = 0; i < points.length; i++) {
        for (int j = i + 1; j < points.length; j++) {
          // 距離が近い点同士のみ繋ぐ
          if ((points[i] - points[j]).distance < size.width * 0.4) {
            canvas.drawLine(points[i], points[j], linePaint);
          }
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant VitalsPainter oldDelegate) => true;
}

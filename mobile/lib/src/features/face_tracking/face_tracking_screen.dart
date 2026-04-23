import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/session/app_controller.dart';
import '../vitals_measurement/vitals_measurement_screen.dart';

class FaceTrackingScreen extends StatefulWidget {
  const FaceTrackingScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<FaceTrackingScreen> createState() => _FaceTrackingScreenState();
}

class _FaceTrackingScreenState extends State<FaceTrackingScreen> {
  final ImagePicker _picker = ImagePicker();
  final List<Map<String, dynamic>> _records = [
    {'date': '04/23', 'status': 'Good', 'color': Colors.blueGrey[200], 'metrics': 'くま:少 | 目元:明', 'image': null},
    {'date': '04/22', 'status': 'Tired', 'color': Colors.blueGrey[400], 'metrics': 'くま:多 | 目元:重', 'image': null},
    {'date': '04/21', 'status': 'Good', 'color': Colors.blueGrey[100], 'metrics': 'くま:無 | 目元:パッチリ', 'image': null},
  ];

  Future<void> _onAddRecord() async {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.favorite_rounded, color: Colors.redAccent),
              title: const Text('バイタル計測 (rPPG)'),
              subtitle: const Text('20秒間顔を撮影して脈拍を推定'),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (context) => const VitalsMeasurementScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded),
              title: const Text('写真を撮る (表情ログ)'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('ライブラリから選択'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? photo = await _picker.pickImage(
        source: source,
        preferredCameraDevice: CameraDevice.front,
      );

      if (photo != null) {
        setState(() {
          _records.insert(0, {
            'date': '${DateTime.now().month.toString().padLeft(2, '0')}/${DateTime.now().day.toString().padLeft(2, '0')}',
            'status': 'Processing',
            'color': Colors.blueGrey[300],
            'metrics': '解析中...',
            'image': File(photo.path),
          });
        });

        // Mocking analysis delay
        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() {
              _records[0]['status'] = 'Good';
              _records[0]['metrics'] = 'くま:少 | 目元:パッチリ';
            });
          }
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('エラーが発生しました: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _buildHeroSection(context),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            sliver: SliverToBoxAdapter(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'トラッキング履歴',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  TextButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.sort_rounded, size: 18),
                    label: const Text('並び替え'),
                  ),
                ],
              ),
            ),
          ),
          _buildRecordGrid(context),
          const SliverToBoxAdapter(
            child: SizedBox(height: 80),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _onAddRecord,
        icon: const Icon(Icons.camera_alt_rounded),
        label: const Text('自撮りで記録'),
      ),
    );
  }

  Widget _buildHeroSection(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          CircleAvatar(
            radius: 40,
            backgroundColor: Theme.of(context).colorScheme.primary,
            child: const Icon(Icons.face_unlock_outlined, size: 48, color: Colors.white),
          ),
          const SizedBox(height: 16),
          Text(
            '表情から健康を読み取る',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
          ),
          const SizedBox(height: 8),
          const Opacity(
            opacity: 0.7,
            child: Text(
              '毎朝の記録があなたの体調の変化を可視化します',
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecordGrid(BuildContext context) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 0.8,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            final record = _records[index];
            return _buildGridTile(context, record);
          },
          childCount: _records.length,
        ),
      ),
    );
  }

  Widget _buildGridTile(BuildContext context, Map<String, dynamic> record) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            // Thumbnail Image or Placeholder
            record['image'] != null
                ? Image.file(
                    record['image'] as File,
                    width: double.infinity,
                    height: double.infinity,
                    fit: BoxFit.cover,
                  )
                : Container(
                    color: record['color'] as Color?,
                    width: double.infinity,
                    height: double.infinity,
                    child: const Icon(Icons.person_outline_rounded, size: 64, color: Colors.white54),
                  ),
            // Gradient Overlay
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.3),
                      Colors.transparent,
                      Colors.black.withOpacity(0.7),
                    ],
                    stops: const [0.0, 0.5, 1.0],
                  ),
                ),
              ),
            ),
            // Date and Status
            Positioned(
              top: 12,
              left: 12,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    record['date'] as String,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getStatusColor(record['status'] as String),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      record['status'] as String,
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
            // Metrics
            Positioned(
              bottom: 12,
              left: 12,
              right: 12,
              child: Text(
                record['metrics'] as String,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Great':
      case 'Good':
        return Colors.green;
      case 'Fair':
        return Colors.orange;
      case 'Tired':
        return Colors.redAccent;
      case 'Processing':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }
}

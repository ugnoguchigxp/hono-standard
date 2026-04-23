import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'vitals_api.dart';
import 'package:intl/intl.dart';

class VitalsHistoryScreen extends StatefulWidget {
  const VitalsHistoryScreen({super.key});

  @override
  State<VitalsHistoryScreen> createState() => _VitalsHistoryScreenState();
}

class _VitalsHistoryScreenState extends State<VitalsHistoryScreen> {
  final _api = VitalsApi();
  List<dynamic> _history = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    try {
      final history = await _api.getHistory();
      if (mounted) {
        setState(() {
          _history = history;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('履歴の取得に失敗しました: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('バイタル推移')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _history.isEmpty
              ? const Center(child: Text('データがありません'))
              : Column(
                  children: [
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 250,
                      padding: const EdgeInsets.all(16),
                      child: _buildChart(),
                    ),
                    const Divider(),
                    Expanded(
                      child: _buildList(),
                    ),
                  ],
                ),
    );
  }

  Widget _buildChart() {
    // 日時順に並び替え（グラフ表示用）
    final chartData = List.from(_history.reversed);
    
    return LineChart(
      LineChartData(
        gridData: const FlGridData(show: true, drawVerticalLine: false),
        titlesData: FlTitlesData(
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                if (value.toInt() < 0 || value.toInt() >= chartData.length) return const SizedBox();
                final date = DateTime.parse(chartData[value.toInt()]['recorded_at']);
                return Text(DateFormat('MM/dd').format(date), style: const TextStyle(fontSize: 10));
              },
            ),
          ),
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: true),
        lineBarsData: [
          LineChartBarData(
            spots: chartData.asMap().entries.map((e) {
              return FlSpot(e.key.toDouble(), (e.value['heart_rate'] as num).toDouble());
            }).toList(),
            isCurved: true,
            color: Colors.redAccent,
            barWidth: 4,
            isStrokeCapRound: true,
            dotData: const FlDotData(show: true),
            belowBarData: BarAreaData(show: true, color: Colors.redAccent.withOpacity(0.1)),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    return ListView.builder(
      itemCount: _history.length,
      itemBuilder: (context, index) {
        final item = _history[index];
        final date = DateTime.parse(item['recorded_at']);
        
        return ListTile(
          leading: item['thumbnail_url'] != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Image.network(
                    'http://localhost:3000${item['thumbnail_url']}',
                    width: 50,
                    height: 50,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Icon(Icons.person),
                  ),
                )
              : const Icon(Icons.person),
          title: Text('${item['heart_rate']} BPM / RR: ${item['respiratory_rate'] ?? '-'}'),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(DateFormat('yyyy/MM/dd HH:mm').format(date)),
              Text(
                'クマ: ${(item['dark_circle_index'] as num?)?.toStringAsFixed(1) ?? '-'} / '
                'むくみ: ${(item['edema_index'] as num?)?.toStringAsFixed(1) ?? '-'}',
                style: const TextStyle(fontSize: 12, color: Colors.blueGrey),
              ),
            ],
          ),
          isThreeLine: true,
        );
      },
    );
  }
}

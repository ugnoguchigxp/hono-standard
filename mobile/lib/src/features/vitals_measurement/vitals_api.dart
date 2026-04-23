import 'package:dio/dio.dart';
import '../../core/api/dio_client.dart';

class VitalsApi {
  final Dio _dio = buildDio();

  Future<Map<String, dynamic>> analyzeVitals(Map<String, dynamic> roiData) async {
    try {
      final response = await _dio.post(
        '/api/analyze', // app.ts で app.route('/api', apiRoutes) と設定されている場合
        data: roiData,
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw Exception('バイタル解析に失敗しました: ${e.message}');
    }
  }

  Future<List<dynamic>> getHistory() async {
    try {
      final response = await _dio.get('/api/history');
      return response.data as List<dynamic>;
    } on DioException catch (e) {
      throw Exception('履歴の取得に失敗しました: ${e.message}');
    }
  }
}

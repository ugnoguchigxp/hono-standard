import 'package:dio/dio.dart';

import '../config/env.dart';
import 'mock_interceptor.dart';

Dio buildDio() {
  final dio = Dio(
    BaseOptions(
      baseUrl: Env.useMock ? 'http://127.0.0.1:19090' : Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json'},
    ),
  );
  if (Env.useMock) dio.interceptors.add(mockInterceptor);
  return dio;
}

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'device_headers.dart';

class ApiClient {
  ApiClient({
    required DeviceHeaders deviceHeaders,
    FlutterSecureStorage? storage,
  })  : _deviceHeaders = deviceHeaders,
        _storage = storage ?? const FlutterSecureStorage(),
        _dio = Dio(
          BaseOptions(
            baseUrl: AppConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 20),
            receiveTimeout: const Duration(seconds: 30),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          for (final entry in _deviceHeaders.toHeaders().entries) {
            options.headers[entry.key] = entry.value;
          }
          final token = await _storage.read(key: AppConfig.tokenKey);
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            await _storage.delete(key: AppConfig.tokenKey);
          }
          handler.next(error);
        },
      ),
    );
  }

  final Dio _dio;
  final DeviceHeaders _deviceHeaders;
  final FlutterSecureStorage _storage;

  Dio get dio => _dio;

  Future<void> setToken(String? token) async {
    if (token == null || token.isEmpty) {
      await _storage.delete(key: AppConfig.tokenKey);
      return;
    }
    await _storage.write(key: AppConfig.tokenKey, value: token);
  }

  Future<String?> getToken() => _storage.read(key: AppConfig.tokenKey);

  Future<void> clearToken() => _storage.delete(key: AppConfig.tokenKey);

  String apiMessage(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Cannot reach API at ${AppConfig.apiBaseUrl}. '
          'Start Laravel and check API_BASE_URL (use your PC IP on a physical device).';
    }
    return e.message ?? 'Request failed';
  }
}

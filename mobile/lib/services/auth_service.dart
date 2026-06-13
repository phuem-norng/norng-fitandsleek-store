import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../models/user_model.dart';

class AuthService {
  AuthService(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await _api.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String passwordConfirmation,
    String? phone,
  }) async {
    final res = await _api.dio.post('/auth/register', data: {
      'name': name,
      'email': email,
      'password': password,
      'password_confirmation': passwordConfirmation,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String email,
    required String code,
    required String purpose,
    String? challengeToken,
  }) async {
    final res = await _api.dio.post('/auth/otp/verify', data: {
      'email': email,
      'code': code,
      'purpose': purpose,
      if (challengeToken != null && challengeToken.isNotEmpty)
        'challenge_token': challengeToken,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<void> resendOtp({
    required String email,
    required String purpose,
    String? challengeToken,
  }) async {
    await _api.dio.post('/auth/otp/resend', data: {
      'email': email,
      'purpose': purpose,
      if (challengeToken != null && challengeToken.isNotEmpty)
        'challenge_token': challengeToken,
    });
  }

  Future<UserModel?> fetchMe() async {
    final res = await _api.dio.get('/me');
    if (res.data is! Map) return null;
    return UserModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<void> logout() async {
    try {
      await _api.dio.post('/auth/logout');
    } on DioException catch (e) {
      if (e.response?.statusCode != 401) rethrow;
    } finally {
      await _api.clearToken();
    }
  }
}

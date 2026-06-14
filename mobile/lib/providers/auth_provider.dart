import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../core/api_client.dart';
import '../core/auth_flow.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider(this._auth, this._api, {this.onSignedIn, this.onSignedOut});

  final AuthService _auth;
  final ApiClient _api;
  final Future<void> Function()? onSignedIn;
  final VoidCallback? onSignedOut;

  UserModel? user;
  bool booted = false;
  bool busy = false;

  bool get isLoggedIn => user != null;

  void updateUser(UserModel updated) {
    user = updated;
    notifyListeners();
  }

  Future<void> bootstrap() async {
    final token = await _api.getToken();
    if (token == null || token.isEmpty) {
      booted = true;
      notifyListeners();
      return;
    }
    try {
      user = await _auth.fetchMe();
    } catch (_) {
      await _api.clearToken();
      user = null;
    } finally {
      booted = true;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    busy = true;
    notifyListeners();
    try {
      final data = await _auth.login(email, password);
      if (authRequiresOtpStep(data)) {
        return data;
      }
      await _applyTokenResponse(data);
      return data;
    } on DioException catch (e) {
      final otpPayload = authOtpPayloadFromResponse(e.response?.data);
      if (otpPayload != null) {
        return otpPayload;
      }
      rethrow;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String passwordConfirmation,
    String? phone,
  }) async {
    busy = true;
    notifyListeners();
    try {
      final data = await _auth.register(
        name: name,
        email: email,
        password: password,
        passwordConfirmation: passwordConfirmation,
        phone: phone,
      );
      if (!authRequiresOtpStep(data)) {
        await _applyTokenResponse(data);
      }
      return data;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> verifyOtp({
    required String email,
    required String code,
    required String purpose,
    String? challengeToken,
  }) async {
    busy = true;
    notifyListeners();
    try {
      final data = await _auth.verifyOtp(
        email: email,
        code: code,
        purpose: purpose,
        challengeToken: challengeToken,
      );
      await _applyTokenResponse(data);
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> resendOtp({
    required String email,
    required String purpose,
    String? challengeToken,
  }) {
    return _auth.resendOtp(
      email: email,
      purpose: purpose,
      challengeToken: challengeToken,
    );
  }

  Future<void> logout() async {
    await _auth.logout();
    user = null;
    onSignedOut?.call();
    notifyListeners();
  }

  Future<void> _applyTokenResponse(Map<String, dynamic> data) async {
    final token = data['token']?.toString();
    if (token != null && token.isNotEmpty) {
      await _api.setToken(token);
    }
    final userJson = data['user'];
    if (userJson is Map) {
      user = UserModel.fromJson(Map<String, dynamic>.from(userJson));
    } else {
      user = await _auth.fetchMe();
    }
    if (onSignedIn != null) {
      await onSignedIn!();
    }
  }
}

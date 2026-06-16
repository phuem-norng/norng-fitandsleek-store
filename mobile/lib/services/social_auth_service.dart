import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../config/app_config.dart';
import '../core/api_client.dart';

class SocialAuthService {
  SocialAuthService(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> signInWithProvider(String provider) async {
    final normalized = provider.trim().toLowerCase();
    if (normalized != 'google' && normalized != 'facebook') {
      throw ArgumentError('Unsupported provider: $provider');
    }

    final redirectUri = Uri.parse(
      '${AppConfig.backendOrigin}/api/auth/$normalized/redirect',
    ).replace(
      queryParameters: {'frontend_callback': AppConfig.oauthCallbackUrl},
    );

    final String resultUrl;
    try {
      resultUrl = await FlutterWebAuth2.authenticate(
        url: redirectUri.toString(),
        callbackUrlScheme: AppConfig.oauthCallbackScheme,
      );
    } on PlatformException catch (e) {
      if (e.code == 'CANCELED') {
        throw const SocialAuthException('');
      }
      rethrow;
    }

    final ticket = _extractTicket(resultUrl);
    if (ticket == null || ticket.isEmpty) {
      throw const SocialAuthException('Social login callback is invalid.');
    }

    final res = await _api.dio.get('/auth/social/exchange/$ticket');
    final data = Map<String, dynamic>.from(res.data as Map);

    final error = data['error']?.toString();
    if (error != null && error.isNotEmpty) {
      throw SocialAuthException(error);
    }

    final token = data['token']?.toString();
    if (token == null || token.isEmpty) {
      throw const SocialAuthException('Social login failed. Please try again.');
    }

    return data;
  }

  String? _extractTicket(String resultUrl) {
    final uri = Uri.parse(resultUrl);
    final segments = uri.pathSegments;

    if (segments.length >= 2 && segments[0] == 'callback') {
      return segments[1];
    }

    if (segments.length >= 3 &&
        segments[0] == 'oauth' &&
        segments[1] == 'callback') {
      return segments[2];
    }

    if (segments.isNotEmpty) {
      return segments.last;
    }

    return null;
  }
}

class SocialAuthException implements Exception {
  const SocialAuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

String socialAuthErrorMessage(Object error) {
  if (error is SocialAuthException) {
    return error.message;
  }
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
  }
  return 'Social login failed. Please try again.';
}

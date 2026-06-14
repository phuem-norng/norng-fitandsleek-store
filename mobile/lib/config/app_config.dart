import 'package:flutter/foundation.dart';

/// API and media URLs for the Laravel backend.
///
/// Override at run time:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8001/api
///   flutter run --dart-define=BACKEND_ORIGIN=http://192.168.1.10:8001
class AppConfig {
  AppConfig._();

  static const String _apiFromEnv = String.fromEnvironment('API_BASE_URL');
  static const String _originFromEnv = String.fromEnvironment('BACKEND_ORIGIN');

  /// Production API when no dart-define is passed (release builds on real devices).
  static const String productionApiBaseUrl = 'https://norng-fitandsleek-backend.onrender.com/api';
  static const String productionBackendOrigin = 'https://norng-fitandsleek-backend.onrender.com';

  /// Default Laravel API (matches frontend `.env.example` proxy target port).
  static String get defaultApiBaseUrl {
    if (!kDebugMode) return productionApiBaseUrl;
    if (kIsWeb) return 'http://127.0.0.1:8001/api';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8001/api';
    }
    return 'http://127.0.0.1:8001/api';
  }

  static String get defaultBackendOrigin {
    if (!kDebugMode) return productionBackendOrigin;
    if (kIsWeb) return 'http://127.0.0.1:8001';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8001';
    }
    return 'http://127.0.0.1:8001';
  }

  static String get apiBaseUrl {
    final raw = _apiFromEnv.trim();
    if (raw.isEmpty) return defaultApiBaseUrl;
    return raw.endsWith('/api') ? raw : '$raw/api';
  }

  static String get backendOrigin {
    final raw = _originFromEnv.trim();
    return raw.isEmpty ? defaultBackendOrigin : raw.replaceAll(RegExp(r'/+$'), '');
  }

  /// `public/logo.png` on Laravel (web header uses `/logo.png`).
  static String get siteLogoPath => '/logo.png';

  /// Flutter web: `/api/site-logo` includes CORS; native uses `$backendOrigin/logo.png`.
  static String get siteLogoUrl {
    if (kIsWeb) {
      return '${apiBaseUrl.replaceAll(RegExp(r'/+$'), '')}/site-logo';
    }
    return '$backendOrigin$siteLogoPath';
  }

  static const String tokenKey = 'fs_token';
}

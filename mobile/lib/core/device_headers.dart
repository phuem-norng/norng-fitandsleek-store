import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// Mirrors `frontend/src/lib/device.js` — required for `device.bound` Sanctum routes.
class DeviceHeaders {
  DeviceHeaders(this._prefs);

  static const _deviceIdKey = 'fs_device_id';
  final SharedPreferences _prefs;

  static Future<DeviceHeaders> load() async {
    final prefs = await SharedPreferences.getInstance();
    return DeviceHeaders(prefs);
  }

  String get deviceId {
    final existing = _prefs.getString(_deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = 'dev_${const Uuid().v4().replaceAll('-', '').substring(0, 12)}';
    _prefs.setString(_deviceIdKey, id);
    return id;
  }

  String get os {
    if (kIsWeb) return 'Web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'Android';
      case TargetPlatform.iOS:
        return 'iOS';
      case TargetPlatform.windows:
        return 'Windows';
      case TargetPlatform.macOS:
        return 'macOS';
      case TargetPlatform.linux:
        return 'Linux';
      default:
        return 'Unknown OS';
    }
  }

  String get deviceName => 'FitandSleek App on $os';

  Map<String, String> toHeaders() => {
        'X-Device-ID': deviceId,
        'X-Device-Name': deviceName,
        'X-Device-Browser': kIsWeb ? 'Chrome' : 'Flutter',
        'X-Device-OS': os,
      };
}

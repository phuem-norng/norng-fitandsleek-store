import '../config/app_config.dart';
import '../core/api_client.dart';
import '../models/header_settings.dart';

class StorefrontService {
  StorefrontService(this._api);

  final ApiClient _api;

  Future<HeaderSettings> fetchHeaderSettings() async {
    try {
      final res = await _api.dio.get('/homepage-settings');
      final data = res.data;
      if (data is Map) {
        return HeaderSettings.fromHomepageJson(Map<String, dynamic>.from(data));
      }
    } catch (_) {
      /* use defaults */
    }
    return HeaderSettings(logoUrl: AppConfig.siteLogoPath);
  }
}

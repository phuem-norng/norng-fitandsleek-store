import '../core/api_client.dart';

class StorefrontContentService {
  StorefrontContentService(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> fetchFaq() async {
    final res = await _api.dio.get('/faq');
    final data = res.data;
    if (data is Map && data['faq'] is Map) {
      return Map<String, dynamic>.from(data['faq'] as Map);
    }
    return const {};
  }

  Future<Map<String, dynamic>> fetchContactPage() => _fetchPage('/contact-page', 'contact_page');

  Future<Map<String, dynamic>> fetchPrivacyPage() => _fetchPage('/privacy-page', 'privacy_page');

  Future<Map<String, dynamic>> fetchTermsPage() => _fetchPage('/terms-page', 'terms_page');

  Future<Map<String, dynamic>> fetchCookiesPage() => _fetchPage('/cookies-page', 'cookies_page');

  Future<Map<String, dynamic>> _fetchPage(String path, String key) async {
    final res = await _api.dio.get(path);
    final data = res.data;
    if (data is Map && data[key] is Map) {
      return Map<String, dynamic>.from(data[key] as Map);
    }
    return const {};
  }
}

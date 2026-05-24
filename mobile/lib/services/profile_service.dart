import '../core/api_client.dart';

class ProfileService {
  ProfileService(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> fetchCustomerProfile() async {
    final res = await _api.dio.get('/user/profile');
    if (res.data is Map) {
      return Map<String, dynamic>.from(res.data as Map);
    }
    return {};
  }

  Future<Map<String, dynamic>> updateCustomerProfile({
    required String name,
    required String email,
    String? phone,
  }) async {
    final res = await _api.dio.put('/user/profile', data: {
      'name': name,
      'email': email,
      if (phone != null) 'phone': phone,
    });
    final body = res.data as Map;
    final user = body['user'] as Map? ?? body;
    return Map<String, dynamic>.from(user);
  }
}

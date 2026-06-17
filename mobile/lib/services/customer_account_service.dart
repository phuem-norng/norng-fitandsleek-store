import '../core/api_client.dart';
import '../models/loyalty_model.dart';
import '../models/replacement_case_model.dart';

class CustomerAccountService {
  CustomerAccountService(this._api);

  final ApiClient _api;

  Future<LoyaltyModel> getLoyalty() async {
    final res = await _api.dio.get('/user/loyalty');
    final data = res.data;
    final map = data is Map && data['data'] is Map
        ? Map<String, dynamic>.from(data['data'] as Map)
        : Map<String, dynamic>.from(data as Map);
    return LoyaltyModel.fromJson(map);
  }

  Future<ReplacementCasePage> listReplacementCases({int page = 1}) async {
    final res = await _api.dio.get('/replacement-cases', queryParameters: {'page': page});
    return ReplacementCasePage.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<void> submitReplacement({
    required int orderId,
    required String reason,
    String? notes,
    required List<Map<String, dynamic>> items,
  }) async {
    await _api.dio.post('/replacement-cases', data: {
      'order_id': orderId,
      'reason': reason,
      'notes': notes,
      'items': items,
    });
  }
}

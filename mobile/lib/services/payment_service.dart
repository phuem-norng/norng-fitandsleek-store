import '../core/api_client.dart';
import '../models/payment_model.dart';

class PaymentService {
  PaymentService(this._api);

  final ApiClient _api;

  Future<PaymentModel> createBakongPayment(int orderId) async {
    final res = await _api.dio.post('/payments/bakong/create', data: {
      'order_id': orderId,
    });
    return PaymentModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<PaymentModel> checkBakongStatus(int paymentId) async {
    final res = await _api.dio.get('/payments/bakong/status/$paymentId');
    return PaymentModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }
}

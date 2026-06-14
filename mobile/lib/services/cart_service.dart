import '../core/api_client.dart';
import '../models/cart_model.dart';

class CartService {
  CartService(this._api);

  final ApiClient _api;

  Future<CartModel> getCart() async {
    final res = await _api.dio.get('/cart');
    return CartModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<CartModel> addItem({
    required int productId,
    int quantity = 1,
    String? size,
    String? color,
  }) async {
    final res = await _api.dio.post('/cart/items', data: {
      'product_id': productId,
      'quantity': quantity,
      if (size != null && size.isNotEmpty) 'size': size,
      if (color != null && color.isNotEmpty) 'color': color,
    });
    return CartModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<void> removeItem(int itemId) async {
    await _api.dio.delete('/cart/items/$itemId');
  }

  Future<CartModel> updateItemQuantity(int itemId, int quantity) async {
    final res = await _api.dio.patch('/cart/items/$itemId', data: {
      'quantity': quantity,
    });
    return CartModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }
}

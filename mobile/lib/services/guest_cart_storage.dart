import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../core/local_store_keys.dart';
import '../models/cart_model.dart';
import '../models/product_model.dart';

class GuestCartStorage {
  Future<List<CartItemModel>> readItems() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(LocalStoreKeys.guestCart);
    if (raw == null || raw.isEmpty) return [];

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => _itemFromGuestJson(Map<String, dynamic>.from(e)))
          .whereType<CartItemModel>()
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> writeItems(List<CartItemModel> items) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = items.map(_itemToGuestJson).toList();
    await prefs.setString(LocalStoreKeys.guestCart, jsonEncode(payload));
  }

  static String variantKey({
    required int productId,
    String? size,
    String? color,
  }) {
    final s = (size ?? '').trim().toLowerCase();
    final c = (color ?? '').trim().toLowerCase();
    return '$productId::$s::$c';
  }

  static CartItemModel? _itemFromGuestJson(Map<String, dynamic> json) {
    final key = json['id']?.toString() ?? '';
    if (key.isEmpty) return null;

    final productJson = json['product'];
    ProductModel? product;
    if (productJson is Map) {
      product = ProductModel.fromJson(Map<String, dynamic>.from(productJson));
    }

    final productId = json['product_id'] as int? ?? product?.id ?? 0;
    if (productId == 0) return null;

    var unitPrice = _toDouble(json['unit_price']) ?? 0;
    if (unitPrice <= 0 && product != null) {
      unitPrice = product.displayPrice;
    }

    return CartItemModel(
      id: key.hashCode,
      guestKey: key,
      productId: productId,
      quantity: json['quantity'] as int? ?? 1,
      unitPrice: unitPrice,
      size: json['size']?.toString(),
      color: json['color']?.toString(),
      product: product,
    );
  }

  static Map<String, dynamic> _itemToGuestJson(CartItemModel item) {
    return {
      'id': item.guestKey ?? GuestCartStorage.variantKey(
            productId: item.productId,
            size: item.size,
            color: item.color,
          ),
      'product_id': item.productId,
      'quantity': item.quantity,
      'unit_price': item.unitPrice,
      'size': item.size,
      'color': item.color,
      if (item.product != null) 'product': item.product!.toJson(),
    };
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }
}

import 'product_model.dart';

class CartItemModel {
  CartItemModel({
    required this.id,
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    this.product,
    this.size,
    this.color,
    this.guestKey,
  });

  final int id;
  final int productId;
  final int quantity;
  final double unitPrice;
  final ProductModel? product;
  final String? size;
  final String? color;
  /// Local guest-cart line key (web: `${productId}::size::color`).
  final String? guestKey;

  double get lineTotal => unitPrice * quantity;

  bool get isGuest => guestKey != null && guestKey!.isNotEmpty;

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    final productJson = json['product'];
    return CartItemModel(
      id: json['id'] as int,
      productId: json['product_id'] as int,
      quantity: json['quantity'] as int? ?? 1,
      unitPrice: _toDouble(json['unit_price']) ?? 0,
      size: json['size']?.toString(),
      color: json['color']?.toString(),
      product: productJson is Map
          ? ProductModel.fromJson(Map<String, dynamic>.from(productJson))
          : null,
    );
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }
}

class CartModel {
  CartModel({required this.items, required this.total});

  final List<CartItemModel> items;
  final double total;

  factory CartModel.fromJson(Map<String, dynamic> json) {
    final cart = json['cart'];
    final itemsJson = cart is Map ? cart['items'] : null;
    final items = itemsJson is List
        ? itemsJson
            .whereType<Map>()
            .map((e) => CartItemModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <CartItemModel>[];
    final total = (json['total'] is num)
        ? (json['total'] as num).toDouble()
        : double.tryParse('${json['total']}') ?? 0;
    return CartModel(items: items, total: total);
  }
}

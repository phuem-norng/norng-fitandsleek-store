class OrderModel {
  OrderModel({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.total,
    this.subtotal,
    this.shipping,
    this.discount,
    this.paymentMethod,
    this.createdAt,
    this.items = const [],
  });

  final int id;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final double total;
  final double? subtotal;
  final double? shipping;
  final double? discount;
  final String? paymentMethod;
  final String? createdAt;
  final List<OrderItemModel> items;

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final itemsRaw = json['items'];
    return OrderModel(
      id: json['id'] as int,
      orderNumber: (json['order_number'] ?? json['id']).toString(),
      status: (json['status'] ?? 'pending').toString(),
      paymentStatus: (json['payment_status'] ?? 'pending').toString(),
      total: _toDouble(json['total']) ?? 0,
      subtotal: _toDouble(json['subtotal']),
      shipping: _toDouble(json['shipping']),
      discount: _toDouble(json['discount']),
      paymentMethod: json['payment_method']?.toString(),
      createdAt: json['created_at']?.toString(),
      items: itemsRaw is List
          ? itemsRaw
              .whereType<Map>()
              .map((e) => OrderItemModel.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }
}

class OrderItemModel {
  OrderItemModel({
    required this.name,
    required this.quantity,
    required this.price,
    this.imageUrl,
  });

  final String name;
  final int quantity;
  final double price;
  final String? imageUrl;

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    final product = json['product'];
    return OrderItemModel(
      name: (json['name'] ?? (product is Map ? product['name'] : null) ?? 'Product').toString(),
      quantity: json['qty'] as int? ?? json['quantity'] as int? ?? 0,
      price: OrderModel._toDouble(json['price'] ?? json['unit_price']) ?? 0,
      imageUrl: json['image_url']?.toString() ??
          (product is Map ? product['image_url']?.toString() : null),
    );
  }
}

class OrderPage {
  OrderPage({
    required this.items,
    required this.currentPage,
    required this.lastPage,
  });

  final List<OrderModel> items;
  final int currentPage;
  final int lastPage;

  bool get hasMore => currentPage < lastPage;

  factory OrderPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final list = data is List
        ? data
            .whereType<Map>()
            .map((e) => OrderModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <OrderModel>[];
    return OrderPage(
      items: list,
      currentPage: json['current_page'] as int? ?? 1,
      lastPage: json['last_page'] as int? ?? 1,
    );
  }
}

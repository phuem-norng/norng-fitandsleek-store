class OrderShipmentModel {
  OrderShipmentModel({
    this.provider,
    this.trackingCode,
    this.externalTrackingUrl,
    this.status,
    this.shippedAt,
  });

  final String? provider;
  final String? trackingCode;
  final String? externalTrackingUrl;
  final String? status;
  final String? shippedAt;

  factory OrderShipmentModel.fromJson(Map<String, dynamic> json) {
    return OrderShipmentModel(
      provider: json['provider']?.toString(),
      trackingCode: json['tracking_code']?.toString(),
      externalTrackingUrl: json['external_tracking_url']?.toString(),
      status: json['status']?.toString(),
      shippedAt: json['shipped_at']?.toString(),
    );
  }
}

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
    this.shippingAddress,
    this.shipment,
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
  final Map<String, dynamic>? shippingAddress;
  final OrderShipmentModel? shipment;
  final List<OrderItemModel> items;

  String? get formattedShippingAddress {
    final addr = shippingAddress;
    if (addr == null || addr.isEmpty) return null;
    final parts = [
      addr['line1'] ?? addr['address'],
      addr['district'],
      addr['city'] ?? addr['province'],
    ].whereType<String>().map((e) => e.trim()).where((e) => e.isNotEmpty);
    return parts.join(', ');
  }

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final itemsRaw = json['items'];
    final shipmentRaw = json['shipment'];
    final addressRaw = json['shipping_address'];
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
      shippingAddress: addressRaw is Map ? Map<String, dynamic>.from(addressRaw) : null,
      shipment: shipmentRaw is Map
          ? OrderShipmentModel.fromJson(Map<String, dynamic>.from(shipmentRaw))
          : null,
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
    this.id,
    required this.name,
    required this.quantity,
    required this.price,
    this.imageUrl,
    this.size,
    this.color,
  });

  final int? id;
  final String name;
  final int quantity;
  final double price;
  final String? imageUrl;
  final String? size;
  final String? color;

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    final product = json['product'];
    return OrderItemModel(
      id: json['id'] as int?,
      name: (json['name'] ?? (product is Map ? product['name'] : null) ?? 'Product').toString(),
      quantity: json['qty'] as int? ?? json['quantity'] as int? ?? 0,
      price: OrderModel._toDouble(json['price'] ?? json['unit_price']) ?? 0,
      imageUrl: json['image_url']?.toString() ??
          (product is Map ? product['image_url']?.toString() : null),
      size: json['size']?.toString(),
      color: json['color']?.toString(),
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
        : (json['data'] is Map ? (json['data'] as Map)['data'] : null);
    final source = list is List ? list : (data is List ? data : null);
    final items = source is List
        ? source
            .whereType<Map>()
            .map((e) => OrderModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <OrderModel>[];
    return OrderPage(
      items: items,
      currentPage: json['current_page'] as int? ?? 1,
      lastPage: json['last_page'] as int? ?? 1,
    );
  }
}

class OrderTrackModel {
  OrderTrackModel({
    required this.status,
    this.trackingNumber,
    this.shippingAddress,
    this.shipment,
    this.items = const [],
  });

  final String status;
  final String? trackingNumber;
  final String? shippingAddress;
  final OrderShipmentModel? shipment;
  final List<OrderItemModel> items;

  factory OrderTrackModel.fromJson(Map<String, dynamic> json) {
    final order = json['order'] is Map ? Map<String, dynamic>.from(json['order'] as Map) : json;
    final shipmentRaw = order['shipment'];
    final itemsRaw = order['items'];
    final addressRaw = order['shipping_address'];
    String? addressText;
    if (addressRaw is String) {
      addressText = addressRaw == 'N/A' ? null : addressRaw;
    } else if (addressRaw is Map) {
      final map = Map<String, dynamic>.from(addressRaw);
      addressText = [
        map['line1'] ?? map['address'],
        map['district'],
        map['city'] ?? map['province'],
      ].whereType<String>().map((e) => e.trim()).where((e) => e.isNotEmpty).join(', ');
    }
    return OrderTrackModel(
      status: (order['status'] ?? 'pending').toString(),
      trackingNumber: order['tracking_number']?.toString(),
      shippingAddress: addressText,
      shipment: shipmentRaw is Map
          ? OrderShipmentModel.fromJson(Map<String, dynamic>.from(shipmentRaw))
          : null,
      items: itemsRaw is List
          ? itemsRaw
              .whereType<Map>()
              .map((e) => OrderItemModel.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

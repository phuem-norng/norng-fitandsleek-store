import '../core/api_client.dart';

class AdminDashboardStats {
  AdminDashboardStats({
    required this.totalRevenue,
    required this.todayRevenue,
    required this.totalOrders,
    required this.pendingOrders,
    required this.totalProducts,
    required this.lowStockProducts,
    required this.totalCustomers,
  });

  final double totalRevenue;
  final double todayRevenue;
  final int totalOrders;
  final int pendingOrders;
  final int totalProducts;
  final int lowStockProducts;
  final int totalCustomers;

  factory AdminDashboardStats.fromJson(Map<String, dynamic> json) {
    final revenue = json['revenue'] as Map? ?? {};
    final orders = json['orders'] as Map? ?? {};
    final products = json['products'] as Map? ?? {};
    final customers = json['customers'] as Map? ?? {};
    return AdminDashboardStats(
      totalRevenue: _toDouble(revenue['total']),
      todayRevenue: _toDouble(revenue['today']),
      totalOrders: _toInt(orders['total']),
      pendingOrders: _toInt(orders['pending']),
      totalProducts: _toInt(products['total']),
      lowStockProducts: _toInt(products['low_stock']),
      totalCustomers: _toInt(customers['total']),
    );
  }

  static double _toDouble(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);
  static int _toInt(dynamic v) => v == null ? 0 : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
}

class SuperAdminStats {
  SuperAdminStats({
    required this.totalUsers,
    required this.totalAdmins,
    required this.totalCustomers,
    required this.activeUsers,
  });

  final int totalUsers;
  final int totalAdmins;
  final int totalCustomers;
  final int activeUsers;

  factory SuperAdminStats.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map? ?? json;
    return SuperAdminStats(
      totalUsers: AdminDashboardStats._toInt(data['total_users']),
      totalAdmins: AdminDashboardStats._toInt(data['total_admins']),
      totalCustomers: AdminDashboardStats._toInt(data['total_customers']),
      activeUsers: AdminDashboardStats._toInt(data['active_users']),
    );
  }
}

class AdminService {
  AdminService(this._api);

  final ApiClient _api;

  Future<AdminDashboardStats> fetchDashboard() async {
    final res = await _api.dio.get('/admin/reports/dashboard');
    return AdminDashboardStats.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<SuperAdminStats?> fetchSuperAdminStats() async {
    try {
      final res = await _api.dio.get('/admin/superadmin/statistics');
      return SuperAdminStats.fromJson(Map<String, dynamic>.from(res.data as Map));
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>> fetchAdminProfile() async {
    final res = await _api.dio.get('/admin/profile');
    final body = res.data as Map;
    final user = body['user'] as Map? ?? body;
    return Map<String, dynamic>.from(user);
  }

  Future<Map<String, dynamic>> updateAdminProfile({
    required String name,
    required String email,
    String? phone,
    String? address,
  }) async {
    final res = await _api.dio.put('/admin/profile', data: {
      'name': name,
      'email': email,
      if (phone != null) 'phone': phone,
      if (address != null) 'address': address,
    });
    final body = res.data as Map;
    final user = body['user'] as Map? ?? body;
    return Map<String, dynamic>.from(user);
  }

  Future<AdminProductPage> listProducts({int page = 1, String? query}) async {
    final res = await _api.dio.get('/admin/products', queryParameters: {
      'page': page,
      'per_page': 20,
      if (query != null && query.isNotEmpty) 'search': query,
    });
    return AdminProductPage.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<AdminProductModel> getProduct(int id) async {
    final res = await _api.dio.get('/admin/products/$id');
    return AdminProductModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<AdminProductModel> updateProduct(int id, Map<String, dynamic> data) async {
    final res = await _api.dio.patch('/admin/products/$id', data: data);
    return AdminProductModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<BarcodeLookup?> barcodeLookup(String code) async {
    final res = await _api.dio.get('/admin/barcode-scan/lookup', queryParameters: {'code': code});
    final data = res.data as Map;
    final row = data['data'];
    if (row is! Map) return null;
    return BarcodeLookup.fromJson(Map<String, dynamic>.from(row));
  }

  Future<PosSaleResult> completePosSale({
    required List<PosLine> lines,
    required String paymentMethod,
  }) async {
    final res = await _api.dio.post('/admin/pos/complete-sale', data: {
      'payment_method': paymentMethod,
      'lines': lines.map((l) => {'code': l.code, 'qty': l.qty}).toList(),
    });
    return PosSaleResult.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<List<SalesDayRow>> fetchSales({int periodDays = 30}) async {
    final res = await _api.dio.get('/admin/reports/sales', queryParameters: {'period': periodDays});
    final data = res.data as Map;
    final list = data['sales'];
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => SalesDayRow.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<TopProductRow>> fetchTopProducts({int limit = 10}) async {
    final res = await _api.dio.get('/admin/reports/top-products', queryParameters: {'limit': limit});
    final data = res.data as Map;
    final list = data['data'];
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => TopProductRow.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

class AdminProductModel {
  AdminProductModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.price,
    required this.stock,
    required this.isActive,
    this.sku,
    this.imageUrl,
    this.categoryName,
  });

  final int id;
  final String name;
  final String slug;
  final double price;
  final int stock;
  final bool isActive;
  final String? sku;
  final String? imageUrl;
  final String? categoryName;

  factory AdminProductModel.fromJson(Map<String, dynamic> json) {
    final category = json['category'];
    return AdminProductModel(
      id: json['id'] as int,
      name: (json['name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      price: AdminDashboardStats._toDouble(json['price']),
      stock: AdminDashboardStats._toInt(json['stock']),
      isActive: json['is_active'] == true || json['is_active'] == 1,
      sku: json['sku']?.toString(),
      imageUrl: json['image_url']?.toString(),
      categoryName: category is Map ? category['name']?.toString() : null,
    );
  }
}

class AdminProductPage {
  AdminProductPage({
    required this.items,
    required this.currentPage,
    required this.hasMore,
  });

  final List<AdminProductModel> items;
  final int currentPage;
  final bool hasMore;

  factory AdminProductPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final items = data is List
        ? data
            .whereType<Map>()
            .map((e) => AdminProductModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <AdminProductModel>[];
    final current = json['current_page'] as int? ?? 1;
    final last = json['last_page'] as int? ?? current;
    return AdminProductPage(
      items: items,
      currentPage: current,
      hasMore: current < last,
    );
  }
}

class BarcodeLookup {
  BarcodeLookup({
    required this.code,
    required this.name,
    required this.price,
    this.maxSellableQty,
  });

  final String code;
  final String name;
  final double price;
  final int? maxSellableQty;

  factory BarcodeLookup.fromJson(Map<String, dynamic> json) {
    return BarcodeLookup(
      code: (json['code'] ?? '').toString(),
      name: (json['name'] ?? 'Item').toString(),
      price: AdminDashboardStats._toDouble(json['price']),
      maxSellableQty: json['max_sellable_qty'] as int?,
    );
  }
}

class PosLine {
  PosLine({required this.code, required this.name, required this.qty, required this.unitPrice});

  final String code;
  final String name;
  final int qty;
  final double unitPrice;

  double get lineTotal => unitPrice * qty;
}

class PosSaleResult {
  PosSaleResult({
    required this.orderNumber,
    required this.subtotal,
    this.qrString,
    this.qrAmount,
    this.qrCurrency,
  });

  final String orderNumber;
  final double subtotal;
  final String? qrString;
  final double? qrAmount;
  final String? qrCurrency;

  factory PosSaleResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map? ?? json;
    final order = data['order'] as Map? ?? {};
    final khqr = data['khqr'] as Map?;
    return PosSaleResult(
      orderNumber: (order['order_number'] ?? '').toString(),
      subtotal: AdminDashboardStats._toDouble(data['subtotal']),
      qrString: khqr?['qr_string']?.toString(),
      qrAmount: khqr?['amount'] != null ? AdminDashboardStats._toDouble(khqr!['amount']) : null,
      qrCurrency: khqr?['currency']?.toString(),
    );
  }
}

class SalesDayRow {
  SalesDayRow({required this.date, required this.orders, required this.revenue});

  final String date;
  final int orders;
  final double revenue;

  factory SalesDayRow.fromJson(Map<String, dynamic> json) {
    return SalesDayRow(
      date: (json['date'] ?? '').toString(),
      orders: AdminDashboardStats._toInt(json['orders']),
      revenue: AdminDashboardStats._toDouble(json['revenue']),
    );
  }
}

class TopProductRow {
  TopProductRow({
    required this.name,
    required this.totalSold,
    required this.totalRevenue,
    this.imageUrl,
  });

  final String name;
  final int totalSold;
  final double totalRevenue;
  final String? imageUrl;

  factory TopProductRow.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map?;
    return TopProductRow(
      name: (product?['name'] ?? 'Product').toString(),
      totalSold: AdminDashboardStats._toInt(json['total_sold']),
      totalRevenue: AdminDashboardStats._toDouble(json['total_revenue']),
      imageUrl: product?['image_url']?.toString(),
    );
  }
}

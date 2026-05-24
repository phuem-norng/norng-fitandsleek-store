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
}

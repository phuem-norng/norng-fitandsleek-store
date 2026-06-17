class ReplacementCaseModel {
  ReplacementCaseModel({
    required this.id,
    required this.orderId,
    required this.reason,
    required this.status,
    this.notes,
    this.createdAt,
    this.orderNumber,
  });

  final int id;
  final int orderId;
  final String reason;
  final String status;
  final String? notes;
  final String? createdAt;
  final String? orderNumber;

  factory ReplacementCaseModel.fromJson(Map<String, dynamic> json) {
    final order = json['order'];
    return ReplacementCaseModel(
      id: json['id'] as int,
      orderId: json['order_id'] as int? ?? (order is Map ? order['id'] as int? : null) ?? 0,
      reason: (json['reason'] ?? '').toString(),
      status: (json['status'] ?? 'pending').toString(),
      notes: json['notes']?.toString(),
      createdAt: json['created_at']?.toString(),
      orderNumber: order is Map ? order['order_number']?.toString() : null,
    );
  }
}

class ReplacementCasePage {
  ReplacementCasePage({required this.items, required this.currentPage, required this.lastPage});

  final List<ReplacementCaseModel> items;
  final int currentPage;
  final int lastPage;

  bool get hasMore => currentPage < lastPage;

  factory ReplacementCasePage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final list = data is Map ? data['data'] : data;
    final items = list is List
        ? list
            .whereType<Map>()
            .map((e) => ReplacementCaseModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <ReplacementCaseModel>[];

    final meta = data is Map ? data : json;
    return ReplacementCasePage(
      items: items,
      currentPage: meta['current_page'] as int? ?? 1,
      lastPage: meta['last_page'] as int? ?? 1,
    );
  }
}

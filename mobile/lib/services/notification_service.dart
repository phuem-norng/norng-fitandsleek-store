import '../core/api_client.dart';

class StoreNotification {
  StoreNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.isRead,
    this.createdAt,
  });

  final String id;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? createdAt;

  factory StoreNotification.fromJson(Map<String, dynamic> json) {
    DateTime? created;
    final raw = json['created_at'];
    if (raw != null) {
      created = DateTime.tryParse(raw.toString());
    }
    return StoreNotification(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? '',
      isRead: json['is_read'] == true,
      createdAt: created,
    );
  }
}

class NotificationService {
  NotificationService(this._api);

  final ApiClient _api;

  Future<int> fetchUnreadCount({required bool isLoggedIn}) async {
    try {
      final path = isLoggedIn ? '/notifications/unread-count' : '/notifications/public';
      final res = await _api.dio.get(path);
      final data = res.data;
      if (data is Map) {
        return _parseCount(data['unread_count']);
      }
    } catch (_) {}
    return 0;
  }

  Future<({List<StoreNotification> items, int unreadCount})> fetchNotifications({
    required bool isLoggedIn,
  }) async {
    try {
      final path = isLoggedIn ? '/notifications' : '/notifications/public';
      final res = await _api.dio.get(path);
      final data = res.data;
      if (data is! Map) return (items: <StoreNotification>[], unreadCount: 0);

      final unread = _parseCount(data['unread_count']);
      final block = data['notifications'];
      final list = block is Map ? block['data'] : null;
      if (list is! List) return (items: <StoreNotification>[], unreadCount: unread);

      final items = list
          .whereType<Map>()
          .map((e) => StoreNotification.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      return (items: items, unreadCount: unread);
    } catch (_) {
      return (items: <StoreNotification>[], unreadCount: 0);
    }
  }

  Future<void> markAllRead() async {
    await _api.dio.post('/notifications/mark-all-read');
  }

  static int _parseCount(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }
}

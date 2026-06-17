import '../core/api_client.dart';

class TelegramLinkInfo {
  TelegramLinkInfo({
    required this.enabled,
    this.connected = false,
    this.connectUrl,
    this.accountConnectUrl,
  });

  final bool enabled;
  final bool connected;
  final String? connectUrl;
  final String? accountConnectUrl;

  factory TelegramLinkInfo.fromJson(Map<String, dynamic> json) {
    return TelegramLinkInfo(
      enabled: json['enabled'] == true,
      connected: json['connected'] == true,
      connectUrl: json['connect_url']?.toString(),
      accountConnectUrl: json['account_connect_url']?.toString(),
    );
  }
}

class TelegramService {
  TelegramService(this._api);

  final ApiClient _api;

  Future<bool> isEnabled() async {
    try {
      final res = await _api.dio.get('/telegram/settings');
      final data = Map<String, dynamic>.from(res.data as Map);
      return data['enabled'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<TelegramLinkInfo> fetchAccountStatus() async {
    final res = await _api.dio.get('/telegram/status');
    return TelegramLinkInfo.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<TelegramLinkInfo> fetchOrderLink(String orderNumber) async {
    final res = await _api.dio.get('/telegram/orders/$orderNumber/link');
    return TelegramLinkInfo.fromJson(Map<String, dynamic>.from(res.data as Map));
  }
}

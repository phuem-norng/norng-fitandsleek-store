class PaymentModel {
  PaymentModel({
    required this.paymentId,
    required this.status,
    this.billNumber,
    this.qrString,
    this.md5,
    this.expiresAt,
    this.amount,
    this.currency,
  });

  final int paymentId;
  final String status;
  final String? billNumber;
  final String? qrString;
  final String? md5;
  final DateTime? expiresAt;
  final double? amount;
  final String? currency;

  bool get isPaid => status == 'paid';
  bool get isExpired => status == 'expired';
  bool get hasQr => qrString != null && qrString!.isNotEmpty;

  factory PaymentModel.fromJson(Map<String, dynamic> json) {
    final expiresRaw = json['expires_at']?.toString();
    return PaymentModel(
      paymentId: json['payment_id'] as int? ?? json['id'] as int? ?? 0,
      status: (json['status'] ?? 'pending').toString(),
      billNumber: json['bill_number']?.toString(),
      qrString: json['qr_string']?.toString(),
      md5: json['md5']?.toString(),
      expiresAt: expiresRaw != null && expiresRaw.isNotEmpty
          ? DateTime.tryParse(expiresRaw)
          : null,
      amount: _toDouble(json['amount']),
      currency: json['currency']?.toString(),
    );
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }
}

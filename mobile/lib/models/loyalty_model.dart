class LoyaltyModel {
  LoyaltyModel({
    required this.points,
    required this.tier,
    required this.discountPercent,
    required this.lifetimeSpend,
    required this.ordersCount,
    this.nextTier,
  });

  final int points;
  final String tier;
  final int discountPercent;
  final double lifetimeSpend;
  final int ordersCount;
  final LoyaltyNextTier? nextTier;

  factory LoyaltyModel.fromJson(Map<String, dynamic> json) {
    final next = json['next_tier'];
    return LoyaltyModel(
      points: json['points'] as int? ?? 0,
      tier: (json['tier'] ?? 'bronze').toString(),
      discountPercent: json['discount_percent'] as int? ?? 0,
      lifetimeSpend: _toDouble(json['lifetime_spend']) ?? 0,
      ordersCount: json['orders_count'] as int? ?? 0,
      nextTier: next is Map ? LoyaltyNextTier.fromJson(Map<String, dynamic>.from(next)) : null,
    );
  }

  int get pointsToNextTier {
    if (nextTier == null) return 0;
    return (nextTier!.minPoints - points).clamp(0, 999999);
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }
}

class LoyaltyNextTier {
  LoyaltyNextTier({required this.tier, required this.minPoints});

  final String tier;
  final int minPoints;

  factory LoyaltyNextTier.fromJson(Map<String, dynamic> json) {
    return LoyaltyNextTier(
      tier: (json['tier'] ?? '').toString(),
      minPoints: json['min_points'] as int? ?? 0,
    );
  }
}

import 'product_model.dart';

class HomepageSectionConfig {
  const HomepageSectionConfig({
    required this.key,
    required this.title,
    required this.order,
    required this.enabled,
  });

  final String key;
  final String title;
  final int order;
  final bool enabled;

  factory HomepageSectionConfig.fromEntry(String key, Map<String, dynamic> json) {
    return HomepageSectionConfig(
      key: key,
      title: (json['title'] ?? key).toString(),
      order: json['order'] is int
          ? json['order'] as int
          : int.tryParse('${json['order']}') ?? 99,
      enabled: json['enabled'] != false,
    );
  }
}

class HomepageSectionData {
  const HomepageSectionData({
    required this.config,
    this.items = const [],
    this.loading = false,
  });

  final HomepageSectionConfig config;
  final List<ProductModel> items;
  final bool loading;

  HomepageSectionData copyWith({
    List<ProductModel>? items,
    bool? loading,
  }) {
    return HomepageSectionData(
      config: config,
      items: items ?? this.items,
      loading: loading ?? this.loading,
    );
  }
}

/// Browse target when user taps "See all" on a homepage section.
class HomeSectionBrowse {
  const HomeSectionBrowse({
    required this.key,
    this.title,
    this.tab,
    this.parentCategory,
    this.categorySlug,
    this.categoryId,
    this.categoryIds,
    this.searchQuery,
    this.discounts = false,
  });

  final String key;
  final String? title;
  final String? tab;
  final String? parentCategory;
  final String? categorySlug;
  final int? categoryId;
  /// All matched category IDs for multi-category homepage sections (e.g. Clothes).
  final List<int>? categoryIds;
  final String? searchQuery;
  final bool discounts;
}

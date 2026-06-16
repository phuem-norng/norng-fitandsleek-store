class ProductModel {
  ProductModel({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.imageUrl,
    this.price,
    this.finalPrice,
    this.categoryName,
  });

  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? imageUrl;
  final double? price;
  final double? finalPrice;
  final String? categoryName;

  double get displayPrice => finalPrice ?? price ?? 0;

  bool get hasDiscount =>
      price != null && finalPrice != null && price! > finalPrice! && price! > 0;

  int? get discountPercent {
    if (!hasDiscount) return null;
    return ((1 - finalPrice! / price!) * 100).round();
  }

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final category = json['category'];
    return ProductModel(
      id: json['id'] as int,
      name: (json['name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      description: json['description']?.toString(),
      imageUrl: json['image_url']?.toString() ?? json['thumbnail_url']?.toString(),
      price: _toDouble(json['price']),
      finalPrice: _toDouble(json['final_price']),
      categoryName: category is Map ? category['name']?.toString() : null,
    );
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }
}

class ProductPage {
  ProductPage({
    required this.items,
    required this.currentPage,
    required this.lastPage,
  });

  final List<ProductModel> items;
  final int currentPage;
  final int lastPage;

  bool get hasMore => currentPage < lastPage;

  factory ProductPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final list = data is List
        ? data
            .whereType<Map>()
            .map((e) => ProductModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <ProductModel>[];
    return ProductPage(
      items: list,
      currentPage: json['current_page'] as int? ?? 1,
      lastPage: json['last_page'] as int? ?? 1,
    );
  }
}

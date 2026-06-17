class ProductColorVariant {
  const ProductColorVariant({
    required this.name,
    this.imageUrl,
  });

  final String name;
  final String? imageUrl;

  factory ProductColorVariant.fromJson(dynamic json) {
    if (json is String) {
      final name = json.trim();
      return ProductColorVariant(name: name.isEmpty ? '—' : name);
    }
    if (json is Map) {
      final name = (json['name'] ?? json['label'] ?? '').toString().trim();
      final img = (json['image_url'] ?? json['imageUrl'])?.toString().trim();
      return ProductColorVariant(
        name: name.isEmpty ? '—' : name,
        imageUrl: (img != null && img.isNotEmpty) ? img : null,
      );
    }
    return const ProductColorVariant(name: '—');
  }
}

class ProductVariantLotPrice {
  const ProductVariantLotPrice({
    required this.size,
    required this.color,
    this.sellableQty,
  });

  final String size;
  final String color;
  final int? sellableQty;

  factory ProductVariantLotPrice.fromJson(Map<String, dynamic> json) {
    return ProductVariantLotPrice(
      size: (json['size'] ?? '').toString().trim(),
      color: (json['color'] ?? '').toString().trim(),
      sellableQty: _toInt(json['sellable_qty']),
    );
  }

  static int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }
}

class ProductModel {
  ProductModel({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.modelInfo,
    this.imageUrl,
    this.price,
    this.finalPrice,
    this.categoryId,
    this.categoryName,
    this.brandName,
    this.colors = const [],
    this.colorVariants = const [],
    this.gallery = const [],
    this.sizes = const [],
    this.sku,
    this.variantLotPrices = const [],
  });

  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? modelInfo;
  final String? imageUrl;
  final double? price;
  final double? finalPrice;
  final int? categoryId;
  final String? categoryName;
  final String? brandName;
  final List<String> colors;
  final List<ProductColorVariant> colorVariants;
  final List<String> gallery;
  final List<String> sizes;
  final String? sku;
  final List<ProductVariantLotPrice> variantLotPrices;

  double get displayPrice => finalPrice ?? price ?? 0;

  bool get hasDiscount =>
      price != null && finalPrice != null && price! > finalPrice! && price! > 0;

  int? get discountPercent {
    if (!hasDiscount) return null;
    return ((1 - finalPrice! / price!) * 100).round();
  }

  /// All product images: cover, gallery, then color swatch images (same order as web).
  List<String> get allImageUrls {
    final urls = <String>[];
    void add(String? url) {
      if (url == null || url.trim().isEmpty) return;
      if (!urls.contains(url)) urls.add(url);
    }

    add(imageUrl);
    for (final line in gallery) {
      add(line);
    }
    for (final cv in colorVariants) {
      add(cv.imageUrl);
    }
    return urls;
  }

  List<String> displaySizesForColor(String? selectedColor) {
    if (variantLotPrices.isEmpty) return sizes;
    final sel = selectedColor?.trim().toLowerCase() ?? '';
    final ordered = <String>[];
    final seen = <String>{};
    for (final row in variantLotPrices) {
      if (sel.isNotEmpty && !_variantKeyEq(row.color, sel)) continue;
      if (row.size.isEmpty || seen.contains(row.size)) continue;
      seen.add(row.size);
      ordered.add(row.size);
    }
    return ordered.isNotEmpty ? ordered : sizes;
  }

  /// Sellable quantity for one size or color option (sums matrix rows when the other axis is unset).
  int? sellableQtyForOption({
    required bool isSize,
    required String option,
    String? otherSelected,
  }) {
    if (variantLotPrices.isEmpty) return null;

    var found = false;
    var total = 0;
    for (final row in variantLotPrices) {
      if (isSize) {
        if (!_variantKeyEq(row.size, option)) continue;
        if (otherSelected != null &&
            otherSelected.isNotEmpty &&
            !_variantKeyEq(row.color, otherSelected)) {
          continue;
        }
      } else {
        if (!_variantKeyEq(row.color, option)) continue;
        if (otherSelected != null &&
            otherSelected.isNotEmpty &&
            !_variantKeyEq(row.size, otherSelected)) {
          continue;
        }
      }
      found = true;
      total += row.sellableQty ?? 0;
    }
    return found ? total : null;
  }

  static bool _variantKeyEq(String a, String b) =>
      a.trim().toLowerCase() == b.trim().toLowerCase();

  ProductModel mergeDetail(ProductModel detail) {
    return ProductModel(
      id: id,
      name: detail.name.isNotEmpty ? detail.name : name,
      slug: slug,
      description: detail.description ?? description,
      modelInfo: detail.modelInfo ?? modelInfo,
      imageUrl: detail.imageUrl ?? imageUrl,
      price: detail.price ?? price,
      finalPrice: detail.finalPrice ?? finalPrice,
      categoryId: detail.categoryId ?? categoryId,
      categoryName: detail.categoryName ?? categoryName,
      brandName: detail.brandName ?? brandName,
      colors: detail.colors.isNotEmpty ? detail.colors : colors,
      colorVariants: detail.colorVariants.isNotEmpty ? detail.colorVariants : colorVariants,
      gallery: detail.gallery.isNotEmpty ? detail.gallery : gallery,
      sizes: detail.sizes.isNotEmpty ? detail.sizes : sizes,
      sku: detail.sku ?? sku,
      variantLotPrices:
          detail.variantLotPrices.isNotEmpty ? detail.variantLotPrices : variantLotPrices,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        if (description != null) 'description': description,
        if (imageUrl != null) 'image_url': imageUrl,
        if (price != null) 'price': price,
        if (finalPrice != null) 'final_price': finalPrice,
        if (categoryName != null)
          'category': {'name': categoryName},
        if (colors.isNotEmpty) 'colors': colors,
        if (sizes.isNotEmpty) 'sizes': sizes,
        if (sku != null) 'sku': sku,
      };

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final category = json['category'];
    return ProductModel(
      id: json['id'] as int,
      name: (json['name'] ?? '').toString(),
      slug: (json['slug'] ?? '').toString(),
      description: json['description']?.toString(),
      modelInfo: json['model_info']?.toString(),
      imageUrl: json['image_url']?.toString() ?? json['thumbnail_url']?.toString(),
      price: _toDouble(json['price']),
      finalPrice: _toDouble(json['final_price']),
      categoryId: _parseCategoryId(json, category),
      categoryName: category is Map ? category['name']?.toString() : null,
      brandName: _parseBrandName(json['brand']),
      colors: _parseColorNames(json['colors']),
      colorVariants: _parseColorVariants(json['colors']),
      gallery: _parseGallery(json['gallery']),
      sizes: _toStringList(json['sizes']),
      sku: json['sku']?.toString(),
      variantLotPrices: _parseVariantLotPrices(json['variant_lot_prices']),
    );
  }

  static List<ProductVariantLotPrice> _parseVariantLotPrices(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => ProductVariantLotPrice.fromJson(Map<String, dynamic>.from(e)))
        .where((row) => row.size.isNotEmpty || row.color.isNotEmpty)
        .toList();
  }

  static double? _toDouble(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  static String? _parseBrandName(dynamic brand) {
    if (brand is Map) {
      final name = brand['name']?.toString().trim();
      return (name != null && name.isNotEmpty) ? name : null;
    }
    return null;
  }

  static int? _parseCategoryId(Map<String, dynamic> json, dynamic category) {
    final direct = json['category_id'];
    if (direct is int) return direct;
    if (direct is num) return direct.toInt();
    if (direct != null) return int.tryParse(direct.toString());
    if (category is Map) {
      final id = category['id'];
      if (id is int) return id;
      if (id is num) return id.toInt();
      return int.tryParse(id?.toString() ?? '');
    }
    return null;
  }

  static List<String> _parseGallery(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .map((e) => e?.toString().trim() ?? '')
        .where((e) => e.isNotEmpty)
        .toList();
  }

  static List<ProductColorVariant> _parseColorVariants(dynamic raw) {
    if (raw == null) return const [];
    final items = raw is List ? raw : raw.toString().split(',');
    return items.map(ProductColorVariant.fromJson).where((cv) => cv.name != '—').toList();
  }

  static List<String> _parseColorNames(dynamic raw) {
    return _parseColorVariants(raw).map((cv) => cv.name).toList();
  }

  static List<String> _toStringList(dynamic v) {
    if (v is! List) return const [];
    final out = <String>[];
    for (final item in v) {
      if (item is String) {
        final value = item.trim();
        if (value.isNotEmpty) out.add(value);
        continue;
      }
      if (item is Map) {
        final value = (item['name'] ?? item['label'] ?? item['color'] ?? '')
            .toString()
            .trim();
        if (value.isNotEmpty) out.add(value);
      }
    }
    return out;
  }
}

class ProductPage {
  ProductPage({
    required this.items,
    required this.currentPage,
    required this.lastPage,
    this.total,
  });

  final List<ProductModel> items;
  final int currentPage;
  final int lastPage;
  final int? total;

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
      total: json['total'] as int?,
    );
  }
}

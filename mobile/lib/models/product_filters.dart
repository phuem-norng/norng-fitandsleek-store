class ProductSortOption {
  const ProductSortOption(this.value, this.label);

  final String value;
  final String label;
}

class ProductFilters {
  static const sortOptions = [
    ProductSortOption('recommend', 'Recommend'),
    ProductSortOption('new', 'New items'),
    ProductSortOption('price_high', 'Price (High First)'),
    ProductSortOption('price_low', 'Price (Low First)'),
    ProductSortOption('discount_high', 'Discount (High First)'),
    ProductSortOption('discount_low', 'Discount (Low First)'),
  ];

  static const genderOptions = [
    ProductSortOption('women', 'Women'),
    ProductSortOption('men', 'Men'),
    ProductSortOption('boys', 'Boys'),
    ProductSortOption('girls', 'Girls'),
  ];

  String sort = 'recommend';
  double? minPrice;
  double? maxPrice;
  final Set<String> genders = {};
  final Set<String> colors = {};
  final Set<String> sizes = {};
  final Set<int> brandIds = {};

  ProductFilters copy() {
    final next = ProductFilters()
      ..sort = sort
      ..minPrice = minPrice
      ..maxPrice = maxPrice;
    next.genders.addAll(genders);
    next.colors.addAll(colors);
    next.sizes.addAll(sizes);
    next.brandIds.addAll(brandIds);
    return next;
  }

  void clear() {
    sort = 'recommend';
    minPrice = null;
    maxPrice = null;
    genders.clear();
    colors.clear();
    sizes.clear();
    brandIds.clear();
  }

  static String sortLabel(String value) {
    for (final option in sortOptions) {
      if (option.value == value) return option.label;
    }
    return 'Recommend';
  }

  int activeCount({double? boundsMin, double? boundsMax}) {
    var count = 0;
    if (sort != 'recommend') count += 1;
    if (genders.isNotEmpty) count += genders.length;
    if (colors.isNotEmpty) count += colors.length;
    if (sizes.isNotEmpty) count += sizes.length;
    if (brandIds.isNotEmpty) count += brandIds.length;

    final min = boundsMin;
    final max = boundsMax;
    if (min != null && max != null && max > min) {
      if (minPrice != null && minPrice! > min) count += 1;
      if (maxPrice != null && maxPrice! < max) count += 1;
    }

    return count;
  }
}

class FilterOptionsModel {
  FilterOptionsModel({
    required this.colors,
    required this.sizes,
    this.priceMin,
    this.priceMax,
  });

  final List<String> colors;
  final List<String> sizes;
  final double? priceMin;
  final double? priceMax;

  factory FilterOptionsModel.fromJson(Map<String, dynamic> json) {
    List<String> parseList(dynamic raw) {
      if (raw is! List) return [];
      return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
    }

    double? parseDouble(dynamic raw) {
      if (raw == null) return null;
      final value = double.tryParse(raw.toString());
      return value;
    }

    return FilterOptionsModel(
      colors: parseList(json['colors']),
      sizes: parseList(json['sizes']),
      priceMin: parseDouble(json['price_min']),
      priceMax: parseDouble(json['price_max']),
    );
  }
}

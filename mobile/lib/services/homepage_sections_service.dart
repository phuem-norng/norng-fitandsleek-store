import '../core/api_client.dart';
import '../models/category_model.dart';
import '../models/homepage_section.dart';
import '../models/product_model.dart';

class HomepageSectionsService {
  HomepageSectionsService(this._api);

  final ApiClient _api;

  static const _parentSectionKeys = {'women', 'men', 'boys', 'girls'};
  static const _tabSectionMap = {'newIn': 'new'};
  static const _parentLinkMap = {
    'women': 'Women',
    'men': 'Men',
    'boys': 'Boys',
    'girls': 'Girls',
  };

  static const _defaultSections = [
    HomepageSectionConfig(key: 'newIn', title: 'NEW IN', order: 1, enabled: true),
    HomepageSectionConfig(key: 'discounts', title: 'Discounts', order: 2, enabled: true),
    HomepageSectionConfig(key: 'women', title: 'WOMEN', order: 3, enabled: true),
    HomepageSectionConfig(key: 'men', title: 'MEN', order: 4, enabled: true),
    HomepageSectionConfig(key: 'boys', title: 'BOYS', order: 5, enabled: true),
    HomepageSectionConfig(key: 'clothes', title: 'Clothes', order: 6, enabled: true),
    HomepageSectionConfig(key: 'shoes', title: 'Shoes', order: 7, enabled: true),
    HomepageSectionConfig(key: 'belts', title: 'Belts', order: 8, enabled: true),
    HomepageSectionConfig(
      key: 'accessories',
      title: 'Accessories',
      order: 9,
      enabled: true,
    ),
  ];

  Future<List<HomepageSectionConfig>> fetchEnabledSections() async {
    try {
      final res = await _api.dio.get('/homepage-settings');
      final data = res.data;
      if (data is! Map) return _defaultSections;

      final sections = data['sections'];
      if (sections is! Map || sections.isEmpty) return _defaultSections;

      return sections.entries
          .map((e) {
            if (e.value is! Map) return null;
            return HomepageSectionConfig.fromEntry(
              e.key.toString(),
              Map<String, dynamic>.from(e.value as Map),
            );
          })
          .whereType<HomepageSectionConfig>()
          .where((s) => s.enabled)
          .toList()
        ..sort((a, b) => a.order.compareTo(b.order));
    } catch (_) {
      return _defaultSections;
    }
  }

  Future<List<ProductModel>> loadSectionProducts({
    required HomepageSectionConfig section,
    required List<CategoryModel> categories,
    int limit = 6,
  }) async {
    final key = section.key;

    if (key == 'discounts') {
      return _fetchDiscountProducts(limit);
    }
    if (_tabSectionMap.containsKey(key)) {
      return _fetchTabProducts(_tabSectionMap[key]!, limit);
    }
    if (_parentSectionKeys.contains(key)) {
      return _fetchParentProducts(_parentLinkMap[key] ?? key, limit);
    }

    final matched = _pickCategories(categories, _sectionSearchTokens(section));
    if (matched.isEmpty) return [];

    final grouped = <List<ProductModel>>[];
    for (final category in matched) {
      final items = await _fetchCategoryProducts(category, limit: 24);
      if (items.isNotEmpty) grouped.add(items);
    }

    return _interleaveProducts(grouped).take(limit).toList();
  }

  HomeSectionBrowse browseTarget({
    required HomepageSectionConfig section,
    required List<CategoryModel> categories,
  }) {
    final key = section.key;
    if (key == 'discounts') {
      return HomeSectionBrowse(key: key, title: section.title, discounts: true);
    }
    if (_tabSectionMap.containsKey(key)) {
      return HomeSectionBrowse(
        key: key,
        title: section.title,
        tab: _tabSectionMap[key],
      );
    }
    if (_parentSectionKeys.contains(key)) {
      return HomeSectionBrowse(
        key: key,
        title: section.title,
        parentCategory: _parentLinkMap[key] ?? key,
      );
    }

    final matched = _pickCategories(categories, _sectionSearchTokens(section));
    if (matched.isEmpty) {
      return HomeSectionBrowse(
        key: key,
        title: section.title,
        searchQuery: section.title,
      );
    }
    return HomeSectionBrowse(
      key: key,
      title: section.title,
      categoryIds: matched.map((c) => c.id).toList(),
    );
  }

  Future<List<ProductModel>> fetchRecommended({int limit = 6}) async {
    try {
      final res = await _api.dio.get('/products/recommended', queryParameters: {
        'per_page': limit,
      });
      return _parseProductList(res.data).take(limit).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<ProductModel>> _fetchDiscountProducts(int limit) async {
    try {
      final res = await _api.dio.get('/products/discounts', queryParameters: {
        'per_page': limit,
      });
      return _parseProductList(res.data).take(limit).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<ProductModel>> _fetchTabProducts(String tab, int limit) async {
    try {
      final res = await _api.dio.get('/products', queryParameters: {
        'tab': tab,
        'per_page': limit,
      });
      return _parseProductList(res.data).take(limit).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<ProductModel>> _fetchParentProducts(String parent, int limit) async {
    try {
      final res = await _api.dio.get('/products', queryParameters: {
        'parent_category': parent,
        'per_page': limit,
      });
      return _parseProductList(res.data).take(limit).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<ProductModel>> _fetchCategoryProducts(
    CategoryModel category, {
    required int limit,
  }) async {
    try {
      final params = <String, dynamic>{'per_page': limit};
      if ((category.slug ?? '').isNotEmpty) {
        params['category'] = category.slug;
      } else {
        params['category_id'] = category.id;
      }
      final res = await _api.dio.get('/products', queryParameters: params);
      return _parseProductList(res.data);
    } catch (_) {
      return [];
    }
  }

  List<ProductModel> _parseProductList(dynamic data) {
    final list = data is Map ? data['data'] : data;
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => ProductModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  List<CategoryModel> _pickCategories(
    List<CategoryModel> categories,
    List<String> names,
  ) {
    final tokens = names.map(_normalizeToken).where((t) => t.isNotEmpty).toList();
    if (tokens.isEmpty) return [];

    final exact = categories.where((category) {
      final name = _normalizeToken(category.name);
      final slug = _normalizeToken(category.slug);
      final type = _normalizeToken(category.type);
      return tokens.any((token) => token == name || token == slug || token == type);
    }).toList();
    if (exact.isNotEmpty) return exact;

    return categories.where((category) {
      final name = _normalizeToken(category.name);
      final slug = _normalizeToken(category.slug);
      final type = _normalizeToken(category.type);
      return tokens.any(
        (token) =>
            name.contains(token) || slug.contains(token) || type.contains(token),
      );
    }).toList();
  }

  List<String> _sectionSearchTokens(HomepageSectionConfig section) {
    final key = _normalizeToken(section.key);
    final title = _normalizeToken(section.title);
    final tokens = <String>{key, title};

    if (key.contains('belt') || title.contains('belt')) {
      tokens.addAll(['belts', 'belt']);
    }
    if (key.contains('vanna') || title.contains('vanna') || title.contains('វ៉ាន់ណា')) {
      tokens.addAll(['vanna', 'វ៉ាន់ណា']);
    }

    return tokens.where((t) => t.isNotEmpty).toList();
  }

  String _normalizeToken(String? value) {
    return (value ?? '')
        .toLowerCase()
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  List<ProductModel> _interleaveProducts(List<List<ProductModel>> groups) {
    final lists = groups.map((g) => List<ProductModel>.from(g)).toList();
    final output = <ProductModel>[];
    final seen = <int>{};

    var hasRemaining = true;
    while (hasRemaining) {
      hasRemaining = false;
      for (final list in lists) {
        if (list.isEmpty) continue;
        final product = list.removeAt(0);
        if (seen.add(product.id)) {
          output.add(product);
        }
        hasRemaining = hasRemaining || list.isNotEmpty;
      }
    }
    return output;
  }
}

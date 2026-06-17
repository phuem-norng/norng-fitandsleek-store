import '../core/api_client.dart';
import '../models/banner_model.dart';
import '../models/brand_model.dart';
import '../models/category_model.dart';
import '../models/collection_model.dart';
import '../models/homepage_section.dart';
import '../models/product_filters.dart';
import '../models/product_model.dart';

class ProductService {
  ProductService(this._api);

  final ApiClient _api;

  /// Normalize section browse — discounts use sale tab on main PLP for full filter support.
  HomeSectionBrowse? _normalizeSectionBrowse(HomeSectionBrowse? browse) {
    if (browse == null) return null;
    if (browse.discounts) {
      return HomeSectionBrowse(
        key: browse.key,
        title: browse.title,
        tab: 'sale',
      );
    }
    return browse;
  }

  Future<ProductPage> listProducts({
    int page = 1,
    String? query,
    int? categoryId,
    int? brandId,
    String? gender,
    ProductFilters? filters,
    HomeSectionBrowse? sectionBrowse,
  }) async {
    final active = filters ?? ProductFilters();
    final browse = _normalizeSectionBrowse(sectionBrowse);
    final brandIds = <int>{
      if (brandId != null) brandId,
      ...active.brandIds,
    };

    // Tab ordering only applies when user keeps default Recommend sort.
    final useTab = browse?.tab != null &&
        browse!.tab!.isNotEmpty &&
        active.sort == 'recommend';

    final res = await _api.dio.get('/products', queryParameters: {
      'page': page,
      'per_page': 20,
      if (query != null && query.isNotEmpty) 'q': query,
      if (browse?.categoryIds != null && browse!.categoryIds!.isNotEmpty)
        'category_id': browse.categoryIds!.join(',')
      else if (browse?.categoryId != null)
        'category_id': browse!.categoryId
      else if (categoryId != null)
        'category_id': categoryId,
      if (browse?.categorySlug != null &&
          browse!.categorySlug!.isNotEmpty &&
          (browse.categoryIds == null || browse.categoryIds!.isEmpty))
        'category': browse.categorySlug,
      if (browse?.searchQuery != null &&
          browse!.searchQuery!.isNotEmpty &&
          (browse.categoryIds == null || browse.categoryIds!.isEmpty) &&
          browse.categoryId == null &&
          (browse.categorySlug == null || browse.categorySlug!.isEmpty) &&
          browse.tab == null &&
          browse.parentCategory == null)
        'q': browse.searchQuery,
      if (useTab) 'tab': browse.tab,
      if (browse?.parentCategory != null &&
          browse!.parentCategory!.isNotEmpty)
        'parent_category': browse.parentCategory,
      if (brandIds.isNotEmpty) 'brand_id': brandIds.join(','),
      if (gender != null && gender.isNotEmpty) 'gender': gender,
      'sort': active.sort,
      if (active.minPrice != null) 'min_price': active.minPrice,
      if (active.maxPrice != null) 'max_price': active.maxPrice,
      if (active.genders.isNotEmpty) 'gender': active.genders.join(','),
      if (active.colors.isNotEmpty) 'color': active.colors.join(','),
      if (active.sizes.isNotEmpty) 'size': active.sizes.join(','),
    });
    return ProductPage.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<FilterOptionsModel> fetchFilterOptions() async {
    final res = await _api.dio.get('/products/filter-options');
    return FilterOptionsModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<List<ProductModel>> fetchProductsByIds(String ids) async {
    if (ids.trim().isEmpty) return [];
    final res = await _api.dio.get('/products', queryParameters: {
      'ids': ids,
      'per_page': 200,
    });
    final data = res.data;
    final list = data is Map ? data['data'] : data;
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => ProductModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<ProductModel> getProduct(String slug) async {
    final res = await _api.dio.get('/products/$slug');
    return ProductModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<List<BrandModel>> listBrands() async {
    final res = await _api.dio.get('/brands');
    final data = res.data;
    final raw = data is Map ? data['data'] : data;
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((e) => BrandModel.fromJson(Map<String, dynamic>.from(e)))
        .where((b) => b.name.isNotEmpty)
        .toList();
  }

  Future<List<CollectionModel>> listCollections() async {
    try {
      final res = await _api.dio.get('/collections');
      final data = res.data;
      final raw = data is Map ? data['data'] : data;
      if (raw is! List) return CollectionModel.fallbackTiles();
      final items = raw
          .whereType<Map>()
          .map((e) => CollectionModel.fromJson(Map<String, dynamic>.from(e)))
          .where((c) => c.name.isNotEmpty)
          .toList();
      return items.isNotEmpty ? items : CollectionModel.fallbackTiles();
    } catch (_) {
      return CollectionModel.fallbackTiles();
    }
  }

  Future<List<CategoryModel>> listCategories() async {
    final res = await _api.dio.get('/categories');
    final data = res.data;
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => CategoryModel.fromJson(Map<String, dynamic>.from(e)))
          .where((c) => c.name.isNotEmpty)
          .toList();
    }
    return [];
  }

  /// Hero → promo → all active banners (same order as web storefront).
  Future<List<BannerModel>> listHomeBanners() async {
    for (final path in ['/banners/hero', '/banners/promo', '/banners/all']) {
      try {
        final res = await _api.dio.get(path);
        final items = _parseBannerList(res.data);
        if (items.isNotEmpty) return items;
      } catch (_) {
        continue;
      }
    }
    return [];
  }

  List<BannerModel> _parseBannerList(dynamic data) {
    final raw = data is Map ? (data['data'] ?? data['banners']) : data;
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((e) => BannerModel.fromJson(Map<String, dynamic>.from(e)))
        .where((b) => (b.imageUrl ?? '').isNotEmpty)
        .toList();
  }
}

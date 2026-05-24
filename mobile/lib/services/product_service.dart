import '../core/api_client.dart';
import '../models/banner_model.dart';
import '../models/brand_model.dart';
import '../models/category_model.dart';
import '../models/product_model.dart';

class ProductService {
  ProductService(this._api);

  final ApiClient _api;

  Future<ProductPage> listProducts({
    int page = 1,
    String? query,
    int? categoryId,
    int? brandId,
    String? gender,
  }) async {
    final res = await _api.dio.get('/products', queryParameters: {
      'page': page,
      'per_page': 20,
      if (query != null && query.isNotEmpty) 'q': query,
      if (categoryId != null) 'category_id': categoryId,
      if (brandId != null) 'brand_id': brandId,
      if (gender != null && gender.isNotEmpty) 'gender': gender,
    });
    return ProductPage.fromJson(Map<String, dynamic>.from(res.data as Map));
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

import '../core/api_client.dart';
import '../models/product_model.dart';

class WishlistService {
  WishlistService(this._api);

  final ApiClient _api;

  Future<({List<ProductModel> products, int count})> fetchWishlist() async {
    final res = await _api.dio.get('/user/wishlist');
    final data = res.data;
    if (data is! Map) return (products: <ProductModel>[], count: 0);

    final count = data['count'] is int
        ? data['count'] as int
        : int.tryParse('${data['count']}') ?? 0;
    final list = data['data'];
    if (list is! List) return (products: <ProductModel>[], count: count);

    final products = list
        .whereType<Map>()
        .map((e) => ProductModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return (products: products, count: count);
  }
}

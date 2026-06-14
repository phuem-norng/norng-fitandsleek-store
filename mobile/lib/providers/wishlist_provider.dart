import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../models/product_model.dart';
import '../services/wishlist_service.dart';

class WishlistProvider extends ChangeNotifier {
  WishlistProvider(this._service);

  final WishlistService _service;

  final Set<int> _ids = {};
  List<ProductModel> _products = [];
  bool _loading = false;

  Set<int> get ids => Set.unmodifiable(_ids);
  List<ProductModel> get products => List.unmodifiable(_products);
  int get count => _ids.length;
  bool get loading => _loading;

  bool has(int productId) => _ids.contains(productId);

  Future<void> load() async {
    _loading = true;
    notifyListeners();
    try {
      final result = await _service.fetchWishlist();
      _products = result.products;
      _ids
        ..clear()
        ..addAll(result.products.map((p) => p.id));
    } on DioException {
      _products = [];
      _ids.clear();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void clear() {
    _products = [];
    _ids.clear();
    notifyListeners();
  }

  Future<bool> toggle(int productId) async {
    try {
      final result = has(productId)
          ? await _service.removeProduct(productId)
          : await _service.addProduct(productId);
      _products = result.products;
      _ids
        ..clear()
        ..addAll(result.products.map((p) => p.id));
      notifyListeners();
      return has(productId);
    } on DioException {
      return has(productId);
    }
  }
}

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/local_store_keys.dart';
import '../models/product_model.dart';
import '../services/product_service.dart';
import '../services/wishlist_service.dart';

class WishlistProvider extends ChangeNotifier {
  WishlistProvider(this._service, this._productService);

  final WishlistService _service;
  final ProductService _productService;

  final Set<int> _ids = {};
  final Map<int, ProductModel> _productCache = {};
  List<ProductModel> _products = [];
  bool _loading = false;

  Set<int> get ids => Set.unmodifiable(_ids);
  List<ProductModel> get products => List.unmodifiable(_products);
  int get count => _ids.length;
  bool get loading => _loading;

  bool has(int productId) => _ids.contains(productId);

  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(LocalStoreKeys.wishlist);
    if (raw == null || raw.isEmpty) return;

    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        _ids
          ..clear()
          ..addAll(decoded.whereType<num>().map((e) => e.toInt()));
        notifyListeners();
      }
    } catch (_) {
      /* ignore */
    }
  }

  Future<void> _persistGuestIds() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(LocalStoreKeys.wishlist, jsonEncode(_ids.toList()));
  }

  Future<void> _clearGuestIds() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(LocalStoreKeys.wishlist);
  }

  /// Pushes locally saved wishlist IDs to the authenticated account.
  Future<void> mergeGuestIntoAccount() async {
    await bootstrap();
    final guestIds = List<int>.from(_ids);
    if (guestIds.isEmpty) {
      await load(isLoggedIn: true);
      return;
    }

    final remaining = <int>[];
    for (final id in guestIds) {
      try {
        await _service.addProduct(id);
      } on DioException {
        remaining.add(id);
      }
    }

    if (remaining.isEmpty) {
      await _clearGuestIds();
    } else {
      _ids
        ..clear()
        ..addAll(remaining);
      await _persistGuestIds();
    }

    await load(isLoggedIn: true);
  }

  Future<void> load({required bool isLoggedIn}) async {
    _loading = true;
    notifyListeners();

    try {
      if (isLoggedIn) {
        final result = await _service.fetchWishlist();
        _products = result.products;
        _ids
          ..clear()
          ..addAll(result.products.map((p) => p.id));
        _productCache.clear();
      } else {
        if (_ids.isEmpty) {
          _products = [];
        } else {
          final res = await _productService.fetchProductsByIds(_ids.join(','));
          _products = res;
          for (final product in res) {
            _productCache[product.id] = product;
          }
        }
      }
    } on DioException {
      _products = _ids
          .map((id) => _productCache[id])
          .whereType<ProductModel>()
          .toList();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void clear() {
    _products = [];
    _ids.clear();
    _productCache.clear();
    notifyListeners();
  }

  Future<bool> toggle(
    int productId, {
    required bool isLoggedIn,
    ProductModel? product,
  }) async {
    if (product != null) {
      _productCache[productId] = product;
    }

    if (!isLoggedIn) {
      if (_ids.contains(productId)) {
        _ids.remove(productId);
      } else {
        _ids.add(productId);
      }
      await _persistGuestIds();
      _products = _ids
          .map((id) => _productCache[id])
          .whereType<ProductModel>()
          .toList();
      notifyListeners();
      return has(productId);
    }

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

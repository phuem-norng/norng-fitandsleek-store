import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../models/cart_model.dart';
import '../models/product_model.dart';
import '../services/cart_service.dart';
import '../services/guest_cart_storage.dart';

class CartProvider extends ChangeNotifier {
  CartProvider(this._service, this._guestStorage);

  final CartService _service;
  final GuestCartStorage _guestStorage;

  List<CartItemModel> _items = [];
  double _total = 0;
  bool _loading = false;
  String? _error;
  bool _isGuest = true;

  List<CartItemModel> get items => List.unmodifiable(_items);
  double get total => _total;
  bool get loading => _loading;
  String? get error => _error;
  bool get isGuest => _isGuest;

  int get count => _items.fold<int>(0, (sum, item) => sum + item.quantity);

  CartModel get cartModel => CartModel(items: _items, total: _total);

  Future<void> load({required bool isLoggedIn}) async {
    _isGuest = !isLoggedIn;
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      if (isLoggedIn) {
        final cart = await _service.getCart();
        _items = cart.items;
        _total = cart.total;
      } else {
        _items = await _guestStorage.readItems();
        _total = _items.fold<double>(0, (sum, item) => sum + item.lineTotal);
      }
    } on DioException catch (e) {
      _error = e.response?.data is Map
          ? (e.response!.data['message'] ?? 'Failed to load cart').toString()
          : 'Failed to load cart';
      _items = [];
      _total = 0;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> addProduct({
    required bool isLoggedIn,
    required ProductModel product,
    int quantity = 1,
    String? size,
    String? color,
  }) async {
    _isGuest = !isLoggedIn;

    if (isLoggedIn) {
      final cart = await _service.addItem(
        productId: product.id,
        quantity: quantity,
        size: size,
        color: color,
      );
      _items = cart.items;
      _total = cart.total;
      notifyListeners();
      return;
    }

    final key = GuestCartStorage.variantKey(
      productId: product.id,
      size: size,
      color: color,
    );
    final unitPrice = product.displayPrice;
    final current = await _guestStorage.readItems();
    final index = current.indexWhere((item) => item.guestKey == key);

    if (index >= 0) {
      final existing = current[index];
      current[index] = CartItemModel(
        id: existing.id,
        guestKey: key,
        productId: product.id,
        quantity: existing.quantity + quantity,
        unitPrice: unitPrice,
        size: size,
        color: color,
        product: product,
      );
    } else {
      current.add(
        CartItemModel(
          id: key.hashCode,
          guestKey: key,
          productId: product.id,
          quantity: quantity,
          unitPrice: unitPrice,
          size: size,
          color: color,
          product: product,
        ),
      );
    }

    await _persistGuest(current);
  }

  Future<void> updateQuantity({
    required bool isLoggedIn,
    required CartItemModel item,
    required int quantity,
  }) async {
    if (quantity < 1) {
      await removeItem(isLoggedIn: isLoggedIn, item: item);
      return;
    }

    if (isLoggedIn && !item.isGuest) {
      final cart = await _service.updateItemQuantity(item.id, quantity);
      _items = cart.items;
      _total = cart.total;
      notifyListeners();
      return;
    }

    final current = await _guestStorage.readItems();
    final key = item.guestKey;
    final next = current
        .map(
          (line) => line.guestKey == key
              ? CartItemModel(
                  id: line.id,
                  guestKey: line.guestKey,
                  productId: line.productId,
                  quantity: quantity,
                  unitPrice: line.unitPrice,
                  size: line.size,
                  color: line.color,
                  product: line.product,
                )
              : line,
        )
        .toList();
    await _persistGuest(next);
  }

  Future<void> removeItem({
    required bool isLoggedIn,
    required CartItemModel item,
  }) async {
    if (isLoggedIn && !item.isGuest) {
      await _service.removeItem(item.id);
      await load(isLoggedIn: true);
      return;
    }

    final current = await _guestStorage.readItems();
    final key = item.guestKey;
    current.removeWhere((line) => line.guestKey == key);
    await _persistGuest(current);
  }

  /// Pushes locally saved guest cart lines to the authenticated cart.
  Future<void> mergeGuestIntoAccount() async {
    final guestItems = await _guestStorage.readItems();
    if (guestItems.isEmpty) {
      await load(isLoggedIn: true);
      return;
    }

    final remaining = <CartItemModel>[];
    for (final item in guestItems) {
      try {
        await _service.addItem(
          productId: item.productId,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        );
      } on DioException {
        remaining.add(item);
      }
    }

    await _guestStorage.writeItems(remaining);
    await load(isLoggedIn: true);
  }

  void clear() {
    _items = [];
    _total = 0;
    notifyListeners();
  }

  Future<void> _persistGuest(List<CartItemModel> items) async {
    await _guestStorage.writeItems(items);
    _items = items;
    _total = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    _isGuest = true;
    notifyListeners();
  }
}

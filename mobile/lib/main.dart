import 'package:flutter/material.dart';

import 'app.dart';
import 'core/api_client.dart';
import 'core/device_headers.dart';
import 'providers/auth_provider.dart';
import 'providers/wishlist_provider.dart';
import 'services/auth_service.dart';
import 'services/cart_service.dart';
import 'services/image_search_service.dart';
import 'services/order_service.dart';
import 'services/payment_service.dart';
import 'services/product_service.dart';
import 'services/wishlist_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final deviceHeaders = await DeviceHeaders.load();
  final apiClient = ApiClient(deviceHeaders: deviceHeaders);
  final authService = AuthService(apiClient);
  final wishlistService = WishlistService(apiClient);
  final wishlistProvider = WishlistProvider(wishlistService);
  final authProvider = AuthProvider(
    authService,
    apiClient,
    onSignedIn: wishlistProvider.load,
    onSignedOut: wishlistProvider.clear,
  );

  await authProvider.bootstrap();
  if (authProvider.isLoggedIn) {
    await wishlistProvider.load();
  }

  runApp(
    FitandSleekApp(
      apiClient: apiClient,
      authProvider: authProvider,
      productService: ProductService(apiClient),
      cartService: CartService(apiClient),
      orderService: OrderService(apiClient),
      paymentService: PaymentService(apiClient),
      imageSearchService: ImageSearchService(apiClient),
      wishlistProvider: wishlistProvider,
    ),
  );
}

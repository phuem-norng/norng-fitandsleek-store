import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api_client.dart';
import 'core/device_headers.dart';
import 'providers/app_settings_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/wishlist_provider.dart';
import 'services/auth_service.dart';
import 'services/cart_service.dart';
import 'services/guest_cart_storage.dart';
import 'services/image_search_service.dart';
import 'services/order_service.dart';
import 'services/payment_service.dart';
import 'services/product_service.dart';
import 'services/social_auth_service.dart';
import 'services/wishlist_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final prefs = await SharedPreferences.getInstance();
  final appSettingsProvider = AppSettingsProvider(prefs);
  await appSettingsProvider.bootstrap();

  final deviceHeaders = await DeviceHeaders.load();
  final apiClient = ApiClient(deviceHeaders: deviceHeaders);
  final productService = ProductService(apiClient);
  final authService = AuthService(apiClient);
  final socialAuthService = SocialAuthService(apiClient);
  final wishlistService = WishlistService(apiClient);
  final wishlistProvider = WishlistProvider(wishlistService, productService);
  final cartProvider = CartProvider(CartService(apiClient), GuestCartStorage());

  await wishlistProvider.bootstrap();

  final authProvider = AuthProvider(
    authService,
    apiClient,
    socialAuthService,
    onSignedIn: () async {
      await Future.wait([
        wishlistProvider.mergeGuestIntoAccount(),
        cartProvider.mergeGuestIntoAccount(),
      ]);
    },
    onSignedOut: () {
      wishlistProvider.bootstrap().then((_) {
        wishlistProvider.load(isLoggedIn: false);
      });
      cartProvider.load(isLoggedIn: false);
    },
  );

  await authProvider.bootstrap();
  if (authProvider.isLoggedIn) {
    await Future.wait([
      wishlistProvider.mergeGuestIntoAccount(),
      cartProvider.mergeGuestIntoAccount(),
    ]);
  } else {
    await Future.wait([
      wishlistProvider.load(isLoggedIn: false),
      cartProvider.load(isLoggedIn: false),
    ]);
  }

  runApp(
    FitandSleekApp(
      apiClient: apiClient,
      authProvider: authProvider,
      appSettingsProvider: appSettingsProvider,
      productService: productService,
      cartProvider: cartProvider,
      orderService: OrderService(apiClient),
      paymentService: PaymentService(apiClient),
      imageSearchService: ImageSearchService(apiClient),
      wishlistProvider: wishlistProvider,
    ),
  );
}

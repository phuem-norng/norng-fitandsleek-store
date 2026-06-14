import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'providers/auth_provider.dart';
import 'providers/wishlist_provider.dart';
import 'screens/home_shell.dart';
import 'services/auth_service.dart';
import 'services/cart_service.dart';
import 'services/notification_service.dart';
import 'services/image_search_service.dart';
import 'services/order_service.dart';
import 'services/payment_service.dart';
import 'services/product_service.dart';
import 'services/wishlist_service.dart';
import 'theme/app_theme.dart';

class FitandSleekApp extends StatelessWidget {
  const FitandSleekApp({
    super.key,
    required this.apiClient,
    required this.authProvider,
    required this.productService,
    required this.cartService,
    required this.orderService,
    required this.paymentService,
    required this.imageSearchService,
    required this.wishlistProvider,
  });

  final ApiClient apiClient;
  final AuthProvider authProvider;
  final ProductService productService;
  final CartService cartService;
  final OrderService orderService;
  final PaymentService paymentService;
  final ImageSearchService imageSearchService;
  final WishlistProvider wishlistProvider;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider<WishlistProvider>.value(value: wishlistProvider),
        Provider<ProductService>.value(value: productService),
        Provider<CartService>.value(value: cartService),
        Provider<OrderService>.value(value: orderService),
        Provider<PaymentService>.value(value: paymentService),
        Provider<ImageSearchService>.value(value: imageSearchService),
        Provider<NotificationService>(
          create: (_) => NotificationService(apiClient),
        ),
        Provider<WishlistService>(
          create: (_) => WishlistService(apiClient),
        ),
        Provider<AuthService>(
          create: (_) => AuthService(apiClient),
        ),
      ],
      child: MaterialApp(
        title: 'FitandSleek',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const _RootGate(),
      ),
    );
  }
}

class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.booted) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return const HomeShell();
  }
}

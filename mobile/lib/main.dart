import 'package:flutter/material.dart';

import 'app.dart';
import 'core/api_client.dart';
import 'core/device_headers.dart';
import 'providers/auth_provider.dart';
import 'services/auth_service.dart';
import 'services/cart_service.dart';
import 'services/product_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final deviceHeaders = await DeviceHeaders.load();
  final apiClient = ApiClient(deviceHeaders: deviceHeaders);
  final authService = AuthService(apiClient);
  final authProvider = AuthProvider(authService, apiClient);

  await authProvider.bootstrap();

  runApp(
    FitandSleekApp(
      apiClient: apiClient,
      authProvider: authProvider,
      productService: ProductService(apiClient),
      cartService: CartService(apiClient),
    ),
  );
}

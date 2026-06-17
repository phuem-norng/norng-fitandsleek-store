import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../providers/cart_provider.dart';
import '../screens/cart_screen.dart';
import '../widgets/navigation/home_store_header.dart';

void openCartScreen(BuildContext context) {
  final count = context.read<CartProvider>().count;
  final l10n = context.l10n;
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (ctx) => Scaffold(
        backgroundColor: Theme.of(ctx).scaffoldBackgroundColor,
        body: Column(
          children: [
            InnerPageHeader(
              title: '${l10n.cartTitle} ($count)',
              leadingIcon: Icons.shopping_cart_outlined,
              onBack: () => Navigator.pop(ctx),
            ),
            const Expanded(child: CartScreen()),
          ],
        ),
      ),
    ),
  );
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/product_model.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import 'product_image.dart';

/// Sharp-corner product cards (storefront grid style).
const BorderRadius productCardRadius = BorderRadius.zero;

enum ProductCardLayout { standard, imageFocus }

/// Grid cell ratio tuned for [ProductCardLayout.imageFocus] (image + 2-line title).
const double productCardGridAspectRatio = 0.48;

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.onTap,
    this.isWishlisted = false,
    this.onWishlistToggle,
    this.layout = ProductCardLayout.standard,
  });

  final ProductModel product;
  final VoidCallback onTap;
  final bool isWishlisted;
  final VoidCallback? onWishlistToggle;
  final ProductCardLayout layout;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final price = currency.format(product.displayPrice);
    final imageUrl = resolveMediaUrl(product.imageUrl);
    final discount = product.discountPercent;
    final imageFocus = layout == ProductCardLayout.imageFocus;
    final contentPadding = imageFocus
        ? const EdgeInsets.fromLTRB(10, 6, 10, 8)
        : const EdgeInsets.fromLTRB(12, 10, 12, 12);
    final theme = Theme.of(context);
    final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;

    final image = Stack(
      fit: StackFit.expand,
      children: [
        ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
        if (discount != null)
          Positioned(
            top: 8,
            left: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: productCardRadius,
              ),
              child: Text(
                '-$discount%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        if (onWishlistToggle != null)
          Positioned(
            top: 8,
            right: 8,
            child: Material(
              color: theme.colorScheme.surface.withValues(alpha: 0.95),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onWishlistToggle,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Icon(
                    isWishlisted ? Icons.favorite : Icons.favorite_border,
                    size: 20,
                    color: isWishlisted ? AppColors.storeHeader : AppColors.textMuted,
                  ),
                ),
              ),
            ),
          ),
      ],
    );

    const titleMaxLines = 2;
    const titleFontSize = 13.0;
    const titleLineHeight = 1.25;
    final titleStyle = Theme.of(context).textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w600,
          height: titleLineHeight,
          fontSize: imageFocus ? titleFontSize : null,
        );
    final titleBlockHeight = imageFocus
        ? titleFontSize * titleLineHeight * titleMaxLines
        : null;

    final details = Padding(
      padding: contentPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (titleBlockHeight != null)
            SizedBox(
              height: titleBlockHeight,
              child: Text(
                product.name,
                maxLines: titleMaxLines,
                overflow: TextOverflow.ellipsis,
                style: titleStyle,
              ),
            )
          else
            Text(
              product.name,
              maxLines: titleMaxLines,
              overflow: TextOverflow.ellipsis,
              style: titleStyle,
            ),
          SizedBox(height: imageFocus ? 4 : 6),
          Row(
            children: [
              Text(
                price,
                style: TextStyle(
                  fontSize: imageFocus ? 14 : 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.error,
                ),
              ),
              if (product.hasDiscount) ...[
                const SizedBox(width: 6),
                Text(
                  currency.format(product.price!),
                  style: TextStyle(
                    fontSize: imageFocus ? 11 : 12,
                    color: onSurfaceVariant,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );

    return InkWell(
      onTap: onTap,
      borderRadius: productCardRadius,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: productCardRadius,
              child: image,
            ),
          ),
          details,
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../models/product_model.dart';
import '../../theme/app_colors.dart';

enum VariantPickerKind { color, size }

class VariantPickerSheet extends StatelessWidget {
  const VariantPickerSheet({
    super.key,
    required this.kind,
    required this.product,
    required this.options,
    this.selectedValue,
    this.otherSelectedValue,
  });

  final VariantPickerKind kind;
  final ProductModel product;
  final List<String> options;
  final String? selectedValue;
  final String? otherSelectedValue;

  static Future<String?> show(
    BuildContext context, {
    required VariantPickerKind kind,
    required ProductModel product,
    required List<String> options,
    String? selectedValue,
    String? otherSelectedValue,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => VariantPickerSheet(
        kind: kind,
        product: product,
        options: options,
        selectedValue: selectedValue,
        otherSelectedValue: otherSelectedValue,
      ),
    );
  }

  String get _title => kind == VariantPickerKind.size ? 'Size' : 'Color';

  String? _stockLabel(String option) {
    final qty = product.sellableQtyForOption(
      isSize: kind == VariantPickerKind.size,
      option: option,
      otherSelected: otherSelectedValue,
    );
    if (qty == null) return null;
    if (qty <= 0) return '(Sold out)';
    return '($qty left in stock)';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;
    final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: theme.dividerColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              _title,
              style: theme.textTheme.titleMedium,
            ),
          ),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(0, 0, 0, 12),
              itemCount: options.length,
              separatorBuilder: (_, __) => Divider(height: 1, indent: 16, endIndent: 16, color: theme.dividerColor),
              itemBuilder: (context, index) {
                final option = options[index];
                final stockLabel = _stockLabel(option);
                final soldOut = stockLabel == '(Sold out)';
                final isSelected = selectedValue != null &&
                    selectedValue!.trim().toLowerCase() == option.trim().toLowerCase();

                return ListTile(
                  enabled: !soldOut,
                  title: Text(
                    option,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                      color: soldOut ? onSurfaceVariant : onSurface,
                    ),
                  ),
                  trailing: stockLabel == null
                      ? null
                      : Text(
                          stockLabel,
                          style: TextStyle(
                            fontSize: 13,
                            color: soldOut ? AppColors.textMuted : AppColors.error,
                          ),
                        ),
                  onTap: soldOut ? null : () => Navigator.of(context).pop(option),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

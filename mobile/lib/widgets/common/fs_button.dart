import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

enum FsButtonVariant { primary, secondary, outline, danger, accent }

class FsButton extends StatelessWidget {
  const FsButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = FsButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final FsButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox(
            height: 22,
            width: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
              Text(label),
            ],
          );

    final enabled = onPressed != null && !loading;

    switch (variant) {
      case FsButtonVariant.outline:
        return SizedBox(
          width: expand ? double.infinity : null,
          child: OutlinedButton(onPressed: enabled ? onPressed : null, child: child),
        );
      case FsButtonVariant.secondary:
        return SizedBox(
          width: expand ? double.infinity : null,
          child: FilledButton.tonal(
            onPressed: enabled ? onPressed : null,
            child: child,
          ),
        );
      case FsButtonVariant.danger:
        return SizedBox(
          width: expand ? double.infinity : null,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: enabled ? onPressed : null,
            child: child,
          ),
        );
      case FsButtonVariant.accent:
        return SizedBox(
          width: expand ? double.infinity : null,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.storeHeader),
            onPressed: enabled ? onPressed : null,
            child: child,
          ),
        );
      case FsButtonVariant.primary:
        return SizedBox(
          width: expand ? double.infinity : null,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.storeHeader),
            onPressed: enabled ? onPressed : null,
            child: child,
          ),
        );
    }
  }
}

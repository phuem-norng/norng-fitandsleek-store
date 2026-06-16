import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import 'fs_button.dart';

class FsEmptyState extends StatelessWidget {
  const FsEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.subtitleKm,
    this.actionLabel,
    this.onAction,
    this.minimal = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? subtitleKm;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool minimal;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (minimal)
              Icon(icon, size: 72, color: AppColors.textMuted)
            else
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 40, color: AppColors.accentDark),
              ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (subtitleKm != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitleKm!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
              ),
            ],
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              FsButton(label: actionLabel!, onPressed: onAction, variant: FsButtonVariant.accent),
            ],
          ],
        ),
      ),
    );
  }
}

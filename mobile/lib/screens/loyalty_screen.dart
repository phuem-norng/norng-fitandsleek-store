import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../models/loyalty_model.dart';
import '../services/customer_account_service.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/navigation/home_store_header.dart';

class LoyaltyScreen extends StatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  State<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends State<LoyaltyScreen> {
  LoyaltyModel? _loyalty;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final loyalty = await context.read<CustomerAccountService>().getLoyalty();
      if (!mounted) return;
      setState(() {
        _loyalty = loyalty;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      body: Column(
        children: [
          InnerPageHeader(
            title: l10n.menuLoyalty,
            leadingIcon: Icons.workspace_premium_outlined,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? FsEmptyState(
                        icon: Icons.workspace_premium_outlined,
                        title: l10n.loyaltyUnavailable,
                        subtitle: _error,
                        actionLabel: l10n.retry,
                        onAction: _load,
                      )
                    : _loyalty == null
                        ? const SizedBox.shrink()
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView(
                              padding: const EdgeInsets.all(16),
                              children: [
                                _TierCard(loyalty: _loyalty!),
                                const SizedBox(height: 16),
                                _StatGrid(loyalty: _loyalty!),
                                if (_loyalty!.nextTier != null) ...[
                                  const SizedBox(height: 16),
                                  Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: AppColors.storeHeader.withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Text(
                                      l10n.loyaltyNextTier(
                                        _loyalty!.pointsToNextTier,
                                        _loyalty!.nextTier!.tier.toUpperCase(),
                                      ),
                                      style: Theme.of(context).textTheme.bodyMedium,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _TierCard extends StatelessWidget {
  const _TierCard({required this.loyalty});

  final LoyaltyModel loyalty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.storeHeader,
            AppColors.storeHeader.withValues(alpha: 0.85),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.loyaltyTierLabel(loyalty.tier),
            style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            '${loyalty.points.toString()} pts',
            style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.loyaltyDiscount(loyalty.discountPercent),
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.loyalty});

  final LoyaltyModel loyalty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(child: _MiniStat(label: l10n.statOrders, value: '${loyalty.ordersCount}')),
        const SizedBox(width: 10),
        Expanded(
          child: _MiniStat(
            label: l10n.loyaltyLifetimeSpend,
            value: '\$${loyalty.lifetimeSpend.toStringAsFixed(0)}',
          ),
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: onSurface)),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: onSurfaceVariant, fontSize: 12)),
        ],
      ),
    );
  }
}

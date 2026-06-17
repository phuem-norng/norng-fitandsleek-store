import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../models/order_model.dart';
import '../models/replacement_case_model.dart';
import '../services/customer_account_service.dart';
import '../services/order_service.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/navigation/home_store_header.dart';
import 'replacement_request_sheet.dart';

class ReplacementsScreen extends StatefulWidget {
  const ReplacementsScreen({super.key});

  @override
  State<ReplacementsScreen> createState() => _ReplacementsScreenState();
}

class _ReplacementsScreenState extends State<ReplacementsScreen> {
  final List<ReplacementCaseModel> _cases = [];
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
      final page = await context.read<CustomerAccountService>().listReplacementCases();
      if (!mounted) return;
      setState(() {
        _cases
          ..clear()
          ..addAll(page.items);
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

  Future<void> _startRequest() async {
    final l10n = context.l10n;
    try {
      final page = await context.read<OrderService>().listOrders(page: 1);
      final eligible = page.items.where((o) {
        final status = o.status.toLowerCase();
        return status == 'delivered' || status == 'completed' || status == 'shipped';
      }).toList();

      if (!mounted) return;
      if (eligible.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.replacementNoEligibleOrders)),
        );
        return;
      }

      final order = await showModalBottomSheet<OrderModel>(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (_) => _OrderPickerSheet(orders: eligible),
      );

      if (!mounted || order == null) return;

      final submitted = await ReplacementRequestSheet.show(context, order: order);
      if (submitted == true) {
        await _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.replacementSubmitted)),
          );
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      floatingActionButton: _cases.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: _startRequest,
              backgroundColor: AppColors.storeHeader,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: Text(l10n.requestReplacement),
            ),
      body: Column(
        children: [
          InnerPageHeader(
            title: l10n.menuReplacements,
            leadingIcon: Icons.sync_alt_rounded,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? FsEmptyState(
                        icon: Icons.sync_alt_rounded,
                        title: l10n.replacementsUnavailable,
                        subtitle: _error,
                        actionLabel: l10n.retry,
                        onAction: _load,
                      )
                    : _cases.isEmpty
                        ? FsEmptyState(
                            icon: Icons.sync_alt_rounded,
                            title: l10n.replacementsEmpty,
                            subtitle: l10n.replacementsEmptySub,
                            actionLabel: l10n.requestReplacement,
                            onAction: _startRequest,
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                              itemCount: _cases.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final item = _cases[index];
                                return _ReplacementCard(item: item);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _ReplacementCard extends StatelessWidget {
  const _ReplacementCard({required this.item});

  final ReplacementCaseModel item;

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
        return AppColors.storeHeader;
      case 'rejected':
        return AppColors.error;
      default:
        return AppColors.accentDark;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
          Row(
            children: [
              Expanded(
                child: Text(
                  item.orderNumber != null ? '#${item.orderNumber}' : 'Order #${item.orderId}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: onSurface),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusColor(item.status).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  item.status.replaceAll('_', ' '),
                  style: TextStyle(
                    color: _statusColor(item.status),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(item.reason, style: Theme.of(context).textTheme.bodyMedium),
          if (item.notes != null && item.notes!.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(item.notes!, style: Theme.of(context).textTheme.bodySmall),
          ],
          if (item.createdAt != null) ...[
            const SizedBox(height: 8),
            Text(
              l10n.submittedOn(item.createdAt!),
              style: TextStyle(color: onSurfaceVariant, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _OrderPickerSheet extends StatelessWidget {
  const _OrderPickerSheet({required this.orders});

  final List<OrderModel> orders;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.selectOrderForReplacement,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(color: onSurface),
            ),
            const SizedBox(height: 12),
            ...orders.map(
              (order) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('#${order.orderNumber}', style: TextStyle(color: onSurface)),
                subtitle: Text(order.status.replaceAll('_', ' ')),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.pop(context, order),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

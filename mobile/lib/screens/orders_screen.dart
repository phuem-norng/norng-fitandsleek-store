import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_client.dart';
import '../l10n/l10n_extension.dart';
import '../models/order_model.dart';
import '../services/order_service.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/telegram_connect_button.dart';
import 'order_detail_screen.dart';
import 'order_tracking_screen.dart';
import 'replacement_request_sheet.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, this.showTrackingHint = false});

  final bool showTrackingHint;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final List<OrderModel> _orders = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
        _hasMore = true;
        _orders.clear();
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final page = await context.read<OrderService>().listOrders(page: _page);
      if (!mounted) return;
      setState(() {
        _orders.addAll(page.items);
        _hasMore = page.hasMore;
        _page = page.currentPage + 1;
        _loading = false;
        _loadingMore = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = context.read<ApiClient>().apiMessage(e);
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _openReplacement(OrderModel order) async {
    final l10n = context.l10n;
    final submitted = await ReplacementRequestSheet.show(context, order: order);
    if (submitted == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.replacementSubmitted)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;

    return Scaffold(
      body: Column(
        children: [
          InnerPageHeader(
            title: l10n.menuOrders,
            leadingIcon: Icons.shopping_bag_outlined,
            onBack: () => Navigator.of(context).pop(),
          ),
          if (widget.showTrackingHint)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text(
                l10n.menuTrackDelivery,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: onSurfaceVariant),
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? FsEmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: l10n.ordersUnavailable,
                        subtitle: _error,
                        actionLabel: l10n.retry,
                        onAction: () => _load(reset: true),
                      )
                    : _orders.isEmpty
                        ? FsEmptyState(
                            icon: Icons.receipt_long_outlined,
                            title: l10n.ordersEmpty,
                            subtitle: l10n.ordersEmptySub,
                          )
                        : RefreshIndicator(
                            onRefresh: () => _load(reset: true),
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _orders.length + (_hasMore ? 1 : 0),
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                if (index >= _orders.length) {
                                  if (_loadingMore) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16),
                                      child: Center(child: CircularProgressIndicator()),
                                    );
                                  }
                                  _load();
                                  return const SizedBox.shrink();
                                }
                                final order = _orders[index];
                                final canReplace = {
                                  'delivered',
                                  'completed',
                                  'shipped',
                                }.contains(order.status.toLowerCase());

                                return Material(
                                  color: Theme.of(context).colorScheme.surface,
                                  borderRadius: BorderRadius.circular(16),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(16),
                                    onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => OrderDetailScreen(order: order),
                                      ),
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      '#${order.orderNumber}',
                                                      style: TextStyle(fontWeight: FontWeight.w700, color: onSurface),
                                                    ),
                                                    const SizedBox(height: 4),
                                                    Text(
                                                      order.status.replaceAll('_', ' '),
                                                      style: Theme.of(context).textTheme.bodyMedium,
                                                    ),
                                                    if (order.shipment?.trackingCode != null) ...[
                                                      const SizedBox(height: 4),
                                                      Text(
                                                        '${l10n.trackingNumber}: ${order.shipment!.trackingCode}',
                                                        style: TextStyle(
                                                          color: onSurfaceVariant,
                                                          fontSize: 12,
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                              ),
                                              Text(
                                                currency.format(order.total),
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  color: AppColors.primary,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          Row(
                                            children: [
                                              Expanded(
                                                child: FsButton(
                                                  label: l10n.trackOrder,
                                                  icon: Icons.local_shipping_outlined,
                                                  onPressed: () => Navigator.of(context).push(
                                                    MaterialPageRoute(
                                                      builder: (_) => OrderTrackingScreen(order: order),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                              if (canReplace) ...[
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: FsButton(
                                                    label: l10n.requestReplacement,
                                                    variant: FsButtonVariant.outline,
                                                    onPressed: () => _openReplacement(order),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          TelegramConnectButton(
                                            orderNumber: order.orderNumber,
                                            compact: true,
                                          ),
                                          if (order.shipment?.externalTrackingUrl != null) ...[
                                            const SizedBox(height: 8),
                                            TextButton.icon(
                                              onPressed: () async {
                                                final uri = Uri.tryParse(order.shipment!.externalTrackingUrl!);
                                                if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                                              },
                                              icon: const Icon(Icons.open_in_new, size: 16),
                                              label: Text(l10n.openTrackingLink),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

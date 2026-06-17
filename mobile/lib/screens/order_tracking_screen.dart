import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/l10n_extension.dart';
import '../models/order_model.dart';
import '../services/order_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/product_image.dart';

class OrderTrackingScreen extends StatefulWidget {
  const OrderTrackingScreen({super.key, required this.order});

  final OrderModel order;

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  OrderTrackModel? _track;
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
      final track = await context.read<OrderService>().trackOrder(widget.order.orderNumber);
      if (!mounted) return;
      setState(() {
        _track = track;
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

  int _activeStepIndex(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
      case 'pending_payment':
        return 0;
      case 'processing':
      case 'paid':
        return 2;
      case 'shipped':
        return 3;
      case 'delivered':
      case 'completed':
        return 4;
      default:
        return 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final order = widget.order;
    final track = _track;
    final firstItem = order.items.isNotEmpty ? order.items.first : null;
    final status = track?.status ?? order.status;
    final activeStep = _activeStepIndex(status);

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InnerPageHeader(
            title: l10n.orderTrackingTitle,
            subtitle: order.orderNumber,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!, textAlign: TextAlign.center),
                              const SizedBox(height: 12),
                              FilledButton(onPressed: _load, child: Text(l10n.retry)),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            if (firstItem != null)
                              _ProductSummaryCard(item: firstItem, currency: currency),
                            if (track?.trackingNumber != null || order.shipment?.trackingCode != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surface,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        '${l10n.trackingNumber}: ${track?.trackingNumber ?? order.shipment?.trackingCode}',
                                        style: const TextStyle(fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                    if (order.shipment?.externalTrackingUrl != null)
                                      IconButton(
                                        onPressed: () async {
                                          final uri = Uri.tryParse(order.shipment!.externalTrackingUrl!);
                                          if (uri != null) {
                                            await launchUrl(uri, mode: LaunchMode.externalApplication);
                                          }
                                        },
                                        icon: const Icon(Icons.open_in_new),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            _TimelineCard(activeStep: activeStep, order: order, status: status),
                            const SizedBox(height: 16),
                            _AddressCard(
                              address: track?.shippingAddress ?? order.formattedShippingAddress,
                            ),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ProductSummaryCard extends StatelessWidget {
  const _ProductSummaryCard({required this.item, required this.currency});

  final OrderItemModel item;
  final NumberFormat currency;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final imageUrl = resolveMediaUrl(item.imageUrl);
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          if (imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SizedBox(
                width: 64,
                height: 64,
                child: ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
              ),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: onSurface),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.qtyLabel(item.quantity),
                  style: TextStyle(color: onSurfaceVariant, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  currency.format(item.price),
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: onSurface),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({
    required this.activeStep,
    required this.order,
    required this.status,
  });

  final int activeStep;
  final OrderModel order;
  final String status;

  static const _stepIcons = [
    Icons.check,
    Icons.check,
    Icons.inventory_2_outlined,
    Icons.local_shipping_outlined,
    Icons.check_circle_outline,
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final steps = l10n.orderTrackingSteps;
    final date = order.createdAt ?? '';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.orderTrackingHeading, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            status.replaceAll('_', ' '),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          ...List.generate(steps.length, (i) {
            final label = steps[i];
            final icon = _stepIcons[i];
            final completed = i < activeStep;
            final active = i == activeStep;
            final upcoming = i > activeStep;
            return _TimelineStep(
              label: label,
              icon: icon,
              completed: completed,
              active: active,
              upcoming: upcoming,
              isLast: i == steps.length - 1,
              subtitle: completed
                  ? date
                  : active
                      ? l10n.inProgress
                      : l10n.estimatedDelivery,
            );
          }),
        ],
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.label,
    required this.icon,
    required this.completed,
    required this.active,
    required this.upcoming,
    required this.isLast,
    required this.subtitle,
  });

  final String label;
  final IconData icon;
  final bool completed;
  final bool active;
  final bool upcoming;
  final bool isLast;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;
    final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;
    final border = theme.dividerTheme.color ?? theme.colorScheme.outline;
    final nodeColor = completed
        ? AppColors.storeHeader
        : active
            ? AppColors.accent
            : Colors.transparent;
    final borderColor = upcoming ? border : nodeColor;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: completed || active ? nodeColor : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(color: borderColor, width: 2),
                ),
                child: Icon(
                  completed ? Icons.check : icon,
                  size: 16,
                  color: completed || active ? Colors.white : onSurfaceVariant,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: border),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: active ? AppColors.accent : onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(subtitle, style: TextStyle(color: onSurfaceVariant, fontSize: 12)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({this.address});

  final String? address;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.deliveryAddress,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: onSurfaceVariant,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.location_on_outlined, size: 18, color: onSurfaceVariant),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  address?.trim().isNotEmpty == true ? address! : '—',
                  style: TextStyle(color: onSurface.withValues(alpha: 0.85), height: 1.45),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

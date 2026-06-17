import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/l10n_extension.dart';
import '../models/order_model.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/product_image.dart';
import '../widgets/telegram_connect_button.dart';
import 'order_tracking_screen.dart';
import 'payment_screen.dart';
import 'replacement_request_sheet.dart';

class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.order});

  final OrderModel order;

  bool get _needsPayment =>
      order.paymentStatus == 'pending' && order.paymentMethod == 'bakong_khqr';

  bool get _canReplace {
    final status = order.status.toLowerCase();
    return status == 'delivered' || status == 'completed' || status == 'shipped';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: Text('#${order.orderNumber}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _InfoCard(
            children: [
              _Row('Status', order.status.replaceAll('_', ' ')),
              _Row('Payment', order.paymentStatus.replaceAll('_', ' ')),
              if (order.paymentMethod != null) _Row('Method', order.paymentMethod!),
              _Row('Total', currency.format(order.total)),
              if (order.shipment?.trackingCode != null)
                _Row(l10n.trackingNumber, order.shipment!.trackingCode!),
            ],
          ),
          const SizedBox(height: 16),
          Text('Items', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          ...order.items.map((item) {
            final imageUrl = resolveMediaUrl(item.imageUrl);
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  if (imageUrl.isNotEmpty)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 52,
                        height: 52,
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
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        Text(
                          '${l10n.qtyLabel(item.quantity)} · ${currency.format(item.price)}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
          if (_needsPayment) ...[
            const SizedBox(height: 16),
            FsButton(
              label: 'Pay with Bakong KHQR',
              variant: FsButtonVariant.accent,
              icon: Icons.qr_code_2,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PaymentScreen(
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    amount: order.total,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          FsButton(
            label: l10n.trackOrder,
            icon: Icons.local_shipping_outlined,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => OrderTrackingScreen(order: order)),
            ),
          ),
          const SizedBox(height: 8),
          TelegramConnectButton(orderNumber: order.orderNumber),
          if (_canReplace) ...[
            const SizedBox(height: 8),
            FsButton(
              label: l10n.requestReplacement,
              variant: FsButtonVariant.outline,
              icon: Icons.sync_alt_rounded,
              onPressed: () async {
                final submitted = await ReplacementRequestSheet.show(context, order: order);
                if (submitted == true && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(l10n.replacementSubmitted)),
                  );
                }
              },
            ),
          ],
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
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(children: children),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

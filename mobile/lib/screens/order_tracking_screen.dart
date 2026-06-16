import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/app_strings.dart';
import '../models/order_model.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/product_image.dart';

class OrderTrackingScreen extends StatelessWidget {
  const OrderTrackingScreen({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final firstItem = order.items.isNotEmpty ? order.items.first : null;
    final activeStep = _activeStepIndex(order.status);

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InnerPageHeader(
            title: AppStrings.orderTrackingTitle,
            subtitle: order.orderNumber,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (firstItem != null) _ProductSummaryCard(item: firstItem, currency: currency),
                const SizedBox(height: 16),
                _TimelineCard(activeStep: activeStep, order: order),
                const SizedBox(height: 16),
                _AddressCard(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  int _activeStepIndex(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
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
}

class _ProductSummaryCard extends StatelessWidget {
  const _ProductSummaryCard({required this.item, required this.currency});

  final OrderItemModel item;
  final NumberFormat currency;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveMediaUrl(item.imageUrl);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
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
                Text(item.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 4),
                Text(
                  'Qty: ${item.quantity}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  currency.format(item.price),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
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
  const _TimelineCard({required this.activeStep, required this.order});

  final int activeStep;
  final OrderModel order;

  static const _steps = [
    ('ការបញ្ជាទិញ', 'Order Placed', Icons.check),
    ('ការបង់ប្រាក់', 'Payment Confirmed', Icons.check),
    ('ការវេចខ្ចប់', 'Packing', Icons.inventory_2_outlined),
    ('ការដឹកជញ្ជូន', 'Shipped', Icons.local_shipping_outlined),
    ('ការដឹកជញ្ជូនបាន', 'Delivered', Icons.check_circle_outline),
  ];

  @override
  Widget build(BuildContext context) {
    final date = order.createdAt ?? '2025-06-15 · 09:30 AM';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(AppStrings.orderTrackingHeading, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 20),
          ...List.generate(_steps.length, (i) {
            final (km, en, icon) = _steps[i];
            final completed = i < activeStep;
            final active = i == activeStep;
            final upcoming = i > activeStep;
            return _TimelineStep(
              km: km,
              en: en,
              icon: icon,
              completed: completed,
              active: active,
              upcoming: upcoming,
              isLast: i == _steps.length - 1,
              subtitle: completed
                  ? date
                  : active
                      ? 'In progress…'
                      : 'Estimated Jun 16',
            );
          }),
        ],
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.km,
    required this.en,
    required this.icon,
    required this.completed,
    required this.active,
    required this.upcoming,
    required this.isLast,
    required this.subtitle,
  });

  final String km;
  final String en;
  final IconData icon;
  final bool completed;
  final bool active;
  final bool upcoming;
  final bool isLast;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final nodeColor = completed
        ? AppColors.storeHeader
        : active
            ? AppColors.accent
            : Colors.transparent;
    final borderColor = upcoming ? AppColors.border : nodeColor;

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
                  color: completed || active ? Colors.white : AppColors.textMuted,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: AppColors.border),
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
                    '$km / $en',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: active ? AppColors.accent : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: active ? AppColors.textSecondary : AppColors.textMuted,
                      fontFamily: active ? 'monospace' : null,
                    ),
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

class _AddressCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            AppStrings.deliveryAddress,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
              letterSpacing: 0.8,
            ),
          ),
          SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.location_on_outlined, size: 18, color: AppColors.textMuted),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ផ្ទះលេខ ១២៣ ផ្លូវ ២៧១ សង្កាត់ទឹកល្អក់ ខណ្ឌទឹកល្អក់ ភ្នំពេញ',
                  style: TextStyle(color: AppColors.textSecondary, height: 1.45),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

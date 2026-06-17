import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../l10n/l10n_extension.dart';
import '../../providers/auth_provider.dart';
import '../../services/notification_service.dart';
import '../../theme/app_colors.dart';

Future<void> showNotificationsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => const _NotificationsSheetBody(),
  );
}

class _NotificationsSheetBody extends StatefulWidget {
  const _NotificationsSheetBody();

  @override
  State<_NotificationsSheetBody> createState() => _NotificationsSheetBodyState();
}

class _NotificationsSheetBodyState extends State<_NotificationsSheetBody> {
  List<StoreNotification> _items = [];
  int _unread = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    final service = NotificationService(context.read<ApiClient>());
    final result = await service.fetchNotifications(isLoggedIn: auth.isLoggedIn);
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _unread = result.unreadCount;
      _loading = false;
    });
  }

  Future<void> _markAllRead() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) return;
    await NotificationService(context.read<ApiClient>()).markAllRead();
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;
    final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;
    final border = theme.dividerTheme.color ?? theme.colorScheme.outline;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.menuNotifications,
                      style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: onSurface,
                          ),
                    ),
                  ),
                  if (_unread > 0)
                    TextButton(
                      onPressed: _markAllRead,
                      child: Text(l10n.markAllRead),
                    ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _items.isEmpty
                      ? Center(
                          child: Text(
                            l10n.notificationsEmpty,
                            style: TextStyle(color: onSurfaceVariant),
                          ),
                        )
                      : ListView.separated(
                          controller: scrollController,
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          itemCount: _items.length,
                          separatorBuilder: (_, __) => Divider(height: 1, color: border),
                          itemBuilder: (context, i) {
                            final n = _items[i];
                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(vertical: 6),
                              leading: CircleAvatar(
                                backgroundColor: n.isRead
                                    ? theme.colorScheme.surfaceContainerHighest
                                    : AppColors.storeHeader,
                                child: Icon(
                                  Icons.notifications_outlined,
                                  size: 20,
                                  color: n.isRead ? onSurfaceVariant : Colors.white,
                                ),
                              ),
                              title: Text(
                                n.title,
                                style: TextStyle(
                                  fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w700,
                                  color: onSurface,
                                ),
                              ),
                              subtitle: Text(
                                n.message,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: onSurfaceVariant),
                              ),
                              trailing: n.createdAt != null
                                  ? Text(
                                      DateFormat.MMMd().format(n.createdAt!),
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: onSurfaceVariant,
                                      ),
                                    )
                                  : null,
                            );
                          },
                        ),
            ),
          ],
        );
      },
    );
  }
}

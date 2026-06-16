import 'package:flutter/material.dart';

import '../../l10n/l10n_extension.dart';
import '../../models/address_model.dart';
import '../../theme/app_colors.dart';

class AddressFormSheet extends StatefulWidget {
  const AddressFormSheet({
    super.key,
    required this.initial,
    required this.isEditing,
  });

  final AddressDraft initial;
  final bool isEditing;

  static Future<AddressDraft?> show(
    BuildContext context, {
    AddressDraft? initial,
    bool isEditing = false,
  }) {
    return showModalBottomSheet<AddressDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      enableDrag: false,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: AddressFormSheet(
          initial: initial ?? AddressDraft(),
          isEditing: isEditing,
        ),
      ),
    );
  }

  @override
  State<AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends State<AddressFormSheet> {
  final _formKey = GlobalKey<FormState>();
  late AddressDraft _draft;

  @override
  void initState() {
    super.initState();
    _draft = AddressDraft(
      label: widget.initial.label,
      receiverName: widget.initial.receiverName,
      receiverPhone: widget.initial.receiverPhone,
      houseNo: widget.initial.houseNo,
      streetNo: widget.initial.streetNo,
      sangkat: widget.initial.sangkat,
      khan: widget.initial.khan,
      province: widget.initial.province,
      landmark: widget.initial.landmark,
      isDefault: widget.initial.isDefault,
    );
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(_draft);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;

    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.88,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
              child: Row(
                children: [
                  Text(
                    widget.isEditing ? l10n.editAddress : l10n.addAddress,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: onSurface,
                        ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close_rounded, color: onSurface),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    _field(l10n.addressLabel, _draft.label, (v) => _draft.label = v, required: true),
                    _field(l10n.receiverName, _draft.receiverName, (v) => _draft.receiverName = v),
                    _field(l10n.receiverPhone, _draft.receiverPhone, (v) => _draft.receiverPhone = v,
                        keyboard: TextInputType.phone),
                    _field(l10n.houseNo, _draft.houseNo, (v) => _draft.houseNo = v, required: true),
                    _field(l10n.streetNo, _draft.streetNo, (v) => _draft.streetNo = v, required: true),
                    _field(l10n.sangkat, _draft.sangkat, (v) => _draft.sangkat = v, required: true),
                    _field(l10n.khan, _draft.khan, (v) => _draft.khan = v, required: true),
                    _field(l10n.province, _draft.province, (v) => _draft.province = v, required: true),
                    _field(l10n.landmark, _draft.landmark, (v) => _draft.landmark = v),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _draft.isDefault,
                      activeTrackColor: AppColors.storeHeader.withValues(alpha: 0.45),
                      activeColor: AppColors.storeHeader,
                      title: Text(l10n.setDefaultAddress, style: TextStyle(color: onSurface)),
                      onChanged: (value) => setState(() => _draft.isDefault = value),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: FilledButton(
                onPressed: _save,
                child: Text(widget.isEditing ? l10n.saveChanges : l10n.addAddress),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    String label,
    String initial,
    ValueChanged<String> onChanged, {
    bool required = false,
    TextInputType keyboard = TextInputType.text,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        initialValue: initial,
        keyboardType: keyboard,
        decoration: InputDecoration(labelText: label),
        onChanged: onChanged,
        validator: required
            ? (v) => v == null || v.trim().isEmpty ? context.l10n.fieldRequired : null
            : null,
      ),
    );
  }
}

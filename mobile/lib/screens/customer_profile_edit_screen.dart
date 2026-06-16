import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../l10n/l10n_extension.dart';
import '../models/address_model.dart';
import '../models/user_model.dart';
import '../providers/auth_provider.dart';
import '../services/profile_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/product_image.dart';
import '../widgets/profile/address_form_sheet.dart';

class CustomerProfileEditScreen extends StatefulWidget {
  const CustomerProfileEditScreen({super.key, required this.user});

  final UserModel user;

  @override
  State<CustomerProfileEditScreen> createState() => _CustomerProfileEditScreenState();
}

class _CustomerProfileEditScreenState extends State<CustomerProfileEditScreen> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;

  List<AddressModel> _addresses = [];
  String? _profileImageUrl;
  bool _savingProfile = false;
  bool _uploadingPhoto = false;
  bool _loadingAddresses = true;
  String? _addressError;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.user.name);
    _email = TextEditingController(text: widget.user.email);
    _phone = TextEditingController(text: widget.user.phone ?? '');
    _profileImageUrl = widget.user.profileImageUrl;
    _loadAddresses();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  ProfileService get _service => ProfileService(context.read<ApiClient>());

  Future<void> _loadAddresses() async {
    setState(() {
      _loadingAddresses = true;
      _addressError = null;
    });
    try {
      final items = await _service.listAddresses();
      if (!mounted) return;
      setState(() {
        _addresses = items;
        _loadingAddresses = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _addressError = e.toString();
        _loadingAddresses = false;
      });
    }
  }

  Future<void> _pickPhoto() async {
    final l10n = context.l10n;
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(l10n.changePhoto),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Camera'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picked = await _picker.pickImage(source: source, maxWidth: 1200, imageQuality: 85);
    if (picked == null || !mounted) return;

    setState(() => _uploadingPhoto = true);
    try {
      final url = await _service.uploadProfileImage(File(picked.path));
      if (!mounted) return;
      setState(() => _profileImageUrl = url);
      context.read<AuthProvider>().updateUser(
            widget.user.copyWith(profileImageUrl: url),
          );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.profileUpdated)),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    setState(() => _savingProfile = true);
    try {
      final data = await _service.updateCustomerProfile(
        name: _name.text.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim(),
      );
      if (!mounted) return;
      final updated = UserModel.fromJson(data).copyWith(profileImageUrl: _profileImageUrl);
      context.read<AuthProvider>().updateUser(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.profileUpdated)),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _addAddress() async {
    final draft = await AddressFormSheet.show(context);
    if (draft == null || !mounted) return;
    try {
      await _service.addAddress(draft.toPayload());
      await _loadAddresses();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    }
  }

  Future<void> _editAddress(AddressModel address) async {
    final draft = await AddressFormSheet.show(
      context,
      initial: AddressDraft.fromModel(address),
      isEditing: true,
    );
    if (draft == null || !mounted) return;
    try {
      await _service.updateAddress(address.id, draft.toPayload());
      await _loadAddresses();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    }
  }

  Future<void> _deleteAddress(AddressModel address) async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.confirmDeleteAddress),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.cancel)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l10n.deleteAddress)),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await _service.deleteAddress(address.id);
      await _loadAddresses();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    }
  }

  Future<void> _setDefault(AddressModel address) async {
    if (address.isDefault) return;
    try {
      await _service.updateAddress(address.id, {
        ...AddressDraft.fromModel(address).toPayload(),
        'is_default': true,
      });
      await _loadAddresses();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    final resolved = resolveMediaUrl(_profileImageUrl);
    final initial = _name.text.isNotEmpty ? _name.text[0].toUpperCase() : '?';

    return Scaffold(
      body: Column(
        children: [
          InnerPageHeader(
            title: l10n.editProfile,
            leadingIcon: Icons.person_outline,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadAddresses,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  Center(
                    child: Stack(
                      children: [
                        CircleAvatar(
                          radius: 48,
                          backgroundColor: AppColors.storeHeader.withValues(alpha: 0.15),
                          child: _uploadingPhoto
                              ? const Padding(
                                  padding: EdgeInsets.all(24),
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : resolved.isNotEmpty
                                  ? ClipOval(
                                      child: SizedBox(
                                        width: 96,
                                        height: 96,
                                        child: ProductImage(imageUrl: resolved, fit: BoxFit.cover),
                                      ),
                                    )
                                  : Text(
                                      initial,
                                      style: TextStyle(
                                        fontSize: 32,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.storeHeader,
                                      ),
                                    ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Material(
                            color: AppColors.storeHeader,
                            shape: const CircleBorder(),
                            child: InkWell(
                              onTap: _uploadingPhoto ? null : _pickPhoto,
                              customBorder: const CircleBorder(),
                              child: const Padding(
                                padding: EdgeInsets.all(8),
                                child: Icon(Icons.camera_alt_outlined, color: Colors.white, size: 18),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: TextButton(onPressed: _uploadingPhoto ? null : _pickPhoto, child: Text(l10n.changePhoto)),
                  ),
                  const SizedBox(height: 8),
                  Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _name,
                          decoration: InputDecoration(labelText: l10n.fullName),
                          validator: (v) => v == null || v.trim().isEmpty ? l10n.fieldRequired : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(labelText: l10n.email),
                          validator: (v) => v == null || !v.contains('@') ? l10n.fieldRequired : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(labelText: l10n.phone),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  FsButton(
                    label: l10n.saveChanges,
                    onPressed: _savingProfile ? null : _saveProfile,
                    loading: _savingProfile,
                    icon: Icons.check_rounded,
                  ),
                  const SizedBox(height: 28),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          l10n.savedAddresses,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: onSurface,
                              ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: _addAddress,
                        icon: const Icon(Icons.add, size: 18),
                        label: Text(l10n.addAddress),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_loadingAddresses)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_addressError != null)
                    Text(_addressError!, style: TextStyle(color: onSurfaceVariant))
                  else if (_addresses.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        l10n.addressesEmpty,
                        style: TextStyle(color: onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                    )
                  else
                    ..._addresses.map((address) => _AddressCard(
                          address: address,
                          onEdit: () => _editAddress(address),
                          onDelete: () => _deleteAddress(address),
                          onSetDefault: () => _setDefault(address),
                        )),
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
  const _AddressCard({
    required this.address,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final AddressModel address;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onSetDefault;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  address.label,
                  style: TextStyle(fontWeight: FontWeight.w700, color: onSurface),
                ),
              ),
              if (address.isDefault)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.storeHeader.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    l10n.defaultAddress,
                    style: const TextStyle(
                      color: AppColors.storeHeader,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          if ((address.receiverName ?? '').isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(address.receiverName!, style: TextStyle(color: onSurface)),
          ],
          if ((address.receiverPhone ?? '').isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(address.receiverPhone!, style: TextStyle(color: onSurfaceVariant, fontSize: 13)),
          ],
          const SizedBox(height: 6),
          Text(address.displayLines, style: TextStyle(color: onSurfaceVariant, height: 1.4)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              if (!address.isDefault)
                TextButton(onPressed: onSetDefault, child: Text(l10n.setDefaultAddress)),
              TextButton(onPressed: onEdit, child: Text(l10n.editAddress)),
              TextButton(
                onPressed: onDelete,
                style: TextButton.styleFrom(foregroundColor: AppColors.error),
                child: Text(l10n.deleteAddress),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class UserModel {
  UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.role,
    this.status,
    this.address,
    this.profileImageUrl,
  });

  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? role;
  final String? status;
  final String? address;
  final String? profileImageUrl;

  bool get isSuperAdmin => role?.toLowerCase() == 'superadmin';
  bool get isAdmin => isSuperAdmin || role?.toLowerCase() == 'admin';
  bool get isDriver => role?.toLowerCase() == 'driver';
  bool get isCustomer => !isAdmin && !isDriver;

  String get roleLabel {
    final r = role?.trim();
    if (r == null || r.isEmpty) return 'Customer';
    return r[0].toUpperCase() + r.substring(1);
  }

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as int,
        name: (json['name'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        phone: json['phone']?.toString(),
        role: json['role']?.toString(),
        status: json['status']?.toString(),
        address: json['address']?.toString(),
        profileImageUrl: json['profile_image_url']?.toString(),
      );

  UserModel copyWith({
    String? name,
    String? email,
    String? phone,
    String? address,
    String? profileImageUrl,
  }) =>
      UserModel(
        id: id,
        name: name ?? this.name,
        email: email ?? this.email,
        phone: phone ?? this.phone,
        role: role,
        status: status,
        address: address ?? this.address,
        profileImageUrl: profileImageUrl ?? this.profileImageUrl,
      );
}

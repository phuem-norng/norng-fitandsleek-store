class BrandModel {
  BrandModel({
    required this.id,
    required this.name,
    this.slug,
    this.logoUrl,
  });

  final int id;
  final String name;
  final String? slug;
  final String? logoUrl;

  factory BrandModel.fromJson(Map<String, dynamic> json) => BrandModel(
        id: json['id'] as int,
        name: (json['name'] ?? '').toString(),
        slug: json['slug']?.toString(),
        logoUrl: json['logo_url']?.toString(),
      );
}

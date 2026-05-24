class CategoryModel {
  CategoryModel({
    required this.id,
    required this.name,
    this.slug,
    this.type,
    this.imageUrl,
  });

  final int id;
  final String name;
  final String? slug;
  final String? type;
  final String? imageUrl;

  factory CategoryModel.fromJson(Map<String, dynamic> json) => CategoryModel(
        id: json['id'] as int,
        name: (json['name'] ?? '').toString(),
        slug: json['slug']?.toString(),
        type: json['type']?.toString(),
        imageUrl: json['image_url']?.toString(),
      );
}

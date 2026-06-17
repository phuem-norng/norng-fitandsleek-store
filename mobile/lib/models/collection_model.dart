class CollectionModel {
  const CollectionModel({
    required this.id,
    required this.name,
    this.slug,
    this.gender,
    this.imageUrl,
    this.link,
  });

  final int id;
  final String name;
  final String? slug;
  final String? gender;
  final String? imageUrl;
  final String? link;

  factory CollectionModel.fromJson(Map<String, dynamic> json) => CollectionModel(
        id: json['id'] as int,
        name: (json['name'] ?? '').toString(),
        slug: json['slug']?.toString(),
        gender: json['gender']?.toString(),
        imageUrl: json['image_url']?.toString(),
        link: json['link']?.toString(),
      );

  String? get parentCategory {
    final g = gender?.trim();
    if (g != null && g.isNotEmpty) {
      return g[0].toUpperCase() + g.substring(1).toLowerCase();
    }
    final uri = Uri.tryParse(link ?? '');
    if (uri != null) {
      final parent = uri.queryParameters['parent_category'];
      if (parent != null && parent.isNotEmpty) return parent;
    }
    return null;
  }

  static List<CollectionModel> fallbackTiles() => const [
        CollectionModel(id: -1, name: 'WOMEN', gender: 'women'),
        CollectionModel(id: -2, name: 'MEN', gender: 'men'),
      ];
}

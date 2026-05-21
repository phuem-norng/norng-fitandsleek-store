class BannerModel {
  BannerModel({
    required this.id,
    this.title,
    this.subtitle,
    this.imageUrl,
    this.linkUrl,
    this.position,
  });

  final int id;
  final String? title;
  final String? subtitle;
  final String? imageUrl;
  final String? linkUrl;
  final String? position;

  factory BannerModel.fromJson(Map<String, dynamic> json) => BannerModel(
        id: json['id'] as int? ?? 0,
        title: json['title']?.toString(),
        subtitle: json['subtitle']?.toString(),
        imageUrl: json['image_url']?.toString(),
        linkUrl: json['link_url']?.toString(),
        position: json['position']?.toString(),
      );
}

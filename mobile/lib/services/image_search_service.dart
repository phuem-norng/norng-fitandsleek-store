import 'dart:io';

import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../models/product_model.dart';

class ImageSearchResult {
  ImageSearchResult({
    required this.products,
    required this.total,
    this.matchReason,
  });

  final List<ProductModel> products;
  final int total;
  final String? matchReason;
}

class ImageSearchService {
  ImageSearchService(this._api);

  final ApiClient _api;

  Future<ImageSearchResult> searchByImage(File image, {int limit = 12}) async {
    final form = FormData.fromMap({
      'image': await MultipartFile.fromFile(
        image.path,
        filename: 'search.jpg',
      ),
      'limit': limit,
    });

    final res = await _api.dio.post(
      '/image-search',
      data: form,
      options: Options(
        contentType: 'multipart/form-data',
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 120),
      ),
    );

    final data = Map<String, dynamic>.from(res.data as Map);
    final list = data['products'];
    final products = list is List
        ? list
            .whereType<Map>()
            .map((e) => ProductModel.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <ProductModel>[];

    return ImageSearchResult(
      products: products,
      total: data['total'] as int? ?? products.length,
      matchReason: data['match_reason']?.toString(),
    );
  }
}

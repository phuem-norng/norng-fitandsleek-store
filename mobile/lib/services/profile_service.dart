import 'dart:io';

import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../models/address_model.dart';

class ProfileService {
  ProfileService(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>> fetchCustomerProfile() async {
    final res = await _api.dio.get('/user/profile');
    if (res.data is Map) {
      return Map<String, dynamic>.from(res.data as Map);
    }
    return {};
  }

  Future<Map<String, dynamic>> updateCustomerProfile({
    required String name,
    required String email,
    String? phone,
  }) async {
    final res = await _api.dio.put('/user/profile', data: {
      'name': name,
      'email': email,
      if (phone != null) 'phone': phone,
    });
    final body = res.data as Map;
    final user = body['user'] as Map? ?? body;
    return Map<String, dynamic>.from(user);
  }

  Future<String> uploadProfileImage(File file) async {
    final form = FormData.fromMap({
      'profile_image': await MultipartFile.fromFile(
        file.path,
        filename: 'profile.jpg',
      ),
    });
    final res = await _api.dio.post(
      '/user/profile/image',
      data: form,
      options: Options(contentType: 'multipart/form-data'),
    );
    final data = res.data as Map;
    return (data['profile_image_url'] ?? '').toString();
  }

  Future<List<AddressModel>> listAddresses() async {
    final res = await _api.dio.get('/user/addresses');
    final data = res.data;
    final list = data is Map ? data['data'] : data;
    if (list is! List) return [];
    return list
        .whereType<Map>()
        .map((e) => AddressModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<AddressModel> addAddress(Map<String, dynamic> payload) async {
    final res = await _api.dio.post('/user/addresses', data: payload);
    final data = res.data as Map;
    final address = data['address'] as Map? ?? data;
    return AddressModel.fromJson(Map<String, dynamic>.from(address));
  }

  Future<AddressModel> updateAddress(int id, Map<String, dynamic> payload) async {
    final res = await _api.dio.put('/user/addresses/$id', data: payload);
    final data = res.data as Map;
    final address = data['address'] as Map? ?? data;
    return AddressModel.fromJson(Map<String, dynamic>.from(address));
  }

  Future<void> deleteAddress(int id) async {
    await _api.dio.delete('/user/addresses/$id');
  }
}

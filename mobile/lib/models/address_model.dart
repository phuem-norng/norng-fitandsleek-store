class AddressModel {
  AddressModel({
    required this.id,
    required this.label,
    this.receiverName,
    this.receiverPhone,
    this.houseNo,
    this.streetNo,
    this.sangkat,
    this.khan,
    this.province,
    this.landmark,
    this.formattedAddress,
    this.isDefault = false,
  });

  final int id;
  final String label;
  final String? receiverName;
  final String? receiverPhone;
  final String? houseNo;
  final String? streetNo;
  final String? sangkat;
  final String? khan;
  final String? province;
  final String? landmark;
  final String? formattedAddress;
  final bool isDefault;

  factory AddressModel.fromJson(Map<String, dynamic> json) => AddressModel(
        id: json['id'] as int,
        label: (json['label'] ?? 'Home').toString(),
        receiverName: json['receiver_name']?.toString(),
        receiverPhone: json['receiver_phone']?.toString(),
        houseNo: json['house_no']?.toString(),
        streetNo: json['street_no']?.toString(),
        sangkat: json['sangkat']?.toString(),
        khan: json['khan']?.toString(),
        province: json['province']?.toString(),
        landmark: json['landmark']?.toString(),
        formattedAddress: json['formatted_address']?.toString(),
        isDefault: json['is_default'] == true,
      );

  Map<String, dynamic> toPayload() => {
        'label': label,
        if (receiverName != null && receiverName!.isNotEmpty) 'receiver_name': receiverName,
        if (receiverPhone != null && receiverPhone!.isNotEmpty) 'receiver_phone': receiverPhone,
        'house_no': houseNo ?? '',
        'street_no': streetNo ?? '',
        'sangkat': sangkat ?? '',
        'khan': khan ?? '',
        'province': province ?? '',
        if (landmark != null && landmark!.isNotEmpty) 'landmark': landmark,
        'is_default': isDefault,
      };

  AddressModel copyWith({
    String? label,
    String? receiverName,
    String? receiverPhone,
    String? houseNo,
    String? streetNo,
    String? sangkat,
    String? khan,
    String? province,
    String? landmark,
    bool? isDefault,
  }) =>
      AddressModel(
        id: id,
        label: label ?? this.label,
        receiverName: receiverName ?? this.receiverName,
        receiverPhone: receiverPhone ?? this.receiverPhone,
        houseNo: houseNo ?? this.houseNo,
        streetNo: streetNo ?? this.streetNo,
        sangkat: sangkat ?? this.sangkat,
        khan: khan ?? this.khan,
        province: province ?? this.province,
        landmark: landmark ?? this.landmark,
        formattedAddress: formattedAddress,
        isDefault: isDefault ?? this.isDefault,
      );

  String get displayLines {
    if ((formattedAddress ?? '').trim().isNotEmpty) return formattedAddress!.trim();
    final parts = <String>[
      if ((houseNo ?? '').isNotEmpty) 'House $houseNo',
      if ((streetNo ?? '').isNotEmpty) 'St. $streetNo',
      if ((sangkat ?? '').isNotEmpty) sangkat!,
      if ((khan ?? '').isNotEmpty) khan!,
      if ((province ?? '').isNotEmpty) province!,
    ];
    return parts.join(', ');
  }
}

class AddressDraft {
  AddressDraft({
    this.label = 'Home',
    this.receiverName = '',
    this.receiverPhone = '',
    this.houseNo = '',
    this.streetNo = '',
    this.sangkat = '',
    this.khan = '',
    this.province = '',
    this.landmark = '',
    this.isDefault = false,
  });

  String label;
  String receiverName;
  String receiverPhone;
  String houseNo;
  String streetNo;
  String sangkat;
  String khan;
  String province;
  String landmark;
  bool isDefault;

  factory AddressDraft.fromModel(AddressModel model) => AddressDraft(
        label: model.label,
        receiverName: model.receiverName ?? '',
        receiverPhone: model.receiverPhone ?? '',
        houseNo: model.houseNo ?? '',
        streetNo: model.streetNo ?? '',
        sangkat: model.sangkat ?? '',
        khan: model.khan ?? '',
        province: model.province ?? '',
        landmark: model.landmark ?? '',
        isDefault: model.isDefault,
      );

  Map<String, dynamic> toPayload() => {
        'label': label.trim(),
        if (receiverName.trim().isNotEmpty) 'receiver_name': receiverName.trim(),
        if (receiverPhone.trim().isNotEmpty) 'receiver_phone': receiverPhone.trim(),
        'house_no': houseNo.trim(),
        'street_no': streetNo.trim(),
        'sangkat': sangkat.trim(),
        'khan': khan.trim(),
        'province': province.trim(),
        if (landmark.trim().isNotEmpty) 'landmark': landmark.trim(),
        'is_default': isDefault,
      };
}

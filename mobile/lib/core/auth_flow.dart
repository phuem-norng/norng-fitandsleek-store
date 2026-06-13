bool authRequiresOtpStep(Map<String, dynamic> data) {
  return data['otp_required'] == true ||
      data['verification_required'] == true ||
      data['step'] == 'otp';
}

Map<String, dynamic>? authOtpPayloadFromResponse(dynamic data) {
  if (data is! Map) return null;
  final map = Map<String, dynamic>.from(data);
  return authRequiresOtpStep(map) ? map : null;
}

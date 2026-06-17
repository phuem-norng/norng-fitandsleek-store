Map<String, dynamic>? resolveLocaleMap(dynamic payload, String language) {
  if (payload is! Map) return null;

  final locales = payload['locales'];
  if (locales is Map) {
    final preferred = locales[language];
    if (preferred is Map) return Map<String, dynamic>.from(preferred);
    final fallback = locales['en'];
    if (fallback is Map) return Map<String, dynamic>.from(fallback);
  }

  return Map<String, dynamic>.from(payload);
}

List<String> readStringList(dynamic raw) {
  if (raw is! List) return const [];
  return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
}

String readString(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  final text = value.toString().trim();
  return text.isEmpty ? fallback : text;
}

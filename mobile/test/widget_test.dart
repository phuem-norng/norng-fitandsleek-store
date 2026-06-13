import 'package:flutter_test/flutter_test.dart';
import 'package:fitandsleek_mobile/config/app_config.dart';

void main() {
  test('default API base URL includes /api', () {
    expect(AppConfig.apiBaseUrl.endsWith('/api'), isTrue);
  });
}

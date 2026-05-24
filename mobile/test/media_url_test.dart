import 'package:flutter_test/flutter_test.dart';
import 'package:fitandsleek_mobile/utils/media_url.dart';

void main() {
  test('data URI is returned unchanged', () {
    const data = 'data:image/jpeg;base64,/9j/4AAQ';
    expect(resolveMediaUrl(data), data);
    expect(isDataUri(data), isTrue);
  });

  test('storage path is prefixed with backend origin', () {
    expect(
      resolveMediaUrl('/storage/products/x.jpg'),
      contains('/storage/products/x.jpg'),
    );
  });
}

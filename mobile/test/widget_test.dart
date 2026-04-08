import 'package:flutter_test/flutter_test.dart';
import 'package:hono_health_mobile/main.dart';

void main() {
  testWidgets('App builds and shows auth screen', (tester) async {
    await tester.pumpWidget(const HonoHealthApp());
    expect(find.text('セッションを確認しています'), findsOneWidget);
  });
}

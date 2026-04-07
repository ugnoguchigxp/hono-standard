import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hono_health_mobile/main.dart';
import 'package:hono_health_mobile/src/app/app_router.dart';
import 'package:hono_health_mobile/src/core/api/mock_interceptor.dart';

void main() {
  testWidgets('App builds', (tester) async {
    final dio = Dio(
      BaseOptions(baseUrl: 'http://127.0.0.1:19090'),
    )..interceptors.add(mockInterceptor);
    await tester.pumpWidget(HonoHealthApp(router: buildAppRouter(homeDio: dio)));
    await tester.pumpAndSettle();
    expect(find.text('ホーム'), findsOneWidget);
  });
}

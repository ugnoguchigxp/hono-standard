import 'package:fquery_core/fquery_core.dart';

const healthQueryRoot = ['health'];
const authQueryRoot = ['auth'];

List<String> authMethodsQueryKey() => const ['auth', 'methods'];

List<String> healthDashboardQueryKey() => const ['health', 'dashboard'];

List<String> healthInsightsQueryKey() => const ['health', 'insights'];

List<String> healthTimelineQueryKey(String from, String to) =>
    ['health', 'timeline', from, to];

List<String> healthDetailQueryKey(String kind, String from, String to) =>
    ['health', 'detail', kind, from, to];

QueryKey authMethodsQuery() => QueryKey(authMethodsQueryKey());
QueryKey healthDashboardQuery() => QueryKey(healthDashboardQueryKey());
QueryKey healthInsightsQuery() => QueryKey(healthInsightsQueryKey());
QueryKey healthTimelineQuery(String from, String to) =>
    QueryKey(healthTimelineQueryKey(from, to));
QueryKey healthDetailQuery(String kind, String from, String to) =>
    QueryKey(healthDetailQueryKey(kind, from, to));

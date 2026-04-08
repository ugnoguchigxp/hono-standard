import 'package:flutter/widgets.dart';
import 'package:fquery/fquery.dart';
import 'package:fquery_core/fquery_core.dart';

import 'health_query_keys.dart';

final QueryCache appQueryCache = QueryCache();

void clearAppQueryCache() {
  appQueryCache.removeQueries([], exact: false);
}

void invalidateHealthQueries(BuildContext context) {
  CacheProvider.get(context).invalidateQueries(healthQueryRoot);
}

void invalidateAuthQueries(BuildContext context) {
  CacheProvider.get(context).invalidateQueries(authQueryRoot);
}

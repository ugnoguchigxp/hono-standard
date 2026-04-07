# hono_health_mobile

Phase 1 の Flutter 雛形です。

## 開発

`Unable to locate the Dart VM executable` が出る場合は、Homebrew の Flutter が古い／不整合なことが多いです。`brew reinstall --cask flutter` で再インストールしてください（検疫フラグのため初回は `xattr -dr com.apple.quarantine /opt/homebrew/share/flutter` が必要な場合もあります）。

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:5173
```

Android エミュレータからホストの API:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5173
```

## モック

組み込みインターセプター（`USE_MOCK=true`）:

```bash
flutter run --dart-define=USE_MOCK=true
```

または別ターミナルで HTTP モック:

```bash
dart run tool/mock_server.dart
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:19090
```

## 構成

- `lib/src/app` — テーマ・ルーティング
- `lib/src/core` —環境変数・Dio
- `lib/src/features` — 画面
- `assets/locales/` — 文言 JSON（初期形のみ）

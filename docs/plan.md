# ヘルスレコードモバイルアプリ プラン

## 1. 目的

このプロジェクトは、生活習慣病の予防と日々の自己管理を支えるためのヘルスレコードアプリを作る。
既存テンプレートの Hono API と React Web は活かしつつ、同一 monorepo に Flutter モバイルアプリを追加する。

初期スコープは次の 4 つに絞る。

- 運動情報の取得と閲覧
- 血圧の記録
- 血糖値の記録
- 食事の品目と概算カロリーの記録

病院・医療機関向け連携は v1 では扱わない。
React Web は「入力より閲覧」を重視し、Flutter を主入力クライアントとする。

### 1.1 想定規模

- 初期ユーザー数: 1,000 人以内
- 1 ユーザーあたりの日次レコード数: 平均 10 件（血圧 2、血糖 3、食事 3、運動 2）
- 年間レコード数: 約 365 万件（1,000 人 × 10 件 × 365 日）
- データ保持期間: 無期限（ユーザー削除時を除く）

## 2. 設計方針

- データの正はバックエンドに置く
- Flutter と Web は同じバックエンド契約を参照する
- 健康データは手入力と端末同期を同じモデルで扱う
- 取得元が違っても、ユーザーが見る指標は同じ名前・単位で揃える
- 個人情報と健康情報はログに出さない
- 失敗しやすい前提を正常系として扱う
  - 権限拒否
  - オフライン
  - 重複同期
  - 端末変更
  - 取得元差異

### 2.1 セキュリティ方針

- 通信は全て HTTPS を必須とする
- 認証は既存の JWT ベース認証を流用する
- アクセストークンの有効期限は 1 時間、リフレッシュトークンは 30 日とする
- Flutter 側のトークン保存は `flutter_secure_storage` を使用する
- API は Bearer トークンによる認可を必須とし、他ユーザーのデータへのアクセスを禁止する
- 健康データは個人情報として扱い、ログ出力・エラーレスポンスに含めない
- 証明書ピンニングは v1 では実施しない（将来検討）

### 2.2 データ保護方針

- ユーザーは自身のデータのみ閲覧・編集・削除できる
- 論理削除を基本とし、削除フラグと削除日時を記録する
- アカウント削除時は関連する全ての健康データを物理削除する
- データエクスポート機能は Phase 4 以降で検討する
- バックアップは日次で取得し、30 日間保持する

## 3. モノレポ構成

既存 repo は以下の 3 層を持つ。

- `api/` - Hono ベースのバックエンド
- `src/` - React Web
- `shared/` - フロント・バック共通のスキーマ

これに加えて Flutter を新設する。

- `mobile/` - Flutter アプリ

Flutter 側の初期構成は、参照先テンプレートの考え方に寄せる。
特に、`lib/src/app`, `lib/src/core`, `lib/src/features` に分ける feature-first 構成、`mockServer/` によるローカルモック、`integration_test/` による統合テスト、`assets/locales/` による多言語資産、各プラットフォーム用ディレクトリの保持を前提にする。

将来的には必要に応じて共通型や共通定数を `shared/` か `packages/` に切り出す。
ただし最初から過剰に分割せず、まずは health ドメインの共有スキーマを優先する。

## 4. Flutter の採用方針

Flutter 側は、iOS と Android の両対応を前提にする。
参照テンプレートと同じく、`flutter_hooks` と `hooks_riverpod` を組み合わせた構成を基本にする。
健康データ連携は `health` パッケージを追加する。
ただし現在の `health` は Apple HealthKit と Google Health Connect を対象としており、Google Fit 直結ではないため、Android は Health Connect を正式ターゲットとする。

### 4.0 対応プラットフォーム

- iOS: 15.0 以上
- Android: API Level 26 (Android 8.0) 以上
- Health Connect は Android 14 以上で標準搭載、それ以前は Play Store からインストールが必要

採用ライブラリの基本方針は次のとおり。

- 健康データ連携: `health`
- Hooks: `flutter_hooks`
- 状態管理: `hooks_riverpod` / `flutter_riverpod`
- 画面遷移: `go_router`
- API 通信: `dio`
- リトライ: `dio_smart_retry`
- 画面データ: `freezed` / `json_serializable`
- ローカライズ: `intl` / `assets/locales`
- リスト・表: `data_table_2`
- ログ: `logger`
- グラフ: `graphic`
- セキュアストレージ: `flutter_secure_storage`
- 生体認証: `local_auth`
- ローカル DB: `sqflite` / `drift`
- バックグラウンド処理: `workmanager` (Android) / BGTaskScheduler 経由 (iOS)
- 通知: `flutter_local_notifications`

Google Fit を直接叩く方針は採用しない。
Android 側は Health Connect を正規ルートとして設計し、Google Fit 由来のデータは Health Connect 経由で扱える範囲に限定する。

### 4.1 Flutter のディレクトリ方針

`mobile/` 配下は次の構成にする。

- `lib/main.dart`
- `lib/bootstrap.dart`
- `lib/src/app/` - アプリ全体設定、ルーティング、テーマ
- `lib/src/core/` - API、認証、設定、共通ユーティリティ
- `lib/src/features/` - 機能単位の画面と状態管理
- `assets/locales/` - ローカライズ資産
- `mockServer/` - Flutter 単独起動時の API モック
- `integration_test/` - 端末レベルの統合テスト
- `scripts/` - ローカル開発補助

`mobile/` は `--dart-define=API_BASE_URL=...` で API を切り替えられるようにする。
開発時は実サーバー、統合テスト時はモックサーバー、配布検証時は本番 URL を指す。

## 5. バックエンド方針

既存の認証基盤は流用し、健康データ用の新しいドメインを追加する。
既存の `/api/health` は死活監視として残し、健康記録 API とは分離する。

### 5.1 ドメイン分割

- `api/modules/health/activity`
- `api/modules/health/vitals`
- `api/modules/health/nutrition`
- `api/modules/health/summary`
- `api/modules/health/sync`

### 5.2 主要 API

- `POST /api/health/activity/sync`
- `GET /api/health/activity/daily?date=YYYY-MM-DD`
- `POST /api/health/vitals/blood-pressure`
- `GET /api/health/vitals/blood-pressure?from=&to=`
- `POST /api/health/vitals/blood-glucose`
- `GET /api/health/vitals/blood-glucose?from=&to=`
- `POST /api/health/nutrition/meals`
- `GET /api/health/nutrition/meals?from=&to=`
- `GET /api/health/summary/daily?date=YYYY-MM-DD`
- `GET /api/health/summary/weekly?from=&to=`

### 5.3 共通スキーマ

`shared/schemas/health.schema.ts` を新設し、以下を共通化する。

- 記録日時
- 記録種別
- 値
- 単位
- 入力元
- 同期元
- メモ
- 外部 ID

Web と Flutter の入力形式を揃えるため、入力検証は必ず共通スキーマで行う。

### 5.4 DB 方針

記録はドメインごとにテーブルを分ける。

- `activity_records`
- `blood_pressure_records`
- `blood_glucose_records`
- `meal_records`
- `daily_health_summaries`
- `health_sync_states`

重複同期対策として、次のいずれかで一意性を担保する。

- 端末側の外部 ID がある場合は `user_id + source + external_id`
- 外部 ID がない場合は `user_id + record_type + recorded_at + value_hash`

加えて、検索と集計のために `user_id` と `recorded_at` に索引を付ける。

## 6. Flutter アプリ方針

Flutter は入力の中心であり、日々の記録負荷を下げる UI に集中する。

### 6.1 画面構成

- ログイン
- 今日のサマリ
- 運動
- 血圧
- 血糖値
- 食事
- 履歴一覧
- 設定

### 6.2 画面ごとの役割

- 今日のサマリ
  - 今日の歩数
  - 最後の血圧
  - 最後の血糖値
  - 今日の食事件数
  - 目標との差分
- 運動
  - HealthKit / Health Connect の同期
  - 歩数、活動時間、消費カロリーの閲覧
  - 同期できない場合の手動確認
- 血圧
  - 最高血圧、最低血圧、脈拍、測定時刻を入力
  - 朝・夜の区分を持つ
- 血糖値
  - 数値、単位、測定時刻、条件を入力
  - 空腹時・食後・任意の区分を持つ
- 食事
  - 品目、簡易メモ、概算カロリーを入力
  - 頻出メニューを再入力しやすくする

### 6.3 Flutter の挙動

- 端末連携の権限が取れない場合は手入力だけ使えるようにする
- オフライン時はローカルに保存し、オンライン復帰時に再送する
- 送信前に単位を正規化する
- 取得失敗や権限拒否は画面の通常ステータスとして扱う

### 6.4 同期方針

- 端末健康データの同期タイミング
  - アプリ起動時に自動同期
  - 運動画面を開いた時に手動同期ボタンを提供
  - バックグラウンド同期は v1 では実装しない（Phase 4 で検討）
- 同期範囲は過去 7 日間を基本とし、初回のみ過去 30 日間を取得する
- 同期中はプログレス表示し、完了・失敗を明示する
- 同期失敗時は次回起動時に自動リトライする

### 6.5 オフライン対応

- 未送信レコードはローカル DB に保存する
- 送信ステータス（pending / synced / failed）を持つ
- オンライン復帰時に pending レコードを順次送信する
- 3 回連続失敗したレコードは failed として手動確認を促す
- ローカル DB の保持期間は 30 日間とし、synced 済みの古いレコードは削除する

## 7. React Web 方針

Web は同じ健康情報を閲覧するためのクライアントとして残す。
入力機能は持たせてもよいが、初期の主目的は閲覧に置く。

### 7.1 Web の役割

- 日次サマリの閲覧
- 週次・月次の推移確認
- 詳細履歴の一覧表示
- 端末同期結果の確認
- 手入力データの軽微な修正

### 7.2 Web の位置づけ

- 計測端末を持たないユーザーでも使える
- Flutter で記録した内容をブラウザで確認できる
- 画面構成はシンプルにし、モバイルと同じ意味の指標を表示する

## 8. 集計と表示ルール

全クライアントで数字の意味を揃えるため、表示ルールを固定する。

- 歩数: `steps`
- 血圧: `mmHg`
- 血糖値: `mg/dL` を基本とし、必要なら `mmol/L` を変換表示する
- 食事: `kcal`
- 日付基準はユーザーのローカルタイムゾーン

日次集計は 0:00 から 23:59:59 の範囲で揃える。
歩数や活動量などの端末データは、取得元のサンプル時刻を保持したまま日次に集約する。

## 9. API バージョニング

- API パスにバージョンを含める: `/api/v1/health/...`
- 破壊的変更時は新バージョンを追加し、旧バージョンは 6 ヶ月間並行稼働する
- 非推奨 API は `Deprecation` ヘッダーで通知する
- クライアントは `X-API-Version` ヘッダーで利用バージョンを明示する

## 10. 運用・監視方針

### 10.1 監視項目

- API レスポンスタイム（P50, P95, P99）
- エラーレート（4xx, 5xx）
- 同期 API の成功率
- DB 接続数とクエリ時間
- ストレージ使用量

### 10.2 アラート条件

- エラーレートが 5% を超えた場合
- P95 レスポンスタイムが 3 秒を超えた場合
- DB 接続プールが 80% を超えた場合

### 10.3 障害対応

- 障害発生時はまずサービス継続を優先する
- データ不整合が発生した場合は該当機能を一時停止し、調査後に復旧する
- ロールバックが必要な場合は直前のマイグレーションを巻き戻す手順を用意する

## 11. 開発フェーズ

### Phase 1: 基盤整備

- health ドメインの共通スキーマを追加する
- 記録テーブルを追加する
- 記録作成・閲覧 API を整備する（`/api/v1/health/...`）
- React Web で日次サマリと履歴一覧を見られるようにする
- Flutter のプロジェクト雛形を `mobile/` に追加する

### Phase 2: Flutter 入力

- Flutter でログインと API 接続を実装する
- 血圧・血糖・食事の手入力を実装する
- `health` パッケージで端末健康データの読み取りを実装する
- 権限拒否、未対応端末、同期失敗の表示を実装する
- 同期キューとローカルキャッシュを実装する
- `mockServer/` を使って Flutter 単体で画面開発できるようにする

### Phase 3: Web 閲覧の強化

- 週次・月次グラフを追加する
- 今日のサマリを見やすくする
- 編集しやすい履歴画面を整える
- モバイルと同じ集計値を表示することを確認する

### Phase 4: 予防ケア機能

- 目標設定
- 傾向アラート
- 週次レポート
- 習慣化のための軽いリマインド
- プッシュ通知基盤の整備（FCM / APNs）
- バックグラウンド同期の実装
- データエクスポート機能（JSON / CSV）

## 12. テスト方針

### API

- 血圧、血糖、食事、運動の CRUD
- 集計結果の正しさ
- 重複同期の排除
- 権限不足時の拒否
- ユーザー間のデータ分離

### Flutter

- 権限許可 / 拒否
- HealthKit / Health Connect の分岐
- オフライン入力
- 再送成功
- 単位変換
- 表示崩れのない基本画面

### Web

- 日次サマリ
- 履歴一覧
- 推移表示
- モバイルとの表示値一致

### 非機能

- 個人情報をログに残さない
- 失敗時にデータを壊さない
- 同じ入力が二重登録されない

## 13. 非対象

次の項目は v1 ではやらない。

- 病院連携
- 医療者向け管理画面
- 厳密な栄養成分解析
- 医療機器との直接連携
- Google Fit 直結実装

## 14. 完了条件

最初のマイルストーンは次を満たした時点とする。

- Flutter から記録が送れる
- Web で同じ記録が見える
- 血圧、血糖、食事、運動が同じユーザー時系列で扱える
- 日次サマリが自動で出る
- 権限拒否やオフラインでもアプリが破綻しない
- 個人情報がログに出ない

## 15. マイグレーション戦略

### 15.1 DB マイグレーション

- Drizzle のマイグレーション機能を使用する
- 各マイグレーションファイルは up / down の両方を定義する
- 本番適用前にステージング環境で検証する
- 大量データの変更を伴う場合はメンテナンスウィンドウを設ける

### 15.2 ロールバック手順

1. 問題のあるデプロイを特定する
2. 直前のコミットに戻す（`git revert` または再デプロイ）
3. DB マイグレーションが含まれる場合は down マイグレーションを実行する
4. 影響範囲を確認し、必要に応じてユーザーに通知する

## 16. 用語集

| 用語 | 説明 |
|------|------|
| HealthKit | Apple の健康データフレームワーク |
| Health Connect | Google の健康データプラットフォーム（旧 Google Fit の後継） |
| 同期元 (source) | データの取得元を示す識別子（manual / healthkit / health_connect） |
| 外部 ID (external_id) | 端末側で付与された一意識別子。重複同期の排除に使用 |
| 日次サマリ | 1 日分の健康指標を集約した表示 |

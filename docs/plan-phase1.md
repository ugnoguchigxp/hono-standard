# Phase 1: 基盤整備 実装計画

## 概要

健康記録システムの基盤を構築するフェーズ。
バックエンド API、DB スキーマ、共通型定義、React Web の基本閲覧機能、Flutter プロジェクトの雛形を整備する。

## 期間

4 週間（目安）

## 成果物

- 健康記録用の DB テーブル
- 健康記録 API（CRUD）
- 共通スキーマ定義
- React Web の日次サマリ・履歴一覧画面
- Flutter プロジェクト雛形

---

## Week 1: DB スキーマと共通型

### 目標

- 健康記録用テーブルの設計と作成
- 共通スキーマの定義

### タスク

| # | タスク | 詳細 | 担当 | 見積 |
|---|--------|------|------|------|
| 1.1 | 共通スキーマ作成 | `shared/schemas/health.schema.ts` を新設。記録日時、記録種別、値、単位、入力元、同期元、メモ、外部 ID を定義 | Backend | 4h |
| 1.2 | activity_records テーブル | 歩数、活動時間、消費カロリーを記録 | Backend | 2h |
| 1.3 | blood_pressure_records テーブル | 最高血圧、最低血圧、脈拍、朝夜区分を記録 | Backend | 2h |
| 1.4 | blood_glucose_records テーブル | 血糖値、単位、空腹時/食後/任意の区分を記録 | Backend | 2h |
| 1.5 | meal_records テーブル | 品目、メモ、概算カロリーを記録 | Backend | 2h |
| 1.6 | daily_health_summaries テーブル | 日次集計データを保持 | Backend | 2h |
| 1.7 | health_sync_states テーブル | 同期状態を管理 | Backend | 2h |
| 1.8 | マイグレーション作成 | Drizzle マイグレーションファイルを生成・検証 | Backend | 2h |
| 1.9 | インデックス設計 | `user_id + recorded_at` の複合インデックスを追加 | Backend | 1h |

### 完了条件

- [ ] 全テーブルがマイグレーションで作成できる
- [ ] 共通スキーマが TypeScript で型安全に使える
- [ ] ローカル環境で DB が起動し、テーブルが確認できる

---

## Week 2: バックエンド API

### 目標

- 健康記録の CRUD API を実装
- 認証・認可の適用

### タスク

| # | タスク | 詳細 | 担当 | 見積 |
|---|--------|------|------|------|
| 2.1 | API ルーティング設計 | `api/modules/health/` 配下にドメイン別モジュールを作成 | Backend | 2h |
| 2.2 | 血圧 API | `POST /api/v1/health/vitals/blood-pressure`, `GET /api/v1/health/vitals/blood-pressure` | Backend | 4h |
| 2.3 | 血糖値 API | `POST /api/v1/health/vitals/blood-glucose`, `GET /api/v1/health/vitals/blood-glucose` | Backend | 4h |
| 2.4 | 食事 API | `POST /api/v1/health/nutrition/meals`, `GET /api/v1/health/nutrition/meals` | Backend | 4h |
| 2.5 | 運動同期 API | `POST /api/v1/health/activity/sync`, `GET /api/v1/health/activity/daily` | Backend | 4h |
| 2.6 | 日次サマリ API | `GET /api/v1/health/summary/daily` | Backend | 3h |
| 2.7 | 週次サマリ API | `GET /api/v1/health/summary/weekly` | Backend | 3h |
| 2.8 | 認可ミドルウェア | 自分のデータのみアクセス可能にする | Backend | 2h |
| 2.9 | 入力検証 | 共通スキーマを使ったバリデーション | Backend | 2h |
| 2.10 | 重複排除ロジック | 外部 ID または value_hash による重複チェック | Backend | 3h |

### 完了条件

- [ ] 全 API が Swagger / OpenAPI で確認できる
- [ ] 認証なしでアクセスすると 401 が返る
- [ ] 他ユーザーのデータにアクセスすると 403 が返る
- [ ] 重複データが登録されない

---

## Week 3: API テストと React Web 基本画面

### 目標

- API の自動テストを整備
- React Web で日次サマリと履歴一覧を表示

### タスク

| # | タスク | 詳細 | 担当 | 見積 |
|---|--------|------|------|------|
| 3.1 | 血圧 API テスト | CRUD、バリデーション、認可のテスト | Backend | 3h |
| 3.2 | 血糖値 API テスト | CRUD、バリデーション、認可のテスト | Backend | 3h |
| 3.3 | 食事 API テスト | CRUD、バリデーション、認可のテスト | Backend | 3h |
| 3.4 | 運動 API テスト | 同期、重複排除、日次取得のテスト | Backend | 3h |
| 3.5 | サマリ API テスト | 集計結果の正確性テスト | Backend | 2h |
| 3.6 | 日次サマリ画面 | 今日の歩数、最新血圧、最新血糖、食事件数を表示 | Frontend | 6h |
| 3.7 | 履歴一覧画面 | 血圧、血糖、食事、運動を日付順に一覧表示 | Frontend | 6h |
| 3.8 | API クライアント生成 | OpenAPI から TypeScript クライアントを生成 | Frontend | 2h |

### 完了条件

- [ ] API テストが CI で自動実行される
- [ ] React Web で日次サマリが表示される
- [ ] React Web で履歴一覧が表示される

---

## Week 4: Flutter プロジェクト雛形

### 目標

- Flutter プロジェクトを `mobile/` に作成
- 基本構成とローカル開発環境を整備

### タスク

| # | タスク | 詳細 | 担当 | 見積 |
|---|--------|------|------|------|
| 4.1 | プロジェクト作成 | `flutter create` で `mobile/` を作成 | Mobile | 1h |
| 4.2 | ディレクトリ構成 | `lib/src/app`, `lib/src/core`, `lib/src/features` を作成 | Mobile | 2h |
| 4.3 | 依存パッケージ追加 | `pubspec.yaml` に必要パッケージを追加 | Mobile | 2h |
| 4.4 | 環境変数設定 | `--dart-define=API_BASE_URL` の仕組みを整備 | Mobile | 2h |
| 4.5 | テーマ設定 | アプリ全体のテーマとカラー定義 | Mobile | 3h |
| 4.6 | ルーティング設定 | `go_router` で画面遷移を定義 | Mobile | 3h |
| 4.7 | API クライアント雛形 | `dio` を使った API クライアントの基盤 | Mobile | 4h |
| 4.8 | mockServer 設定 | Flutter 単独開発用のモックサーバー | Mobile | 4h |
| 4.9 | ローカライズ設定 | `assets/locales/` の初期構成 | Mobile | 2h |
| 4.10 | CI 設定 | Flutter のビルド・テストを CI に追加 | Mobile | 3h |

### 完了条件

- [ ] `flutter run` でアプリが起動する
- [ ] mockServer でダミーデータが取得できる
- [ ] CI で Flutter のビルドが通る

---

## リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| DB 設計の手戻り | 全体遅延 | Week 1 で関係者レビューを実施 |
| API 仕様の認識齟齬 | 実装やり直し | OpenAPI を先に定義してレビュー |
| Flutter 環境構築の問題 | 開発遅延 | 早期に環境を検証、ドキュメント化 |

---

## 依存関係

```
Week 1 (DB/Schema)
    ↓
Week 2 (API)
    ↓
Week 3 (API Test + Web)
    ↓
Week 4 (Flutter)
```

Week 4 は Week 2 完了後に並行開始可能。

---

## 次フェーズへの引き継ぎ

Phase 2 開始前に以下を確認する:

- [ ] 全 API が本番相当の環境で動作する
- [ ] React Web で基本的なデータ確認ができる
- [ ] Flutter プロジェクトが API に接続できる状態にある
- [ ] 開発者向けドキュメントが整備されている

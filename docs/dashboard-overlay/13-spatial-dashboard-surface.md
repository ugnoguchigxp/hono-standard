# Spatial 第2弾: Dashboard Surface とライブ状態表示 実装計画

## 1. この計画の役割

[全体コンセプト](./11-spatial-observability-concept.md)と[第1弾 Mock Signal Server](./12-spatial-mock-signal-server.md)を受け、`/dashboard` に Grid / Spatial の表示境界を作る。Spatial 側は Mock の Snapshot と SSE を読み、状態を HTML で確認できるところまで完成させる。Three.js Scene は次の独立した計画で追加する。この段階で画面と通信の骨格を実際に使える状態にし、Canvas に状態管理の責務を持ち込まない。

実装開始前に第1弾の共有 schema、API、進捗台帳を確認し、未コミットの既存変更を保持する。現在の `/dashboard` の描画、検索パラメータ、認証、Gallery、既存 E2E の基準値を採取する。

### 完了した利用体験

1. 認証済み利用者が `/dashboard` で Grid と Spatial を切り替え、再読み込みと戻る・進むでも選択が保たれる。
2. Grid は従来どおり動き、Spatial 表示中は Grid の panel query、layout 編集、Inspector を起動しない。
3. Spatial は Snapshot から Entity、Boundary、Task、Pipeline の状態を HTML で表示し、SSE による変化を反映する。
4. 接続が途切れた場合は古い状態を現在の状態として見せず、再接続後は完全 Snapshot で同期する。
5. Spatial 表示をやめると通信と購読が停止し、Grid に戻すと既存の操作が使える。

## 2. 現状と設計判断

現行の `web/src/domains/dashboard/v2/dashboard-page.tsx` には route-level lazy component、`DashboardToolbar`、manifest・variable・panel query、Grid layout、PanelShell、Inspector が集まっている。`useDashboardPanelsV2` はここで呼ばれている。Grid を CSS で隠すだけでは通信と描画の負担が残る。

`web/src/routes/dashboard-route-search.ts` は現在 range、timezone、refresh、filters を正規化する。`surface` を追加するときは、既存の canonicalization がその値を消さず、filter 編集や期間変更でも保持する必要がある。

`web/src/api.ts` の `appFetch` は Cookie、401 後の認証更新、unauthorized 通知、AbortSignal を扱う。一方、ブラウザの `EventSource` はこの経路を通らない。第2弾では `appFetch` と `ReadableStream` による SSE client を採用し、認証とキャンセルの扱いを揃える。SSE の chunk 境界、複数行 `data`、`id`、heartbeat を parser が処理し、wire payload は第1弾の Zod schema で検証する。

## 3. 変更範囲

| 層 | 方針 |
| --- | --- |
| Dashboard shell | 認証、画面見出し、Grid / Spatial 切替を受け持つ。表示中の Surface だけを mount する |
| Grid Surface | 既存 Dashboard の manifest/variable/panel query、toolbar、layout、PanelShell、Inspector をまとめ、機能を変えずに移す |
| Spatial Surface | Snapshot と SSE の client、状態表示、接続 status、再試行を受け持つ。HTML だけで成立させる |
| Route search | `surface=grid|spatial` を型付きで受ける。省略時は Grid、不正値も Grid に戻す。既存 search の正規化と共存させる |
| Shared model | 第1弾 schema を wire 検証に使う。Frontend 固有の connection state と表示用 summary は純粋な変換に限定する |

想定する主な編集先は `dashboard-page.tsx`、`dashboard-route-search.ts`、その test、`web/src/domains/dashboard/v2/spatial/`、Dashboard の style と E2E。Grid を分離する具体的なファイル名は `grid-surface.tsx` を第一候補とする。Grid と Spatial のどちらも route の認証境界を通る。Gallery route は変更しない。

### 対象外と禁止事項

- Three.js、`@react-three/fiber`、Canvas、Camera、Geometry、animation、粒子、視覚文法の renderer 実装。
- Dashboard v2 Data Frame や Visualization Registry への Spatial 登録、既存 API・DB schema・認証方式の変更。
- Runtime/Task/Memory の新規詳細 Dashboard、存在しない route への drill-down。
- UI 側に Mock の Task/Health を再計算する第二の正本を作ること。Server Snapshot を状態の正本とし、Frontend は接続状態と派生表示だけを持つ。
- Dashboard 全体の大規模な再設計。Grid から移すコードは、Surface 境界に必要な範囲に限定する。

## 4. Surface 境界と検索状態

```text
/dashboard route + auth
  └─ DashboardShell
       ├─ 共通見出し・Grid / Spatial switch
       ├─ GridSurface (選択時だけ load / mount)
       │    └─ manifest → variables → panel queries → Grid / Inspector
       └─ SpatialSurface (選択時だけ load / mount)
            └─ Snapshot → SSE → HTML summary / lists
```

初期 URL `/dashboard` の表示は Grid のままとする。`?surface=spatial` を直接開いた場合は、ログイン確認後に Spatial のみを開始する。切替時には range、filters、timezone など既存 search を保ち、`surface` だけを更新する。`resolveDashboardSearch` が Grid の値を canonicalize する場合も `surface` を維持する。Grid が layout 編集中に切り替える操作は、未保存変更を失わないよう編集の Save/Cancel と整合させる。判断の詳細は Grid の既存 layout state を読んで WP 開始時に固定する。

Dashboard shell から Grid への import は動的にし、Spatial を直接開いた場合に Grid の runtime、`react-grid-layout`、visualization catalog を読み込まない。Grid を開いた場合は Spatial client と将来の Three.js chunk を読み込まない。見出しや切替 UI は両 Surface に共通だが、Grid の期間・filter・refresh・edit 操作を Spatial に意味なく表示しない。

## 5. Client と状態更新

### 初回表示

Spatial mount 時に `GET /api/observatory/mock/state` を `appFetch` で取得し、Zod で検証する。読み込み・401・schema 不一致・ネットワークエラーは状態別に表示し、再試行できるようにする。Snapshot を取得してから stream を開く。stream の最初の Snapshot を完全状態として採用し、REST 取得との間の更新抜けを解消する。

### SSE と再接続

第1弾 SSE の `snapshot`、`telemetry`、`event`、`heartbeat` を明示的に扱う。stream packet の ID は `instanceId:sequence`。初回 Snapshot を基準に、同じ `instanceId` 内で次の packet ID が連続することを確認する。重複は捨て、欠番・instance 変更・不正 payload では部分更新を続けず、接続を閉じて完全 Snapshot から取り直す。履歴 replay や `Last-Event-ID` は使わない。

Snapshot は Entity/Boundary/Task/Pipeline の唯一の全体状態として置き換える。Telemetry は対応する値だけを短時間更新し、次の Snapshot で整合させる。Event は最近の出来事を上限付きで保持し、Task の state や Health を Event から推測して上書きしない。heartbeat は接続の生存だけを示し、Entity の freshness を更新しない。

接続 status は `loading / live / stale / reconnecting / offline / unauthorized` など、観測対象の health とは別に持つ。heartbeat が途絶えたら stale とし、接続をやり直す。再試行は上限付きの backoff を使い、タブ非表示時は不要な描画を抑える。認証が無効な場合は無限再試行せず、既存のログイン導線を使う。切替・unmount・ログアウト・タブ終了時は AbortController と timer を解放する。

### HTML 表示

Snapshot から、全体の health 件数、Entity 一覧、Boundary 一覧、Task の工程、Pipeline の stage と queue、最終更新時刻を生成する。Node と Boundary の health は別に数える。状態は色に頼らずテキストで示す。選択した対象の詳細は必要な情報だけを表示し、Mock に存在しない詳細への link は置かない。この HTML は次の Three.js Scene が読み込めない場合の代替表示にもなる。

## 6. Work Package

| WP | 作業 | 完了条件 |
| --- | --- | --- |
| U0 基準値 | 既存 Grid smoke、search test、bundle graph を記録。第1弾 API contract を確認 | 既知の bundle gate 失敗と今回の回帰を区別できる |
| U1 Route search と shell | `surface` の parse / canonicalization、認証後の切替 UI | Grid 既定、直接 URL、不正値、戻る・進む、既存 search 保持の test が通る |
| U2 Grid 分離 | Grid 固有 hook / runtime / toolbar / layout / Inspector を Surface 内へ移す | Spatial 表示で panel query 0、Grid の既存 E2E と編集動作が維持される |
| U3 Snapshot client | `appFetch`、Zod 検証、loading/error/retry、HTML summary | 固定 Snapshot の意味が表示され、401 と不正 payload を誤表示しない |
| U4 SSE client | parser、packet 順序、再同期、接続 status、cleanup | 分割 chunk、欠番、重複、再接続、unmount、heartbeat 喪失の deterministic test が通る |
| U5 統合 | Spatial E2E、a11y、bundle 比較、進捗記録 | Grid ↔ Spatial と Scenario 変更が画面に反映され、既存 Dashboard 回帰がない |

各 WP を一つずつ進め、targeted test、型チェックを通してから次へ移る。test のコマンド、結果、変更ファイル、未解決事項を [進捗台帳](./progress.md)に記録する。U2 の移動では動作変更を混ぜず、query の起動条件と import graph を明示的に確認する。

## 7. 検証と失敗時の扱い

| 検証 | 期待結果 |
| --- | --- |
| `bunx vitest run web/src/routes/dashboard-route-search.test.ts web/src/domains/dashboard/v2/spatial` | search 正規化、SSE parser/reducer、summary、失敗系の固定 fixture が成功 |
| Dashboard v2 の frontend unit test | Grid query、layout、PanelShell、Inspector に回帰がない |
| `bun run verify:dashboard-e2e` | Grid ↔ Spatial、直接 URL、Scenario 変更、切断・再接続、Grid 復帰が成功 |
| `bun run verify:dashboard-a11y` | キーボードで切替と一覧を操作でき、状態がテキストで読める |
| `bun run verify` | typecheck、lint、format、unit、coverage、build が成功 |
| `bun run verify:dashboard-bundle` と変更前後の manifest 比較 | Grid に Spatial client / Three.js が混入せず、Spatial 直行時に Grid chunk が不要。既知の `core-state-timeline` 予算超過は別途記録し、今回の増分と混同しない |
| `git diff --check` と文書リンク gate | 差分と文書参照に問題がない |

SSE test は Mock の固定 seed・初期時刻・手動 tick を使い、外部システムや長い実時間待機に依存させない。通信断では最後の Snapshot と「接続が古い」という表示を確認し、再接続後は完全 Snapshot がそれを更新する。失敗した WP は原因を修正して同条件で再実行する。既存 gate の開始時からの失敗は基準値と結果を併記し、成功と偽って記録しない。

## 8. 次の計画へ渡すもの

この計画の完了時には、Spatial の状態、HTML 表示、選択対象、接続状態、Grid / Spatial 切替と遅延ロードが揃う。次の Three.js 計画では、同じ Snapshot 由来の表示状態を Scene に渡し、Camera、Node、Boundary、Task、Pipeline の視覚文法を実装する。Canvas 側に API 接続や health 診断を重複して持たせない。

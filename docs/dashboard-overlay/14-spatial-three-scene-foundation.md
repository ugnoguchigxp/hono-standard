# Spatial 第3弾: Three.js Scene の基礎 実装計画

## 1. 目的と完了した利用体験

[全体コンセプト](./11-spatial-observability-concept.md)、[第1弾 Mock Signal Server](./12-spatial-mock-signal-server.md)、[第2弾 Dashboard Surface](./13-spatial-dashboard-surface.md)の次の段階として、Spatial に Three.js Scene を追加する。利用者は同じ Mock Snapshot を空間図と HTML 一覧の両方で確認し、どちらから対象を選んでも同じ詳細を読める。Scene は関係と状態を読むための表示であり、通信や health 判定を持たない。

この計画は Scene の**静的な基礎**までを対象とする。SSE で Snapshot が変われば形・色・状態表示は更新するが、Event に合わせた粒子、pulse、flash、Task の周回運動は次の計画に分ける。Canvas が使えない場合も HTML 一覧と詳細は使える。

完了条件は次のとおり。

1. `/dashboard?surface=spatial` で、Core と周辺 Entity、Boundary、Task、Pipeline stage の関係を、再読み込みしても同じ位置に表示する。
2. Node の health と Boundary の health を別の形・凡例で読み取れる。接続 status が `stale` 等になったときは Scene 全体の観測時点が古いことも HTML で示す。
3. Scene の click / tap と HTML 一覧の button は同じ意味上の ID を選び、同じ HTML 詳細を開く。キーボードと screen reader だけでも同じ対象を選べる。
4. WebGL 不可、Scene のロード失敗、描画エラー時も、Spatial の Snapshot/SSE と HTML 表示が残る。
5. Grid と通常 route の初期読込に Three.js が混入せず、Spatial を閉じたら Canvas とその処理が解放される。

## 2. 開始条件と基準値

第2弾の `SpatialSurface`、`useSpatialData`、`SpatialData`、`summarize` と共有 Observatory schema を先に読む。現在は `SpatialSurface` が Snapshot、接続 status、一覧、選択、詳細を一つのコンポーネントに持つ。Scene を足す前に、選択状態を Spatial の親に残し、HTML 表示を小さく切り出す。Grid 側は変更しない。

作業開始時に `bun run verify`、`bun run verify:dashboard-e2e`、`bun run verify:dashboard-a11y`、`bun run verify:dashboard-bundle` を実行する。bundle の基準は第2弾完了時の初期 graph raw 838,339 / gzip 239,493 bytes、Dashboard shell raw 30,547 / gzip 9,878 bytes、Grid Surface raw 379,887 / gzip 110,466 bytes、Spatial Surface raw 160,236 / gzip 44,593 bytes。実装時には同じコマンドで再測定し、差分と読み込み graph を[進捗台帳](./progress.md)に記録する。数値の揺れがあるため、この値をそのまま新しい固定予算にはしない。

## 3. 責務とデータ契約

```text
Mock Snapshot / SSE
    ↓ 既存 useSpatialData / SpatialData
Semantic Scene Model（純粋な変換）
    ├─ HTML summary / list / detail
    └─ Visual State（純粋な変換）
         └─ lazy Three.js Scene（表示・hit target のみ）
```

`SemanticSceneModel` は既存 Snapshot の Entity、Boundary、Task、Pipeline と接続 status から表示に必要な値を作る。ID、label、health、activity、工程、stage status、queueDepth、位置などを持つが、API response の別の正本にはしない。位置と表示用状態は純粋関数で導出し、保存・編集・Server 送信しない。health は Server Snapshot の値を使い、`connected` 等を Scene が推測しない。接続 status は対象の health と区別する。

配置は ID と kind に対して決定的にする。Core/System を中央、Memory を上、Tool を左、External を右、Runtime / Service / Model を下、Task を Core 周囲の安定 slot、Pipeline stage を下方の列に置く。同じ zone に複数あるときは ID 順の slot を使い、Snapshot の配列順や Event 到着順で位置を変えない。Core 等が存在しない、件数が上限に近い、追加・削除された場合にも重なりを避ける規則を pure function の test で固定する。Mock の具体的な ID や表示名を位置ロジックの条件に使わない。

Node と Boundary の視覚状態は別々に導出する。健康・劣化・古い信号・切断・障害・不明を、色に加えて輪郭、線種、断線、記号と HTML 凡例で区別する。`activity` の明るさは Snapshot の値に従う。Task は工程名を HTML 詳細に残し、Scene では固定 Orb と選択印に留める。Pipeline は stage、順序、queue と stalled を静的な形で示す。意味を持たない大きさや高さの差は付けない。ラベル、数値、Event 履歴は HTML に置き、Canvas 内の小さな文字へ依存させない。

選択 ID は `kind + id` の識別子を一つだけ Spatial 親で保持する。Scene と HTML 一覧から同じ `select` callback を呼ぶ。Snapshot 更新で対象が消えたら選択を解除する。Boundary の hit target は見える線より操作しやすい幅を持たせるが、手前の Node を誤選択しないようイベント伝播を制御する。Pipeline stage は stage ID が pipeline 内でのみ一意な契約なので、`pipelineId + stageId` で識別する。

## 4. Scene と fallback

`three` と `@react-three/fiber` を Spatial 内の追加の動的 import に閉じ込める。第2弾の Spatial HTML chunk は Scene module を静的 import しない。Canvas には固定の斜め上からの orthographic camera を使い、全体の距離関係を読みやすくする。最初は自由回転・pan・zoom を提供しない。画面幅と高 DPR で重要な対象が切れないよう camera frustum と Canvas 高さを調整する。Scene は pointer で選択できるが、操作可能な全対象を HTML 一覧にも残す。

基本図形と線、控えめな照明だけで構成する。外部 3D asset、texture、shader、postprocessing は導入しない。R3F の `frameloop="demand"` を基本にして、Snapshot と選択の更新時だけ再描画する。hidden tab で描画を続けず、毎 frame の React state 更新を作らない。`devicePixelRatio` に上限を設ける。Scene を外したときに event handler、geometry、material、WebGL resource が残らないことを確認する。

Canvas 作成前の WebGL 利用可否確認、chunk ロード失敗、描画中例外、`webglcontextlost` を扱う。失敗時は Canvas を外し、短い説明と再試行操作を出す。既存の HTML summary、一覧、詳細、接続 status は Scene の成否と独立して表示する。`prefers-reduced-motion` は現段階で常時アニメーションを入れないことで満たし、次のライブ表現計画にも引き継ぐ。

依存パッケージの採用版は実装開始時に React 19 / Vite 8 との互換性を公式資料と lockfile で確認して固定する。R3F の Canvas は orthographic camera、on-demand 描画、pointer event を提供している。新しい UI 補助ライブラリや Drei は必要性が確認できるまで加えない。

実装時の参照先: [R3F Canvas](https://r3f.docs.pmnd.rs/api/canvas)、[R3F performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)、[R3F events](https://r3f.docs.pmnd.rs/api/events)、[Three.js OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html)、[Three.js resource disposal](https://threejs.org/manual/pages/how-to-dispose-of-objects.html)。API と互換性は着手時に再確認する。

## 5. Work Package

| WP | 作業 | 完了条件 |
| --- | --- | --- |
| S0 基準と依存確認 | 第2弾 gate、bundle graph、対象コンポーネントと package 互換を確認 | 変更前の結果と dependency pin が進捗台帳にある |
| S1 Semantic Scene Model | Snapshot → model、決定的配置、Visual State、凡例用説明を純粋関数にする | 配列順変更・追加削除・health 差・stage ID 衝突・同一入力の再現 test が通る |
| S2 HTML と選択の分離 | summary/list/detail と選択 ID を Spatial 親に整理する | Canvas なしでも第2弾の E2E と a11y が通り、一覧と詳細の意味が維持される |
| S3 Scene 基本構造 | lazy R3F Canvas、orthographic camera、Entity / Boundary / Task / Pipeline stage と静的凡例 | 固定 Snapshot で配置と状態差が確認でき、Grid に依存 chunk が入らない |
| S4 選択と fallback | pointer 選択、HTML 詳細との同期、WebGL / chunk / context failure と再試行 | Canvas 不可でも HTML 操作可能。unmount 後に描画と購読が止まる |
| S5 統合と計測 | scenario 切替、E2E、a11y、視覚比較、bundle / 性能計測、進捗更新 | 既存 gate と新規 test が通り、予算と実測差を説明できる |

各 WP の完了時に対象 test と typecheck を実行し、結果と次の作業を進捗台帳へ記録する。Scene の見た目は S3 で固定 seed / 固定時刻の Snapshot を使って調整し、偶然の乱数や force layout を使わない。

## 6. 検証

| 検証 | 確認すること |
| --- | --- |
| `bunx vitest run web/src/domains/dashboard/v2/spatial` | model の決定性、visual mapping、選択の消去、既存 SSE reducer の回帰 |
| `bun run verify:dashboard-e2e` | Grid 既定・直接 Spatial URL・scenario による静的状態更新・Canvas と HTML の選択同期・Grid 復帰 |
| `bun run verify:dashboard-a11y` | Canvas に依存しない一覧と詳細、キーボード操作、状態テキスト、reduced motion |
| `bun run verify:dashboard-visual` または固定 fixture の専用 visual test | normal / degraded / signal loss の同条件 screenshot を比較。GPU 差で不安定な pixel 完全一致は要求しない |
| WebGL 不可・context loss の browser test | Scene エラー表示と再試行、HTML と SSE の継続、例外のない Grid 復帰 |
| `bun run verify:dashboard-bundle` と Vite manifest 監査 | 初期・Grid graph に Three.js / R3F がない。Spatial HTML と Scene を個別に計測 |
| `bun run verify`、`bun run verify:dashboard-doc-links`、`git diff --check` | 全体回帰、文書参照、差分の整合性 |

ブラウザ計測では固定 viewport と DPR を使い、初回 Canvas 表示までの時間、Scene chunk の raw/gzip、代表 scenario の draw call と idle 時の描画回数を記録する。数値の予算は S0 の実測と S3 の最小 Scene を見て明示的に追加する。初期・Grid の既存予算を無条件に増やして通すことはしない。Canvas 非表示や Grid 復帰後は描画回数が増え続けないことを確認する。

## 7. 対象外・禁止事項・判断が必要な変更

- 対象外: Event に連動する粒子・flash・pulse、自由 camera 操作、timeline / replay、実 Provider、Runtime / Task 専用 Dashboard への遷移。次の「ライブ表現と探索」計画で扱う。
- 変更しない層: Mock API、共有 schema、DB、認証方式、Dashboard v2 Data Frame / Visualization Registry、Grid panel runtime、Gallery。
- 禁止: Scene 内で health や Task 進捗を再診断すること、Mock の ID をハードコードした配置、Canvas だけに意味や操作を閉じ込めること、Grid の起動時に Three.js を読み込ませること。
- 実装中に判断が必要: 固定予算では収まらない Scene chunk、WebGL fallback の検証不能、既存 API 契約の不足。実測と影響を記録し、この計画の範囲を拡張する前に別の判断として扱う。

第3弾の完了後、第4弾では同じ Semantic Scene Model と選択 ID を使い、実 Event に対応する短い動きと停止を追加する。Scene に新たな通信経路や第二の状態正本を作らない。

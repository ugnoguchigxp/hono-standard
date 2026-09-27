# Spatial / Ambient Observability: 全体コンセプト

## この文書の役割

この文書は Dashboard v2 の上に置く Spatial / Ambient Observability Surface の目的、利用体験、設計境界を定める。個々の API schema、ファイル構成、実装順、テストコマンドはここで固定しない。後続の小さな実装計画で、対象コードを確認して決める。

基盤となる正本は [Dashboard コンセプト](./00-concept.md)、[共有契約](./01-contracts.md)、[Frontend](./03-frontend.md)、[Specialized Observability](./10-specialized-observability-visualizations.md)、[Data Source Adapter](./data-source-adapters.md)。この文書はそれらを置き換えない。

## 1. 何を実現するか

現在の Dashboard は数値、時系列、ログ、Trace などを詳しく読むための場所である。Spatial Surface は複数の状態を一枚の空間に圧縮し、数秒で「いつもと違う形」「止まった流れ」「活動の偏り」に気づける入口にする。

利用者の流れは次のとおり。

```text
Spatial Overview → 異変を選択 → 状態と根拠を確認 → 既存 Dashboard / Trace / Logs で調べる
```

Spatial は詳細分析を完結させない。数値が必要な判断や原因調査は、既存の可視化と生データへ進む。Grid Surface はそのまま使い続けられ、Spatial は Dashboard level の別 Surface として切り替える。単独の Panel Visualization にはしない。

### 利用場面

| 場面 | 利用者が知りたいこと | Spatial が担うこと |
| --- | --- | --- |
| 常時表示 | 全体は普段どおりか | 重要な状態差と活動を静かに見せる |
| 探索 | どこで何が起きているか | Entity、Task、Boundary、Pipeline を選び、短い根拠を示す |
| 診断への移行 | なぜ起きたか | 対応する Dashboard、Trace、Logs へ移動させる |

最初の体験は探索を中心にする。Ambient と Diagnose は方向性として残すが、最初から独立したモード群を完成させる前提にはしない。

## 2. 画面の意味

最初の Scene は Core、Memory、Tools、External、Task、Runtime、Pipeline の関係を、繰り返し見ても位置が安定する形で表す。特定の製品名やエージェント名を配置ロジックに埋め込まない。Mock 上の表示名には具体例を使える。

```text
                  Memory
                     │
Tools ─────────── Core ─────────── External
                 ○   ○  Tasks
                     │
                  Runtime
                 Models / Services

Finding → Covering → Finalize
Review Queue             Knowledge Queue
```

Node は構成要素そのもの、Boundary は要素間の通信・依存関係を表す。たとえば Core と Runtime がそれぞれ healthy でも、その間の Boundary だけが degraded になり得る。この区別を消してはいけない。

Task は Core 周辺の選択可能な作業記号とし、accepted、scheduled、planning、working、waiting、blocked、verifying、completed、failed のような実際の工程を示す。完了率を LLM に推測させない。ContextStill の Mock では Finding → Covering → Finalize だけに順序付きの接続があり、Review Queue と Knowledge Queue は独立して置く。Queue の名称は Mock の仮称である。接続線は移管関係を表す線とし、タスクの通過を常時描かない。処理中の Queue は図形そのものを琥珀色に変え、拡縮と回転で示す。移管 Event は段階が変わる時に一度だけ発行し、移管後は受け取った Queue がアクティブになる。停止、非表示、reduced motion では連続描画を止める。

各 Node の立体シンボルは表示対象の役割に対応させる。Memory は脳、LLM は接続されたネットワーク、Runtime はサーバー、Tool は歯車、External はゲート、WorldModel は世界を表す球体など、サービスの意味から形を選ぶ。特定の製品名を Scene の描画条件として推測せず、データにシンボル種別と短い説明を載せる。Mock に存在しないサービスの天体を装飾として増やさない。軌道線は配置と動きの補助に留め、観測対象と誤認する光点や大きな背景天体を置かない。

### 視覚文法

各表現は意味を持ち、画面内の凡例と HTML の説明で確かめられるようにする。

| 表現 | 意味の候補 |
| --- | --- |
| 大きさ | 規模・容量。比較できる値がない場合は固定 |
| 明るさ | 現在の活動量 |
| 不透明度 | 観測の新しさ |
| Pulse | 現在処理中 |
| 粒子の移動 | 実際に観測した signal / event flow |
| 周回する Task | 登録済み Task とその工程 |
| 歪み・不安定な線 | degraded |
| 途切れた線 | disconnected |
| 明確な警告形状 | fault |
| 蓄積 | queue / backlog |
| 短い flash | 完了 Event |

色や動きだけに意味を預けない。`stale`、`disconnected`、`fault`、`unknown` は異なる状態として説明する。完全な無信号では、赤い警告を増やすだけでなく、その信号に由来する光や流れが止まることを表す。装飾のためだけの animation は入れない。

### Three.js でつくる空間

Spatial は `three` と `@react-three/fiber` を使う一つの Scene として描く。ダッシュボードのカードを単に 3D に並べるのではなく、構成要素の距離、接続、活動の流れを一目で捉えられる地形にする。初期視点は全体が見える斜め上からの固定視点を基本とし、奥行きは関係の重なりをほどくために使う。透視によって手前の要素だけが過度に大きくなったり、奥の異常が隠れたりしないようにする。

```text
画面上部: 接続状態・現在の Scenario・Grid / Spatial 切替
┌──────────────────────────────────────────────┐
│                Three.js Scene                │
│                                              │
│ Memory field       Core       External       │
│                    ◌ Tasks                   │
│ Tools          Boundaries     Runtime        │
│           Pipeline stages / flow             │
│                                              │
│ 凡例・現在の異常を短く示す                    │
└──────────────────────────────────────────────┘
選択時: HTML の詳細 Drawer と既存 Dashboard への導線
下部または代替表示: HTML Summary / 一覧
```

Scene は静的な構造と一時的な出来事を分けて描く。位置と Node の基本形は構成を示し、線は Boundary の状態を示す。光、pulse、粒子は活動の変化を示す。一時 Event が止まっても構成自体は読める。現実の 3D 世界の再現より、短時間での読み取りを優先する。

| Scene 要素 | 形と位置の考え方 | 状態変化の見え方 |
| --- | --- | --- |
| Core / System | 中心を示す大きめの安定した形 | 稼働中は内側が明るくなり、fault は輪郭でも区別する |
| Runtime / Service / Model | Core の下方にまとまる独立 Node | Node 自体の health と Core からの Boundary health を別々に表示する |
| Memory | Core 上方のまとまりを持つ field | freshness が落ちたときは光と活動が減る。単なる背景装飾にしない |
| Tool / External | 左右の zone に置く Node | 通信 Event がある Boundary にだけ流れを表示する |
| Task 記号 | Core 周辺の安定した slot | 工程に応じて色、pulse、停止、完了 flash を変える。軌道位置だけで進捗を装わない |
| Pipeline | stage と接続を連続した小さな構造として置く | Event に沿って移動し、backlog は stage に溜まり、stalled は流れが止まる |
| Boundary | 二つの Node を結ぶ線・帯 | degraded は不安定、disconnected は断線、fault は警告形状と明示的なラベル |

Camera の自由移動は主目的ではない。最初は全体把握と対象選択を優先し、必要なら限定した zoom / pan を後続で検討する。視点操作を加える場合も「初期視点へ戻る」操作を用意し、選択対象と異常の位置を見失わせない。スマートフォンでは Canvas の見える範囲だけに情報を閉じず、HTML 一覧から同じ対象を選べるようにする。

Scene 内の hit target は Entity、Boundary、Task、Pipeline stage の意味上の ID に対応させる。hover は補助情報、click / tap は選択、選択内容の説明と移動操作は HTML の Drawer が担当する。Canvas 内に小さな文字や操作ボタンを大量に描かない。Canvas のラベルは短く保ち、詳細な名前・値・時刻・Event は HTML で読めるようにする。

描画の責務は Visual State の表現に限定する。Geometry、material、照明、shader の選択は視覚文法を実現する手段であり、health の診断を shader や Scene component 内で決めない。常時動く効果は最小限にし、同じ状態なら同じ画面になることを優先する。表示密度が上がった場合は集約や段階表示で対処し、粒子数や光量だけを増やさない。

## 3. 情報の流れ

最初は Repository 内の Mock Signal Server が唯一の情報源となる。実環境 API を呼ばず、SAAA、LARM、ContextStill と接続しない。Mock は fixture を返すだけでなく、Task、Pipeline、Health、Event が時間とともに変化する Simulation Environment として扱う。

Mock の監視対象は `../SAAA` の自己診断にある安定した項目を参考にできる。現時点では LARM の LLM / Backchannel / ASR / TTS / Embedding、SQLite、Personal State、World Model、ToolChain、ContextStill Recall / Search を個別のオブジェクトとして扱う。各オブジェクトには元の診断項目 ID と役割説明を持たせる。ただし表示中の health と activity は Mock Simulator の値であり、SAAA の自己診断結果ではない。Fast 診断で能力が広告されたことを稼働確認済みと誤解させない。

```text
Mock Signal Server
  ├─ Snapshot: 全体の構造と状態
  ├─ Telemetry: 活動量や遅延などの観測値
  └─ Event: 実際に起きた離散的な変化
          ↓
Observatory Client / State Reducer
          ↓
Semantic Scene Model
          ↓
Visual State ── Three.js Surface
          └──────── HTML Summary / Detail
```

Snapshot、Telemetry、Event は役割を分ける。Snapshot は現在の完全状態、Telemetry は変化する測定値、Event は「Task が始まった」「境界で timeout した」などの出来事である。関連 Event は correlation ID 等で結べる形にし、将来の causal trace を妨げない。

Renderer は Raw API response や business logic を直接扱わない。Scene Model に Entity、Boundary、Task、Pipeline とその状態をまとめ、純粋な規則で Visual State を作る。Three.js と HTML は同じ意味上の状態を異なる形式で表示する。現時点で Dashboard v2 の Data Frame に Spatial 専用 shape を追加しない。既存 graph/state/logs/traces Frame から Scene へ変換する余地は残し、必要な場面と対応関係が明確になった段階で計画する。

## 4. 信号の鮮度と信用

Entity と Boundary は、期待される観測間隔と最後に観測した時刻を使って freshness を判断できる必要がある。healthy、stale、disconnected への変化は明示的な規則で決める。観測値が欠けている場合は都合よく healthy と見なさない。

また、サーバーから「対象が無信号である」と届く状態と、ブラウザがサーバーに接続できなくなった状態は別である。通信路自体が止まったら、画面は最後の状態を現在の真実として表示し続けず、情報が古くなっていることを示す。復旧時は完全な状態に同期してから流れる Event を反映する。

Spatial の価値は、いつもの形との違いに気づけることにある。配置、シナリオ、時刻の進め方は再現可能にし、偶然の乱数や force simulation によって同じ状態の見た目が変わらないようにする。

## 5. Mock で表現したい状態

手動で再現できるシナリオとして、少なくとも normal、high-activity、task-heavy、runtime-degraded、runtime-disconnected、stale-memory、pipeline-backlog、pipeline-stalled、boundary-latency、task-blocked、task-user-waiting、recovery、total-signal-loss を想定する。

時間順にこれらを見せる自動デモも、視覚調整と展示に有用である。ただし手動シナリオ、固定 seed、固定時刻の再現性を先に成立させる。自動デモの時刻表と切替操作の詳細は Mock 側の計画で決める。

Mock の状態を誰と共有するか、シナリオ変更をどの環境で許すか、SSE 再接続時にどう同期するかは重要な設計事項である。既存の認証境界と整合させ、専用計画で明文化する。複数プロセス間の同期や履歴保存まで暗黙に含めない。

## 6. Dashboard コンポーネントの抽象化

現在の `DashboardPageV2` は画面の見出し・操作、manifest と変数、パネル取得、Grid layout、PanelShell、Inspector を一つの画面で構成している。Spatial を追加する際には、この画面の中に Canvas を条件付きで差し込むだけで終えない。Dashboard の共通部分と Surface 固有部分を分け、Grid と Spatial が同じ画面上の対等な表示方式として成立する形を目指す。

```text
Dashboard route / 認証
  └─ Dashboard shell
       ├─ 共通: title、surface 切替、期間・filter の意味、接続状態、詳細への移動
       ├─ Grid Surface
       │    └─ Grid layout → PanelShell → Visualization renderer / Inspector
       └─ Spatial Surface
            └─ Observatory client → Scene Model
                 ├─ Three.js Scene
                 └─ HTML Summary / Detail Drawer
```

ここでいう共通化は UI を無理に同じコンポーネントへ押し込むことではない。共有するのは Dashboard の画面枠、ユーザーが選んだ surface、対象と時間範囲の文脈、詳細への遷移といった概念である。Grid の panel query、layout 編集、Visualization Registry は Grid に属する。Spatial の Snapshot/SSE、Scene、Camera、選択状態は Spatial に属する。表示していない Surface の重い取得と描画は続けない。

| 既存の部品 | Spatial との関係 |
| --- | --- |
| `DashboardPageV2` / route | 認証と画面入口を維持し、共通 shell と surface 切替の置き場所を整理する |
| `DashboardToolbar` | title や共通操作を再利用できるよう責務を見直す。Grid 固有の edit / refresh を Spatial にそのまま見せない |
| `DashboardGridV2` / `PanelShell` | Grid 専用のまま維持する。Spatial を Panel として包まない |
| Dashboard v2 Query runtime | Grid のデータ取得に使う。Mock Observatory の継続信号を panel query に偽装しない |
| Visualization Registry / Data Frame | 既存 panel 描画用として維持する。将来の Frame → Scene adapter は明示的な対応付けができてから加える |
| Inspector / links | 既存の詳細確認方法を活かす。Spatial の drawer からは実在する遷移先のみを示す |

Grid、Dashboard v2 runtime、Visualization Registry、PanelShell、Inspector、Data Frame、Query runtime、Gallery を再実装しない。Spatial から詳細へ進む先は、実在する画面とデータだけを使う。現在存在しない Runtime、Memory、Task 専用 Dashboard を前提にしたリンクは置かない。

Three.js と `@react-three/fiber` は Spatial を開くときだけ読み込む。Grid の表示や通常 route の初期 bundle に含めない。描画ループから React state を毎 frame 更新せず、見えないタブでは描画を抑え、粒子と保持 Event に上限を設ける。

WebGL 未対応、低性能端末、reduced motion、キーボード、screen reader にも状態を伝える。HTML Summary は Scene Model から作るため、Canvas を見られなくても Entity、Task、Boundary、Pipeline の状態と詳細導線を使える。

## 7. 範囲と将来像

最初に目指す範囲は、Mock Signal Server、完全状態、継続更新、再現可能な Scenario、Scene Model、Spatial Surface、Task と Pipeline、Health と信号断、詳細表示、Grid 切替、HTML Summary、reduced motion までである。ただし、これを一つの実装計画や一度の変更として扱わない。

実システム Provider、履歴 replay、timeline slider、複数システムの本格管理、WebSocket、factory visualization は後続の検討対象とする。将来の Provider は Mock と同じ意味上の Scene 入力へ変換できる構造を目指すが、未使用の汎用層を先に大量に作らない。

## 8. 後続の実装計画への分割

次に作る計画は、各々で対象コード、契約、変更ファイル、依存関係、正常・失敗時の挙動、検証方法を決める。以下は分割の境界であり、実装手順の確定版ではない。

1. **共有意味モデルと視覚文法**: Entity、Boundary、Task、Pipeline、Health、配置、HTML で説明できる状態。
2. **Mock Signal Server**: 時間・seed・Scenario、Snapshot/Telemetry/Event、認証、SSE、切断と再同期。[第1弾の実装計画](./12-spatial-mock-signal-server.md)。
3. **Dashboard shell と Surface 境界**: 共通画面文脈、Grid / Spatial 切替、各 Surface の取得と操作の責務。[第2弾の実装計画](./13-spatial-dashboard-surface.md)。
4. **Three.js Scene の基礎**: 遅延ロード、静的構造、Camera、選択、HTML Summary、WebGL fallback。
5. **ライブ表現と探索**: Event に対応する動き、Task/Pipeline/Boundary の表現、選択と詳細導線。
6. **品質と導入判定**: 固定条件での E2E・視覚・a11y、既存 Dashboard 回帰、bundle と性能の比較。

各計画は先行部分の完了条件を確認してから作成・実施する。実際の契約と検証コマンドはその計画に記載し、このコンセプトを詳細仕様の代わりに使わない。

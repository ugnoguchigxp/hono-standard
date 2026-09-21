# Organic Brain Sandbox MVP 実装計画

作成日: 2026-09-21。対象ブランチ: `brain-sandbox`。実装担当: Terra。

この文書は実装前の計画であり、記載した機能・性能・学習効果はまだ検証されていない。企画書の要件を、実装順序、モジュール間の契約、検証可能な作業単位に落とす。コードの実装は本計画作成に含めない。

原文: [Concept & Implementation Brief](brain-sandbox/concept.md)。計画作成時に添付からそのまま保存済み。

## 1. 到達点と判断基準

固定ニューロンを持つ人工生物1体が、2D環境で感覚入力を受け、神経活動から行動し、身体状態の変化を通じて接続を更新する。その過程をWeb画面で停止・進行・観察・保存できる実験環境を完成させる。

完成判定は二段階に分ける。

- **実装の完成**: 下記の全タスクと検証を満たし、局所学習・構造変化・身体状態・観察・記録が実際につながっている。
- **仮説の検証**: 企画書の成功条件A〜Fについて、複数seedと比較条件で結果を記録する。特にE「行動傾向の獲得」は未保証であり、実装が動いただけで達成としない。結果は「支持」「未達」「判定不能」を分ける。

学習が成立しない場合も、失敗の原因を追える環境と証拠を成果物にする。成功するように行動ルールを追加したり、成功したseedだけを採用したりしない。

### 絶対に維持する原則

1. ニューロンの個数・位置・興奮性/抑制性は個体の生存中に不変。
2. 神経の高速処理はイベント駆動。全ニューロンの毎ms走査は禁止。
3. 学習規則と状態と実行制御を分離する。Backpropagationを導入しない。
4. ネットワーク入力は連続的な感覚値と身体値だけ。物体種別、座標、最適行動を渡さない。
5. 行動は運動ニューロンの発火から決める。空腹や危険から行動を直接選ばない。
6. rewardは身体の恒常性誤差の改善から計算する。食べ物・行動に固定報酬を付けない。
7. 死亡は終端。新個体へ重み、trace、乱数の途中状態を引き継がない。
8. 同一seed、確定config、engineVersion、操作条件なら再現可能にする。
9. 可視化の間引き、SSE購読数、速度変更でシミュレーション結果を変えない。

### 対象外

人間相当の知能、言語、LLM、世代進化、遺伝、GPU/WebGL、Wasm実装、複数個体、分散実行、稼働中プロセスの復元、全spikeのDB保存は対象外。Workerは将来の配置候補とし、初回MVPではサーバー内の協調スケジューリングで実装する。

## 2. 既存プロジェクトへの組み込み

本計画は作成時点の実ファイルを確認している。実装開始時には変更状況を再確認する。

| 現在の配置 | 追加・変更の方針 |
| --- | --- |
| `api/app/hono.ts` | `AppDeps`に実験serviceを注入し、`createApiRoutes`にrouteを追加。既存のglobal runtimeを利用し、import/HMRごとに実行loopを増やさない |
| `api/app/server.ts` | shutdown時に実験停止・最終保存・SSE終了を追加。DB closeより前に完了させる |
| `api/modules/` | `brain-sandbox/`に所有者管理、scheduler、永続化、HTTP向けserviceを置く |
| `api/brain/`（新設） | Hono、React、DB、Bun/Node APIに依存しない計算本体。企画書で求められた独立性のための配置例外 |
| `shared/schemas/` | config、HTTP、telemetry DTOのZod検証。内部のMapや可変配列を公開しない |
| `web/src/api.ts` | 既存`hc<AppType>`、cookie、401 refreshを再利用。追加する保護queryのprefixは`protected`、keyにuserIdを含める |
| `web/src/routes/`, `views/`, `domains/` | `/brain-sandbox`、page view、分野別UI。企画書の`web/features/`を新しいトップレベル階層として作らない |
| `api/db/schema.ts`, `drizzle/` | 実験とcheckpointのテーブルを追加。既存認証テーブル・適用済みmigrationは維持 |
| `vitest.config.ts` | Node/jsdomの既存区分と95% coverage基準を維持 |
| `playwright.config.ts` | 作成時点の実設定はChromiumとmobile-chromium。古い資料の5ブラウザー記載を実設定と混同しない |

開始時点ですでに未コミット変更がある: `.github/workflows/verify.yml`, `README.md`, `bun.lock`, `docs/operations.md`, `package.json`, `playwright.config.ts`, `templates/authless/README.md`。それらを本作業の成果と扱わず、reset、stash、上書き、まとめてcommitしない。後続タスクで変更が必要なら現状の差分を読んで必要箇所だけ追加する。

既存の認証方式、ホーム、Showcase、protectedサンプル、CIの品質閾値を変更しない。DBは実験保存用の追加だけを許可する。新規ライブラリは原則不要。独立runtime内ではZodも使わず、外部境界で検証し、直接利用する入口でも有限値・範囲の不変条件を検査する。

### 新規ファイルの配置案

```text
api/brain/
  index.ts
  core/                  types.ts, neuron.ts, synapse.ts, network.ts, config.ts
  runtime/               random.ts, event-queue.ts, brain-runtime.ts
  topology/              generator.ts, spatial-index.ts, connection-policy.ts
  plasticity/            stdp.ts, homeostasis.ts, structural-plasticity.ts
  modulation/            modulator-state.ts, modulator-runtime.ts
  organism/              body-state.ts, metabolism.ts, sensors.ts, actuators.ts
  environment/           world.ts, interaction.ts
  experiment/            experiment.ts, scenario.ts, metrics.ts
  observation/           snapshot.ts, telemetry.ts, recorder.ts
api/modules/brain-sandbox/
  service.ts, scheduler.ts, persistence.ts, stream.ts
api/routes/               experiment.route.ts, brain.route.ts
shared/schemas/           brain.schema.ts, experiment.schema.ts, telemetry.schema.ts
web/src/routes/           brain-sandbox-route.tsx
web/src/views/            brain-sandbox-view.tsx
web/src/domains/brain-sandbox/
  controls/, world/, brain/, organism/, timeline/
  observation-store.ts, use-telemetry.ts
scripts/                 brain-experiment.ts
tests/e2e/               brain-sandbox.spec.ts
docs/brain-sandbox/       concept.md, progress.md, experiment-protocol.md, results/
```

テストは対象ファイルの横に置く。上記は責務の配置先であり、空ファイルを一括生成しない。stateとruleの分離を維持できるなら小さな型定義の統合は可。

## 3. 実装契約

以下の数値は生物学的な事実ではなく、実装と初期実験を始めるための仮設定。`engineVersion=1`、`configVersion=1`としてconfigに保存する。実験結果を見ずに暗黙変更しない。

### 3.1 型・所有権・入口

| 境界 | 契約 |
| --- | --- |
| `createExperiment(config, seed)` | 検証済みconfigから新個体・world・network・独立PRNG群を生成。I/Oとtimerを持たない |
| `advanceTo(targetSimMs, maxEvents)` | targetまで決定論的に処理。結果は到達時刻、処理件数、継続要否、終端理由。途中でyieldした場合、未処理イベントより先へ時計を進めない |
| `readSnapshot()` | 整合した観察用コピーを返す。外部変更がruntimeに戻らない。読み取りで乱数を消費しない |
| `drainTelemetry()` | 上限付き観測bufferの読み出し。読み出し頻度で学習状態やmetricsを変えない |
| plasticity strategy | local spike/trace、対象synapse、modulator、configを受けて局所更新を返す。世界の物体や正解行動を読めない |
| service | runtimeを所有。認証・操作直列化・実時間速度・DB・配信を担当 |
| frontend | snapshot/telemetryの観察用複製だけを持つ。simulationを進めない |

`Neuron`は企画書の項目に加え、`role: sensory | internal | motor`、`lastUpdatedAt`、`activityUpdatedAt`を持つ。`type`と`role`を混同しない。

`Synapse`は符号なしの`weight`と送信元に一致する`type`を持つ。`lastUsedAt`, `createdAt`, `eligibility`, `traceUpdatedAt`, `lastPlasticityDelta`を追加する。IDは個体内で単調増加し、剪定後に再利用しない。incoming/outgoing indexを両方保持し、追加・削除はnetworkの操作を経由する。

### 3.2 初期configと上限

| 項目 | 初期値・制約 |
| --- | --- |
| neuronCount | 1,000。APIでは100〜2,000の整数。テスト内部の小規模fixtureは別factoryで作成 |
| inhibitoryFraction | 0.2。固定configとして保存。roleに関係なく個体全体で比率を満たす |
| sensory / motor | 12入力channel×4=48 sensory、6行動×4=24 motor。残りinternal |
| topology | 座標を単位正方形に固定。初期outdegree 12、最大32、global budget 20,000 |
| 接続制約 | 自己接続と重複edgeなし。距離減衰lambda=0.15。初期weightは0.05〜0.3。weight範囲0〜1 |
| 時刻 | simulation整数ms。最小synapse delay 1ms、最大20ms |
| membrane | restingPotential=0、threshold初期1、tau=20ms、refractory=3ms、potential下限-2 |
| 周期 | sensor 20ms、action/body/modulation 100ms、homeostasis 10,000ms、構造更新60,000ms |
| STDP | tauPre/tauPost=20ms、Aplus=0.01、Aminus=0.012、eligibility減衰tau=2,000ms |
| body初期値 | energy=.65、hunger=.6、fatigue=.2、matingDrive=.1 |
| setpoint | energy=.8、hunger=.2、fatigue=.2、matingDrive=.1 |
| world | 32×32 grid、agentは1セル占有、向きは上下左右。境界で移動不成立 |
| queue | 100,000件。超過は`failed/queue_limit`で停止し、黙ってspikeを捨てない |
| 実行時間 | 1run最大1,800,000 simulation ms。死亡前に到達した場合は`completed/time_limit` |
| runtime数 | 1ユーザーあたり未終端run 1件、サーバー全体4件。超過は429 |
| 保存 | 30秒simulationごとのcheckpoint、最大61件/run（初期＋60回）。同時刻の最終保存はupsert |

仮設定のweight・入力利得で無発火/暴走になり得る。T04で活動を確認してから閉ループへ進む。値の変更はconfig versionと根拠を残す。行動成功に合わせてセンサーから運動への特別な接続を埋め込まない。

### 3.3 決定論とイベント順

seedはuint32。固定アルゴリズムのPRNG（Mulberry32等、採用時に名称とversionを固定）を使用し、`Math.random`を禁止する。topology、world、sensory noise、structuralの乱数系列を、seedと固定tagから別々に導出する。日時、UUID、SSE sequenceは再現性比較の対象外。

queueはmin-heap、整列keyは`(atMs, phase, sequence)`。同時刻の順序を次のように固定する。

1. 感覚入力・自発活動イベント
2. synapse到着・発火・伝播
3. action window確定、環境相互作用
4. body代謝と神経コスト反映、死亡判定、modulator更新
5. homeostasis、構造更新
6. metricsとcheckpoint用観測

周期イベントも同じqueueに置く。発火からの伝播は必ず未来（1ms以上）へ予約する。処理中のphaseより前の同時刻イベントの追加は禁止。同phase内はsequence順。action/body境界を含む処理中断ではphase位置も維持する。

送信イベントは`synapseId`, `source`, `target`, `strength`を持ち、strengthは送信時に固定。到着前に剪定されたsynapseのイベントは取り消して無効件数を記録する。削除済みIDを参照するeventが別edgeへ誤配信されない。

膜電位は入力到着時に`rest + (old-rest) × exp(-経過時間/tau)`で遅延評価してから入力を加算する。不応期の入力は蓄積せず破棄。閾値以上なら1発火、potentialをrestへ戻し、不応期を設定する。観察時は投影値を計算するだけで状態を進めない。

遅いhomeostasis/構造処理、snapshot生成での全体走査は許可する。毎sensor周期の全neurons走査や全synapses走査は禁止。計測用counterで実際に触ったニューロン数・edge数を記録する。

### 3.4 局所学習と遅延した身体改善

STDPは到着したpre spikeとtarget post spikeの時刻差を使う。pre到着時には過去post traceによりeligibilityを減らし、post発火時には到着済みpre traceにより増やす。同一時刻はqueue順序に従い、fixtureで期待値を固定する。

trace/eligibilityは参照時に指数減衰し、eligibilityは[-1,1]にclamp。STDPがeligibilityを作り、medium周期に`Δweight = η × reward × eligibility`を適用する三要素則を標準strategyにする。η初期値=.01。reward=0の場合は重みを変えず、traceは進む。reward到着まで活動履歴を残すため、eligibilityの減衰はSTDPより長い。

更新候補は直近にeligibilityが非ゼロになったedgeの集合。絶対値1e-6未満は集合から外し、medium周期に全edgeを走査しない。興奮性edgeを標準の重み学習対象とする。抑制性edgeは符号とweightを保ち、MVPでは構造変化とmodulationによる有効利得の調整対象とする。この簡略化をUIと実験記録に明記する。

比較実験用に`learningMode=full | frozen | no_reward | no_structural`を設ける。`frozen`はweight更新・構造更新・threshold適応を無効にするが、身体・感覚・modulationは動かす。`no_reward`はrewardゲートのみ0、`no_structural`は構造更新のみ無効。同じ初期topologyを使う。

homeostasisは10秒ごとに発火率の時間平均を参照し、目標5Hz（arousalで3〜8Hz）の上下に応じthresholdを最大±.02更新、範囲[.3,3]。無発火のニューロンもこの低頻度処理では対象とする。

構造更新は、直近1秒の共活動記録と空間indexから、各source最大8候補を決定論的に抽出する。距離減衰と共活動で候補を順位付けし、同点はID順。使用なし120秒またはweight<.01を剪定候補とする。先に剪定、次に作成、1回最大64削除/64追加。予算満杯で条件に合う剪定対象がない場合は作成しない。新edge weight=.05。初期edgeが成熟前に一斉剪定されないようage>=120秒を剪定の必要条件にする。

### 3.5 世界・感覚・身体・行動

worldの物体種別は環境層と描画DTOだけが保持する。感覚channelはchemical-left/right、mate-signal-left/right、danger-signal、light、shelter-signal、touchの8つと、energy/hunger/fatigue/matingDriveの4つ。外部signalは距離に伴い減衰する0〜1の値。左右の受容点は向きに対して固定し、物体座標・方位ベクトルをnetworkへ直接渡さない。

20msごとに各sensory neuronへ`p = clamp(channel × gain × .02, 0, 1)`でspike相当の入力を生成する。gain初期20Hz。自発活動は20msごとにinternalをPRNGで4個選び弱い入力を与える固定予算方式。全体走査せず、行動IDを乱数で選ぶfallbackも実装しない。

100msのmotor発火countを6行動ごとに集計し、正の最大countを持つ行動を1つ選ぶ。同点はrun用PRNGの専用系列で選択し、全て0なら行動なし。選択結果と根拠countを記録する。role/type/connectionは行動の正解を知らない。

| 行動・現象 | 初期仕様 |
| --- | --- |
| move_forward | 1セル前進、境界なら失敗。試行コストenergy .001 |
| turn_left/right | 90度回転。energy .0002 |
| eat | 同じセルにfoodがあれば1個消費しenergy+.2、hunger-.25。なければ不成立 |
| rest | fatigueを通常.002、shelter上で.02減らす。energyを直接増やさない |
| mate | 同じセルにmateがあればmatingDrive-.2。mate側に1秒の再相互作用cooldown |
| 基礎代謝/秒 | energy-.001、hunger+.002、fatigue+.001、matingDrive+.0005 |
| neural cost | spikeあたりenergy 1e-6、伝播あたり2e-7 × (1+正規化距離)。送信時1回課金 |
| danger | 危険セル上でenergyを毎秒.05減らす。特別な逃走命令はない |
| food再配置 | 消費から5秒後、空きセルからworld PRNGで再配置。agent位置へ追従させない |

全body値は[0,1]。コストは該当時刻のbodyへ反映しenergy<=0の時点で死亡確定、以降の同時刻を含む行動・発火を停止する。神経コストによる死亡は次のbody周期まで延期しない。通常のaction/body境界では、行動の利益より先に同時刻までの未精算コストを反映する。

恒常性誤差は`E = mean(abs(body_i - setpoint_i))`。rewardは前medium境界から現在までの`clamp(5 × (E_previous-E_current), -1, 1)`。前回値はコスト精算後のbodyで更新し、同じ改善を二重計上しない。食べ過ぎ等でsetpointから遠ざかれば正報酬にしない。

threatはdanger-signalの平滑値、noveltyは感覚vectorの前回との差の平均、arousalは恒常性誤差とthreatから算出し、各[0,1]。時定数は1秒。rewardのみ[-1,1]の符号付き値とする。各ニューロンの固定感受性[.5,1.5]を介してsensor gain、可塑性係数、抑制伝播利得、homeostasis目標を有界に調整する。行動を選ぶ関数へmodulatorを直接渡さない。

### 3.6 操作・実行寿命

状態は`paused | running | completed | dead | failed | interrupted`。作成直後はpaused。

- Run: pausedからrunning。すでにrunningなら変更なし。
- Pause: runningからpaused。処理sliceの安全な境界で止まり、その時刻を返す。
- Step: paused時のみ、現在時刻から100 simulation ms進めてpausedへ戻す。1 spikeだけ進める意味ではない。
- Speed: .1/1/10/100。simulation時間と実時間の比の目標であり、数値積分や学習係数を変更しない。
- Reset: 同じconfig/seedから**別runId**の新個体をpausedで生成。旧runは途中ならcompleted/manual_resetとして最終保存。死亡済みrunは維持する。重みの引き継ぎは禁止。
- 終端runのRun/Stepは409。変更後のconfig/seedは新runを作る場合だけ受け付ける。
- タブを閉じても実験は時間上限または終端まで継続。再接続で最新状態を取得する。
- サーバー停止・再起動では実行再開しない。未終端runはinterruptedにして最終保存済み時刻を表示する。

1sliceは最大2,000 eventsまたは実時間8msの早い方でyieldし、未到達targetを保持して次のsliceで再開する。runtime自身は実時計を参照しない。サービス側のslice制限がイベント件数を決める。複数runはround-robin。目標速度が出なければ実効速度と遅延をUIに表示し、eventsを間引かない。

### 3.7 API・認証

既存のログインを再利用し、全APIに`requireAuth`、run所有者照合を適用する。別ユーザーのrunは404。認証方式自体は変更しない。

| Method / path | 入出力・責務 |
| --- | --- |
| POST `/api/experiments` | `{seed, scenario, configOverrides}` → 201 `{runId, status, resolvedConfig}` |
| GET `/api/experiments` | 所有者の一覧。cursor paging、limit既定20/最大100 |
| GET `/api/experiments/:id` | 保存済みconfig、状態、集約metrics。稼働中はruntime状態を優先 |
| POST `/api/experiments/:id/control` | `{commandId, expectedRevision, action, speed?}` → 状態、revision、simTime、新規reset時のrunId |
| GET `/api/experiments/:id/snapshot` | schemaVersion付き完全観察snapshot。終端runもDBから参照可 |
| GET `/api/experiments/:id/events` | SSE。接続時に完全snapshot、その後batch |
| GET `/api/experiments/:id/export` | config/seed/initial・final topology/checkpoint/metricsをJSON出力。復元用ファイルとは呼ばない |
| GET `/api/brain/:id/neurons/:neuronId` | 指定時刻の全項目と入出力edge一覧 |
| GET `/api/brain/:id/synapses/:synapseId` | trace、weight、age、usage、変化量。削除済みは404 |

制御commandはrunごとの直列queueで実行。commandIdはユーザー内で一意とし、DBにpayload hashと結果を保存する。同じID/同じ内容の再送は保存結果、違う内容は409。expectedRevision不一致も409。Resetの旧run更新、新run作成、command結果保存は単一transactionにする。

不正configは400、未認証401、存在なし404、不正状態409、runtime数上限429、保存失敗500。JSONサイズ上限64KiB、有限数検査、enumと範囲検査、未知のconfigキー拒否を行う。詳細エラーは既存`HttpError`のレスポンス形式に合わせる。

### 3.8 観測とSSE

batch envelopeは`schemaVersion, runId, sequence, simTimeMs, status, topologyVersion`を必須にする。sequenceはrun単位で単調増加。状態変更、spike集計、edge追加/削除/weight差分、body、modulator、action、homeostatic errorを分ける。

神経mapは全量初回snapshot＋差分。神経の状態、強いedge、新規edge等を再構成できる情報を送る。初期座標・typeは変更しない。強化/弱化filterには最終deltaと時刻、剪定候補filterには同じ判定規則によるflagを渡す。

実時間100msごとに最大1batch。pausedでもcontrol変更は即時通知。直近100 simulation msのactive edgeを標準表示。x100では表示の対象窓が飛ぶことを明示する。集約metricsの全件数は保持し、表示spikeのみ上限2,000件/batchで標本化し`droppedVisualEvents`を表示する。

クライアント送信待ち上限1MiB。超過時は接続を閉じ、再接続の完全snapshotで復旧させる。topology差分を黙って落とさない。Last-Event-IDからの全履歴再送はMVPでは実装せず、再接続は常にsnapshot置換。snapshot取得と購読開始を同一service操作内で実施し、その間の更新を欠落させない。

frontendはfetch streamでSSEを読む。既存の401 refresh transportを公開して再利用し、別の認証更新処理を作らない。UTF-8の分割、CRLF、複数data行、コメント、切断を処理する小さなparserを用意する。AbortControllerでunmount/logout/run切替を中断。401再認証失敗後は再接続を続けない。通常エラー時は1/2/4/8秒、最大10秒のbackoffで再接続する。

接続寿命は最大60秒とし再認証させる。10秒ごとにheartbeat、ユーザーごと最大2購読。サービス停止時は全streamを閉じてからHTTP drainへ進む。観察用bufferは直近60秒simulation/最大10,000 records、どちらかの上限で古いものを捨てる。全履歴は集約metricsとcheckpointで見る。

### 3.9 保存形式

追加テーブル案:

- `brain_experiments`: runId、ownerUserId、status、terminalReason、seed、engine/config version、resolvedConfig JSON、initialTopology JSON、finalSnapshot JSON、summaryMetrics JSON、revision、created/updatedAt。
- `brain_checkpoints`: runId、simTimeMs、snapshot JSON、metrics JSON。`(runId, simTimeMs)`をuniqueにする。
- `brain_commands`: ownerUserId、commandId、runId、payloadHash、response JSON、createdAt。再送によるReset重複を防ぐ。

定期snapshotは観察・分析用であり、event queueやPRNGの途中状態を省いた**再開不能なsnapshot**とする。初期topology、config、seed、versionから最初から再実行できる。死亡後の再開・継承には使用しない。

全書込は既存`dbRuntime.client.write.execute`。checkpoint/終端の書込はawaitし、遅いDBのために未保存snapshotを無限にためない。保存失敗はrunを停止してUIにfailed/persistence_errorを通知する。DB自体が使えずfailure状態も保存できない場合はログとメモリ状態に残し、再起動時はinterrupted扱いにする。

終端snapshotとmetricsとstatusは同じtransaction。checkpoint間のクラッシュでは最後の保存時刻までしか保証しないことを画面に表示する。プロセス起動時の未終端rowのinterrupted化はscheduler開始前に行う。

## 4. Terraが順に実装するタスク

各タスクは、列挙した対象とその直近のテストだけを変更する。通常1タスクずつ実施し、結果を`docs/brain-sandbox/progress.md`へ記録する。表の番号順で依存を満たす。大きいタスクは記載のa/b単位で区切れる。

### T00 — 企画の保存と実装前確認

- 依存: なし。
- 対象: `docs/brain-sandbox/concept.md`, `progress.md`。
- 作業: 保存済み`concept.md`と本計画を読む。progress.mdに本計画へのリンク、全タスクの未着手一覧を作る。branchと既存差分を記録する。`bun run verify`でbaselineを採取し、既存失敗と新規失敗を分ける。
- 完了条件: 正本となる企画書がrepo内にあり、開始点のcommitと既存差分・検証結果が記録されている。既存差分の解消を勝手に開始しない。

### T01 — Config・状態・DTOの契約

- 依存: T00。
- 対象: `api/brain/core/{types,config,neuron,synapse}.ts`, `shared/schemas/{brain,experiment,telemetry}.schema.ts`。
- 作業: 3章の型と制約、config解決、version、terminalReason、command/response、snapshot/batchの型を定義。内部型とwire型の変換責務を明示。DTO schemaから公開型を導出。
- 検証: 初期config、境界値、NaN/Infinity、負のdelay、予算矛盾、未知キーを拒否。JSON往復でschemaが一致。
- 完了条件: 後続担当が独自の別config型やbody型を作らず利用できる。runtime依存方向にHono/React/DBが入らない。

### T02 — 決定論PRNGとイベントqueue

- 依存: T01。
- 対象: `api/brain/runtime/{random,event-queue}.ts`。
- 作業: PRNG系列分離、min-heap、phase/sequence順、peek/pop/size、queue上限を実装。
- 検証: 固定seedの既知出力、系列間独立性、逆順投入、同時刻同phase、空queue、上限、100,000件の取り出し順。
- 完了条件: 全件sortをpopごとに行わず、同じ入力列は同じ順で返る。

### T03 — 固定topologyとnetwork操作

- 依存: T01,T02。
- 対象: `core/network.ts`, `topology/{generator,spatial-index,connection-policy}.ts`。
- 作業: 固定座標/type/role、距離減衰接続、incoming/outgoing index、追加/削除、予算検査。roleのID割当をsnapshotで説明可能にする。
- 検証: 1,000 neurons/20% inhibitory、最大outdegree、global budget、自己/重複edgeなし、削除後のindex整合、同seed一致。小規模fixtureでは手計算できるgraphを使用。
- 完了条件: snapshotを外から書き換えてnetworkが変わらない。nodeを追加/削除するAPIがない。

### T04 — 発火runtime

- 依存: T02,T03。
- 対象: `runtime/brain-runtime.ts`, `api/brain/index.ts`。
- 作業: 遅延膜電位、不応期、抑制、threshold crossing、伝播、slice継続、操作counter。学習・bodyはまだ組み込まない。
- 検証: 3neuronsの鎖で発火時刻/符号を検算。分割advanceと一括advanceの同一性。不応期、無入力、queue overflow、剪定された配送の無効化。
- 完了条件: 訪問ニューロン数がevent対象に限定される。初期configでsensory試験入力からmotorを含む活動が発生し、上限内で停止可能。値を調整した場合は根拠を記録。

### T05 — STDPとrewardによる更新

- 依存: T04。
- 対象: `plasticity/stdp.ts`, synapse trace、runtimeの局所hook。
- 作業: pre/post trace、eligibility、減衰、clamp、active eligibility集合、strategy切替。body未実装の段階ではテスト入力としてrewardを注入するだけ。
- 検証: pre→postとpost→preのeligibility符号、遅延reward、負reward、reward=0、範囲外weight防止、削除edgeの候補解除。
- 完了条件: 100ms後のrewardで該当経路だけが変わる。実験本体へ固定報酬が混入していない。

### T06 — Homeostasisと構造可塑性

- 依存: T05。
- 対象: `plasticity/{homeostasis,structural-plasticity}.ts`。
- 作業a: 発火率推定、閾値適応、modulated目標値、範囲制限。
- 作業b: 共活動記録、空間候補、剪定と生成、topologyVersion/delta。時間経過はsimulation時間のみ。
- 検証: 過活動/無活動で閾値の方向が正しい。近接共活動fixtureで生成、120秒未使用で剪定、満杯時の予算厳守、nodeの不変性。
- 完了条件: 数分分advanceでgraphは変わり、node数・位置・typeが変わらない。全node pair比較がない。

### T07 — Worldと身体相互作用

- 依存: T01,T02。
- 対象: `environment/{world,interaction}.ts`, `organism/{body-state,metabolism}.ts`。
- 作業: grid、entity配置/再配置、6行動の物理的結果、コスト、代謝、死亡。まだ神経からの行動選択は行わない。
- 検証: foodなしeat失敗、食料消費1回、shelter有無のrest差、mate cooldown、境界移動、危険、コストによる死亡、死亡後無作用、body範囲。
- 完了条件: 相互作用の結果はbody変化と成否であり、固定rewardや移動先の提案を返さない。

### T08 — Sensors・motor decoding・modulation

- 依存: T04,T07。
- 対象: `organism/{sensors,actuators}.ts`, `modulation/{modulator-state,modulator-runtime}.ts`。
- 作業: 12入力channel、感覚spike符号化、自発活動、motor window、身体差分からreward、4modulatorの有界な作用。
- 検証: agent回転で左右signalが入れ替わる。入力DTOに物体情報がない。全motorゼロで行動なし。同点の再現性。同じbody改善なら食事以外でも同reward。無改善のeatに正rewardがない。
- 完了条件: action決定コードがworldやhungerを直接参照せず、motor活動だけを受け取る。

### T09 — 閉ループexperimentとheadless入口

- 依存: T05,T06,T08。
- 対象: `experiment/{experiment,scenario,metrics}.ts`, `scripts/brain-experiment.ts`。
- 作業: イベントphase全体を統合。5scenario、終端条件、learningMode。CLI引数seed/scenario/duration/config/outputを検証し、summary JSONを出す。
- 検証: 同seedを二度実行し、最終topology/body/action列が一致。slice件数1/100/2,000で結果一致。死亡とtime_limit。別runの共有可変状態がない。
- 完了条件: HTTP/UIなしで1runが完走する。`bun scripts/brain-experiment.ts --scenario food --seed 1 --duration-ms 60000`が動作する。

### T10 — Snapshot・telemetry・記録buffer

- 依存: T09。
- 対象: `observation/{snapshot,telemetry,recorder}.ts`, DTO変換。
- 作業: 整合snapshot、batch/delta、age/traceの観察値、active edge、filter用metadata、bounded timeline、累積metrics。
- 検証: 観測なし/頻繁な観測で最終状態一致。topology差分再生で完全snapshot一致。buffer上限、表示spike省略と累積countの整合。
- 完了条件: A〜Fを調べる情報が欠けず、1spike=1外部messageにならない。

### T11 — DB追加と永続化adapter

- 依存: T10。
- 対象: `api/db/schema.ts`, 新migration/metadata, `modules/brain-sandbox/persistence.ts`。
- 作業a: テーブル/index/FK追加とschema生成。既存migration番号を確認して次番号を使用。
- 作業b: 作成、checkpoint、終端transaction、一覧、export、command冪等性、再起動interrupted処理。
- 検証: fresh DBと既存認証DBの両方へmigration。別所有者の読取不可。同時書込がsingle writerを通る。中途失敗rollback、重複checkpointとcommand、既存認証データ維持。
- 完了条件: 全spike保存がなく、保存件数上限が守られる。schema追加に応じ既存DB/readinessテストも更新する。

### T12 — 実行serviceとscheduler

- 依存: T09,T11。
- 対象: `modules/brain-sandbox/{service,scheduler}.ts`, `api/app/hono.ts`, `api/app/server.ts`。
- 作業a: run所有、状態遷移、操作直列化、command再送、resetと保存、runtime数上限。
- 作業b: 実時間slice、速度、round-robin、DB遅延、shutdown、global runtimeへの注入。既存テストのAppDeps fixtureを必要最小限更新。
- 検証: fake clockでrun/pause/step、全速度で同simulation時刻の結果一致、PauseとResetの競合、同commandの再送。停止後timerゼロ。DB close前の保存とstream終了。
- 完了条件: 4run実行時も制御要求が処理され、同じrunをtimer二重起動しない。保存失敗を成功レスポンスにしない。

### T13 — HTTP APIと認可

- 依存: T12。
- 対象: `routes/{experiment,brain}.route.ts`, `api/app/hono.ts`, shared schemas。
- 作業: 3.7のJSON APIと検証・認可・HttpError変換。SSE endpoint本体は次タスク。
- 検証: requestレベルで各正常系と400/401/404/409/429。別ユーザーで一覧・snapshot・inspector・export・controlが漏れない。Reset再送でrunが増えない。
- 完了条件: 既存`AppType`経由で型が利用できる。routeに学習やDB transactionの実装を埋め込まない。

### T14 — SSE配信と再同期

- 依存: T10,T13。
- 対象: `modules/brain-sandbox/stream.ts`, events endpoint。
- 作業: 接続snapshot、100ms batch、sequence、heartbeat、寿命、購読上限、backpressure、abort清掃。
- 検証: snapshotと最初のdeltaの間に取りこぼしなし。遅いsubscriberで切断、再接続後snapshot一致。認証失効後の再接続401。停止時にstreamがHTTP drainを妨げない。
- 完了条件: 1subscriberごとにsimulationを進めず、disconnect後のlistener/timerが残らない。

### T15 — UI導線・操作・観察store

- 依存: T13,T14。
- 対象: `web/src/api.ts`, brain-sandbox route/view, `controls/`, `observation-store.ts`, `use-telemetry.ts`, router/既存navigation。
- 作業a: 認証導線、run一覧/作成、scenario/seed、Run/Pause/Step/Reset/Speed、状態とエラー表示。
- 作業b: fetch SSE parser、再同期、所有者別query、Abort、store。Canvas用配列はref/storeで保持し、Reactへ毎spike配信しない。
- 検証: command中の多重click、409からの再取得、切断/401/再接続、古いrunの遅延batch無視、sequence重複、logout時の清掃。SSE parserはchunk分割を網羅。
- 完了条件: paused Stepで時刻が100ms進み、Reset後runIdが変わる。通信断をpausedと誤表示しない。

### T16 — World・body・modulator表示

- 依存: T15。
- 対象: `world/`, `organism/`, page layout。
- 作業: Canvas world、agent向き、4entity、legend、任意sensor範囲、body/modulator bar、alive/death理由、simulation時計と実効速度。
- 検証: fixtureの座標と描画位置、DPR/resize、モバイル横溢れ、色以外の凡例、pause時描画の安定。
- 完了条件: bodyやworldの変化が同じsnapshot時刻として表示される。Canvasとは別に状態のテキスト情報がある。

### T17 — Neural mapとinspector

- 依存: T16。
- 対象: `brain/`のCanvas layer、描画pure helper、inspector。
- 作業a: 固定座標、activity/potential/plasticity/modulator sensitivity表示、active/strong/strengthened/weakened/new/prune候補のedge filter、weightによる線幅。
- 作業b: 座標変換・hit test、neuron/synapse選択と全項目、incoming/outgoing。重なるedgeは候補一覧で選べる。Canvas選択に加えID入力でも選択可。
- 検証: panを実装する場合の座標整合、DPR、filterと時刻窓、剪定された選択の解除、incoming/outgoing正確性。描画呼出しmockだけに依存せずブラウザーで目視確認。
- 完了条件: neuron's type/potential/threshold/activity/sensitivity/last spike、synapseのweight/delay/usage/age/trace/deltaが取得できる。

### T18 — Timeline・metrics・保存結果の閲覧

- 依存: T11,T17。
- 対象: `timeline/`, metrics panel、履歴/export UI。
- 作業: 刺激→発火→行動→body→reward→weight/graph変化を同じsimTime軸へ表示。間引き件数を明示。checkpointから過去runのbody/集約値/最終graphを閲覧する。
- 検証: 既知fixtureで因果順、履歴とliveの区別、buffer上限、export schema、終端runの再読込、再起動後interrupted表示。
- 完了条件: 保存結果は読み取り専用。過去snapshot閲覧を過去時刻からの再学習と誤解させない。

### T19 — 実験プロトコルと比較実行

- 依存: T09,T18。
- 対象: `scripts/brain-experiment.ts`, `docs/brain-sandbox/experiment-protocol.md`, `results/`。
- 作業: 次章のseed群、対照条件、指標、実行時間を固定してCLIで実行。raw spikeではなく集約JSONと読める結果表を保存。仮説A〜Fを判定する。
- 検証: 学習禁止条件ではweight/graph/thresholdが不変。初期topologyが比較間で一致。2seedを再実行しsimulation結果の一致を確認。
- 完了条件: negative resultも報告。未達をハードコードや死亡後の継承で埋めない。

### T20 — 統合品質・性能・運用文書

- 依存: T19。
- 対象: E2E、必要な性能script、README/LLM_CONTEXT/運用文書、authless生成の除外規則とテスト。
- 作業a: 下記の最終検証と性能測定。既存認証・サンプル回帰を含む。
- 作業b: 起動、実験、限界、保存、失敗時の挙動を文書化。brain機能は認証依存のためauthless generatorでは新規brain/module/routes/schema/web/script/E2Eとbrain固有migrationを除外し、追加authless実装は作らない。元のgenerator契約を維持して生成物を検証する。
- 完了条件: 必須gate結果とA〜Fの判定が別々に記録され、未検証項目が成功扱いされない。

## 5. 実験方法と成功条件の証拠

### 5.1 段階的なscenario

| scenario | 固定する条件 | 主な観測 |
| --- | --- | --- |
| food | hunger=.6、近傍food、dangerなし、mate/shelterなし | food摂取回数、eat試行/成功、chemicalへの反応、恒常性誤差 |
| shelter | fatigue=.7、shelter、代謝維持用food、dangerなし | 疲労時のshelter滞在率、rest効率 |
| mating | matingDrive=.8、mate、food、dangerなし | signalとdrive別motor活動、mate成功 |
| competing | hunger/fatigue/matingDrive=.7、food/mate/shelter | 行動配分、各driveと誤差の推移 |
| risk | competingの配置にfood近傍dangerを追加 | 危険曝露、energy、空腹別行動配分 |

物体数・位置生成規則・再配置はscenarioごとにconfigへ解決して保存する。初期foodは正面隣接セルとするが、食べる・向かう行動は自動化しない。

### 5.2 比較条件

まずseed 1,2,3を各60秒simulationで動作確認。その後、事前固定したseed 1〜20を各最大30分simulationで、full/frozen/no_reward/no_structuralの4条件で実行する。5scenario全て同じ枠組みで行う。実行コストが大きい場合はfoodから順に行い、未実行scenarioを明記する。未実行をMVPの仮説検証完了とはしない。

同seedの各条件は同じ初期topology/world。以後の行動によりworldが異なることは許容する。独立PRNG系列で構造処理の有無がsensor noiseを直接ずらさないようにする。死亡は失敗データとして残し、新個体を同run内で補充しない。

C/Dの診断用コピーは生存中の状態から作るテスト専用の神経応答測定器であり、身体・環境の実行や学習を再開しない。膜電位・trace・時刻の初期化条件を固定し、同じ重み/閾値に既知入力を与える。永続snapshotからrunを復元するAPIは作らない。診断時点より前に死亡したseedは診断不能として記録する。

### 5.3 指標と判定

| 条件 | 必要な証拠と判定 |
| --- | --- |
| A 重みの変化 | active synapseのweight差分と原因eligibility/rewardが追跡できる。fixtureで方向・範囲を検算 |
| B topology変化 | 生成/剪定の両fixtureと実験の時系列count。nodeの不変性を同時に検証 |
| C 再現可能な局所pattern | 生存中checkpointから読み取り専用の診断用コピーを作り、学習停止・固定bodyで同一感覚列を3回入力。20ms binの発火vector一致と活動の局所性を測定。診断結果を生個体へ戻さない |
| D 内部状態による変化 | 同じcheckpoint・感覚列・noise seed、異なるbodyの診断コピーでmotor count/activityを比較。差がなければ未達 |
| E 行動傾向の獲得 | full対frozen/no_rewardでhomeostatic errorの時間積分、摂取成功/分、生存時間、eat成功率をseed対応で比較。前半/後半差だけでは学習と断定しない |
| F 追跡可能性 | 任意の成功eat/restについて、sensor、motor count、action結果、body改善、reward、eligibility、weight変化を画面/記録で同時刻系として説明できる |

Eの主指標は全seedの恒常性誤差の平均時間積分。死亡後は観測期間末まで最大誤差1として補完し、早死にの短いデータが有利にならないようにする。full−対照の対応差、中央値とbootstrap 95%区間を報告する（分析用乱数はsimulationと独立）。区間が改善方向に限定され、成功行動の副指標とも整合するとき「支持」とする。それ以外は未達/判定不能。これは初期の探索的検証であり、生物学的妥当性の証明ではない。

無発火、暴走、行動が出ない、rewardが発生しない、eligibilityが先に消える、可塑性はあるが行動が改善しない、の順で原因を切り分ける。変更前後のconfigを保存し、調整後は新たなseed 21〜40で再検証する。評価用の正解行動や診断fixtureは通常のruntimeへ接続しない。

## 6. 最終検証

文書作成時には以下を実行していない。コード実装後にTerraが実行して証拠を残す。

### 機能・回帰

1. タスク中の対象テストは`bun run test -- <対象.test.ts>`で局所確認する。
2. ソース変更の区切りで`bun run verify`を実行し、内包するtypecheck/lint/format/coverage/buildを重複実行しない。失敗時のみ個別工程で診断する。
3. 最終引渡しでは`bun run verify:e2e`を実行する。ログイン→作成→Run→Pause→Step→filter/inspector→Reset→履歴→export、再接続、死亡、モバイル表示を確認する。
4. `bun run audit`とfresh DB/既存DB migration、authless生成物の検証を行う。既存作業による失敗は根拠を添えて区別する。
5. 状態遷移・所有者照合・transaction・学習符号について、限定的な故障注入/ミューテーションでテストの検出力を確認する。例えば所有者条件削除、死亡判定反転、STDP符号反転を検出できること。注入変更は成果物へ残さない。
6. `docs/delivery-quality-gates.md`のsecurity-sensitive change条件を確認し、新規の認可・永続化APIに必要な診断を実施する。ツール不在はunavailableでありpassではない。

### 性能と上限

同一ホスト、同一build、1,000 neurons/最大20,000 synapses、1runと4run、SSE購読あり/なしで各3回測定し、ホスト・Bun version・config・seedを保存する。

| 観測 | 初期合格目標 |
| --- | --- |
| x1実効速度 | 60秒simulationで実効比>=.95、発火爆発がない通常config |
| Pause応答 | 通常負荷のp95が250ms以内 |
| slice | 自前schedulerの処理予算8msを監視。単一イベント/slow更新の超過を別計測 |
| UI | desktop 1,000 neuronsで中央値30fps以上を目標。低速端末では実測値と制約を記載 |
| queue/buffer | 設定上限を超えない。購読切替100回でlistener/timerが増加しない |
| メモリ | 同じ到達状態でrun作成/終了を繰り返し、終了runのnetworkがregistryに保持されない。保存前後のheap傾向も測る |
| x10/x100 | 選択可能で実効速度を表示。100倍達成自体は必須としない。結果の同一性は必須 |

slow処理やsnapshot生成がPauseを阻害する場合は、内部計算の分割と描画/送信の頻度を先に調整する。eventを捨てて速度を稼がない。Worker移行が必要だと実測で判明した場合は、その変更を別タスクとして本計画に追加する。

## 7. 引継ぎとタスク完了報告

Terraに渡す最初の指示例:

> `docs/brain-sandbox-implementation-plan.md`に従い、brain-sandboxブランチでT00から順番に実装してください。最初はT00〜T03を対象とし、それぞれの完了条件と検証結果をprogress.mdへ記録してください。既存の未コミット差分を維持し、行動のハードコード、品質閾値の引き下げ、別タスクへのメッセージ送信は行わないでください。先のタスクのUIやAPIを先回りして作らず、依存を満たした単位で進めてください。

各タスクの報告には「実装した契約」「変更ファイル」「実行した検証と結果」「残る制約」「次に着手できるタスク」を記載する。未実行テストは明示し、taskのcheckboxだけで完了を表さない。

本計画内で確定した配置・数値・責務は、そのまま実装の初期方針としてよい。局所的な命名やhelper分割は実装者が判断する。認証撤去、DB方式変更、新個体への学習継承、行動ルール追加、品質gate削除などは本計画の範囲外であり、通常の実装判断に含めない。

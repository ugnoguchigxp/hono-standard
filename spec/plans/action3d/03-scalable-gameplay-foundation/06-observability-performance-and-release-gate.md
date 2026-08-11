# Delivery A3-6: Observability, Performance Budgets, and Release Gate 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A3 |
| 状態 | Planned |
| 主対象 | Action3D telemetry port、runtime metrics、Playwright performance、build report、delivery docs |
| 依存 | Delivery A3-3、A3-4、A3-5完了 |

## 1. 目的

プレイヤーがどこで開始・離脱・失敗しているかと、どの端末でload/runtime/saveが失敗しているかを、gameplayへ影響を与えず観測できるようにする。同時に、現在は記録のみのdraw calls、mesh、resource、memory、long task予算を自動release gateへ昇格する。

## 2. Telemetry boundary

domainはvendor SDKをimportせず、application/runtimeが次のportへsemantic eventを渡す。

```text
Action3dTelemetry
└ capture(eventName, properties): void | Promise<void>

adapters
├ NoopAction3dTelemetry
├ BufferedBrowserAction3dTelemetry
└ provider adapter（採用時だけ）
```

最小event:

- `action3d_session_started`
- `action3d_world_entered`
- `action3d_combat_started`
- `action3d_combat_completed`
- `action3d_player_defeated`
- `action3d_checkpoint_saved`
- `action3d_save_conflict`
- `action3d_content_load_failed`
- `action3d_asset_fallback_used`
- `action3d_runtime_interrupted`
- `action3d_performance_degraded`

propertyはgame version、content version、world ID、enemy archetype ID、attack ID、duration bucket、device class、error codeに限定する。email、user ID、token、save payload、自由入力、完全なuser agentを送らない。

## 3. Performance and delivery budgets

CI referenceで次をassertする。

| 対象 | Gate |
| --- | ---: |
| Desktop p95 frame time | 20.5 ms以下 |
| Compact p95 frame time | 33.3 ms以下 |
| 50 ms超long task | 0 |
| Steady draw calls | 60/frame以下 |
| Steady active meshes | 100以下 |
| Action3D first-world runtime transfer | baseline + 15%以下 |
| Second-world pre-transition transfer | 0 bytes |
| Model import count | unique model asset数以下 |
| Save payload | 256 KiB以下 |
| Context retry / 10 world swaps | Canvas 1、listener/scene増加なし |

bundleはroute entry、Babylon runtime、shader/loader chunks、world assetsを分けてreportする。単一chunkの500 kB warningを無視せず、entrypointごとのgzip/Brotli/transfer budgetを設定する。

## 4. Implementation steps

1. event catalog、property allowlist、consent/disable policy、retention ownerを文書化する。
2. Noop/buffered telemetry adapterとdedupe/session IDを実装する。
3. domain semantic event、runtime failure、save application resultをtelemetryへ接続する。
4. telemetry failure、timeout、blocked requestがgameplayを止めないtestを追加する。
5. Playwright performance testでlong task、draw calls、meshes、resource、model import、heap deltaをassertする。
6. build manifest parserでroute/chunk/asset budgetを検証し、`verify`へ追加する。
7. 3、6、12 enemiesとworld往復10回のprofile artifactを保存する。
8. A1/A2の古いRepository gate記録を最新結果へ更新し、A3 implementation evidenceと継続判断ADRを作る。

## 5. Acceptance Criteria

- 同じdomain eventから同じtelemetry eventが一度だけ生成される。
- telemetry adapterがthrow/reject/offlineでもsimulation、render、saveが継続する。
- event property allowlistがPIIとsave payloadを型・testで拒否する。
- performance testがframe timeだけでなくlong task、draw calls、meshes、resource budgetを実際にassertする。
- second-world assetの早期fetch、同一GLBの重複import、world swap後のheap/mesh増加をGateが検出する。
- build warningをrelease logに残すだけでなく、設定したbudget超過でcommandが非0終了する。
- current target deviceの実機結果とCI reference値を区別して記録する。
- `bun run verify`と`bun run verify:e2e`が成功し、文書のStage状態が実結果と一致する。

## 6. Verification

```bash
bunx vitest run web/src/action3d/telemetry web/src/action3d/runtime shared/action3d
bun run validate:action3d-content
bun run validate:action3d-models
bun run build
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "performance|telemetry|bundle|lifecycle"
bun run verify
bun run verify:e2e
```

## 7. Release evidence

完了時に次を一つのA3 evidenceへまとめる。

- commit、content/save/manifest version、asset revision。
- unit/E2E/coverage/build結果。
- desktop/compact/target deviceの複数run値。
- route別bundle/resource report。
- world swap前後のmesh、heap、listener、model import数。
- V1→V2 migration、offline sync、409 conflict、別browser Continue結果。
- 第二attack/enemy/worldの実装工数と、platform/content作業の比率。
- 残課題、既知の例外、次Stageへ持ち越す予算。

## 8. Rollback

telemetry providerはNoop adapterへ即時切替可能にする。budget緩和は数値変更だけで行わず、計測artifactと期限付き例外を必要とする。A3 feature flagをOFFにしてもserver saveとmigration readerは維持し、新version payloadを破棄しない。

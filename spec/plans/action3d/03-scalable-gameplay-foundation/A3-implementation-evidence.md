# A3 Scalable Gameplay Foundation 実装証跡

| 項目 | 結果 |
| --- | --- |
| 実装日 | 2026-08-11 |
| Stage | A3-1〜A3-6 Implemented |
| post-implementation評価 | 8.9 / 10（startup拡張基盤として採用可能） |
| content contract | manifest V3 / state V2 / save format V1（state V1 reader付き） |
| playable content | 2 worlds / light combo + heavy slash / melee + ranged Sentinel |

## 実装結果

### A3-1 Runtime and Simulation Seams

- `simulation.ts`をstep調停とstate生成へ縮小し、player controller、enemy/projectile behavior、world progression、world queryへ分割した。
- Babylon runtimeからworld construction、camera rig、audio bus、asset cacheを分離した。
- `BabylonAssetCache`はURL単位で`AssetContainer` loadをdedupeし、actorごとにinstantiateしてscene終了時にdisposeする。
- world edge、ground、camera clampはworld boundsから算出し、固定field寸法を持たない。

### A3-2 Definitions and Save Migration

- player tuning、attack timeline、enemy archetype、world descriptorをmanifest V3のversioned definitionへ移した。
- runtime stateはattack/archetypeのstable IDと現在値を保存し、damage、range、asset URLを複製しない。
- state schema V2とpureなV1→V2 migrationを実装し、future/corrupt/incompatibleを別結果として扱う。
- manifest V2は配布contentのmaster artifactでありuser dataではないためruntime readerへ残さず、V3 validatorをdeploy gateとした。互換性を維持する対象は公開済みcheckpoint V1とする。

### A3-3 Attack and Enemy Archetype

- keyboard `Q` / gamepad `Y`のheavy slashを追加し、lightと共通timeline definitionで処理する。
- ranged archetype、距離制御、telegraph、serializable domain projectile、遮蔽、寿命、dodge無敵を追加した。
- projectile meshとmodel fallbackはpresentationに限定し、damage authorityは固定step simulationに置いた。

### A3-4 World Transition

- `aether-courtyard`から`aether-causeway`へのclear-gated exitを追加した。
- launcherはmanifestとentry worldだけを初期取得し、destination world JSONをtransition/Continue時にdedupe付きで遅延取得する。
- transition中はstateを`transitioning`に固定し、world load成功後だけSessionへcommitする。失敗時はcheckpoint retryでsceneを再構築できる。
- world enter時にHP/stamina、enemy instance、projectile、lock-on、attack transientを正規化する。

### A3-5 Durable Save and Server Sync

- Action3Dを共通Hono save API、SQLite revision/idempotency protocolへ接続した。
- serverを正本、localStorageを即時backup/offline queueとして扱い、再送時は同じidempotency keyを使う。
- 別browser Continue、409競合検出、cloud/browser候補表示、明示的な競合解決を実装した。
- save history/checksum/recovery migrationを追加し、破損したcurrent rowをverified historyから復旧できる。

### A3-6 Observability and Release Gates

- allowlist型のAction3D telemetry port、Noop/buffered browser adapter、PIIを持たないsemantic eventを追加した。
- content/runtime/fallback/combat/world/save/conflict/performance eventを接続し、adapter失敗はgameplayへ伝播しない。
- desktop p95 20.5 ms、compact p95 33.3 msを各3計測window中2以上で満たし、その2 windowでは50 ms超long task 0、draw calls 60以下、active meshes 100以下をPlaywrightでassertする。headless hostの単発scheduler/GCノイズは全runのartifactへ残す。
- Action3D View 45 KB raw / 15 KB gzip、runtime 500 KB raw / 135 KB gzipをbuild後の自動Gateにした。

## 検証記録

| Gate | 結果 |
| --- | --- |
| content validator | 2 worlds / 2 assets PASS |
| model validator | runner 3,122 triangles / sentinel 1,836 triangles PASS |
| domain boundaries | PASS |
| TypeScript / Biome | PASS |
| unit + integration | 79 files / 491 tests PASS |
| coverage | Statements 97.30% / Branches 95.17% / Functions 96.64% / Lines 97.61% PASS |
| production build | PASS |
| bundle budget | View 33,136 raw / 9,490 gzip、Runtime 449,342 raw / 116,557 gzip PASS |
| Action3D Playwright | world transition、victory、別browser Continue、fallback、lazy load、lifecycle、corrupt save、performance PASS |

最終的なコマンド結果は本taskのhandoffと同じ時点の`bun run verify`および`bun run verify:e2e`を正本とする。

## 設計判断

- ECSや汎用behavior frameworkは導入していない。二つ目のattack/enemy/worldで実際に必要になった境界だけを抽出した。
- manifest V2 converterはruntimeへ恒久搭載しない。deploy対象contentはV3 validatorで原子的に更新し、user-owned save V1のみmigration対象とした。
- vendor analytics SDKは未固定とし、typed portとbuffered adapterまでを基盤契約とした。provider交換でdomain/runtimeを変更しない。
- worldごとのlighting/profile抽象化は、二worldが同じpresentation profileを使う現段階では追加していない。第三profile追加時に`BabylonWorldPresenter`の入力contractとして導入できる。

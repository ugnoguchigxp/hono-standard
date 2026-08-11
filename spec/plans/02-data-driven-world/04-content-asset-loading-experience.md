# Delivery 4: Content and Asset Loading Experience 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Stage | Stage 2: Data-driven World |
| 状態 | Complete |
| 主対象 | `web/src/game/content`、`GameLauncher`、`GameScreen`、`BootScene` |
| 依存 | Delivery 1–3 |

## 1. 目的とプレイヤー価値

content JSONとassetを固定importではなくmanifestから読み込み、読込中、失敗、再試行をplayer-facingな正常系として扱う。壊れたcontentや画像欠落でCanvasが白くなる状態を防ぎ、Continue前にsaveとの互換性を判定する。

## 2. 満たす設計原則

- 9 Visual、UI、Audioの方向性
- 11.8 Failureを正常系として設計する
- 12.1 Reactの責務
- 12.2 Phaserの責務
- 13.2 Save
- 16.5 Reliability

## 3. 現状と問題

- `BootScene.preload()`がSignal Ruins画像URLを直接登録する。
- Phaser asset load失敗をReactへ通知するcontractがない。
- Game Session生成前にcontentを取得・検証する段階がない。
- Launcherはsave schemaを検証するが、saveのcontent versionが現在のbundleと利用可能か判定しない。
- loading、retry、content errorとstorage errorの表示責務が整理されていない。

## 4. Scope

- `GameContentLoader`をbrowser adapterとして実装し、manifest、documentsのfetch、parse、参照検証を行う。
- load stateを`loading | ready | failed`でReactへ公開し、AbortControllerとRetryを持たせる。
- `GameLauncher`はready registryを受け取って初めてSessionを生成する。
- saveの`contentVersion`とregistry versionを照合し、互換性不明のContinueを禁止する。
- `BootScene`はAsset DefinitionからPhaser loader queueを構築する。
- Phaserの`loaderror`を`GameScreen`へ通知し、Canvas外overlayにasset ID、再試行、Launcherへ戻る操作を表示する。
- 読込statusをscreen readerへ通知し、focusをRetryへ移す。
- 同一versionのcontent load promiseとasset loadをsession内で重複させない。

## 5. Non-goals

- Service Worker、offline-first、persistent asset cache
- remote CDN、signed URL、download progressのbyte精度表示
- hot reload中のSessionを維持したcontent差し替え
- content version間のlive migration
- asset streamingとmap chunking
- audio asset導入

## 6. UX flowとAcceptance Criteria

```text
/gameを開く
→ "Loading world…"
→ manifest/documentsを取得・検証
→ Launcherでsave互換性を確認
→ New / Continue
→ Phaserがmanifest assetをpreload
→ 成功: 対象Scene開始
→ 失敗: error overlay + Retry / Back to launcher
```

Acceptance Criteria:

- content読込中はprogress statusを表示し、New/Continueを操作できない。
- network、HTTP、JSON parse、schema、reference、asset loadを異なるerror codeとして保持する。
- user-facing文言は内部stackやlocal pathを露出しない。
- Retryで古いAbort済みrequestやPhaser instanceが残らない。
- content version不一致saveはContinueを表示せず、save自体は勝手に削除しない。
- asset一件欠落時にSceneを開始せず、欠落asset IDを開発用logへ残す。
- React StrictModeのmount/unmountでfetch、listener、Phaser instanceをcleanupする。

## 7. State・Command・Event・Content schemaへの影響

- Game StateとGame Session Commandは変更しない。
- loaderのruntime stateはsave対象外のReact stateとする。
- `ContentLoadError`は`network | http | parse | schema | reference | incompatible-version`を持つ。
- `AssetLoadError`はasset IDとretryable flagを持ち、URL全文はuser-facing stateへ保存しない。
- `GameScreen`は`registry`と`onRuntimeError`を受け取る。

## 8. Ownershipとsystem境界

- React: content fetch lifecycle、loading/error/retry UI、save互換性、Phaser再生成。
- Shared content module: parse、validation、registry。
- Phaser Boot: Phaser loaderへのasset登録と進捗eventの橋渡し。
- Game Session: validated registryだけを受け取り、networkやloading stateを知らない。
- Local save repository: save bytesの読書だけを担当し、content fetchを行わない。

## 9. 依存関係と導入順序

1. browser loaderとerror taxonomyを実装する。
2. React content boundaryとRetry testを追加する。
3. Launcher/Session生成をregistry ready後へ移す。
4. BootSceneの固定preloadをasset manifestへ置き換える。
5. Phaser→React error callbackとoverlayを追加する。
6. save content version互換性を統合する。
7. StrictMode cleanupとE2E failure routeを検証する。

## 10. Failure・recovery・security

- fetchへtimeoutを設け、無限loadingを防ぐ。
- retry回数はuser操作ごとに一回の新requestとし、自動無限retryをしない。
- manifestで許可済みのsame-origin URLだけをPhaserへ渡す。
- validation前のdocumentをregistry cacheへ保存しない。
- 失敗後は直前のlocal saveを変更せず、New Gameの上書きはplayerが明示選択した場合だけ行う。
- console logへauth情報、save本文、relationship等のplayer stateを出さない。

## 11. Unit・integration・E2E・visual検証

```bash
bunx vitest run web/src/game/content web/src/game
bun run validate:game-content
bun run verify
bun run verify:e2e
```

- unit: fetch成功、HTTP失敗、timeout、abort、invalid JSON、schema error、cache、retry。
- component: loading→ready、loading→error→retry→ready、unmount cleanup、save incompatibility。
- integration: asset manifestからPhaser loaderへ全画像が登録される。
- E2E: request interceptionでmanifest 500と画像404を発生させ、Retryで復旧する。
- visual: loading、content error、asset errorをdesktop/mobile幅で確認し、Canvasとoverlayの重なりを確認する。

## 12. Performanceとaccessibilityへの影響

- manifest/documentsは一度だけfetchし、同一contentVersionではpromiseを共有する。
- 初期経路に不要な将来mapの巨大assetはmanifest groupで分離できる構造にするが、先行実装はしない。
- loading statusは`role="status"`、errorは`role="alert"`、Retryはkeyboard focus可能にする。
- progress animationは文字情報を併記し、色やmotionだけに依存しない。

## 13. Rollout・削除する旧経路・完了条件

- 初めにcontent JSONだけをloaderへ移し、次にasset preloadを切り替える。
- `BootScene`の固定`this.load.image`列挙を削除する。
- GameScreenを直接起動するtest helperはregistry fixtureを必須に更新する。
- failure E2E、Retry後cleanup、既存New/Continue E2Eがすべて成功して完了とする。

## 14. 未決事項と採用しなかった代替案

- 採用: Reactがcontent fetch、Phaserがrenderer asset loadを所有する。各runtimeのerrorを適切なUIへ戻せる。
- 不採用: Phaser preloadだけでJSONも読む。save互換性をLauncher前に判定しにくい。
- 不採用: 全assetをVite static importにする。manifest validationとfailure UXを証明できない。
- 未決: productionでのcache header/hash命名はStage 8のhosting方針と合わせて決める。

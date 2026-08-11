# Delivery A1-1: Domain Boundary and Shared Platform Contract 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A1 |
| 状態 | Implemented / Gate pending |
| 主対象 | `shared/action3d`、`shared/game-platform`、`web/src/action3d`、`web/src/game-platform`、router、scripts |
| 依存 | 既存2D `/game`、auth route、GameScreen lifecycle |

## 1. 目的とプレイヤー価値

3D実装を始める前に、2D、Action3D、共有platformのownershipをsourceとtestで固定する。プレイヤー向けの見た目はAction3Dの保護routeと準備画面までだが、以後の3D変更が2D saveやplayable pathを暗黙に壊さない土台になる。

## 2. 現状と問題

- `shared/game`と`web/src/game`は一般名だが、実体はgrid field、Phaser Scene、command battleを持つ2D domainである。
- `GameScreen`のReact mount/unmount境界は3Dでも価値があるが、Phaser型と結合している。
- `LocalGameSaveRepository`はstorage adapterと2D save codec、2D key命名を一つに持つ。
- routeは`/game`一つで、別runtimeを遅延loadする境界がない。
- source間の禁止依存をCIで検出するcontractがない。

## 3. Scope

- `shared/action3d`と`web/src/action3d`のpublic entryを作り、空のdomain/runtimeでもownershipを確立する。
- `shared/game-platform`と`web/src/game-platform`を作り、共有可能な最小contractだけを置く。
- browser runtimeのmount、abort、disposeを表す`BrowserGameRuntime` contractとReact boundaryを抽出する。
- 既存Phaser runtimeを薄いadapterで新boundaryへ接続し、`destroy(true)`とerror UIの挙動を維持する。
- `/games/action-3d`のlogin-required routeと、runtime未導入を示すAction3D launcher placeholderを追加する。
- route componentはdynamic importし、Action3D moduleが2D routeのinitial graphへ入らないようにする。
- TypeScript ASTでimportを検査する`scripts/validate-domain-boundaries.ts`と`validate:domain-boundaries` scriptを追加し、`verify`へ組み込む。
- ownership matrixと例外をscript内のdataとして一元管理し、path文字列の散在を避ける。

最小runtime contract:

```text
BrowserGameRuntime
├ start(host, abortSignal): Promise<void>
├ resize(width, height, devicePixelRatio): void
└ dispose(): void
```

`dispose()`は複数回呼ばれても安全とし、start中のabortも正常な終了経路として扱う。

## 4. Non-goals

- Babylon package、Canvas、3D Sceneの導入
- 既存`shared/game`または`web/src/game`のrename/move
- Game State、Session、Story State、content registryの共通base class化
- 2D save key/envelopeの変更
- Action3D home導線の一般公開
- host分離、subdomain、別deployment

## 5. Sharing decision

このDeliveryで共有するのはruntime lifecycleと既存auth/app shellだけとする。

- 共有: auth user取得、login redirect、root layout、mount/abort/resize/dispose contract。
- 2Dに残す: `GameSession`、`GameState`、Phaser factory、2D runtime error内容、2D save codec。
- Action3Dに新設: Action3D entry、Action3D route UI、将来のruntime error分類。
- 保留: local slot storage、asset progress、settings。二つ目のconsumerが必要になるDelivery A1-5で判断する。

## 6. Implementation steps

1. 現在の2D unit/E2E、bundle chunk、localStorage keyをbaselineとして記録する。
2. shared/web platform directoryとpublic exportを追加する。
3. runtime lifecycle boundaryをfake runtimeでunit testする。
4. Phaser adapterを接続し、既存GameScreen testを維持する。
5. Action3D route、auth redirect、lazy moduleを追加する。
6. dependency matrix validatorとnegative fixtureを追加する。
7. validatorを`verify`へ追加し、2D smokeを再実行する。

## 7. Acceptance Criteria

- `/game`のroute、表示、login redirect、Phaser起動・終了が変更前と同じである。
- `/games/action-3d`は未login時に同routeをredirect先としてloginを促す。
- Action3D routeを開くまでAction3D moduleがnetwork取得されない。
- React StrictMode再mount、start中unmount、runtime error後retryの各経路でruntimeが一つだけ存在する。
- 2D runtimeはAction3Dをimportせず、Action3Dは2D domain/runtimeをimportしない。
- validatorのnegative fixtureが禁止importを検出し、対象fileとruleを表示する。
- 既存2D localStorage keyとsave dataを変更しない。

## 8. Verification

```bash
bunx vitest run web/src/game web/src/game-platform web/src/action3d
bun run validate:domain-boundaries
bun run typecheck
bun run build
bun run verify:e2e
```

build artifactとbrowser network logで、Homeと`/game`にAction3D chunkが混入していないことを確認する。禁止依存をexceptionで通す場合は、期限と削除Deliveryを計画書へ追加し、恒久wildcard exceptionを作らない。

## 9. 実装結果

- `shared/action3d`、`shared/game-platform`、`web/src/action3d`、`web/src/game-platform`を追加した。
- `/games/action-3d`をlogin-required routeとして追加し、Action3D viewをReact lazy importで別chunkへ分離した。
- 共通top barへAction3Dリンクを追加し、狭いviewportでもnavを折り返せるようにした。
- Phaserのmount、AbortSignal、disposeを`BrowserGameRuntime` contractへ接続し、StrictModeとstart failureをtestした。
- 2D/Action3D/shared platform間の禁止importをTypeScript ASTで検証する`validate:domain-boundaries`を追加した。
- 2D save keyは共有game IDを使うようにしたが、実際のkey文字列とsave codecは変更していない。
- 273 unit test、coverage threshold、typecheck、lint、production buildが成功した。
- production buildでAction3D viewは3.66 kB、gzip 1.10 kBの独立chunkとして出力された。
- public navigationとAction3D login/redirect/previewのPlaywright 2件が成功した。
- repository全体のformat gateは、このDeliveryで変更していない`BattleScene.ts`の既存整形差分で停止した。
- repository全体のE2E 5件中、Action3Dを含む4件は成功した。既存2DのSignal Warden自動戦闘はcommand budget超過が再現しており、2D変更を保全するため本Deliveryでは修正していない。

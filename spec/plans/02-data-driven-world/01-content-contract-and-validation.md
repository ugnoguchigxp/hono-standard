# Delivery 1: Content Contract and Validation 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Stage | Stage 2: Data-driven World |
| 状態 | Complete |
| 主対象 | `shared/game/content`、`web/public/game-content`、`scripts` |
| 依存 | Stage 1完了済み |

## 1. 目的とプレイヤー価値

map、event、assetを安全に追加できるcontent contractを先に固定する。直接の画面変化は小さいが、不正dataを実行時の白画面ではなく制作時に検出し、後続Deliveryで世界を増やせる土台にする。

## 2. 満たす設計原則

- 11.4 Serializableであることを優先する
- 11.6 データ駆動と安定ID
- 11.8 Failureを正常系として設計する
- 15 Content制作原則
- 16.1 Correctness

## 3. 現状と問題

- map寸法、壁、event tile、画像keyが`field-engine.ts`と`FieldScene.ts`へ埋め込まれている。
- dialogue、話者、event後のflag、encounter開始が`EventScene.ts`へ埋め込まれている。
- `BootScene`がasset URLを直接列挙し、欠落を事前検出できない。
- `GAME_CONTENT_VERSION`は存在するが、versionに対応するcontent bundleがない。
- ID重複、参照切れ、範囲外座標を検出する共通validatorがない。

## 4. Scope

- `ContentManifestV1`、`MapDefinitionV1`、`EventDefinitionV1`、`AssetDefinitionV1`のZod schemaを定義する。
- content documentは`web/public/game-content/<contentVersion>/`以下のJSONとする。
- raw documentを検証し、ID別read-only indexへ正規化する`GameContentRegistry`を実装する。
- syntax validationに加え、重複ID、参照切れ、座標範囲、到達不能event node、asset pathを検証する。
- `scripts/validate-game-content.ts`と`validate:game-content` scriptを追加し、`verify`のbuild前へ組み込む。
- 正常bundleと意図的に壊したfixtureを用意する。

最初のcontractは次を基準とする。

```text
ContentManifestV1
├ manifestVersion
├ contentVersion
├ entryPoint { mapId, entranceId }
├ documents { maps[], events[] }
└ assets[] { id, type, url }

MapDefinitionV1
├ id, displayName, width, height, tileSize
├ backgroundAssetId
├ entrances[]
├ collisionRegions[]
└ triggers[]

EventDefinitionV1
├ id, title, presentation
├ entryNodeId
└ nodes[]
```

## 5. Non-goals

- map移動ruleの差し替え
- Event interpreterとDialogue UI
- remote CDN、cache invalidation、差分download
- localization bundle
- Enemy、Ability、Itemのmaster data化
- authoring editorやJSON schema GUI

## 6. UX flowとAcceptance Criteria

このDeliveryでは既存playable pathを変更しない。開発者向けflowは次とする。

```text
content JSONを編集
→ validate:game-content
→ schemaと参照整合性を検証
→ 成功時だけtest/buildへ進む
```

Acceptance Criteria:

- 同じIDを持つmap、event、assetを拒否する。
- map外のentrance、collision、trigger座標を拒否する。
- 存在しないevent、map、entrance、assetへの参照を拒否する。
- event graphのentry欠落、node参照切れ、到達不能nodeを拒否する。
- `http:`、`https:`、`data:`、`..`を含むasset URLを拒否し、`/assets/game/`配下だけを許可する。
- validator errorはdocument pathとdata pathを含み、修正箇所を特定できる。
- registryの戻り値を利用側から変更できない。

## 7. State・Command・Event・Content schemaへの影響

- `GameState`とsave schemaはこのDeliveryでは変更しない。
- `GameSessionCommand`と`GameSessionEvent`は変更しない。
- `GameContentRegistry`は`contentVersion`、`entryPoint`、map/event/asset indexを公開する。
- runtime schemaとbuild validatorは同じparse・参照検証関数を使い、二重実装しない。
- Event nodeのdiscriminated unionはDelivery 3で実行する種類だけを先に定義し、未実装commandを予約しない。

## 8. Ownershipとsystem境界

- `shared/game/content`: schema、pure validation、registry、error型。
- `web/public/game-content`: serializableなcontent source。
- `scripts`: filesystemからbundleを読み、shared validatorを呼ぶbuild-time adapter。
- Phaser、React、Bun filesystem APIをshared validatorへ持ち込まない。

## 9. 依存関係と導入順序

1. stable IDと共通primitive schemaを定義する。
2. asset、map、event、manifest schemaを定義する。
3. cross-reference validatorとimmutable registryを実装する。
4. Signal Ruinsの初期JSONを追加するが、runtime consumerはまだ切り替えない。
5. validator CLI、fixture、unit testを追加する。
6. `verify`へvalidation stepを追加する。

既存コードとdataを並行配置し、このDeliveryでは旧経路を削除しない。

## 10. Failure・recovery・security

- validation errorは全件を集約して返し、最初の1件だけで終了しない。
- duplicate IDを後勝ちで上書きしない。
- asset URLはsame-originの固定prefixだけを許可し、任意URL取得やpath traversalを防ぐ。
- JSON sizeとcollection数に上限を設け、異常に大きいcontentを拒否する。
- runtimeで未検証dataを受け取った場合も例外型を統一し、Delivery 4のerror UIへ渡せるようにする。

## 11. Unit・integration・E2E・visual検証

```bash
bun run validate:game-content
bunx vitest run shared/game/content scripts/validate-game-content.test.ts
bun run typecheck
bun run verify
```

- unit: schema境界値、全cross-reference、URL制約、immutable snapshot。
- integration: public内の実bundleをfilesystemから読み、registry構築まで通す。
- negative fixture: duplicate、missing reference、out-of-bounds、未知node type、asset欠落。
- E2E/visual: runtime未切替のため、このDeliveryでは既存smokeの維持だけを確認する。

失敗時はvalidatorをskipせず、dataまたはcontractを修正する。type assertionで回避しない。

## 12. Performanceとaccessibilityへの影響

- registry構築はbundle読込時の一回だけとし、moveごとにZod parseしない。
- 座標、node、IDの上限をschemaへ持たせ、極端なdataによる停止を防ぐ。
- user-facing textはEvent Definitionに保持するが、表示速度や操作はDelivery 3で扱う。

## 13. Rollout・削除する旧経路・完了条件

- このDeliveryはparallel foundationであり、旧hard-codeを削除しない。
- `validate:game-content`が通常の`verify`で必ず実行されることを完了条件とする。
- public Signal Ruins bundleが全schemaと参照検証を通ることを完了条件とする。
- runtime切替前にregistry APIをexportし、Delivery 2と3の唯一のcontent入口にする。

## 14. 未決事項と採用しなかった代替案

- 採用: JSON source + Zod runtime validation。非開発者による編集と起動前検証を両立できる。
- 不採用: TypeScript objectだけをcontent sourceにする。compile時型検査だけではruntime取得失敗を検証できない。
- 不採用: Tiled等のeditor formatをそのままruntime schemaにする。現時点では変換層の維持費が大きい。
- 未決: localization keyへの分離はStage 5以降で別途判断し、今回は表示文言を直接保持する。

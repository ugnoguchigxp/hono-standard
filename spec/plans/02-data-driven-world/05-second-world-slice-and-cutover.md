# Delivery 5: Second World Slice and Cutover 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Stage | Stage 2: Data-driven World |
| 状態 | Complete |
| 主対象 | game content、original asset、Field/Event E2E、旧経路削除 |
| 依存 | Delivery 1–4 |

## 1. 目的とプレイヤー価値

二つ目の小規模mapと選択eventをコード分岐なしで追加し、Data-driven WorldがSignal Ruins専用の抽象化ではないことを証明する。プレイヤーは戦闘後にRelay Campへ進み、誰の判断を支持するかを選び、その結果が保存後の会話へ反映される。

## 2. 満たす設計原則

- 4.3 成功状態の探索→会話→戦闘→反応loop
- 5.1 世界を読む探索
- 5.2 人物関係が残る会話
- 6.3 群像劇の原則
- 11.6 二つの実例が現れるまで過剰抽象化しない
- 15 Content制作原則

## 3. 現状と問題

- Stage 2のruntimeをSignal Ruinsだけで終えると、固有値を別層へ移しただけか判断できない。
- Story FlagとRelationshipが後続contentへ影響する実例がない。
- asset manifestの複数map運用、map transition、入口復帰をend-to-endで証明するconsumerがない。
- 移行期間に残した旧hard-codeとcompatibility adapterを削除する最終地点が必要である。

## 4. Scope

- 小規模map `relay-camp` をMap Definitionとして追加する。
- Signal Ruinsクリアflagで有効になる出口から`relay-camp:ruins-gate`へ遷移する。
- Relay Camp専用のオリジナルpixel-art背景をasset manifestへ追加する。
- Mira、Sol、Luneの方針が分かれる短いchoice eventを追加する。
- choice結果で一つのStory Flagと少なくとも一組のRelationshipを変更する。
- choice後の別interactionで条件分岐した反応を表示し、選択の残存を可視化する。
- Relay Camp checkpointでautosaveし、reload後もmap、flag、relationship、反応を復元する。
- Stage 2移行用に残した旧map/event hard-codeと不要adapterを削除する。

## 5. Non-goals

- 長編scenario、quest log、複数chapter
- shop、inn、inventory reward
- 新規enemy、boss、Battle rule変更
- NPC自律移動、昼夜、天候
- 完成版character portrait、voice、BGM
- 三つ目以降のmap量産

## 6. UX flowとAcceptance Criteria

```text
Signal Ruins battle victory
→ cleared flagで北東出口が有効化
→ Relay Campへmap transition
→ camp eventで方針を選ぶ
→ flag + relationship更新
→ checkpoint autosave
→ reload / Continue
→ Relay Campから再開し、選択に応じた反応を表示
```

Acceptance Criteria:

- 二つ目のmap追加にPhaser Scene classやGame Session command typeの追加を必要としない。
- map間を往復して正しいentranceへ配置される。
- clear前は出口が無効で、clear後だけ利用できる。
- choiceは2つ以上あり、結果が異なるstable flag/relationshipへ反映される。
- reload後の条件付き台詞が選択結果と一致する。
- Relay Camp asset欠落をbuild validatorが検出する。
- Signal Ruinsの既存New Game→Battle→autosave flowが退行しない。

## 7. State・Command・Event・Content schemaへの影響

- 新しいschema variantやcommand typeは原則追加しない。追加が必要ならDelivery 1–4のcontract不足として先に修正する。
- 追加対象はMap Definition、Event Definition、Asset Definition、stable Story Flag/Relationship IDである。
- chapter/sceneの更新が必要な場合は既存`story` state commandを使い、Sceneから直接mutationしない。
- Relay Camp checkpointはstable IDで保存する。

## 8. Ownershipとsystem境界

- 新しい場所固有の座標、文言、条件、asset参照はcontent dataだけに置く。
- Sceneは`relay-camp`、event ID、flag IDを知らない。
- Game Sessionはgeneric commandを処理し、固有story分岐を持たない。
- background assetはproject内へ保存し、出典・生成方法・利用条件を追跡できるmetadataを残す。

## 9. 依存関係と導入順序

1. Relay Campの最小map、entrance、collision、checkpoint dataを追加する。
2. original background assetとmanifest entryを追加する。
3. Signal Ruins出口triggerと往復transitionを追加する。
4. choice eventと選択後reaction eventを追加する。
5. checkpoint/reload E2Eとvisual snapshotを追加する。
6. codebaseを固有ID、固定dialogue、固定asset keyで検索する。
7. migration用以外の旧hard-codeと未使用adapterを削除する。
8. Stage全体gateを実行し、計画書へ実装結果を記録する。

## 10. Failure・recovery・security

- map/event transition先の参照切れはbuildを失敗させる。
- conditionにより全choiceが消えるdataをvalidatorで拒否する。
- checkpoint直前にevent errorが起きた場合、直前のSignal Ruins saveを維持する。
- New Gameによる既存save上書きpolicyはStage 1から変更しない。
- 新assetは外部hotlinkせずrepository管理下へ置く。

## 11. Unit・integration・E2E・visual検証

```bash
bun run validate:game-content
bunx vitest run shared/game web/src/game
bun run verify
bun run verify:e2e
```

- unit: clear条件、往復entrance、choice両分岐、relationship境界、reaction条件。
- integration: Signal Ruins victory stateからRelay Camp checkpointまで同じSession IDを維持。
- E2E: New Game→Signal Ruins→Battle→Relay Camp→choice→save→reload→Continue→reaction。
- negative E2E: content/asset load失敗とRetry。
- visual: 320×192、整数scale 2/3、desktop/mobile shellで背景、collision整合、dialogue、choiceを目視確認する。

## 12. Performanceとaccessibilityへの影響

- 二map分の初期asset量とload時間を記録し、不要な重複loadがないことを確認する。
- map transition中にinputをlockし、二重transitionを防ぐ。
- choice、Retry、Continueをkeyboardだけで完遂できることを確認する。
- 新背景はparty、trigger、dialogue textのcontrastを損なわないpaletteにする。
- 点滅演出は既存flash強度を超えず、情報を点滅だけで伝えない。

## 13. Rollout・削除する旧経路・完了条件

削除対象を明示する。

- FieldSceneのSignal Ruins固有背景、label、marker座標。
- EventSceneの固定dialogue、title、actor配置、直接story/battle command。
- BootSceneの固定asset preload。
- Game Sessionの固有flag分岐。
- runtimeから参照されなくなった旧map定数とdemo event helper。

save migration tableとtest fixtureは履歴互換性のため削除しない。二つ目のmap/event追加、旧経路削除、full E2E、visual review、Stage計画書の実装結果記録が揃って完了とする。

## 14. 未決事項と採用しなかった代替案

- 採用: 二つ目のmapとchoice eventを一つの短いsliceにする。map、event、asset、saveをまとめて証明できる。
- 不採用: dialogueだけを二件目にする。map runtimeとasset manifestの再利用性を証明できない。
- 採用: 専用の小規模背景を作る。既存背景の色替えだけでは場所の記憶性が弱い。
- 未決: Relay Campの正式名称と台詞本文は実装時のcontent reviewで確定できるが、stable IDは`relay-camp`から変更しない。

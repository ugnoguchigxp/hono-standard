# Delivery A3-3: Second Attack and Enemy Archetype 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A3 |
| 状態 | Planned |
| 主対象 | Action3D gameplay definitions、simulation behavior、input、presentation、Aether Courtyard content |
| 依存 | Delivery A3-2完了、definition/save V2 |

## 1. 目的とプレイヤー価値

light comboとは判断が異なるheavy slashと、接近型Sentinelとは間合いが異なるranged Sentinelを追加する。数を増やすことではなく、第二の実例が既存moduleの条件分岐複製を要求しないことを証明する。

## 2. Gameplay target

### Heavy slash

- keyboard `Q`、gamepad `Y`を既定入力とし、logical action名は`attack-heavy`とする。
- light comboより長いstartup/recovery、広いarc、高damage、高stamina costを持つ。
- attack中の移動制限、dodgeとの排他、被弾staggerとの優先順位をdefinition/testで固定する。
- A2の既存`attack-3` clipを暫定presentationとして再利用できるが、logical attack IDとclip IDは同一視しない。

### Ranged Sentinel

- archetype IDは計画上`sentinel-ranger`とし、instance IDとは分ける。
- perception内で距離を取り、telegraph後にdomain projectileを生成する。
- projectileはposition、velocity、radius、owner、damage、lifetimeを持つserializable stateとする。
- Babylon meshはprojectile stateのpresentationであり、hit authorityにしない。
- line-of-sight遮断、dodge invulnerability、lifetime終了、owner defeatを処理する。

名称とvisual assetは実装開始時にcontent ownerが確定できるが、stable ID変更はsave fixture作成前に完了する。

## 3. Implementation steps

1. inputへ`attackHeavy` edgeを追加し、keyboard/gamepad/focus loss testを作る。
2. heavy attack definitionとattack selection ruleを追加する。
3. attack runtimeをlight/heavy共通timelineで進め、hit shape差分をdefinitionから解決する。
4. enemy behavior registryへmelee/rangedの二つのbehavior IDを登録する。
5. projectile state、step、collision、semantic eventをpure simulationへ追加する。
6. projectile、ranged telegraph、heavy trailをpresentation adapterへ追加する。
7. Aether Courtyardにranged instanceを一体配置し、既存3体戦闘のfixtureを別fixtureとして保持する。
8. keyboard/gamepad、低fps、複数projectile、遮蔽、retry、save normalizationをtestする。

## 4. Acceptance Criteria

- light/heavyは同じattack timeline処理を使い、attack IDごとの`if/switch`をsimulation orchestratorへ追加しない。
- melee/rangedはbehavior registryで解決し、world IDまたはinstance IDによるAI分岐を作らない。
- projectile結果が固定stepとdomain queryで決まり、render fpsやanimation callbackに依存しない。
- heavy attackはlight comboと明確なrisk/reward差を持ち、通常攻撃の完全上位互換にならない。
- ranged telegraph、projectile、被弾を色だけでなく形・動き・HUD eventで認識できる。
- projectile active中のcheckpoint作成ではsafe spawnへ正規化され、orphan projectileを復元しない。
- enemy model load失敗時もbehaviorと当たり判定は継続し、diagnostic fallbackで識別できる。
- 既存light combo/melee fixtureが変化しない。

## 5. Verification

```bash
bunx vitest run shared/action3d web/src/action3d/runtime/Action3dInputController.ts web/src/action3d/presentation
bun run validate:action3d-content
bun run validate:action3d-models
bun run typecheck
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "heavy|ranged|projectile"
```

visual reviewでは通常速度とcompact viewportでheavy startup、ranged telegraph、projectile進行方向を確認する。frame-by-frame captureだけで合格にしない。

## 6. Rollback

新archetype/attackはcontent flagで無効化できるようにする。flag OFF時にV2 stateやsave codecを戻さず、unknown definitionを生成しない。projectile presentationに問題がある場合はdiagnostic meshへ切り替え、domain projectileを旧AIへ混ぜて削除しない。

# Delivery A1-4: Action Combat Vertical Slice 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A1 |
| 状態 | Planned |
| 主対象 | `shared/action3d/combat`、`web/src/action3d/runtime/babylon` |
| 依存 | Delivery A1-3完了、controller、camera、static world query |

## 1. 目的とプレイヤー価値

敵1体に接近し、lock-on、通常攻撃、dodgeを使って撃破または敗北できる最小action combatを作る。effect量ではなく、入力、判定、damage、animation、camera feedbackが一貫した意味を持つことを優先する。

## 2. Scope

- player/enemyのHP、stagger、invulnerability、attack cooldown、combat phaseをAction3D domainへ追加する。
- 通常攻撃1系統の最大3段comboと、dodge中の限定invulnerability windowを定義する。
- attack startup、active、recoveryをsimulation timeで管理し、animation eventだけをauthorityにしない。
- `CombatWorldQuery` portでshape queryとline-of-sightを行い、stable entity IDの集合をdomainへ返す。
- 一つのenemy archetypeにidle、approach、wind-up、attack、recover、stagger、defeatedのfinite stateを実装する。
- target候補、距離、視界、画面方向からlock-on targetを選び、解除条件を定義する。
- semantic combat eventをanimation、VFX、SFX、camera shake、HUDへ変換するpresentation adapterを実装する。
- HP、target、stamina、pause/retry/exitをDOM HUDで表示し、Canvasだけに重要情報を閉じない。
- defeat時は最後のcheckpointからSessionを明示的に再構築し、途中stateを継ぎ足さない。

## 3. Combat event boundary

代表event:

```text
combat.attack-started
combat.hit-confirmed
combat.damage-applied
combat.dodge-started
combat.attack-avoided
combat.actor-staggered
combat.actor-defeated
combat.ended
```

VFXや音が失敗してもdamage結果を巻き戻さない。queryの重複targetは一つのactive window内で一度だけhit可能とし、render frame数で多段hitさせない。

## 4. Non-goals

- element reaction、ability、ultimate、weapon切替
- 複数enemy archetype、boss、flying enemy
- projectile、destructible object、loot、EXP
- animation cancelの高度な例外、frame-perfect counter
- server authority、anti-cheat、PvP
- 2D command battleとのrule共有または相互変換

## 5. Implementation steps

1. combat timing、damage、invulnerability、lock-on解除条件を数値fixtureとして定義する。
2. pure combat reducerとfake world queryによるtestを実装する。
3. enemy state machineとnavigationの最小steeringを実装する。
4. Babylon shape/visibility query adapterを接続する。
5. player/enemy animation、semantic VFX/SFX、camera feedbackを接続する。
6. DOM HUD、defeat、retry、victory flowを追加する。
7. input連打、低fps、重複hit、route離脱を含むintegration testを追加する。

## 6. Acceptance Criteria

- 同じ初期state、command列、query結果、seedからdamageと勝敗が再現できる。
- attack active window外ではhitせず、同じtargetへ一active windowで重複damageしない。
- dodge invulnerabilityの開始・終了がrender fpsやanimation clip速度で変わらない。
- enemy telegraphからdamageまでの状態が観察可能で、不可視の即時damageを発生させない。
- lock-on targetの消滅、遮蔽、距離超過、defeatで安全に解除する。
- VFX/SFX/animation failureがdomain transitionを二重適用しない。
- defeat→retryでHP、position、enemy stateがcheckpoint定義へ戻る。
- 2D battle engineと型、state、eventを共有しない。

## 7. Verification

```bash
bunx vitest run shared/action3d web/src/action3d
bun run validate:domain-boundaries
bun run typecheck
bun run test:e2e -- --grep "Action3D combat"
```

通常testに加え、hit deduplication、invulnerability boundary、enemy state transition、defeat retryにはmutation testのtriggerを評価する。visual確認ではtelegraph、target表示、HP変化を色以外でも識別できることを確認する。

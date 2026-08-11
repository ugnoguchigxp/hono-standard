# Delivery A1-3: Player Controller, Camera and Collision 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A1 |
| 状態 | Planned |
| 主対象 | `shared/action3d`、`web/src/action3d/input`、`web/src/action3d/runtime/babylon` |
| 依存 | Delivery A1-2完了、fixed clock、runtime diagnostics |

## 1. 目的とプレイヤー価値

小規模3D fieldを三人称視点で自由に移動し、jump、sprint、dodgeを一貫した入力とcameraで操作できる状態を作る。戦闘より先に、移動そのものが継続判断に値するかを検証する。

## 2. Scope

- Action3D専用Action Mapを定義する: `MOVE`、`LOOK`、`JUMP`、`SPRINT`、`DODGE`、`ATTACK`、`LOCK_ON`、`PAUSE`。
- keyboard/mouseとgamepadを同じAction valueへ変換し、DOM key名をdomainへ渡さない。
- pointer lockのrequest、拒否、解除、focus喪失を正常なUI stateとして扱う。
- plain dataのposition、velocity、yaw、grounded、locomotion、staminaをAction3D stateへ追加する。
- fixed-step kinematic controllerを実装し、加速、減速、gravity、slope limit、step height、jump、sprint、dodge cooldownを定義する。
- `ActionWorldQuery` portを介して静的worldへのsweep/ground queryを行い、Babylon object参照をdomainへ渡さない。
- Stage A1では静的collisionとkinematic playerだけを扱い、dynamic rigid bodyは導入しない。
- third-person camera rigを実装し、yaw/pitch、distance、camera collision、recentering、smoothingをpresentation側で管理する。
- licensedまたはproject-ownedの仮GLB characterを読み、idle/walk/run/jump/dodge clipをlocomotion eventへ対応させる。
- pause、tab非表示、pointer lock解除中はinputをneutralizeし、復帰時にstuck inputを残さない。

## 3. State ownership

Domain stateに置くもの:

- playerの論理position、velocity、yaw、grounded
- stamina、dodge cooldown、locomotion state
- inputから正規化したintentとsimulation結果

Presentationに閉じるもの:

- camera transformとshake
- mesh、skeleton、AnimationGroup、blend weight
- pointer lock、physical key/gamepad state
- interpolation用のprevious/current render transform

`ActionWorldQuery`はquery結果だけを返し、mesh IDではなくAction3D contentのstable collider IDを使う。

## 4. Non-goals

- climbing、swimming、gliding、wall run、mount
- moving platform、dynamic rigid body、ragdoll
- touch control、remapping UI、full settings screen
- network prediction、rollback
- combat hitbox、enemy collision、lock-on target選択
- animation root motionをsimulation authorityにすること

## 5. Implementation steps

1. reference操作値とtest field寸法をcontent-independent fixtureとして決める。
2. Action Map、input adapter、focus/pointer lock lifecycleを実装する。
3. kinematic state transitionをfake world queryでunit testする。
4. Babylon static collision adapterとtest arenaを接続する。
5. camera rig、camera collision、render interpolationを実装する。
6. GLB characterとanimation mappingを追加する。
7. keyboard/mouse、gamepad、低fps、tab復帰を実機確認する。

## 6. Acceptance Criteria

- keyboard/mouseとgamepadで同じAction3D command列を生成できる。
- 同じ初期state、input intent列、world query結果、fixed deltaから同じplayer transitionを得る。
- wall、floor、許容外slopeを通過せず、小段差と許容slopeを移動できる。
- jump、sprint、dodgeのstamina/cooldown境界がframe rateで変化しない。
- 30fps render時もsimulationが破綻せず、過大delta後にtunnelingや連続dodgeが発生しない。
- cameraがwallを貫通してplayerを見失わず、pitch/distance制限を守る。
- pointer lock拒否、Escape解除、tab復帰後に移動入力が残留しない。
- animation完了をGame State更新の唯一のtriggerにしない。

## 7. Verification

```bash
bunx vitest run shared/action3d web/src/action3d/input web/src/action3d/runtime
bun run validate:domain-boundaries
bun run typecheck
bun run test:e2e -- --grep "Action3D controller"
```

unit testはfps別の同値性、slope/step境界、stamina枯渇、dodge cooldown、focus喪失を含める。E2Eに加え、実機でmouse感度、camera酔い、gamepad dead zone、steady frame timeを記録する。

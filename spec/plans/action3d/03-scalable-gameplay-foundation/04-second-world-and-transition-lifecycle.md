# Delivery A3-4: Second World and Transition Lifecycle 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A3 |
| 状態 | Planned |
| 主対象 | Action3D world/content schema、content loader、Session、Babylon world presenter、save |
| 依存 | Delivery A3-2完了、runtime/asset lifecycle seam |

## 1. 目的とプレイヤー価値

Aether Courtyardのnorth gateから第二worldへ移動し、別のcheckpointまで進行・保存・再開できるようにする。複数worldをmanifestへ列挙できるだけでなく、load、transition、old world破棄、failure recoveryを一つのtransactionとして成立させる。

第二worldの計画上のIDは`aether-causeway`とする。最終名称はcontent制作開始前に確定し、save公開後は表示名だけを変更可能とする。

## 2. World contract

worldへ次を追加する。

- `assetDependencies`: world開始前に必要なmodel/texture/audio ID。
- `exits`: trigger bounds、destination world ID、spawn ID、condition ID。
- `encounters`: enemy instance集合とcompletion policy。
- `checkpointPolicy`: enter、combat clear、manual activationの許可。
- `presentationProfileId`: lighting、fog、sky、ground/prop setのstable profile。

Sessionは`playing`から直接world IDを書き換えず、次のphaseを持つ。

```text
playing
  → transition-requested
  → loading-world
  → playing(new world)

failure:
loading-world
  → transition-failed
  → retry loading / restore previous stable checkpoint
```

## 3. Loading policy

- manifestとglobal definitionはlauncherで読み、world documentと依存assetはworld単位でon-demand loadする。
- entry worldだけをNew Game前に準備し、第二world assetはexit開始までfetchしない。
- 同じworldへの再入場はcache policyに従うが、Babylon Scene objectをcontent registryへ保存しない。
- AbortSignalをworld JSON、asset load、scene buildの全段へ伝播する。
- transition commit前は旧worldを表示可能に保ち、新world build成功後に一度だけswapする。
- failure時は旧worldまたは最後のcheckpointへ戻り、半分生成されたactor/worldを破棄する。

## 4. Implementation steps

1. exit、destination、asset dependency、presentation profile schemaとreference validationを追加する。
2. registryをmanifest/global definitionとworld document resolverへ分ける。
3. Sessionへtransition command、phase、commit/abort結果を追加する。
4. content loaderへworld単位のdedupe、progress、abort、retry、cache invalidationを追加する。
5. world presenterへbuild/activate/dispose transactionを追加する。
6. `aether-causeway`の最小world、spawn、checkpoint、exit-backを追加する。
7. world移動時にenemy state、projectile、lock-on、camera、audioを正規化する。
8. transition中reload、JSON 503、GLB 404、abort、往復10回、ContinueをE2E化する。

## 5. Acceptance Criteria

- 第二world document/assetはnorth gate transition開始前にnetwork取得されない。
- destination world/spawn/profile/asset reference欠落をbuild validatorが拒否する。
- new world build成功前にcurrent locationとcheckpointをcommitしない。
- transition失敗後にRetryまたは旧checkpoint復帰を選べ、blank Canvasで停止しない。
- world往復10回後もCanvasは一つで、旧world mesh、actor、animation group、listenerが増加しない。
- arbitrary world boundsでground、edge、camera clamp、collisionが一致する。
- 第二world checkpointからreload/Continueすると正しいworld/spawnで開始する。
- world遷移に伴うpresentation完了callbackをsave authorityにしない。

## 6. Verification

```bash
bun run validate:action3d-content
bunx vitest run shared/action3d web/src/action3d/content web/src/action3d/runtime
bun run typecheck
bun run build
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "world transition|Aether Causeway|lazy world"
```

network traceにはresource URL、開始時刻、transfer sizeを残し、第二worldの先読みが発生した場合はperformanceが良好でも失敗とする。

## 7. Rollback

第二world entry flagをOFFにしてCourtyard victoryで従来どおり終了できるようにする。saveに第二worldが存在する場合は旧clientでCourtyardへ勝手に巻き戻さず、unsupported contentとして保持する。

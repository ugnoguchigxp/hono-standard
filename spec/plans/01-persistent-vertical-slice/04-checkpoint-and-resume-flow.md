# Delivery 4: Checkpoint and Resume Flow 実装計画

| 項目 | 内容 |
| --- | --- |
| 状態 | Complete |
| 主対象 | `web/src/game`、`web/src/views`、E2E |
| 依存 | Delivery 2、Delivery 3 |

## 目的

保存の存在と状態に応じてNew GameまたはContinueを選択でき、checkpoint到達時にautosaveし、browser reload後に同じ進行状態から再開できるUXを作る。

## Scope

- Game Launcher画面
- New Game開始時の初期checkpoint save
- Continueによるsnapshot復元
- checkpoint semantic eventを契機とするautosave
- 保存成功・失敗status
- corrupt／unsupported saveの明示とNew Gameによる復旧
- reloadを含むPlaywright E2E

## Non-goals

- Pause Menu内のSave画面
- manual save slot選択
- server save、account間同期
- save削除確認dialog

## Acceptance Criteria

- 保存なしではNew Gameを開始でき、Continueは表示されない。
- 正常saveがあればContinueを選択できる。
- checkpoint到達後にautosave statusが表示される。
- reload後にContinueが表示され、保存したcheckpointから開始する。
- corrupt／unsupported saveは理由を示し、Continueを許可しない。
- React StrictModeでもPhaser instanceとSession subscriptionが残らない。

## 検証

```bash
bunx vitest run web/src/game web/src/views
bun run verify
bun run verify:e2e
```

## 実装結果

- `GameLauncher`にNew Game、正常saveがある場合のContinue、保存状態と読込エラーの表示を実装した。
- New Game開始時に初期checkpointを保存し、`checkpoint.reached` semantic eventだけをautosave契機にした。
- legacy saveをContinueした場合は現行formatへ更新し、更新失敗も画面へ通知する。
- corruptまたはunsupported saveではContinueを表示せず、New Gameによる復旧経路を維持する。
- React StrictModeでPhaser instanceとSession subscriptionがcleanupされることをcomponent testで確認した。
- PlaywrightでNew Game、Field、Event、Battle勝利、autosave、reload、Continue後のfield checkpoint復元を確認した。

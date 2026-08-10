# Delivery 3: Local Save and Migration 実装計画

| 項目 | 内容 |
| --- | --- |
| 状態 | Complete |
| 主対象 | `shared/game`、`web/src/game/save` |
| 依存 | Delivery 1、Delivery 2 |

## 目的

Game Stateをversion付きautosave snapshotとしてbrowser storageへ保存し、正常、旧version、破損、非対応versionを区別して読み込めるようにする。

## Scope

- 現行Game Stateのruntime validation schema
- Game Save envelopeとformat version
- legacy Game State v1から現行versionへのmigration
- JSON parse失敗、schema不整合、未知versionの分類
- userごとにkeyを分離するlocalStorage repository
- 保存時刻とautosave slot

## Non-goals

- server save API
- 複数manual save slot
- cloud同期と競合解決
- active Battle中のautosave

## Acceptance Criteria

- 現行stateを保存して同値に復元できる。
- legacy v1 saveが現行Game Stateへmigrationされる。
- 破損JSONとschema不整合を`corrupt`として返す。
- 未知format/state versionを`unsupported`として返す。
- user Aとuser Bのsaveが混在しない。
- storage書き込み失敗を呼び出し元へ返す。

## 検証

```bash
bunx vitest run shared/game web/src/game/save
bun run test:coverage
```

## 実装結果

- 現行Game Stateを検証するZod schemaとversion付きsave envelopeを`shared/game`へ実装した。
- 現行saveのround-trip、legacy Game State v1からv2へのmigration、破損JSON、schema不整合、未知versionの分類を実装した。
- `LocalGameSaveRepository`がログインuser単位のautosave keyを使用し、load、save、clearとstorage例外の結果を返す。
- save codecとbrowser repositoryの正常系、migration、失敗系をunit testで検証した。
- server save、cloud同期、複数slotは後続Stageの範囲として維持した。

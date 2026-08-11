# ADR-A1: Browser Action3D基盤の継続判断

| 項目 | 内容 |
| --- | --- |
| 日付 | 2026-08-11 |
| 状態 | Accepted for Action3D / Repository gate pending |
| Decision | `continue-web` |
| 対象 | Action3D Stage A1完了後の次Delivery |

## Context

既存2D RPGを維持したまま、Canvas/WebGL2で三人称3D actionを作れるか、またUnity等へ早期移行すべきかを判断する必要があった。判断材料は単なるdebug worldではなく、domain分離、asset/content workflow、controller/camera/collision、combat、save/reload、failure recovery、route bundle分離、性能の一続きの証拠とした。

## Decision

次の小規模DeliveryもWeb基盤を継続する。Babylon.jsは`web/src/action3d`内のpresentation adapterに留め、gameplay authorityは`shared/action3d`のserializable fixed-step stateに置く。WebGPUやfull physics engineを前提化せず、WebGL2 fallbackとkinematic world queryを基準にする。

継続の根拠:

1. production Chromiumの6回計測でmedian 16.6–16.7 ms、p95 17.4–18.3 msとなり、A1のdesktop 20 ms / compact 33.3 ms暫定予算内だった。
2. move/combat/checkpointのfull pathとfailure pathが実WebGL E2Eで再現でき、10回のmount/unmount後もCanvas重複がなかった。
3. Action3D runtime、GLB、Phaserがlaunch単位で分離され、Action3D追加のために2D rule/save/contentを変更する必要がない。
4. content schema、CLI validator、project-owned GLB generator、fallbackにより、最小asset workflowをrepository内で再現できる。
5. controller、collision、combo、AI、saveはrenderer非依存のunit testで変更でき、Babylon objectがdomainへ漏れていない。

## Consequences

- [A2 Character & Combat Presentation](../02-character-combat-presentation/README.md)は新しいgameplay機能を増やさず、player/enemy/animation/combat feedback/field artの品質改善へ限定し、A1のperformance/lifecycle testを継続gateにする。
- Action3D専用domain/content/save ownershipを維持し、2Dとの共通化は同じfailure/lifecycleを持つplatform contractだけにする。
- scene作成は当面code + validated JSONで行う。artistの制作量が増える前に、DCC→glTF→manifest検証の所要時間を再測定する。
- headless reference値は回帰gateには使えるが、市販mobile端末の出荷保証には使わない。target device確定時に実機profileを追加する。

## Unity等を再評価するtrigger

次のいずれかが具体要件になった時は、content量産前に`re-evaluate-engine` ADRを作る。

- native mobile/console配布、app store/console certificationが必須になる。
- 大規模terrain streaming、dynamic rigid-body、ragdoll、cloth、vehicleがcore loopになる。
- 複数characterの高度なanimation graph、cinematic timeline、visual scripting、artist向けlevel editorが制作の律速になる。
- target実機でp95 budgetを満たせず、asset/quality最適化後もbrowser/runtime制約が支配的である。
- Babylon adapterや独自toolingの保守時間が、game content制作時間を継続的に上回る。

現時点ではこれらはA1のNon-goalsであり、確認済みの小規模field actionに対してUnity移行コストを先に負う根拠はない。

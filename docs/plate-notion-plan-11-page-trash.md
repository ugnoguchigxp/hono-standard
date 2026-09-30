# 実装計画 11: ページのゴミ箱と復元

状態: 未実装。2026-09-30 に設計書のみ作成。12・13は本書の作業に含めない。

## 目的・コンセプトとの対応

本人のページを子孫ごと通常の一覧から取り除き、誤操作した場合は保存内容を失わず復元できるようにする。[全体コンセプト](./plate-notion-concept.md)の段階2「ページ移動・複製・ゴミ箱」と、体験の中心の「サイドバーから…削除できる」を具体化する。[要件対応表](./plate-notion-requirements-coverage.md)の11候補に対応する。

コンセプトの「移動・削除…はサーバー側で認可し、子ページ…への影響を明示的に扱う」に従い、削除対象を確認後に同一トランザクションで検証・更新する。「内容を黙って破棄しない」に従い、未保存内容がある状態では開始せず、本文JSONを物理削除しない。将来のデータベース行への影響は段階3で設計する。

## 範囲と非目標

- 対象: 選択中の本人の未削除ページと、その時点で有効な子孫をゴミ箱へ移す。削除操作単位の一覧・復元。復元先は本人の有効ページまたは最上位。
- 復元は削除操作の全メンバーをまとめて行う。削除単位の内部から1ページだけ抜き出して復元しない。
- 対象外: 完全削除、ゴミ箱を空にする、自動期限削除、未保存下書きの保存、ゴミ箱内の本文編集・改名・移動・複製、共有、DB行、ファイル削除、AI、履歴本文の復元。

削除・復元の保持期限は設けない。本文とIDを保持するゴミ箱復元であり、任意時点の本文履歴の復元ではない。

## 既存実装・01〜10との接点

設計調査の作業ツリーは `codex/plate-notion-app`。前回確認HEADは `7fdf0e45e7087608e18b80945f31d43eed86d209`。未コミットの実装があり、09/10は隔離コピーで実装中との依頼情報を優先する。本書はそれらの完成を宣言しない。

| 計画・コード | 既存契約と11の接点 |
| --- | --- |
| 01、`api/db/schema.ts` | pages.deletedAtあり。通常一覧/取得/更新が未削除条件を使う。削除単位・復元APIはない |
| 02、page-tree / pages-view | 階層・選択URL・同名識別を維持。削除した枝を一覧から外す |
| 03/04 | Plate JSONを正本として保持。ノード移行やID再生成をしない |
| 04/05/06 | revisionと失敗・競合・離脱保護を利用。削除/復元の境界で旧本文PUTを拒否する |
| 07 | 一時ノード・スラッシュ保存制御は変更しない |
| 08 | タイトル/本文の単一guard集約に削除・復元中の状態を加える |
| 09 | 移動と削除を同じwriter境界で直列化し、循環・認可検証を再利用 |
| 10 | 複製先は独立ページ。操作記録とRESTRICT参照を保持し、削除済みコピーの再送は既存409を維持 |

09/10の統合済み成果物のschema・migration・共通API実装を受け取ってから11を実装する。隔離コピーの未統合migration番号を推測して固定しない。今回変更するのは新しい本設計書だけ。

## 削除単位の規則

例: A→B→C、A→D の階層で、BとCを先にゴミ箱へ移した場合、後からAを削除する単位はAとDだけ。B/Cの削除単位・deletedAtは変更しない。Aを復元してもB/Cは削除状態のまま。B/Cは別途復元し、Aが有効なら元の配下、Aが削除中なら利用者が最上位等を選ぶ。

通常の有効ページは、有効かつ同一所有者の祖先を持つことを不変条件とする。削除済みページは元parentIdを保持できる。削除中のparentIdを通常のツリーへ表示しない。

メンバーは削除確認時の有効子孫。走査はvisited Setを使い、別所有者の子・循環・有効子が削除済み中間祖先の下に存在する等の破損を検出したら500、書込みなし。所有者でfilterして他所有者の子を黙って無視するだけの実装にしない。内部ログのみに整合性の原因を記録し、他人のタイトル・IDを応答へ出さない。

操作上限は1単位500ページ。超える場合はプレビュー時/送信時に413で拒否し、部分削除・部分復元しない。ページ数に応じて後続で見直せるが、実装者が黙って切り詰めない。

## UI 契約

### ゴミ箱へ移す

1. サイドバーの選択ページ操作に「ゴミ箱へ移す」を追加。未選択、未保存・保存失敗・本文競合、タイトル/本文送信中、移動・複製中では無効。「変更を保存するか取り消してから操作してください」と説明する。
2. プレビューを取得し、元タイトル、有効子孫を含む対象件数、一覧、既に別単位で削除されたページは含まないことを確認ダイアログへ表示。プレビューが取得できなければ確認ボタンを有効にしない。
3. 確認中は元本文・タイトル編集を停止。スナップショットを固定し、送信直前にもguardを確認。操作requestIdは最初の確認送信で一度生成する。
4. 確認ボタン「ゴミ箱へ移す」、取消「キャンセル」。送信中は取消・Escape・二重送信を無効にし、ページ切替・ログアウト・beforeunloadを保護する。送信前はEscapeとフォーカス復帰を利用可能にする。
5. 成功後は対象詳細キャッシュを除き、通常一覧とゴミ箱を更新し、`/pages` の未選択画面へ移動。「ゴミ箱へ移しました」を表示。自動的な即時復元や未保存の破棄はしない。
6. 削除成功と一覧取得/画面遷移失敗を分ける。成功済みPOSTを新requestIdで再送せず、GETや遷移だけ再試行する。

### ゴミ箱と復元

`/pages/trash` にゴミ箱画面を追加し、サイドバーに「ゴミ箱」を置く。動的ページIDより静的trashルートを優先し、認証対象にする。ページ選択画面からの移動は既存未保存確認を通す。

一覧は現在未復元の削除単位だけを、deletedAt降順・同時刻batchId昇順で表示。元ルートタイトル、削除日時、対象件数を出す。単位を開くとメンバーのタイトル・元parentIdに基づく階層を表示する。通常本文エディタは表示しない。同名単位は削除日時とIDの識別ラベルで区別する。

「復元する」で確認ダイアログを開き、元の親が現在有効なら初期選択。元が最上位なら最上位(null)を初期選択。それ以外は未選択にして「元の場所を利用できません。復元先を選んでください」と表示する。最上位(null)を必ず選べるようにし、勝手に最上位へ変更しない。自分の有効ページだけを候補にする。

送信中は他単位の復元も開始させない。成功後は単位を一覧から除き、通常一覧を再取得し、「復元しました」と元ルートページを開くボタンを表示する。勝手に別画面へ遷移しない。復元先の祖先を展開し、同じページIDでGET/編集を再開する。

全ダイアログに見出し・ラベル・aria-modal・フォーカス保持を付ける。既存確認部品が送信中でもEscapeを許す場合は、呼び出し側で送信中の取消を抑止する。セッション・対象ID変更後の旧結果で新画面へ遷移しない。

## API・共有スキーマ

すべて本人の認証配下。既存GET/PATCH/本文PUT/move/duplicateは削除済みページへの新規操作を404で拒否し続ける。通常Page型へ削除履歴を混ぜず、ゴミ箱用schemaを別にする。

| 操作 | 入力 | 成功 |
| --- | --- | --- |
| `GET /api/pages/:id/trash-preview` | URLのUUID | `200 { root: PageSummary, pages: PageSummary[], count: number, previewToken: string }` |
| `POST /api/pages/:id/trash` | `{ requestId: UUID, previewToken: string }` | `200 { batchId: UUID, rootPageId: UUID, pageIds: UUID[], deletedAt: ISO日時 }` |
| `GET /api/pages/trash` | なし | `200 { batches: [{ batchId, rootPageId, title, deletedAt, count }] }` |
| `GET /api/pages/trash/:batchId` | batchId UUID | `200 { batchId, rootPageId, deletedAt, originalParentId, pages: [{ id, parentId, title }], count }` |
| `POST /api/pages/trash/:batchId/restore` | `{ requestId: UUID, parentId: UUIDまたはnull }` | `200 { batchId, rootPageId, pageIds: UUID[], parentId, restoredAt: ISO日時 }` |

countはpages/pageIdsと一致。配列はcreatedAt/ID順で固定し、rootが含まれる。日時は既存ISO UTC方式。previewTokenは小文字16進SHA-256の64文字、requestId/IDはUUID。POST入力は全フィールド必須のstrict object、ownerIdや任意pageIdsは拒否。GETレスポンスとPOST/409も共有Zodで検証する。

trash/restoreの成功応答には `replayed: boolean` を追加する。初回はfalse、操作記録を返す再送はtrue。保存結果は元操作の完了を示し、現在も削除/復元状態であることを保証しない。再送成功時は通常一覧・trash一覧・対象詳細をGETして現在状態を確認し、古い結果だけでキャッシュ除去や画面遷移を行わない。保存済みresult_jsonのスキーマも検証する。trash単位詳細GETは本人の未復元単位のみ返し、復元済みは404とする。

プレビューtokenは秘密鍵や認可tokenではない。本人の対象をトランザクション内で再検証するための状態比較値。削除対象各ページのID/title/parentId/本文revisionをID順の固定形式にし、SHA-256を計算する。deletedAt・現在の削除単位も走査判定に含める。新しい子、移動、改名、本文更新、子の別削除を検出する。GETで本人のページ・本文revisionを整合した一つの読み取りスナップショットとして取得する。read clientでtransactionが使えない場合は単一SQL等の整合した取得、または書込みをしないwriter transactionを利用し、複数読取の途中で混ざったpreviewを作らない。

静的 `/trash` と `/trash/:batchId` は既存 `/:id` のUUID検証ルートより前に登録する。クライアントルートも同じ衝突をテストする。

### エラー

| 条件 | 応答・UI |
| --- | --- |
| 未ログイン / 不正入力 | 既存401 / 400、書込みなし |
| 他人/不存在のページ・単位・復元先 | 同じ404 Not found。別ユーザーの存在を漏らさない |
| 新規削除で既に削除済み | 404。同じ成功済みrequestIdなら保存した結果を返す |
| previewTokenと最新状態が不一致 | 409 `{ code: "TRASH_PREVIEW_CONFLICT", message: "Page tree changed" }`。再プレビューと再確認を要求し、自動で対象を増減しない |
| 復元済み単位を別requestIdで復元 | 409 `{ code: "TRASH_BATCH_RESTORED", message: "Trash batch already restored" }`。一覧を更新。同じ成功済みrequestIdなら元の成功結果 |
| requestIdを違う操作/対象/入力に再利用 | 409 `{ code: "PAGE_LIFECYCLE_REQUEST_CONFLICT", message: "Page lifecycle request conflict" }` |
| 本文revisionを安全に増やせない | 409 `{ code: "CONTENT_REVISION_LIMIT", message: "Content revision limit reached" }`。部分変更なし |
| 対象500ページ超 | 413 `{ message: "Page operation exceeds limit" }`。部分処理なし |
| 復元先の循環・自単位を指定 | 409 `{ code: "INVALID_PAGE_HIERARCHY", message: "Invalid page hierarchy" }` |
| 参照・batch所属・本文欠落等の破損、DB失敗 | 500。全体ロールバック、情報漏えいなし |

復元先が削除された場合は404で止め、明示再取得・再選択を行う。自分の削除単位に含まれるページの指定は409として先に分類する。message文字列ではなくstatusと検証済みcodeで分岐する。

通信失敗/応答紛失では入力とrequestIdを保持して「再試行」。同じrequestIdで送信し、自動retryしない。500で失敗が確認された場合も同じキーで安全に再試行できる。競合後の新プレビュー/復元先変更は利用者の新確認を経て新requestIdを使う。

## DBモデル・保持するデータ

既存pages.deletedAtを使い、現在の削除単位を表す nullable `trash_batch_id` をpagesへ追加する。deletedAtとtrashBatchIdは両方nullまたは両方非nullというCHECK制約を設ける。

| テーブル | 列・制約 |
| --- | --- |
| `page_trash_batches` | id UUID PK、owner_id users参照、root_page_id pages参照RESTRICT、deleted_at必須、restored_at nullable、restore_parent_id nullable。rootとownerの整合性はサービスで検証 |
| `page_trash_members` | batch_id batches参照RESTRICT、page_id pages参照RESTRICT、original_parent_id nullable、original_revision必須。batch_id/page_id複合PK。元親は履歴IDとして保持し、完全削除後も記録を失わないよう元親へのFKは付けない |
| `page_lifecycle_requests` | owner_id users参照、request_id UUID、action trash/restore、target_id UUID、input_json、result_json、created_at。owner_id/request_id複合PK。targetはaction別の履歴IDで多態FKは付けない |
| `pages`追加列 | trash_batch_id nullable、batches.id参照RESTRICT。owner_id/deleted_at、trash_batch_idに索引 |

page_trash_batchesにowner_id/restored_at/deleted_at、membersにpage_idの索引。既存page_duplicate_requestsとそのFK/記録は維持する。操作履歴は無期限保持し、完全削除・退会時の参照整理は後続。

trashはpagesのdeletedAt/trashBatchId/updatedAtだけを変更する。restoreはそれらを元へ戻し、ルートparentIdだけを選択先へ変更する。内部メンバーのparentIdは保存時のまま。title、ownerId、createdAt、本文JSON、ブロックIDは常に保持する。

**本文revisionは削除時と復元時に各1増やす。** 本文JSONは不変だが、状態遷移前に送信された遅延PUTが復元直後に同じrevisionで成功することを防ぐ。page_contents.updatedAtも各遷移時に更新する。元revisionと同じ値へ戻さない。上限はNumber.MAX_SAFE_INTEGER、増分前に全メンバーを検査する。previewTokenには遷移前revisionを使う。これは04の「古いrevisionを上書きしない」を削除境界へ拡張する仕様であり、本文JSONの変更ではない。

## 削除・復元のサービス処理

各処理は `client.write.execute()` 内の同一transactionで、DB取得・認可・競合・全変更・操作結果保存を行う。外側で走査し、内側で無条件更新する実装にしない。

### trashPageTree(ownerId, pageId, input)

1. ownerId/requestIdの操作記録を確認。action・target・正規化入力が一致すれば保存結果を返し、新規削除しない。不一致409。復元後の旧削除リクエストも再削除せず元結果を返す。
2. 未削除の本人rootを取得し、有効子孫を走査。既削除枝は別batch整合性を確認し、メンバーへ加えない。500ページ上限・祖先/子孫整合性・本文レコード・revision上限を検証。
3. 最新tokenを算出して入力と比較。不一致409で書込みなし。
4. 新batchを作成。元parentId/revisionをmembersへ保存。各対象のowner・未削除条件付きでdeletedAt/trashBatchId/updatedAtを更新し、本文revisionを1増やす。各更新件数が想定と一致することを確認。
5. resultを操作記録へ保存。同じキーの競合はrollbackして既存記録を再確認し、二重batchを残さない。

### restoreTrashBatch(ownerId, batchId, input)

1. 同様に操作記録を先に確認。一致する成功済みrestoreは保存結果を返し、再復元しない。再削除後に届いた旧restoreでも再復元しない。
2. 本人batchが未復元か確認し、全membersを取得。pagesのdeletedAt/trashBatchIdが全員このbatchを指すこと、root存在、内部親参照と所有者・非循環、本文・revision上限を確認。不一致は500、部分復元しない。
3. 復元先nullまたは有効な本人ページを検証。祖先をvisited Setで走査し、batchメンバー到達は409、他の破損は500。元親が削除中だからといって暗黙にnullを選ばない。
4. root.parentIdを入力先へ変更し、全membersのdeletedAt/trashBatchIdをnull、updatedAtを更新。本文revisionを各1増やす。batch.restoredAt/restoreParentIdを更新し、操作結果を保存。
5. 更新件数・batch状態を検証してcommit。members・batch・操作記録は履歴として残し、次の削除時は新batchに所属できる。

動作例: 本文revision3のページを削除すると4、復元すると5。削除前revision3のPUTは削除中404、復元後409。復元後のGETは5を返し、通常保存で6へ進む。

並行操作はtransactionで直列化する。子作成や移動で削除対象の集合・状態が変われば削除preview不一致、削除が先なら削除対象への新規操作404。10の通常複製は同じ親に兄弟を作るため、対象枝の外ならpreviewを変えずコピーは残る。対象枝の子を複製して枝内に新ページを作ればpreview不一致。本文更新が先ならpreview不一致、削除が先ならPUT404。復元が先の旧previewはrevision変化で再削除されない。

## キャッシュ・別タブ・遅延応答

query keyは通常一覧/詳細を維持し、ゴミ箱は `['pages', userId, 'trash', 'list']` と `['pages', userId, 'trash', 'detail', batchId]`。setSessionUserのpages配下cancel/removeに含める。

trash成功時はpageIdsの詳細GETをcancel/removeし、通常一覧から対象IDだけを除いてinvalidateする。復元時は通常一覧とtrash一覧/単位をinvalidateし、復元ページ詳細は新GETで取得する。成功応答から本文revisionを推測したキャッシュを生成しない。古い応答が後から削除前の詳細を復活させないよう、実装時点のセッション・操作世代の境界を利用する。

guardは08〜10と同じ一箇所で `saving = bodySaving || titleSaving || movePending || duplicatePending || trashPending || restorePending`。trashは詳細画面の集約点、restoreはtrash画面の集約点で登録し、両画面を同時にmountしてguardを上書きしない。本文保存制御にはbody固有の状態を渡す。成功後の離脱はpending解除後に行う。

別タブで削除され、本文PUTが404になった場合は本文下書きを維持し、自動保存を停止して「ページがゴミ箱へ移されたか、利用できなくなりました」と表示する。404だけから削除と断定しない。GET失敗で下書きを空にしたり、エディタを無条件にunmountしない。ゴミ箱への移動・離脱は既存破棄確認を通し、復元して続ける場合も最新GETのrevisionを確認し、古い下書きを自動送信しない。利用者が確認して再編集・明示保存する。

一覧再取得後に選択IDが一覧から消えても、未保存下書きがある場合は一覧からの欠落だけで画面を破棄しない。下書きの永久保存・強制終了後復元はこの計画に含めない。

タイトルPATCHは08の既存last-write-wins契約を維持する。削除中は404だが、削除前に遅延したPATCHが復元後に実行されることを厳密に区別できない。このmetadataの履歴競合検出は残る制約として明示し、本文revisionの保証と混同しない。

## migration・安全なデータ保持

09/10の統合後、最新journalから新migrationを生成する。既存migration/snapshotは変更しない。SQLiteでCHECK/FK追加のためpages再構築が必要なら、pages・page_contents・10の操作記録の全行/本文/IDを保持し、参照先と外部キーを確認する。新テーブルのroot_page_idとpages.trash_batch_idは相互参照だが、batch作成後にpagesへ設定できる順序とする。

通常は既存deletedAtが全null。既存deletedAt非nullの行があれば、その意味を推測してbatchへ混ぜない。migration前チェックで検出し、通常適用を停止する。既存データの出所と復元単位が不明なため、承認された個別移行方針が必要。deletedAtを消して勝手に復活させない。

空一時DB、01〜10適用済み一時DBの両方でmigrationを検証。件数・内容比較、`PRAGMA foreign_key_check`、CHECK制約、元/コピー双方の本文保持を確認。検証は一時DBだけで行い、開発/本番DBを削除・再作成しない。適用済み環境の差し戻しはバックアップと別migrationで行い、削除済みページや履歴を捨てて戻さない。

## 変更対象と実装順序

1. 09/10統合結果と既存修正の最新状態、HEAD/差分、schema/migration、guard・セッション管理を読む。対象の変更前typecheck/test結果を記録する。
2. `shared/schemas/page-trash.schema.ts`（新規）にpreview/trash/list/detail/restoreと409契約を定義し、同名testを追加。既存Page契約を維持する。
3. `api/db/schema.ts`・schema testと新migrationへ削除単位・所属・操作記録を追加し、上記移行検証を行う。DBexportも必要な新テーブルだけ登録。
4. `api/modules/pages/page-trash.service.ts`（新規候補）にfactoryを置き、既存client/writerを注入する。既存pages serviceと共通の認可・階層検証を局所的に再利用。globalsや別writerを作らない。
5. `api/routes/pages.route.ts` または同配下のtrash routeへ静的/動的APIを登録。schema・app依存注入・route mockを更新し、既存認証・CORSを変更しない。
6. `web/src/api.ts`、api.test/api-hooks.testへ通信・再送記録・キャッシュ・セッション境界を追加。
7. trash-confirm-dialog/trash-viewとテスト、`routes/page-trash-route.tsx`、router/route-accessとテスト、stylesを追加。既存未保存確認と404本文保持を接続する。
8. 削除/復元・並行操作・遅延PUT・ユーザー切替を検証し、対象テストから全体gateとブラウザー導線へ進む。

## 必須テストと受け入れ基準

| ケース | 合格条件 |
| --- | --- |
| root/子/孫の削除 | 一つのbatchで対象を非表示、通常GET/PATCH/PUT/move/新duplicateは404 |
| 削除後の永続状態 | 本文JSON・ブロックID・タイトル・親参照保持、revision各+1、物理削除0件 |
| 先に子を削除、後から親を削除 | 別batch維持。親復元で先の子を復元しない |
| 元親へ/別親へ/最上位へ復元 | 同じID/本文、内部親参照保持、revisionさらに+1、通常編集再開 |
| 元親が削除中 | 明示選択を要求、暗黙fallbackなし |
| root/子孫改名・移動・本文更新・新子作成 | preview不一致409、対象を勝手に追加/除外しない |
| 削除と作成/移動/複製/本文PUT並行 | writer順序に従い、孤立有効ページ・部分削除なし |
| 他人/削除先/不存在、未ログイン | 404/401、書込み/情報漏えいなし |
| 不正入力・token・余分なキー | 400、書込みなし |
| 同じrequestId再送/再起動後/並行 | 一度だけ状態遷移、同じ保存結果。キー入力違い409 |
| restore後の旧trash、再trash後の旧restore再送 | 保存結果だけ返し、再削除・再復元しない |
| 復元済みbatchへの新restore | 409。別batchや現在状態を変えない |
| 10のコピーを削除/復元後にduplicate再送 | 削除中は10の利用不可409、復元後は同コピーID。元から再コピーしない |
| 旧revisionPUTが復元後に到着 | 409、復元JSONを変更しない |
| 子の所有者混在・循環・所属不一致・本文欠落 | 500、無限走査/部分処理なし |
| 500件と501件、revision上限 | 500件は処理可能、501件413、上限409。全体を保持 |
| DB更新途中・記録保存失敗 | rollbackでpages/content/batch/members/requestに部分更新なし |
| 未保存タイトル/本文・保存中 | 削除開始不可、下書き保持 |
| 別タブ削除によるPUT404/一覧欠落 | 自動送信停止、下書きは画面に保持、離脱は確認 |
| 成功後GET/遷移だけ失敗 | 状態遷移成功を保持、GET/遷移だけ再試行 |
| キャッシュ・セッション切替・遅延GET | 削除済みの旧詳細や前ユーザーのtrashを復活させない |
| migration | 本文/ID/10操作記録保持、FK正常、非null旧deletedAtは安全に停止 |

実DBは既存の一時SQLite・実migration・ユーザーA/B・Hono app.request方式。レスポンスだけでなく、pages/page_contents/batches/members/requests/10操作記録の前後を比較する。破損fixtureは一時DBに限定。UIはTesting Library、遅延Promise、fake timerで404と復元を再現する。

実装後に対象test、01〜10回帰、`bun run typecheck`、`bun run lint`、`bun run format:check`、`bun run build:web`、`bun run verify`、`git diff --check`、`bun run verify:e2e`。ブラウザーで作成→保存→削除→再読込→復元→本文再保存を確認する。フォーカス・Escape・モバイル・同名識別も確認する。

[品質契約](./delivery-quality-gates.md)に従い、認可・token比較・所属条件・rollback・revision増分を外した局所的変異がテストで検出されることを確認。500件・深い階層の走査とwriter占有時間を測定し、製品予算と照合する。未実行はpass扱いにせず記録する。

## 並行作業・未決事項・完了報告

09/10は隔離実装中のため、そのコピーを編集・起動・検証しない。11実装者は統合後に重複するschema/service/route/api/guardを確認し、移動・複製・既存不具合修正を再実装しない。本書にある11固有の削除/復元境界だけ追加する。

未決事項は、完全削除と退会時のFK/操作履歴整理、保管容量と期限、将来のDB行・メディアの削除/復元、metadataの厳密な世代競合、製品向け性能予算。今回は物理削除なし・無期限保持・500ページ上限・削除単位の全体復元で固定。旧deletedAt非nullデータがあれば個別移行判断が必要であり、ブロッカーとして報告する。

実装完了は全体コンセプトの全機能完了を意味しない。報告にはAPI契約、削除/復元単位、本文保持・revision境界、migration、09/10との統合、テスト結果、未実行と残存制約を記載する。本設計書作成ではコード・設定・既存文書・DB変更・コミット・push・12/13作成を行わない。

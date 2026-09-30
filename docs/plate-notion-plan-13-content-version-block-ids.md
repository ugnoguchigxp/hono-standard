# 実装計画 13: 本文形式の版管理と安定ブロックID

状態: 未実装。2026-09-30 に設計書のみ作成。14以降には着手しない。

## 目的とコンセプトへの対応

保存済み本文を将来のブロック追加・Plate更新・ページリンク・コメントで安全に扱うため、本文形式の版とブロックの識別規則を固定する。[全体コンセプト](./plate-notion-concept.md)の「ページ ID とブロック ID を安定させる」「JSON スキーマのバージョン管理と…保存済み本文をどう移行するか」、[要件対応表](./plate-notion-requirements-coverage.md)の13候補に対応する。

本文を独自の文字列へ変換せずPlateのノード配列を正本として維持する。版管理はPlateパッケージのversion番号と分け、アプリの保存契約として管理する。新規ブロック・リンク・コメント・履歴・共同編集の機能自体は追加しない。

## 範囲と非目標

対象は、保存/APIのformatVersion、既存p/h1/h2の必須ID・ページ内一意性、編集操作によるID維持、コピーによる新ID、旧データの明示移行、未対応版の拒否・下書き保護。

リスト等の新型、ネスト拡張、Markdown変換、リンク/コメント参照、ブロック履歴・削除IDの墓標、リアルタイム共同編集、オフライン、Plate/Reactの依存更新は対象外。ページIDはUUIDのまま変更しない。JSON外形を配列から独自エンベロープへ変えない。

## 現在の実装と01〜12の接点

作業ツリーは `codex/plate-notion-app`、先行HEADは `7fdf0e45e7087608e18b80945f31d43eed86d209`。並行実装があるため着手時の最新成果物を読む。今回テスト・DB変更は行っていない。

| 実装・計画 | 現状と13の境界 |
| --- | --- |
| 01、pages.schema / DB | 初期本文はIDなし段落、value_jsonとrevisionあり。formatVersionなし |
| 03/04 | p/h1/h2、text、bold/italic。ブロックidは10文字の任意属性。重複・必須化は未定義 |
| 05/06 | 保存スナップショット・revision制御を維持し、送信/読取のformatVersionを加える |
| 07 | SlashPluginと一時ノードの保存停止あり。13でも一時ノードを送信しない |
| 08/09 | 改名・移動は本文JSON・ID・formatVersionを変えない |
| 10 | 独立コピーの全ブロックは新ID、revision=0。13では対応版も保存する |
| 11 | 削除/復元はJSON/ID/版を保持。revision各+1の境界を維持する |
| 12 | タイトルだけの検索は本文テーブル/版を読まず、検索cursorも変更しない |

調査時の本文PUT成功schemaにはcontentに加えて `page: { id, updatedAt }` がある。13の版追加でこの最新契約を落とさず、古い計画04の例だけに戻さない。現在の依存はplatejs 53.3.14、basic-nodes/slash-command 53.0.0。ローカル型定義にはNodeIdPlugin、idCreator、filterText/filterInline、normalizeInitialValue等があるが、実装時にその版の実挙動をテストして設定する。

09/10隔離実装と11/12の成果物を統合してから共通schema/service/API/エディタを変更する。状態ラベルやファイル存在だけで各実装を完了とみなさない。

## 本文形式の定義

- formatVersion=0: 現在の保存本文。p/h1/h2のみ、10文字IDは任意、同一ページの重複IDがあり得る。0は内部の旧データ識別専用。
- formatVersion=1: 同じノード配列・許可型・leaf属性。各トップレベルブロックのid必須、`^[A-Za-z0-9_-]{10}$`、ページ内一意。新規保存/作成は1のみ。
- アプリの公開APIは導入完了後1だけを読取・書込する。未対応の正整数版を検出して旧版扱いへfallbackしない。

text leafとslashの一時ノードには永続ブロックIDを追加しない。今回は平坦なトップレベルブロックだけに必須化する。今後のネスト型は新しい版の契約で識別対象と深さを決める。

ブロックの参照キーは `(pageId, blockId)`。全ページを跨ぐID一意性は要求しない。10のコピーは参照の意味を引き継がないため元ページと異なるIDにする。

1000ブロック、1ブロック200leaf、1leaf100000文字、value配列のJSON UTF-8で1MiBの既存上限を維持。ID追加で超過した場合は移行を拒否し、本文を切り詰めない。サイズ基準は配列のみとし、API envelopeのformatVersion分を本文上限へ勝手に加算しない。

## 編集・IDライフサイクル

| 操作 | ID規則 |
| --- | --- |
| GET/再読込・親再render・フォーカス・選択変更 | 保存IDをそのまま使用。再生成・PUTなし |
| 文字編集、bold/italic、p↔h1/h2、slashで変換 | 同じブロックIDを維持 |
| 新段落、分割 | 元ブロック側（先頭側）は元ID、後続の新ブロックは新ID |
| 結合 | 先頭/結合先ブロックのIDを保持、消える側のIDは終了 |
| ブロック順序移動・cutで同ページ内へ移動 | 同じIDを維持。ただし同じIDの元ブロックを残すコピー操作とは区別 |
| 複製・コピー/ペースト | コピー側の各ブロックに新ID。HTML/内部clipboardの元IDを流用しない |
| 別ページへcut/paste | 新ページ側で新ID。元の参照は自動移設しない |
| undo/redo | 同じ操作で作ったIDを再利用。undoのたびに生成しない。復元時の重複がないことを検証 |
| 10ページ複製 | 全ブロック新ID、元ID集合と重複なし。コピー内部でも一意 |
| 11削除/復元・09移動 | 元IDを保持。JSONを再正規化して変更しない |

ID生成は暗号学的な乱数を使い10文字許可集合を満たす。生成時に現在ページのID集合を確認し、衝突時は再生成。関数をテストで注入可能にし、衝突の再試行を検証する。追加ライブラリは不要。

PlateのNodeIdPlugin等を必要なblock型へ限定し、text/inline/一時ノードを対象外にする。既に有効なIDを通常normalizeで書き換えない。コピー境界・split/merge・undoの実値を確認し、プラグイン既定値だけで保証されない操作は局所adapterで扱う。毎onChangeで配列全体のIDを作り直す処理は禁止。

新ID付与はエディタの可視操作の一部として先に完了し、その同じJSONをonChange/保存へ渡す。PUT直前だけIDを付けた別JSONを送らない。slash一時値には既存07のholdを維持し、クリーンな値が確定してから検証・保存へ渡す。

## UI・API契約

通常画面に技術的なformatVersion選択欄は追加しない。読取成功後のsupported valueだけをエディタへ渡す。未対応版/不正本文を空段落へ置き換えず、エディタを開始できないエラーと再取得手段を表示する。

本文GETとPUT成功のcontentは `{ formatVersion: 1, revision, value }`。PUT入力は必須の `{ formatVersion: 1, revision, value }`。既存ルート・revisionの意味・成功応答のpage.updatedAtを維持する。共有schemaとすべてのfixture/mockを更新し、本文版情報を持たない入力は受け付けない。

| 条件 | 応答/扱い |
| --- | --- |
| 新規作成/コピー | contentは1、必須ID付き、revision=0 |
| 本文PUT成功 | 版1維持、revision+1。サーバーはIDを再生成しない |
| ID欠落・形式不正・ページ内重複・未知属性/型 | 400 Invalid request、書込みなし |
| formatVersion欠落/非整数/負数等 | 400 `{ code: "CONTENT_FORMAT_REQUIRED", message: "Content format version is required or invalid" }` |
| 対応していない整数版（0を含む） | 409 `{ code: "CONTENT_FORMAT_UNSUPPORTED", message: "Content format is unsupported", supportedFormatVersions: [1] }` |
| 永続データに未移行0・将来版が残る | 認可後の本文GET/新規コピーで同じ未対応版409。GETで書換えない |
| 永続版1のJSON不正・ID重複・欠落、列とJSONの不整合 | 500 Internal server error、本文内容は応答/ログへ出さない |
| 古いrevision | 既存409 Content revision conflictとcurrentRevisionを維持 |
| 他人/削除済み | 既存404。版/revision/本文を漏らさない |

版の入力判定を通常本文Zod検証より先に分類するが、認証は先に適用する。PUTではサービスが本人の有効ページを確認してからDB版・revisionを判定する。未知版を400に丸めるだけのstrict literal検証にしない。クライアントの409解析は未対応版とrevision競合を分け、未知の409は一般エラーとして扱う。

未対応版の保存失敗ではローカル下書きを保持し、タイマーを停止・自動再送しない。「この本文形式には対応していません。再読み込みが必要です」と表示し、破棄を伴う再読み込みは既存確認を通す。最新版への強制変換や、versionだけ変更した同じJSONの自動送信はしない。

本文保存のスナップショットはformatVersion/revision/valueを一組で扱う。旧応答・refetchで未保存のvalueや版を上書きしない。セッション世代とpageIdの境界は既存を維持。GETからvalueだけを取り出してformatVersionを捨てない。

## DB・永続検証

`page_contents.format_version` integer NOT NULL DEFAULT 0を新migrationで追加する。CHECKは非負整数とし、1以外の将来版をDB制約で禁止しない。DBdefault0は、旧コードが列を省略した書込みを1と偽装しないため。現行新コードの全create/copy経路は明示的に1を入れる。

value_jsonは配列のまま、版は別列。node配列へversionを混入しない。revisionは版と別の更新競合番号。formatVersion変更が必要な本文移行ではrevisionを1増やし、旧クライアントの本文を上書きさせない。

保存済み本文のvalidationをread/update/create/copyで共通化し、版ごとのvalidator/明示converterを `api/modules/pages/page-content-format.ts` 等へ分離する。v1へ無条件castしない。対応版registryと0→1 converterのみを用意し、未承認の将来変換を仮実装しない。

UI/HTTPでのownerIdは認証から決める。移行CLIは運用者のDB全体処理であり、一般ユーザーへ移行APIを公開しない。inactive ownerやゴミ箱も失われないよう全page_contentsを対象とする。

## 旧データの明示移行

移行をGET時や初回編集の副作用で行わない。専用CLI（`api/cli/page-content-migrate.ts`候補）をdry-run既定で追加し、適用は明示フラグと事前バックアップを必要とする。13実装時に追加するもので、今回の作業では実行・作成しない。

### 0→1の変換規則

1. 旧schemaでJSON・型・属性・leaf・件数・サイズを検証する。未知ノード/一時slash/壊れたJSON/不正IDは変換不能として停止し、削除・空本文化しない。
2. 既存の有効な一意IDは保持。重複IDは文書順で最初のブロックを保持し、後続へ新IDを付ける。IDなしにも新ID。元の全IDと新集合を避けて生成する。
3. 文字・型・装飾・順序をそのまま保持し、v1とUTF-8上限を検証。ID増加で1MiBを超えれば変換不能。上限を緩めたり本文を短くして通さない。
4. 必要な変更数と理由をreportする。重複IDの再付与は移行仕様として明示し、既に外部参照が存在する環境では参照対応が不明のため適用停止する。現行01〜12にはblock参照機能はないが、環境を確認する。
5. value_jsonとformatVersion=1、revision+1、page_contents.updatedAtを同一transactionで更新。pages.updatedAtは通常の本文保存と同じく更新し、他のページmetadataを変更しない。元JSON・旧revisionの完全なバックアップを保持する。

### 手順と稼働条件

1. 停止前dry-runで全ページ（ゴミ箱を含む）の版・変換可否・重複/欠落ID・増加サイズ・revision上限を検査する。列追加前は読取専用のschema検査でformat_versionの不存在を確認し、全行をlegacy0として検査する。CLIが勝手に列を追加しない。reportはpageId/理由/件数中心で本文や秘密をstdoutへ出さない。
2. 稼働中writer・旧アプリ・バックグラウンド更新を停止し、停止後の最新DBバックアップを既存運用手順で作成・復元確認する。停止前の検査用backupだけで切替時点の復元を保証しない。単一プロセスのwriterだけで外部プロセスの停止を保証しない。
3. 09〜12統合後の最新journalから構造migrationを適用。既存SQL/snapshotを編集しない。0の識別列を追加後、再度全件preflightする。
4. 明示適用で0の行だけを変換する。ページ単位transactionで `{ pageId, formatVersion: 0, revision: 読取値 }` を条件に更新し、途中の同時変更は競合停止。100ページ単位で進捗を記録するが、成功済みページは次回処理しない。
5. 失敗が一件でもあれば旧writer/newアプリとも再開しない。成功済み行は1、未処理行は0で残り、安全に再実行可能。完了済みIDを再生成したりrevisionを二重増分しない。
6. 全件1・一意ID・内容保持・FK正常・0残件0を確認して新API/UIをまとめて公開する。旧bundleのversionなしPUTは400として下書き保持・再読込へ誘導する。旧サーバーを新DBへ混在稼働させない。

0以外の未知版は下位変換しない。version1にも不正JSONがあれば停止。revision上限や外部参照・容量超過は個別判断事項として報告する。

dry-runはDB/JSON/日時/revisionを一切変更しない。適用前バックアップとreportは秘密を含む可能性があるため管理されたDBバックアップ領域へ置き、repositoryや公開artifactに本文を置かない。適用時生成したIDはDB成功行が正本。dry-run乱数と同じIDになることは保証しない。

## 10/11/12との具体的な整合

- 10: 保存元がv1ならそのvalidatorを使ってコピーし、全IDを新生成、版1/revision0。既存requestId再送は同じコピーIDを返し、再移行/再コピーしない。操作記録の古い入力・result_jsonを13で書き換えない。
- 11: trash/restoreはvalue_jsonとformatVersionを不変のまま、revisionだけ既存規則で各+1。移行がdeletedページのrevisionを増やしても、members.original_revisionは削除時履歴として保持する。restoreは現在revisionから増分し、履歴値へ戻さない。previewtokenは現在revisionを利用するため移行前previewは不一致となる。
- 11: lifecycle requestの再送は保存結果を返すだけで、移行後のJSON・revision・版を復元し直さない。replayed結果から旧本文をcacheへ入れない。
- 12: title検索の結果/順序/cursorを変更しない。移行のpages.updatedAt変更はcreatedAt順に影響しない。検索は本文版を検証しないため、未対応本文のページが結果に出ても詳細GETで安全に停止する。
- 08/09: 版移行を理由にtitle/parent/owner/createdAtを変えず、改名・移動の応答がcontentの版/IDを上書きしない。

## 段階的な実装と変更対象

1. 最新01〜12の統合状況、schema/API成功応答、migration、保存hook、Plateのローカル型と実操作を確認。baseline test/typecheckを記録し、並行実装を巻き戻さない。
2. `shared/schemas/page-content.schema.ts` にlegacy/current validator・formatVersion型・ID一意性と版エラー型を定義。pages.schemaのcontentにも版を接続。初期本文の定数はIDなしの雛形として使い、作成時factoryで毎ページ新IDを付ける。共有固定ID定数を新ページへ使い回さない。
3. DB列と新migration、共通format validator/converter、専用CLIとtestを作る。一時DBでdry-run/適用/中断再開/rollback方針を先に検証する。
4. pages serviceのcreate/read/update、10copy、11trash/restoreへ明示versionと検証を接続。未知版/認可/ID不正のHTTP型をroutesへ接続。
5. `web/src/api.ts`、autosave hook、pages-view、editorの境界を更新し、snapshot/キャッシュ/409分類で版を保持する。
6. エディタのIDライフサイクルを実Plateテストで固定し、必要なplugin設定/clipboard等のadapterを最小追加する。新ブロックや依存upgradeは混ぜない。
7. migration完了後の全機能・旧入力拒否・ゴミ箱・検索の回帰、typecheck/lint/format/build/verify/E2Eで確認。運用への適用はバックアップとメンテナンス手順をレビューした後に行う。

## 必須テストと受け入れ基準

| ケース | 合格条件 |
| --- | --- |
| 新規・空段落 | v1、必須10文字ID、revision0、毎回独立ID |
| 欠落/不正/重複IDのPUT | 400、本文・revision・日時不変 |
| GET/再読込/選択・親render | 同ID、余計なonChange/PUT0件 |
| 文字・装飾・p/h1/h2・slash選択 | 元ID保持。一時ノードは保存されない |
| split/merge | 先頭ID保持、新部分新ID、削除側を再利用しない |
| clipboard/cut/undo/redo | 定義どおりの保持/新ID、表示と保存JSON一致 |
| ID生成衝突 | 再生成、ページ内一意、元の別IDを変えない |
| v1→v1保存 | サーバーID再生成なし、通常revision+1 |
| 欠落版/旧版/将来版・認可外 | 規定400/409/404、データ漏えい/黙示変換なし |
| 未対応版保存失敗 | 下書き保持、自動再送停止、破棄確認なしに再読込しない |
| legacy IDなし/重複/装飾 | IDだけ規則どおり修復、文字/型/装飾/順序保持 |
| 旧JSON破損/未知型/容量超過 | preflight/適用停止、切り詰め/空本文化なし |
| dry-run | DB/JSON/revision/日時の前後完全一致 |
| 適用・再実行・途中失敗 | 各行原子的、成功済みID/revision不変、未処理0を再開可能 |
| 移行revision競合/上限 | 停止、同時更新の上書き・整数overflowなし |
| 10コピー/同request再送 | 新ID/v1/revision0、一度だけコピー、receipt保持 |
| 11削除/復元/削除済み移行 | ID/JSON/版維持、現在revisionから増分、旧PUT409 |
| 12検索と改名/移動 | title・parent・createdAt・cursorの契約維持 |
| 全件移行後のDB/バックアップ | 0残件0、全v1検証、FK正常、復元検証可能 |

API/CLIは実migrationを用いた一時SQLite、UIはPlateをmockしないTesting Libraryと必要なPlaywrightを使う。ゴミ箱・inactive owner・複製済み・operation receipts付きのfixtureを含め、表示文字列だけでなくID・版・DB不変条件を検証する。

実装後、対象test、01〜12回帰、typecheck、lint、format:check、build:web、verify、git diff --check、verify:e2eを実行。[品質契約](./delivery-quality-gates.md)に沿い、ID一意性/版判定/revision条件の変異検出、1000ブロック・最大本文・全件移行の時間/メモリを計測。未実行をpass扱いしない。

## 未決事項・差し戻し・報告

未決は、将来のネスト型と版2、ID削除後の参照先表示、block履歴、外部参照付き既存データ、最大容量直前のID追加、メンテナンス時間と製品性能予算。今回は平坦v1・参照キー(pageId,blockId)・旧ID保持/重複後続再生成・全件明示移行で固定する。

旧bundleと新契約は完全互換ではないため、API/UI/DBの同時切替と旧PUTの安全な拒否を完了条件にする。移行後のrollbackは新しいユーザー編集を消さない計画が必要。旧backupを無条件にDBへ戻したり、formatVersionだけ0へ下げたり、IDを削って旧版に見せない。停止中で新規編集がないことを確認できる場合のみ検証済みbackup復元を検討し、それ以外は別の逆移行を設計する。

報告には採用版・実PlateのID挙動、schema/HTTP変更、移行件数・ID変更理由・バックアップ/再開確認、10/11/12との整合、検証/未実行、残存制約を記載する。本作業は13設計書だけを保存し、ソース・設定・DB・既存文書・コミット・push・14以降作成は行わない。

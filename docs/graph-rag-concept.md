# Graph RAG Variant Concept

## Status

- Branch: `variant/graph-rag`
- Base branch: `variant/rag`
- Stage: concept and implementation contract
- Persistence: PostgreSQL + pgvector

この文書は、`variant/rag` を基礎に、論文・技術文書などの長文を解析し、検証可能な Knowledge Graph と根拠付き成果物を構築する `variant/graph-rag` の設計方針を定義する。

ここに記載する機能は、実装済みであることを示すものではない。実装時の責務境界、データの意味、検証条件を共有し、単純な JSON 生成や出典不明の LLM 出力へ設計が戻らないようにするためのコンセプト文書である。

## Purpose

この variant は、次の情報を同一の provenance model の下で扱う。

- PDF から Markdown へ正規化した原文
- 原文から抽出した Claim、Entity、Finding、Method、Dataset、Relation
- Web 検索や他文書から得た Evidence と検証結果
- 社内知識、用語集、マスターデータなどの追加 Knowledge
- Graph と Evidence を使って生成した文章、フォーム、Table、CSV、PDF

最終目的は、質問応答だけではなく、入力から出力まで根拠を追跡できる Knowledge-to-Artifact pipeline を提供することである。

## Goals

- 原文の位置へ戻れる状態で PDF / Markdown を取り込む。
- 原文中の主張と、システムによる検証結果を分離して保存する。
- Knowledge Graph の Node、Edge、Evidence、embedding を PostgreSQL の正規化テーブルへ保存する。
- pgvector を使い、文書、Section、Passage、Claim、Entity を用途別に検索する。
- vector 類似度と Graph traversal を組み合わせて Knowledge Pack を構築する。
- 作文、フォーム、正規化済み Table、CSV、PDF を同じ型付き Artifact から生成する。
- 文章、フィールド、行、セルごとに provenance と confidence を確認できるようにする。
- 抽出・検証・生成を versioned run として再実行可能にする。

## Non-goals

- LLM の出力を検証せず、そのまま事実として保存すること。
- Graph 全体を単一 JSON document として永続化すること。
- LLM に任意 SQL を生成・実行させること。
- あらゆる Node 間の距離を事前計算して保存すること。
- 特定の学術分野、顧客、申請様式だけに固定した実装を variant 本体へ入れること。
- 最初から専用 Graph database を必須にすること。

特定業務向けの画面、Recipe、seed data は、必要に応じて `sample/*` または利用側 application へ分離する。

## Core Principles

### Original text is immutable

原文は一次資料として保持し、LLM による修正、要約、補完で上書きしない。正規化 Markdown、解析結果、Graph、Evidence、Artifact は、原文から再生成可能な派生成果物として version を持つ。

### Claim is not fact

論文に書かれた内容は、まず Claim として保存する。Claim が事実であるかどうかは別の assessment として扱う。

検証状態の初期候補は次の通りとする。

- `supported`
- `contradicted`
- `mixed`
- `insufficient`
- `not_verifiable`

研究結果は、対象集団、期間、Method、Dataset、比較対象などの条件を含めて評価する。条件の異なる研究間で、表面的な結論だけを比較して矛盾と判定しない。

### Provenance is first-class data

Graph Node、Edge、Evidence、Artifact field は、必ず原文または外部 Knowledge の locator へ関連付けられるようにする。

最低限、次の情報を追跡する。

- document / source ID
- page、Section、Paragraph、Table、Figure
- source span
- extraction / verification / generation run
- model、prompt、schema version
- confidence
- created / retrieved time

### Token count is a guardrail, not a semantic boundary

tokenizer は embedding input の上限管理に使う。Chunk の境界は Markdown の見出し、Paragraph、List、Table、Sentence などの意味構造を優先する。

### External mutation requires a gate

Table Insert や外部システムへの送信は、生成直後に実行しない。型検証、正規化、差分 preview、必要な承認を通過した Artifact だけを transaction で反映する。

## High-level Architecture

```text
PDF / Markdown / Knowledge Sources
  -> Canonical Document + Source Locators
  -> Multi-resolution Analysis
       -> Section / Passage / Claim / Entity / Relation
       -> Embeddings in pgvector
  -> Evidence Collection and Assessment
  -> Evidence-aware Knowledge Graph
  -> Knowledge Pack Builder
  -> Artifact Composer
       -> Typed Draft
       -> Validation and Normalization
       -> Provenance Gate
       -> Review / Approval
  -> Output Adapters
       -> Document / Form / Table Insert / CSV / PDF
```

実行処理は同期 request に閉じず、長時間処理を job として扱う。各 stage は idempotent に再実行でき、途中失敗から再開できることを目標とする。

## Document Ingestion

### Canonical representation

PDF は構造を保持した Markdown へ正規化する。見た目の再現ではなく、検索、引用、解析に必要な構造を残す。

- title and authors
- heading hierarchy
- page boundaries
- paragraphs and lists
- tables and captions
- figures and captions
- equations and surrounding explanation
- footnotes and citations
- references

Markdown だけを唯一の位置情報にせず、PDF page、原文 offset、可能であれば bounding box を source locator として保持する。

### Atomic blocks

Markdown を AST として解析し、次の block を最小の保存単位とする。

- heading
- paragraph
- list
- quote
- code block
- table
- figure caption
- equation
- footnote
- reference

Atomic block は原文への locator を担当し、RAG の主要検索単位として直接使うとは限らない。

## Multi-resolution Chunking and Embeddings

単一の Chunk size をすべての用途へ適用しない。同じ原文位置から複数粒度の検索表現を作る。

| Embedding kind | Initial size guideline | Primary use |
| --- | ---: | --- |
| `document_summary` | 300-600 tokens | corpus-level routing |
| `section_summary` | 100-300 tokens | section routing and broad questions |
| `passage` | target 500, max 900 tokens | normal RAG retrieval |
| `claim` | 30-180 tokens | fact checking and Claim matching |
| `entity_profile` | 20-150 tokens | entity resolution and Graph search |
| `table_summary` | 100-300 tokens | table discovery |
| `table_row_group` | 200-600 tokens | value-level table retrieval |
| `artifact` | output-dependent | reuse and comparison of generated artifacts |

数値は初期値であり、embedding model の制限と評価 corpus に合わせて調整する。

### Passage construction

Passage の境界は次の優先順位で決定する。

```text
heading
  -> Markdown block
  -> paragraph
  -> sentence
  -> token hard limit
```

- 同じ Section 内の block を target token 数まで結合する。
- max token 数を超える長い block だけ sentence 単位で分割する。
- 小さすぎる block は、同じ Section の隣接 block と結合する。
- Section をまたぐ結合は行わない。
- overlap は必要最小限とし、検索後の adjacent passage expansion を優先する。
- Claim の重複生成は source span と content hash で抑制する。

現在の `variant/rag` は見出しを認識しながら約 2,500 文字で `source_fragments` を作る。この方式を baseline とし、Graph RAG では文字数中心の分割から、Markdown AST、意味境界、token 上限を組み合わせる方式へ段階的に置き換える。

### Contextualized embedding input

保存する原文と embedding 用テキストを分ける。

```text
Document: <title>
Section: <heading path>
Content type: <passage | claim | table | entity>

<content>
```

`raw_content` は原文のまま保持し、`embedding_content` とその hash を保存する。再 embedding 時に入力差分を検知できるようにする。

### Special content

- 小さな Table は Caption と Header を含めて一単位にする。
- 大きな Table は Header を各 row group に含め、Table Summary も別に作る。
- Figure は Caption、説明 paragraph、必要に応じた vision / OCR result を関連付ける。
- Equation は単独にせず、前後の説明と関連付ける。
- References は通常 Passage から分離し、citation Graph の入力として扱う。

## Evidence-aware Knowledge Graph

### Candidate Node types

- `Document`
- `Section`
- `Claim`
- `Entity`
- `Finding`
- `Method`
- `Dataset`
- `Population`
- `Intervention`
- `Outcome`
- `Limitation`
- `EvidenceSource`
- `Artifact`

### Candidate Edge types

- `ASSERTS`
- `MENTIONS`
- `SUPPORTS`
- `CONTRADICTS`
- `DERIVED_FROM`
- `USES_METHOD`
- `EVALUATED_ON`
- `CITES`
- `SAME_AS`
- `PART_OF`
- `SEMANTICALLY_SIMILAR`

抽出された relation と、vector 距離から生成した similarity relation は `relation_origin` で区別する。

### Persistence direction

Graph は PostgreSQL の正規化テーブルへ保存する。想定する論理テーブルは次の通りである。

```text
documents
document_sections
document_blocks
passage_chunks
analysis_runs

graph_nodes
graph_edges
graph_edge_evidence
node_embeddings
edge_vector_metrics

evidence_sources
evidence_items
claim_assessments
verification_runs
```

embedding は pgvector の vector column とし、少なくとも次を識別する。

- embedding kind
- model and deployment
- dimensions
- input content hash
- generated time
- owner type and owner ID

異なる embedding kind を無条件に同一ランキングへ混ぜない。検索時に kind を絞り込み、必要に応じて kind ごとの score を後段で統合する。

Node 間の全組み合わせを永続化しない。近傍 top-K、閾値以内、LLM または rule により関係候補となった組み合わせだけを `SEMANTICALLY_SIMILAR` Edge として採用し、使用した metric、distance、model、computed time を保存する。

query と Node / Passage の距離は retrieval run の結果として保存する。

## Evidence and Fact Checking

### Evidence lifecycle

```text
Claim
  -> Search Query Plan
  -> Local / Web Evidence Candidates
  -> Source Fetch and Span Extraction
  -> Relevance Assessment
  -> Support / Contradiction Assessment
  -> Human Review when required
```

検索結果 snippet だけで最終判定せず、可能な場合は source 本文を取得して該当 span を保存する。

Evidence には次の属性を持たせる。

- source URI and title
- publisher / author when known
- publication and retrieval time
- source span and locator
- source type and authority level
- relation to Claim
- confidence
- freshness / temporal scope
- verification model and version

Evidence assessment は source credibility だけでなく、Claim との entailment、条件の一致、時点の一致を評価する。

## Knowledge Pack and Retrieval

Knowledge Pack は生成目的に必要な情報だけを集めた versioned context である。原文、Graph、Evidence、外部 Knowledge を無差別に一つの prompt へ投入しない。

基本検索フローは次の通りとする。

```text
request and output intent
  -> document / section routing
  -> passage and Claim hybrid retrieval
  -> Graph traversal
  -> Evidence and assessment filtering
  -> adjacent / parent context expansion
  -> reranking
  -> token budget allocation
  -> Knowledge Pack
```

検索は、全文検索、pgvector 類似検索、Graph 構造、Evidence status を組み合わせる。用途別の例は次の通りである。

- 要約: Section Summary、主要 Claim、原文 parent passage
- Fact check: Claim、検証対象条件、Evidence span、反証候補
- 比較表: Entity / Finding / Dataset Node、共通属性、原文 span
- 作文: Outline に必要な Graph subgraph と verified Evidence
- フォーム: field mapping に必要な Claim / Entity と provenance

検索で拾う単位と、LLM へ渡す単位を分ける。細かい Claim がヒットした場合も、生成時には source Passage と Section context を追加できるようにする。

## Artifact Composer

Artifact Composer は、Knowledge Pack を型付き出力へ変換する。LLM text から loose な artifact block を抽出するだけでなく、Output Recipe と schema に従って生成、検証、正規化する。

### Output Recipe

Recipe は次の契約を持つ。

- output type and schema version
- input scope
- field mappings
- Evidence policy
- normalization rules
- validation rules
- renderer / destination
- approval policy
- template version

Evidence policy の候補は次の通りとする。

- `original_only`
- `verified_only`
- `allow_external`
- `creative_with_disclosure`

### Artifact lifecycle

```text
Knowledge Pack
  -> Typed Draft
  -> Schema Validation
  -> Deterministic Normalization
  -> Provenance and Evidence Validation
  -> Preview / Review
  -> Approval
  -> Render or Deliver
```

想定する論理テーブルは次の通りである。

```text
output_recipes
output_recipe_versions
artifact_runs
artifacts
artifact_versions
artifact_field_values
artifact_provenance
artifact_validation_results
delivery_jobs
```

任意 schema の immutable snapshot には JSONB を利用できる。ただし Graph、Evidence、provenance、外部 Table への正規化結果を単一 JSON だけに閉じ込めない。

### Supported output families

#### Document composition

- Graph から論点と outline を構築する。
- Claim と Evidence を選択して draft を生成する。
- 事実を述べる sentence / paragraph を provenance へ関連付ける。
- unsupported、mixed、contradicted な内容を表示または出力 policy に従って除外する。

#### Form

- Zod または JSON Schema 相当の契約から UI を構築する。
- field ごとに raw value、normalized value、confidence、provenance、review status を表示する。
- 確定できない値は推測で埋めず、`unresolved` として残す。

#### Table Insert

```text
generated values
  -> staging artifact
  -> type and constraint validation
  -> normalization and entity resolution
  -> insert / update diff preview
  -> approval
  -> transaction / upsert
```

- destination、Table、Column は allowlist で制御する。
- LLM に SQL を直接実行させない。
- raw value と normalized value を両方保持する。
- idempotency key と conflict policy を Recipe に定義する。

#### CSV

- validated tabular Artifact から生成する。
- column order、encoding、delimiter、null representation を Recipe で固定する。
- formula injection を防止する。
- raw / normalized / audit 用の export profile を分けられるようにする。

#### PDF

- semantic Document Artifact から print template を通して生成する。
- Markdown、HTML、PDF は同じ Artifact version から派生させる。
- citation、Evidence appendix、生成日時、model、Recipe version を含められるようにする。

## User Experience Concept

`Output Studio` を中心画面の候補とする。

1. 対象文書、Graph、Knowledge scope を選ぶ。
2. Output Recipe を選ぶ。
3. Evidence policy と厳格度を選ぶ。
4. Knowledge Pack と Artifact draft を生成する。
5. sentence、field、row、cell 単位で根拠を確認する。
6. unresolved / contradicted / low-confidence 項目を修正する。
7. 承認後に CSV / PDF を出力するか、Table Insert を実行する。

大量文書処理では、job status、失敗 stage、再試行、部分再解析、費用と token 使用量を確認できるようにする。

## Suggested Module Boundaries

実装時の配置候補を示す。既存構造とレビュー結果に応じて調整する。

```text
api/modules/documents/       canonical documents and locators
api/modules/analysis/        multi-resolution analysis runs
api/modules/knowledge-graph/ nodes, edges, traversal
api/modules/evidence/        evidence collection and assessment
api/modules/retrieval/       Knowledge Pack construction
api/modules/artifacts/       typed Artifact Composer
api/modules/outputs/         CSV, PDF, form, table adapters
api/modules/jobs/            long-running orchestration
shared/schemas/              public request and Artifact contracts
```

provider 固有の API 呼び出しは adapter に閉じ込め、domain service が OpenAI / Azure OpenAI / Web search provider の詳細へ直接依存しないようにする。

## Delivery Phases

### Phase 0: Contract and evaluation corpus

- representative papers and Markdown fixtures
- expected retrieval queries
- expected Claim / Evidence pairs
- output Recipe examples
- provenance acceptance criteria

### Phase 1: Canonical documents and multi-resolution retrieval

- PDF / Markdown locators
- Markdown AST blocks
- Passage / Section Summary embeddings
- hybrid retrieval and parent context expansion

### Phase 2: Claim Graph and Evidence

- Claim / Entity / Relation extraction
- Graph persistence and traversal
- Claim embedding and Evidence matching
- assessment status and review flow

### Phase 3: Typed Artifact Composer

- Output Recipe
- schema validation
- field-level provenance
- document / table / CSV preview

### Phase 4: Controlled delivery

- normalization pipeline
- approved Table Insert
- PDF renderer
- batch jobs, retry, observability

## Verification Strategy

### Retrieval evaluation

- document and Section routing recall
- Passage Recall@K
- Claim-Evidence matching precision / recall
- citation source span validity
- duplicated context ratio
- context token usage

評価 query は、Method、Result、数値、Table、条件付き Claim、反証関係、複数論文比較を含める。

### Graph evaluation

- Node / Edge extraction accuracy
- source locator coverage
- duplicate Entity rate
- unsupported Edge rate
- Graph traversal relevance

### Artifact evaluation

- schema validation pass rate
- required field coverage
- field / sentence provenance coverage
- unsupported factual statement rate
- normalization accuracy
- preview and delivered output consistency

### Repository verification

文書だけの変更では、最低限次を実行する。

```bash
git diff --check
bun run format:check
```

実装が始まった後は、変更範囲に応じて targeted test、typecheck、build、`bun run verify` を追加する。DB schema 変更では fresh PostgreSQL への migration と pgvector index / query も確認する。

期待結果は、対象 command が成功し、生成差分や未追跡 artifact が意図したものだけであること。失敗した場合は stage を特定し、未確認の migration、delivery、外部 mutation を完了扱いにしない。

## Open Decisions

- PDF parser と page / bounding-box locator の共通契約
- embedding model、dimensions、再 embedding 方針
- Graph schema の固定部分と拡張可能部分
- Evidence source authority の評価規則
- Graph / vector / full-text score の統合方法
- reranker の採用条件
- Output Recipe の schema 表現
- PDF rendering engine
- human review が必須となる Evidence policy と destination
- corpus 規模に応じた partitioning と index strategy

これらは実装前にすべて固定する必要はないが、各 Phase の開始時に decision record と検証条件を残す。

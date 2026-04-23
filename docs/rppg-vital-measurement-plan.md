# rPPGベース非接触バイタル計測アプリ 実装計画書 (Hono/Bun 最適化版)

## 1. プロジェクト概要
Hono/Bun の高速なランタイム特性を活かし、rPPG（非接触脈拍推定）機能を統合します。FastAPI等の重量なフレームワークを廃止し、プロセス間通信のオーバーヘッドを最小化したハイブリッド構成を採用します。

## 2. システムアーキテクチャ (Zero-Cold-Start Optimized)

### 全体構成
- **Frontend**: Flutter
- **Backend API**: Hono (on Bun)
- **Signal Analysis Engine**: 
  - **Persistent Python Daemon**: 起動時に NumPy 等の重量ライブラリをプリロードし、Unix Domain Sockets (UDS) で待機。
  - **Zero-Latency Bridge**: Bun から UDS 経由で接続し、バイナリデータをストリーミング。プロセス再起動のオーバーヘッドを完全に排除。

### 橋渡し（Bridge）の設計
| 方式 | 採用理由 | パフォーマンス特性 |
| :--- | :--- | :--- |
| **Unix Domain Sockets (UDS)** | ファイルシステム上のソケットを介した通信で、ネットワークスタックを完全に回避。 | 最高 (Lowest latency for IPC) |
| **Persistent Pool** | 接続済みのソケットをプールし、リクエストごとのコネクション確立コストをゼロに。 | 最高 (No handshake overhead) |
| **NumPy Preloading** | デーモン起動時に全ての解析準備を完了させ、初回リクエストの遅延を回避。 | 最高 (No cold start) |

## 3. ディレクトリ構成
```text
hono-standard/
├── api/                # Hono API (Bun)
│   ├── src/
│   │   └── services/
│   │       └── vitals/ # Daemon Client (IPC)
├── vitals-daemon/      # 解析デーモン (Persistent Worker)
│   ├── main.py         # UDS Server & Analysis Logic
│   ├── rppg/           # yarPPGベースの信号処理
│   └── requirements.txt
├── mobile/             # Flutterアプリ
└── docs/               # 設計ドキュメント
```

## 4. インターフェース設計 (IPC Protocol)

### Unix Domain Socket (App ↔ Daemon)
- **Path**: `/tmp/hono-vitals.sock`
- **Format**: MessagePack または Protobuf (JSONの2〜5倍高速)

### データフロー
1.  **Daemon Start**: システム起動時に Python デーモンが立ち上がり、モデルとライブラリをロード。
2.  **Request**: Bun が UDS 経由でバイナリ化された ROI データを送信。
3.  **Process**: デーモンがメモリ上で即座に行列演算。
4.  **Response**: 解析結果をバイナリで返却。

## 5. 実装ステップ

### Phase 1: Python デーモン基盤
1.  `socket` モジュールを使用した UDS サーバーの実装。
2.  NumPy / yarPPG のプリロードロジックの実装。
3.  Bun 側からの接続・ヘルスチェックの実装。

### Phase 2: ROI抽出のネイティブ化
1.  Mobile側 (iOS/Android) で MediaPipe を用いた ROI 平均値の算出をネイティブ実装。
2.  Bun 側の API でバイナリデータ（Float32Array）として受け取る。

### Phase 3: 信号処理の最適化
1.  POS / CHROM 等のアルゴリズムのデーモンへの組み込み。
2.  将来的な Rust FFI 化への備え（ロジックの疎結合化）。

## 6. Python デーモンの運用
- **Daemonization**: `systemd` や `Docker (sidecar)`、または Bun から管理される永続プロセスとして運用。
- **Auto-Restart**: デーモンがクラッシュした際は、Bun 側またはオーケストレータが即座に再起動。
- **Warm-up**: 起動直後にダミーデータで一度解析を走らせ、JITやメモリバッファを最適化。


## 7. 技術的課題と対策
- **メモリ管理**: 頻繁なバイナリデータのやり取りによる GC 負荷を抑えるため、Bun 側で `Uint8Array` / `Float32Array` を再利用。
- **並列処理**: 重い解析リクエストが重なった場合、Bun の Cluster モードまたは Worker Threads を利用してワーカープロセスを複数立ち上げる。

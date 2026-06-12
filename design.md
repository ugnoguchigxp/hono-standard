# hono-standard Design Guide

この文書は、`hono-standard` で画面を作るときの基準と、利用できる Design System コンポーネントの目録です。
実装時は `designSystem/src/**` を直接参照せず、必ず package として `@repo/design-system` を利用します。

## 目的

`hono-standard` は、業務アプリケーション、管理画面、SaaS のような反復利用される UI を短時間で安全に作るためのテンプレートです。
デザインは派手さよりも、情報密度、見通し、操作の予測しやすさ、状態の分かりやすさを優先します。

## 基本方針

### 1. 画面はワークフローから設計する

最初に「ユーザーが何を判断し、何を操作し、どの状態に戻るか」を決めます。
画面を装飾単位で考えず、次の順番で組み立てます。

1. 主要タスク
2. 必要な状態表示
3. 入力・選択・実行の操作
4. エラー、空状態、読み込み中、権限不足
5. 補助情報、履歴、詳細表示

業務系 UI では、巨大な hero、装飾的なカードの多用、意味の薄いグラデーション背景は避けます。

### 2. Design Token を UI の境界にする

色、余白、角丸、影、z-index、密度は token を経由します。
コンポーネントやアプリ画面で直接色値、任意 shadow、独自 z-index を増やさないでください。

利用側 CSS の基本形:

```css
@import "tailwindcss";
@import "@repo/design-system/styles";
@import "@fontsource-variable/geist";
```

React 側の基本形:

```tsx
import '@repo/design-system/styles';
import { Button, Card, CalendarProvider } from '@repo/design-system';
```

### 3. Consumer は package API だけを使う

利用側は次の import を使います。

```tsx
import { Button, Card, Select } from '@repo/design-system';
```

禁止:

```tsx
import { Button } from '../designSystem/src/components/Button';
import '../designSystem/src/styles/index.css';
```

root app の Vite は workspace 開発時だけ `@repo/design-system/styles` を source CSS に解決します。
公開・配布の契約は `@repo/design-system` と `@repo/design-system/styles` です。

### 4. 色は semantic token を使う

状態や意味を持つ色は、Tailwind class の semantic token を使います。

| 用途 | 推奨 |
| --- | --- |
| 通常文字 | `text-foreground` |
| 補助文字 | `text-muted-foreground` |
| 境界線 | `border-border` |
| 主操作 | `bg-primary text-primary-foreground` |
| 副操作 | `bg-secondary text-secondary-foreground` |
| 危険操作 | `bg-destructive text-destructive-foreground` |
| 成功 | `bg-success text-success-foreground` |
| 警告 | `bg-warning text-warning-foreground` |
| 情報 | `bg-info text-info-foreground` |
| 弱い状態背景 | `bg-*-soft` |

避けるもの:

- `bg-emerald-500`
- `text-white`
- `border-theme-*`
- `text-[hsl(...)]`
- コンポーネント内の直接 RGB/HSL 値

### 5. Shadow は token 化された class を使う

通常の elevation は `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` を使います。
方向性が必要な場合は 45度刻みの direction shadow を使います。

方向:

- `top`
- `top-right`
- `right`
- `bottom-right`
- `bottom`
- `bottom-left`
- `left`
- `top-left`

サイズ:

- `sm`
- `md`
- `lg`

例:

```tsx
<div className="shadow-md" />
<div className="shadow-top-right-md" />
<div className="shadow-bottom-lg" />
```

避けるもの:

```tsx
<div className="shadow-[0_12px_40px_rgba(0,0,0,0.18)]" />
```

### 6. コンポーネント選定の優先順位

同じ UI を作れる場合は、抽象度の高い公開コンポーネントを優先します。

1. `@repo/design-system` の用途別コンポーネント
2. `@repo/design-system` の基本コンポーネント
3. Tailwind token class を使った小さな app-local component
4. 直接 HTML + Tailwind

内部の `components/ui/*` は shadcn/Radix ベースの実装部品です。
root app からは public export されているコンポーネントを使い、必要な部品がない場合は designSystem 側に昇格させます。

## レイアウト指針

### App Shell

- Header / Sidebar / Content / Modal の責務を分ける。
- 全画面を card 化しない。
- page section は full-width の領域として扱い、個別の情報単位だけ card にする。
- z-index は `--z-backdrop`, `--z-modal`, `--z-portal`, `--z-tooltip` を基準にする。

### 情報密度

- 業務画面では余白を広げすぎない。
- テーブル、リスト、フォームは scan しやすい間隔にする。
- 密度変更が必要な場合は local padding ではなく density token に寄せる。

### カード

- Card は繰り返し項目、詳細パネル、操作パネルに使う。
- section 全体を浮かせる目的では使わない。
- 角丸は基本 token に従い、過度な丸みを避ける。

### フォーム

- 入力は `Field`, `Label`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` を組み合わせる。
- エラー、補足、必須状態を近接表示する。
- フォーム全体の送信操作は `ActionButton` 系または `Button` の semantic variant を使う。

### 状態表示

すべての非同期 UI は、次の状態を持つことを標準にします。

- loading
- empty
- error
- success
- disabled
- unauthorized / forbidden が必要な場合の説明

`AsyncDataWrapper`, `Spinner`, `Skeleton`, `ErrorState`, `NotificationToast` を優先します。

## Component Catalog

目録は `designSystem/src/index.ts` の public export を基準にしています。

### Actions

| Component | 用途 |
| --- | --- |
| `Button` | 汎用ボタン。通常、secondary、destructive、outline、ghost、link などの基本操作に使う。 |
| `ActionButton` | アイコンや状態を伴う業務操作ボタンの基底。 |
| `CreateButton` | 作成操作。 |
| `SaveButton` | 保存操作。 |
| `EditButton` | 編集操作。 |
| `DeleteButton` | 削除操作。危険操作として扱う。 |
| `CancelButton` | キャンセル、取り消し操作。 |
| `CopyClipButton` | クリップボードコピー操作。 |

### Forms & Inputs

| Component | 用途 |
| --- | --- |
| `Form` | フォーム構造。 |
| `Field` | ラベル、補足、エラーを含む入力行。 |
| `Label` | 入力ラベル。 |
| `Input` | 基本入力。 |
| `TextInput` | テキスト入力の用途別 wrapper。 |
| `Textarea` | 複数行入力。 |
| `Checkbox` | 複数選択、同意、表示切替。 |
| `Switch` | 即時反映される on/off 設定。 |
| `Select` | 単一選択。 |
| `SearchableSelect` | 検索可能な選択。 |
| `EditableSelect` | 選択と自由入力を組み合わせる。 |
| `OptionButtonGroup` | 少数選択肢の segmented control。 |
| `ScaleInput` | スケール値、割合、段階評価入力。 |
| `SimpleSearchInput` | 一覧・テーブル用の検索入力。 |
| `SelectableTextInput` | 入力値の候補選択を伴うテキスト入力。 |
| `KeypadModal` | 数値入力用 keypad modal。 |

### Data Display

| Component | 用途 |
| --- | --- |
| `Card` | 個別情報、詳細、操作パネル。 |
| `Badge` | 状態、分類、件数、ラベル。 |
| `Avatar` | ユーザー、組織、対象物の識別表示。 |
| `MiniTable` | 軽量な表形式表示。 |
| `Pagination` | ページング操作。 |
| `ProgressBar` | 進捗率、容量、完了度。 |
| `NumberFormat` | 数値の locale-aware 表示。 |
| `DateDisplay` | 日付表示。 |
| `DateFormat` | CalendarProvider と連動した日付整形。 |
| `ImageViewer` | 画像表示、拡大確認。 |
| `Skeleton` | 読み込み中の形状 placeholder。 |
| `HealthRadarChart` | 複数指標のレーダーチャート。 |
| `AdaptiveText` | 幅に応じたテキスト表示調整。 |

### Feedback

| Component | 用途 |
| --- | --- |
| `AsyncDataWrapper` | loading / empty / error / data の分岐表示。 |
| `Spinner` | 短時間の loading 表示。 |
| `ErrorState` | エラー状態の説明と復旧操作。 |
| `NotificationToast` | 一時通知。 |
| `Toaster` | toast 表示の mount point。 |
| `toast` | toast 発火 API。 |
| `Tooltip` | 補助説明。 |

### Overlays

| Component | 用途 |
| --- | --- |
| `Modal` | 汎用 modal。 |
| `ConfirmModal` | 確認、破壊的操作の確認。 |
| `Drawer` | 横・下からの補助パネル。 |
| `Popover` | 小さな補助操作・補足表示。 |
| `Collapsible` | 折りたたみ表示。 |

### Navigation & Structure

| Component | 用途 |
| --- | --- |
| `ContentHeader` | ページ・セクションの見出しと主要操作。 |
| `Tabs` | 同一文脈内の表示切替。 |
| `NavigationStepper` | 手順型 workflow。 |
| `TreeMenu` | 階層ナビゲーション。 |
| `IconTreeMenu` | アイコン付き階層ナビゲーション。 |
| `InfiniteListMenu` | 大量項目のメニュー表示。 |
| `DropdownMenu` | メニュー操作。 |
| `MenuButtonGroup` | 関連操作ボタン群。 |
| `ViewSwitcher` | 表示形式の切替。 |
| `Separator` | 視覚的な区切り。 |
| `ScrollArea` | scroll 領域。 |
| `Command` | command palette / command menu。 |

### Domain Utilities

| Component | 用途 |
| --- | --- |
| `Calculator` | 計算 UI。 |
| `ChatDock` | 画面内 chat / assistant dock。 |
| `LanguageSelector` | 言語選択。 |
| `CalendarProvider` | 日付・暦表示の設定 provider。 |
| `useCalendarSettings` | CalendarProvider の設定 hook。 |

### Types, Constants, Utils

| Export | 用途 |
| --- | --- |
| `cn` | className merge utility。 |
| `IThemeColors` | theme color 型。 |
| `ThemeName` | theme 名型。 |
| `ThemeTone` | theme tone 型。 |
| `DEFAULT_THEME` | 既定 theme。 |
| `THEME_COLORS` | theme color 定義。 |
| `THEME_CONSTANTS` | theme 関連定数。 |

## Component Selection Cheatsheet

| 作りたい UI | 最初に使うもの |
| --- | --- |
| 保存・削除・作成ボタン | `SaveButton`, `DeleteButton`, `CreateButton` |
| 一般ボタン | `Button` |
| 検索付き選択 | `SearchableSelect` |
| 設定 on/off | `Switch` |
| チェック項目 | `Checkbox` |
| 入力フォーム | `Form`, `Field`, `Input`, `Textarea`, `Select` |
| 一覧の空・エラー・読み込み | `AsyncDataWrapper` |
| 読み込み placeholder | `Skeleton` |
| 失敗表示 | `ErrorState` |
| 成功・失敗通知 | `NotificationToast`, `toast` |
| 確認 dialog | `ConfirmModal` |
| 補助 panel | `Drawer` |
| ページ見出し | `ContentHeader` |
| 詳細 card | `Card` |
| 状態 label | `Badge` |
| タブ切替 | `Tabs` |
| 表示形式切替 | `ViewSwitcher` |
| 階層 menu | `TreeMenu`, `IconTreeMenu` |
| 進捗表示 | `ProgressBar` |
| 日付表示 | `DateDisplay`, `DateFormat`, `CalendarProvider` |

## 実装チェックリスト

画面実装後は、最低限次を確認します。

- `@repo/design-system` と `@repo/design-system/styles` だけを利用している。
- `designSystem/src/**` への直接 import がない。
- 任意色 class と直接色値が増えていない。
- `shadow-[...]` が増えていない。
- loading / empty / error / disabled の状態がある。
- 主要操作に icon、label、disabled、pending の状態がある。
- フォームは label、補足、エラーが入力と近接している。
- modal / drawer / tooltip の z-index は token の範囲に収まっている。
- Storybook または `/showcase` に再利用可能な表示例を追加できる状態になっている。


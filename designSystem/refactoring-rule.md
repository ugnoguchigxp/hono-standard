# gxp-designSystem リファクタリングルール

> このドキュメントは、すべてのコンポーネントリファクタリングにおいて遵守すべきルールを定義する。

---

## 1. 見た目の維持（最重要ルール）

> [!CAUTION]
> **現行の見た目を変更してはならない。独自のレイアウトを導入してはならない。**

- リファクタリングはあくまで **内部構造の改善** であり、ユーザーが目にするUIに変更が出てはならない
- ピクセル単位で同一の描画結果を保つこと
- Storybookのビジュアルスナップショットで変更前後を比較し、差分がないことを確認すること
- `className` による既存スタイルの上書きパターンは維持すること
- **カラー設定（テキスト色、背景色、ボーダー色等）を変更しないこと。現在の色指定をそのまま維持すること。**

---

## 2. TailwindCSS / shadcn/ui デザイントークンの適用

### 2.1 UI密度トークン（Spacing）

`tailwind.preset.js` と `variables.css` に定義済みのUIトークンを使用すること。ハードコードされた `px`, `py`, `p`, `gap` 値は原則としてトークンに置き換える。

> [!IMPORTANT]
> **カラー（`primary`, `secondary` 等のテーマカラー）は適用しない。原則として現在のカラー指定を維持すること。**

| 用途 | ❌ NG（ハードコード） | ✅ OK（トークン） |
|---|---|---|
| コンポーネント水平padding | `px-3`, `px-4` | `px-ui`, `px-ui-x` |
| コンポーネント垂直padding | `py-2`, `py-3` | `py-ui-y` |
| ボタンpadding | `px-4 py-2` | `px-ui-button py-ui-button` |
| 要素間gap | `gap-2`, `gap-4` | `gap-ui` |
| テーブルセルpadding | `p-3`, `p-4` | `p-ui-cell` |

#### 定義済みトークン一覧（`tailwind.preset.js`）

```
padding:
  ui     → var(--ui-component-padding-x)
  ui-x   → var(--ui-component-padding-x)
  ui-y   → var(--ui-component-padding-y)
  ui-button   → var(--ui-button-padding-x)
  ui-button-x → var(--ui-button-padding-x)
  ui-button-y → var(--ui-button-padding-y)
  ui-cell     → var(--ui-table-cell-padding)

gap:
  ui → var(--ui-gap-base)

height/width:
  ui → var(--ui-component-height)

minHeight/minWidth:
  ui-touch → var(--ui-touch-target-min)
```

### 2.2 テキストサイズ

UIコンポーネントの本文テキストには `text-ui` を使用すること。

| 用途 | ❌ NG | ✅ OK |
|---|---|---|
| コンポーネント本文 | `text-sm`, `text-[14px]` | `text-ui` |
| 必要に応じた固定サイズ | ー | `text-xs`, `text-base`, `text-lg` 等 |

`text-ui` は `variables.css` の `--ui-font-size-base` を参照し、Density設定（`compact` / `normal` / `spacious` / `tablet`）に応じて自動的にサイズが変わる。

### 2.3 角丸（Border Radius）

`tailwind.preset.js` で定義されたトークンを使用すること。

| 用途 | ❌ NG | ✅ OK |
|---|---|---|
| 標準角丸 | `rounded-[8px]` | `rounded-lg`（`var(--radius)`） |
| 中角丸 | `rounded-[6px]` | `rounded-md`（`calc(var(--radius) - 2px)`） |
| 小角丸 | `rounded-[4px]` | `rounded-sm`（`calc(var(--radius) - 4px)`） |
| 完全円形 | ー | `rounded-full` |

### 2.4 Props による強制指定

すべての対話型コンポーネントは、以下のプロパティを **props経由で指定可能** にすること。

```tsx
interface DensityProps {
  /** UI密度サイズ。デフォルトは "md" */
  size?: "sm" | "md" | "lg";
}
```

各 `size` のマッピング：

| props | spacing | font-size | radius |
|---|---|---|---|
| `sm` | 小さめ（compact相当） | `text-sm` | `rounded-sm` |
| `md`（デフォルト） | 標準（現在のデザイン踏襲） | `text-ui` / `text-base` | `rounded-md` |
| `lg` | 大きめ（spacious相当） | `text-lg` | `rounded-lg` |

**デフォルトは `md` とし、現在のデザインを踏襲すること。**

#### 実装例（CVA使用）

```tsx
const componentVariants = cva("base-classes", {
  variants: {
    size: {
      sm: "px-ui-x py-ui-y text-sm rounded-sm gap-ui",
      md: "px-ui-x py-ui-y text-ui rounded-md gap-ui",
      lg: "px-ui-x py-ui-y text-lg rounded-lg gap-ui",
    },
  },
  defaultVariants: {
    size: "md",
  },
});
```

### 2.5 現状の問題例

以下のようなハードコード値が存在するコンポーネントはトークンに置き換えること：

- `Button`: `py-2 px-4` → `py-ui-button-y px-ui-button-x`
- `Badge`: `text-[10px]`, `text-[14px]`, `text-[16px]`, `px-4` → `text-ui` 系 + `px-ui`
- `Header`: `px-10 py-3`, `text-[24px]`, `text-[12px]` → トークンベース
- `SidebarItem`: `gap-4 px-4 py-[22px]` → `gap-ui px-ui py-ui-y`

---

## 3. Ref の正しい使い方

### 3.1 基本ルール

- DOM操作が不要なコンポーネントに `useRef` を使わない
- `React.forwardRef` はDOM要素に直接アタッチする場合にのみ使用する
- 内部状態の管理に `ref` を使う場合は、値の変更がレンダリングを必要としないケースに限定する

### 3.2 forwardRef パターン

```tsx
// ✅ OK: DOM要素への直接参照
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("...", className)} {...props} />
  )
);

// ✅ OK: Radix UIプリミティブへの参照
const Modal = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  ModalProps
>((props, ref) => (
  <DialogPrimitive.Content ref={ref} {...props} />
));

// ❌ NG: refが不要なのにforwardRefを使用
const StaticDisplay = React.forwardRef<HTMLDivElement, Props>(
  (props, ref) => <div ref={ref}>{props.children}</div>
);
// → 外部からDOMアクセスする必要がなければforwardRef不要
```

### 3.3 useRef の適切な用途

```tsx
// ✅ OK: レンダリング間で値を保持（再描画不要）
const dragStartPos = React.useRef({ x: 0, y: 0 });

// ✅ OK: DOM要素への直接操作
const inputRef = React.useRef<HTMLInputElement>(null);

// ❌ NG: 状態管理にrefを使用（再描画が必要な場合）
const countRef = React.useRef(0); // → useState を使うべき
```

### 3.4 コンポーネント状態管理

- 再描画が必要な値 → `useState`
- 再描画が不要なミュータブル値 → `useRef`
- 制御/非制御パターンは `open` / `defaultOpen` パターンを踏襲する（`Modal` を参考）
- 不要な `useState` が内部にないか確認する（外部propsで十分な場合）

---

## 4. パフォーマンス最適化

### 4.1 React.memo

| 適用すべき場面 | 例 |
|---|---|
| propsが変わらない限り再描画不要なコンポーネント | `Badge`, `Card`, `SelectTrigger` |
| リスト内のアイテムコンポーネント | `SelectItem`, `SidebarItem` |
| 重い描画処理を含むコンポーネント | チャート、テーブル |

```tsx
// ✅ OK: 適切なmemo
const Badge = React.memo(({ variant, size, children }: BadgeProps) => {
  // ...
});

// ❌ NG: childrenに関数やオブジェクトを常に受け取る場合（memoの効果なし）
const Wrapper = React.memo(({ render }: { render: () => JSX.Element }) => {
  return render();
});
```

### 4.2 useMemo

| 適用すべき場面 | 例 |
|---|---|
| 計算コストの高い派生値 | フィルタリング、ソート結果 |
| 参照安定性が必要なオブジェクト/配列 | コンテキスト値、子コンポーネントのprops |

```tsx
// ✅ OK: 計算コストが高い場合
const filteredItems = React.useMemo(
  () => items.filter(item => item.active),
  [items]
);

// ❌ NG: 単純な値の計算（過剰な最適化）
const isCircle = React.useMemo(
  () => !children && !!icon,
  [children, icon]
);
// → const isCircle = !children && !!icon; で十分
```

### 4.3 useCallback

| 適用すべき場面 | 例 |
|---|---|
| memo化された子コンポーネントに渡すハンドラ | onClick, onChange |
| useEffectの依存配列に含まれる関数 | ー |

```tsx
// ✅ OK: memo化コンポーネントに渡す場合
const handleClick = React.useCallback((e: React.MouseEvent) => {
  onClick?.(e);
}, [onClick]);

// ❌ NG: memo化されていない子に渡す場合（効果なし）
const handleClick = React.useCallback(() => {
  console.log("clicked");
}, []);
// → 子がmemo化されていなければ通常の関数で十分
```

### 4.4 不要な再描画の防止

- `React.useEffect` の依存配列は最小限にする
- オブジェクト・配列リテラルを直接propsに渡さない（`style={{ ... }}` などは変数に切り出す）
- イベントハンドラ: `useCallback` で安定化 → `React.memo` 子に渡す場合のみ

---

## 5. コンポーネント設計ルール

### 5.1 displayName の設定

すべてのコンポーネントに `displayName` を設定すること。

```tsx
Component.displayName = "Component";
```

### 5.2 className のマージ

`cn()` ユーティリティ（`clsx` + `tailwind-merge`）を使用し、最後に `className` props を渡すこと。

```tsx
className={cn(variants({ size, variant }), className)}
```

### 5.3 スプレッド演算子

残りのpropsは `...props` でコンポーネントルートに展開すること。

```tsx
const Component = ({ className, size, ...props }: Props) => (
  <div className={cn("...", className)} {...props} />
);
```

### 5.4 CVA (class-variance-authority) の活用

バリアント管理には一貫して `cva` を使用すること。

- `variants` でバリエーションを定義
- `compoundVariants` で複合条件を定義
- `defaultVariants` でデフォルト値を設定
- 型は `VariantProps<typeof xxxVariants>` で自動生成

### 5.5 アクセシビリティ

- `aria-*` 属性を適切に設定（`aria-current`, `aria-label` 等）
- Radix UIプリミティブのアクセシビリティ要件を満たすこと（`Description` の `sr-only` 等）
- インタラクティブ要素には適切な `role` を設定

### 5.6 エクスポートルール

- コンポーネント本体と `variants` 関数を named export する
- default export は原則使用しない（既存のものは互換性のため維持）

```tsx
export { Component, componentVariants };
```

---

## 6. その他の改善チェックリスト

### 6.1 TypeScript

- [ ] `any` 型を使用していないか？ → 具体的な型に置き換える
- [ ] Props interface は適切にextendされているか？（`HTMLAttributes`, `VariantProps` 等）
- [ ] Generics は正しく使われているか？

### 6.2 インポート

- [ ] `@/` エイリアスを使用しているか？（相対パス `../../` ではなく）
- [ ] 未使用インポートはないか？
- [ ] `import type` を型のみのインポートに使用しているか？

### 6.3 ファイル構成

- [ ] 各コンポーネントディレクトリに `index.ts`, `Component.tsx`, `Component.test.tsx`, `Component.stories.tsx` があるか？
- [ ] バリアント定義が大きい場合は別ファイルに分離しているか？（`Select/selectVariants.ts` を参考）

### 6.4 テスト

- [ ] ユニットテストがあるか？
- [ ] propsの各バリアントがテストされているか？
- [ ] アクセシビリティ要件がテストされているか？
- [ ] エッジケース（空値、undefined等）がテストされているか？

### 6.5 Storybook

- [ ] 各バリアントのストーリーが網羅されているか？
- [ ] インタラクティブなストーリー（args）が用意されているか？

### 6.6 コードの衛生

- [ ] Magic numberは定数化 or トークン化されているか？
- [ ] 重複したclassName文字列はないか？（`Select.tsx` の `"p-1"` 重複等）
- [ ] console.logなどデバッグコードが残っていないか？
- [ ] コメントは日本語/英語で適切に記載されているか？

---

## 適用優先順位

1. **見た目を変えない・カラーを変えない**（最優先）
2. **デザイントークンの適用**（spacing / font-size / radius）
3. **size props による密度制御の実装**
4. **ref / 状態管理の修正**
5. **パフォーマンス最適化**
6. **その他の改善**

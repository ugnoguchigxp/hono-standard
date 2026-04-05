import React, { useState } from 'react';
import { Badge } from '../src/components/ui/badge';
import { Button } from '../src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../src/components/ui/card';
import { Checkbox } from '../src/components/ui/checkbox';
import { Input } from '../src/components/ui/input';
import { Separator } from '../src/components/ui/separator';
import {
  applyColorTheme,
  applyDensityAndScaleTokens,
  COLOR_THEME_PRESETS,
  type ColorThemeKey,
  DENSITY_PRESETS,
  DESIGN_TOKEN_DEFAULTS,
  type DensityKey,
  FONT_SCALE_PRESETS,
  type FontScaleKey,
  RADIUS_PRESETS,
  type RadiusKey,
  SHADOW_PRESETS,
  type ShadowKey,
} from '../src/lib/design-tokens';
import { penVariantIndex, penVariantMeta } from './generatedVariants';

/** トークン値一覧を表示するセル */
const TokenCell = ({ name, value }: { name: string; value: string }) => (
  <div className="flex items-center justify-between py-2 text-sm">
    <code className="font-mono text-muted-foreground">{name}</code>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);

/**
 * Design System Preview Catalog
 *
 * Pencil.dev 連携用プレビューカタログ。
 * デザインファイル: ./designSystem.pen (pencil-shadcn ベース, v2.10)
 *
 * 上部のトークンコントロールパネルを変更すると、CSS 変数が動的に切り替わり、
 * 全コンポーネントに変化が即時反映されます。
 */
export const DesignSystemPreview = () => {
  const [font, setFont] = useState<FontScaleKey>(DESIGN_TOKEN_DEFAULTS.fontScale);
  const [density, setDensity] = useState<DensityKey>(DESIGN_TOKEN_DEFAULTS.density);
  const [radius, setRadius] = useState<RadiusKey>(DESIGN_TOKEN_DEFAULTS.radius);
  const [shadow, setShadow] = useState<ShadowKey>(DESIGN_TOKEN_DEFAULTS.shadow);
  const [colorTheme, setColorTheme] = useState<ColorThemeKey>(DESIGN_TOKEN_DEFAULTS.colorTheme);

  // CSS 変数を即時適用
  React.useEffect(() => {
    applyDensityAndScaleTokens({
      fontScale: font,
      density,
      radius,
      shadow,
    });
  }, [font, density, radius, shadow]);

  // カラーテーマ: html クラスを切り替え
  React.useEffect(() => {
    applyColorTheme(colorTheme);
  }, [colorTheme]);

  const SegmentControl = <T extends string>({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: Record<T, { label: string }>;
    value: T;
    onChange: (v: T) => void;
  }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <div className="flex gap-1 bg-muted rounded-[var(--radius-md)] p-1">
        {(Object.entries(options) as [T, { label: string }][]).map(([k, v]) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={[
              'flex-1 text-xs py-1.5 px-2 rounded-[var(--radius-sm)] transition-colors font-medium',
              value === k
                ? 'bg-background text-foreground shadow-[var(--shadow-xs)]'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );

  const penVariantEntries = Object.entries(penVariantIndex);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontSize: 'var(--font-size-base)' }}
    >
      {/* ====== Sticky Header ====== */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
              Design System
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
              shadcn/ui · Base UI · Tailwind CSS
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            pencil-shadcn v2.10
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12 space-y-16">
        {/* ====== Token Control Panel ====== */}
        <section>
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            🎨 Design Tokens
          </h2>
          <Card className="shadow-[var(--shadow-md)]">
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--font-size-lg)' }}>Token Controls</CardTitle>
              <CardDescription>
                値を切り替えると CSS 変数が即時更新され、下記全コンポーネントに反映されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <SegmentControl
                  label="Color Theme"
                  options={COLOR_THEME_PRESETS}
                  value={colorTheme}
                  onChange={setColorTheme}
                />
                <SegmentControl
                  label="Font Scale"
                  options={FONT_SCALE_PRESETS}
                  value={font}
                  onChange={setFont}
                />
                <SegmentControl
                  label="UI Density"
                  options={DENSITY_PRESETS}
                  value={density}
                  onChange={setDensity}
                />
                <SegmentControl
                  label="Border Radius"
                  options={RADIUS_PRESETS}
                  value={radius}
                  onChange={setRadius}
                />
                <SegmentControl
                  label="Shadow"
                  options={SHADOW_PRESETS}
                  value={shadow}
                  onChange={setShadow}
                />
              </div>
            </CardContent>
            <Separator />
            <CardContent className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                Active CSS Variables
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 divide-y md:divide-y-0">
                <TokenCell name="html.class" value={COLOR_THEME_PRESETS[colorTheme].className} />
                <TokenCell name="--font-size-base" value={FONT_SCALE_PRESETS[font].value} />
                <TokenCell name="--spacing-unit" value={DENSITY_PRESETS[density].value} />
                <TokenCell name="--radius-factor" value={RADIUS_PRESETS[radius].value} />
                <TokenCell name="--shadow-md" value={shadow} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ====== Buttons ====== */}
        <section>
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            🧩 .pen Variants
          </h2>
          <Card className="shadow-[var(--shadow-md)]">
            <CardHeader>
              <CardTitle style={{ fontSize: 'var(--font-size-lg)' }}>Variant Index</CardTitle>
              <CardDescription>
                designSystem.pen から自動生成。更新時は `pnpm -C designSystem pencil:variants`
                を実行してください。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  Components: {penVariantMeta.totalComponents}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Variants: {penVariantMeta.totalVariants}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Source: v{penVariantMeta.sourceVersion}
                </Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {penVariantEntries.map(([component, variants]) => (
                  <div key={component} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{component}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {variants.length}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {variants.map((variant) => (
                        <Badge
                          key={`${component}-${variant}`}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {variant}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ====== Buttons ====== */}
        <section>
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Button
          </h2>
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="pt-8 space-y-8">
              {(['default', 'sm', 'lg'] as const).map((size) => (
                <div key={size} className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {size}
                  </p>
                  <div className="flex flex-wrap items-center gap-[var(--spacing-md)]">
                    <Button size={size}>Default</Button>
                    <Button size={size} variant="secondary">
                      Secondary
                    </Button>
                    <Button size={size} variant="outline">
                      Outline
                    </Button>
                    <Button size={size} variant="destructive">
                      Destructive
                    </Button>
                    <Button size={size} variant="ghost">
                      Ghost
                    </Button>
                    <Button size={size} variant="link">
                      Link
                    </Button>
                  </div>
                  {size !== 'lg' && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* ====== Badge ====== */}
        <section>
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Badge
          </h2>
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="pt-8">
              <div className="flex flex-wrap items-center gap-[var(--spacing-md)]">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ====== Inputs & Controls ====== */}
        <section>
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Inputs & Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--spacing-lg)]">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--font-size-lg)' }}>Text Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-[var(--spacing-lg)]">
                <Input placeholder="Default input" />
                <Input placeholder="Disabled input" disabled />
                <Input type="password" placeholder="Password" />
              </CardContent>
            </Card>
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle style={{ fontSize: 'var(--font-size-lg)' }}>Checkbox</CardTitle>
              </CardHeader>
              <CardContent className="space-y-[var(--spacing-lg)]">
                <div className="flex items-center gap-[var(--spacing-sm)]">
                  <Checkbox id="cb-checked" defaultChecked />
                  <label htmlFor="cb-checked" className="text-sm font-medium cursor-pointer">
                    Checked
                  </label>
                </div>
                <div className="flex items-center gap-[var(--spacing-sm)]">
                  <Checkbox id="cb-unchecked" />
                  <label htmlFor="cb-unchecked" className="text-sm font-medium cursor-pointer">
                    Unchecked
                  </label>
                </div>
                <div className="flex items-center gap-[var(--spacing-sm)]">
                  <Checkbox id="cb-disabled" disabled />
                  <label
                    htmlFor="cb-disabled"
                    className="text-sm font-medium text-muted-foreground cursor-not-allowed"
                  >
                    Disabled
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ====== Cards ====== */}
        <section>
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Card
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--spacing-lg)]">
            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>Basic Card</CardTitle>
                <CardDescription>A standard card with action.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card body content goes here with adaptive typography.
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Action</Button>
              </CardFooter>
            </Card>

            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>Metric Card</CardTitle>
                  <CardDescription className="mt-1">Updated just now</CardDescription>
                </div>
                <Badge variant="secondary">Live</Badge>
              </CardHeader>
              <CardContent>
                <p className="font-bold" style={{ fontSize: 'var(--font-size-3xl)' }}>
                  98.2%
                </p>
                <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }}>
                  Uptime this month
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-md)]">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-[var(--spacing-md)]">
                {[
                  { name: 'Alice Johnson', role: 'Engineer' },
                  { name: 'Bob Smith', role: 'Designer' },
                  { name: 'Carol White', role: 'PM' },
                ].map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p
                        className="text-muted-foreground"
                        style={{ fontSize: 'var(--font-size-sm)' }}
                      >
                        {m.role}
                      </p>
                    </div>
                    <Badge variant="outline">{m.role}</Badge>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" size="sm">
                  View All
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* ====== Separator ====== */}
        <section className="pb-24">
          <h2
            className="font-bold tracking-tight mb-6"
            style={{ fontSize: 'var(--font-size-2xl)' }}
          >
            Separator
          </h2>
          <Card className="shadow-[var(--shadow-md)]">
            <CardContent className="pt-8 space-y-[var(--spacing-xl)]">
              <div className="space-y-[var(--spacing-md)]">
                <p style={{ fontSize: 'var(--font-size-sm)' }} className="font-medium">
                  Above the separator
                </p>
                <Separator />
                <p style={{ fontSize: 'var(--font-size-sm)' }} className="text-muted-foreground">
                  Below the separator
                </p>
              </div>
              <div className="flex items-center h-8 gap-[var(--spacing-md)]">
                <span style={{ fontSize: 'var(--font-size-sm)' }}>Left content</span>
                <Separator orientation="vertical" />
                <span style={{ fontSize: 'var(--font-size-sm)' }}>Right content</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

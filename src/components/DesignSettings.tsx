import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/design-system';
import { Maximize, Palette, RotateCcw, Square, Type } from 'lucide-react';
import { type ThemeMode, useDesignSystem } from '../hooks/use-design-system';

export function DesignSettings() {
  const { settings, updateSettings, resetSettings } = useDesignSystem();

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Palette className="h-4 w-4" />
          カラーテーマ
        </div>
        <Select
          value={settings?.theme || 'light'}
          onValueChange={(value) => updateSettings({ theme: value as ThemeMode })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="テーマを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">ライト</SelectItem>
            <SelectItem value="dark">ダーク</SelectItem>
            <SelectItem value="tokyonight">Tokyo Night</SelectItem>
            <SelectItem value="eclipse">Eclipse</SelectItem>
            <SelectItem value="macosclassic">macOS Classic</SelectItem>
            <SelectItem value="fire">Fire</SelectItem>
            <SelectItem value="classicterminal">Classic Terminal</SelectItem>
            <SelectItem value="sakurabloom">Sakura Bloom</SelectItem>
            <SelectItem value="leafmint">Leaf Mint</SelectItem>
            <SelectItem value="lattecream">Latte Cream</SelectItem>
            <SelectItem value="sunshineOrange">Sunshine Orange</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Maximize className="h-4 w-4" />
          UI密度 (余白)
        </div>
        <ToggleGroup
          value={String(settings?.density ?? 1)}
          onValueChange={(value) => updateSettings({ density: Number.parseFloat(value) })}
          className="grid grid-cols-3 gap-0"
        >
          <ToggleGroupItem value="0.75" id="density-compact">
            コンパクト
          </ToggleGroupItem>
          <ToggleGroupItem value="1" id="density-default">
            標準
          </ToggleGroupItem>
          <ToggleGroupItem value="1.25" id="density-comfortable">
            ゆったり
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Square className="h-4 w-4" />
          角丸
        </div>
        <ToggleGroup
          value={String(settings?.radius ?? 1)}
          onValueChange={(value) => updateSettings({ radius: Number.parseFloat(value) })}
          className="grid grid-cols-4 gap-0"
        >
          <ToggleGroupItem value="0" id="radius-sharp">
            なし
          </ToggleGroupItem>
          <ToggleGroupItem value="0.5" id="radius-sm">
            小
          </ToggleGroupItem>
          <ToggleGroupItem value="1" id="radius-md">
            標準
          </ToggleGroupItem>
          <ToggleGroupItem value="2" id="radius-lg">
            大
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Type className="h-4 w-4" />
          文字サイズ
        </div>
        <ToggleGroup
          value={String(settings?.fontSize ?? 1)}
          onValueChange={(value) => updateSettings({ fontSize: Number.parseFloat(value) })}
          className="grid grid-cols-3 gap-0"
        >
          <ToggleGroupItem value="0.875" id="font-sm">
            小
          </ToggleGroupItem>
          <ToggleGroupItem value="1" id="font-md">
            標準
          </ToggleGroupItem>
          <ToggleGroupItem value="1.125" id="font-lg">
            大
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 border-dashed h-10"
        onClick={resetSettings}
      >
        <RotateCcw className="h-4 w-4" />
        設定をリセット
      </Button>
    </div>
  );
}

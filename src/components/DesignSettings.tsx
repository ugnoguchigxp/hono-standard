import {
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
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
          value={settings.theme}
          onValueChange={(value) => updateSettings({ theme: value as ThemeMode })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="テーマを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="theme-light">ライト</SelectItem>
            <SelectItem value="theme-dark">ダーク</SelectItem>
            <SelectItem value="theme-tokyo-night">Tokyo Night</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator variant="muted" />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Maximize className="h-4 w-4" />
          UI密度 (余白)
        </div>
        <RadioGroup
          value={settings.density.toString()}
          onValueChange={(value) => updateSettings({ density: Number.parseFloat(value as string) })}
          className="grid grid-cols-1 gap-3"
        >
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="0.75" id="density-compact" />
            <Label htmlFor="density-compact" className="cursor-pointer">
              コンパクト
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="1.0" id="density-default" />
            <Label htmlFor="density-default" className="cursor-pointer">
              標準
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="1.25" id="density-comfortable" />
            <Label htmlFor="density-comfortable" className="cursor-pointer">
              ゆったり
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator variant="muted" />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Square className="h-4 w-4" />
          角丸
        </div>
        <RadioGroup
          value={settings.radius.toString()}
          onValueChange={(value) => updateSettings({ radius: Number.parseFloat(value as string) })}
          className="grid grid-cols-1 gap-3"
        >
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="0" id="radius-sharp" />
            <Label htmlFor="radius-sharp" className="cursor-pointer">
              シャープ
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="0.5" id="radius-sm" />
            <Label htmlFor="radius-sm" className="cursor-pointer">
              小
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="1.0" id="radius-md" />
            <Label htmlFor="radius-md" className="cursor-pointer">
              標準
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="2.0" id="radius-lg" />
            <Label htmlFor="radius-lg" className="cursor-pointer">
              大
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator variant="muted" />

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Type className="h-4 w-4" />
          文字サイズ
        </div>
        <RadioGroup
          value={settings.fontSize.toString()}
          onValueChange={(value) =>
            updateSettings({ fontSize: Number.parseFloat(value as string) })
          }
          className="grid grid-cols-1 gap-3"
        >
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="0.875" id="font-sm" />
            <Label htmlFor="font-sm" className="cursor-pointer">
              小
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="1.0" id="font-md" />
            <Label htmlFor="font-md" className="cursor-pointer">
              標準
            </Label>
          </div>
          <div className="flex items-center gap-3 space-x-2">
            <RadioGroupItem value="1.125" id="font-lg" />
            <Label htmlFor="font-lg" className="cursor-pointer">
              大
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Separator variant="muted" />

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

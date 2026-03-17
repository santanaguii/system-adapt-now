import { FontFamily, FontSize, ColorTheme, ThemeMode, NoteLineSpacing, AppearanceSettings } from '@/types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Monitor, Moon, Sun } from 'lucide-react';

interface AppearanceSettingsProps {
  appearance: AppearanceSettings;
  onUpdate: (updates: Partial<AppearanceSettings>) => void;
}

const fonts: { value: FontFamily; label: string; sample: string }[] = [
  { value: 'inter', label: 'Inter', sample: 'font-sans' },
  { value: 'system', label: 'System UI', sample: 'font-sans' },
  { value: 'roboto', label: 'Roboto', sample: 'font-sans' },
  { value: 'opensans', label: 'Open Sans', sample: 'font-sans' },
  { value: 'poppins', label: 'Poppins', sample: 'font-sans' },
];

const fontSizes: { value: FontSize; label: string; size: string }[] = [
  { value: 'small', label: 'Pequeno', size: '14px' },
  { value: 'medium', label: 'Médio', size: '16px' },
  { value: 'large', label: 'Grande', size: '18px' },
];

const colorThemes: { value: ColorTheme; label: string; color: string }[] = [
  { value: 'amber', label: 'Âmbar', color: 'hsl(35, 90%, 50%)' },
  { value: 'blue', label: 'Azul', color: 'hsl(220, 90%, 50%)' },
  { value: 'green', label: 'Verde', color: 'hsl(150, 70%, 40%)' },
  { value: 'purple', label: 'Roxo', color: 'hsl(270, 70%, 55%)' },
  { value: 'pink', label: 'Rosa', color: 'hsl(330, 70%, 55%)' },
];

const themeModes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Claro', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Escuro', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'Sistema', icon: <Monitor className="h-4 w-4" /> },
];

function getNoteSpacingLabel(value: NoteLineSpacing) {
  if (value <= 20) return 'Bem compacto';
  if (value <= 40) return 'Compacto';
  if (value <= 60) return 'Equilibrado';
  if (value <= 80) return 'Solto';
  return 'Bem espacoso';
}

export function AppearanceSettingsTab({ appearance, onUpdate }: AppearanceSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Font Family */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Família de Fonte</Label>
        <RadioGroup
          value={appearance.fontFamily}
          onValueChange={(v) => onUpdate({ fontFamily: v as FontFamily })}
          className="grid grid-cols-2 gap-2"
        >
          {fonts.map((font) => (
            <div key={font.value} className="flex items-center space-x-2">
              <RadioGroupItem value={font.value} id={`font-${font.value}`} />
              <Label
                htmlFor={`font-${font.value}`}
                className="font-normal cursor-pointer"
                style={{ fontFamily: font.value === 'system' ? 'system-ui' : font.value }}
              >
                {font.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Tamanho de Fonte</Label>
        <div className="flex gap-2">
          {fontSizes.map((size) => (
            <button
              key={size.value}
              onClick={() => onUpdate({ fontSize: size.value })}
              className={cn(
                "flex-1 py-3 px-4 rounded-lg border-2 transition-all",
                appearance.fontSize === size.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <span className="block font-medium" style={{ fontSize: size.size }}>
                Aa
              </span>
              <span className="text-xs text-muted-foreground">{size.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Theme */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Palheta de Cores</Label>
        <div className="flex gap-3">
          {colorThemes.map((theme) => (
            <button
              key={theme.value}
              onClick={() => onUpdate({ colorTheme: theme.value })}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                appearance.colorTheme === theme.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <div
                className="w-8 h-8 rounded-full shadow-sm"
                style={{ backgroundColor: theme.color }}
              />
              <span className="text-xs font-medium">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Theme Mode */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Modo</Label>
        <div className="flex gap-2">
          {themeModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onUpdate({ themeMode: mode.value })}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 transition-all",
                appearance.themeMode === mode.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              {mode.icon}
              <span className="font-medium">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Espacamento das notas</Label>
        <div className="rounded-xl border bg-muted/20 px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{getNoteSpacingLabel(appearance.noteLineSpacing)}</span>
            <span className="text-muted-foreground">{Math.round(appearance.noteLineSpacing)}%</span>
          </div>
          <Slider
            value={[appearance.noteLineSpacing]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => onUpdate({ noteLineSpacing: value ?? 50 })}
            className="py-2"
          />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Bem compacto</span>
            <span>Bem espacoso</span>
          </div>
        </div>
      </div>
    </div>
  );
}

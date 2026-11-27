import type { ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

/** One titled group of controls inside the panel. */
export function ControlSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid min-w-0 content-start gap-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  /** Turns the value into the text shown on the right, e.g. (v) => `${v} ms`. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

/** Compact slider with the label on the left and the value on the right. */
export function SliderField({ label, value, min, max, step, disabled, format, onChange }: SliderFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{format ? format(value) : value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => onChange(typeof next === 'number' ? next : next[0])}
      />
    </div>
  );
}

export interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SwitchField({ label, checked, onChange }: SwitchFieldProps) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Switch checked={checked} onCheckedChange={(next) => onChange(next)} />
      {label}
    </label>
  );
}

export interface ColorSwatchesProps {
  items: { key: string; label: string; value: string }[];
  onChange: (key: string, value: string) => void;
  /** Extra controls shown after the swatches (e.g. a reset button). */
  children?: ReactNode;
}

/** A row of small color pickers with a letter under each. */
export function ColorSwatches({ items, onChange, children }: ColorSwatchesProps) {
  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {items.map((item) => (
        <label key={item.key} className="grid justify-items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
          {item.label}
          <input
            type="color"
            value={item.value}
            title={`${item.label} face color`}
            onChange={(e) => onChange(item.key, e.target.value)}
            className="size-7 cursor-pointer rounded-md border bg-transparent p-0"
          />
        </label>
      ))}
      {children}
    </div>
  );
}

import type { ReactNode, RefObject } from 'react';
import { CaretDown, CaretLeft, CaretRight, SidebarSimple, SlidersHorizontal } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cx } from './utils';
import type { Dock } from './useDockLayout';

const GLASS = 'absolute z-30 border bg-background/65 shadow-2xl backdrop-blur-xl backdrop-saturate-150';

const OPEN_POSITION: Record<Dock, string> = {
  bottom: 'inset-x-3 bottom-3 max-h-[50%] rounded-2xl',
  left: 'bottom-3 left-3 top-3 w-[340px] max-w-[calc(100%-1.5rem)] rounded-2xl',
  right: 'bottom-3 right-3 top-3 w-[340px] max-w-[calc(100%-1.5rem)] rounded-2xl',
};

const COLLAPSED_POSITION: Record<Dock, string> = {
  bottom: 'bottom-3 left-1/2 -translate-x-1/2 rounded-full',
  left: 'left-3 top-1/2 -translate-y-1/2 rounded-full',
  right: 'right-3 top-1/2 -translate-y-1/2 rounded-full',
};

const DOCKS: { dock: Dock; label: string; iconClass: string }[] = [
  { dock: 'left', label: 'Dock left', iconClass: '' },
  { dock: 'bottom', label: 'Dock bottom', iconClass: '-rotate-90' },
  { dock: 'right', label: 'Dock right', iconClass: '-scale-x-100' },
];

export interface ControlPanelProps {
  title?: string;
  dock: Dock;
  effectiveDock: Dock;
  open: boolean;
  /** Hide the dock buttons (narrow screens always dock at the bottom). */
  showDockSwitch: boolean;
  onDockChange: (dock: Dock) => void;
  onOpenChange: (open: boolean) => void;
  panelRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Translucent control panel docked left, right or bottom. Collapsed, it is
 * just one button that brings the panel back.
 */
export function ControlPanel({
  title = 'Controls',
  dock,
  effectiveDock,
  open,
  showDockSwitch,
  onDockChange,
  onOpenChange,
  panelRef,
  children,
}: ControlPanelProps) {
  if (!open) {
    return (
      <section ref={panelRef} aria-label={title} className={cx(GLASS, COLLAPSED_POSITION[effectiveDock])}>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          title="Show controls"
          aria-label="Show controls"
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
        >
          <SlidersHorizontal size={18} />
        </Button>
      </section>
    );
  }

  const Collapse = effectiveDock === 'bottom' ? CaretDown : effectiveDock === 'left' ? CaretLeft : CaretRight;

  return (
    <section ref={panelRef} aria-label={title} className={cx(GLASS, 'flex flex-col overflow-hidden', OPEN_POSITION[effectiveDock])}>
      <div className="flex items-center gap-1 py-2 pl-3 pr-2">
        <SlidersHorizontal size={16} className="mr-1" />
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex-1" />
        {showDockSwitch &&
          DOCKS.map((d) => (
            <Button
              key={d.dock}
              variant={dock === d.dock ? 'secondary' : 'ghost'}
              size="icon"
              className="size-7"
              title={d.label}
              aria-label={d.label}
              aria-pressed={dock === d.dock}
              onClick={() => onDockChange(d.dock)}
            >
              <SidebarSimple size={16} className={d.iconClass} />
            </Button>
          ))}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title="Collapse panel"
          aria-label="Collapse panel"
          aria-expanded
          onClick={() => onOpenChange(false)}
        >
          <Collapse size={16} />
        </Button>
      </div>
      <div
        className={cx(
          'grid gap-x-5 gap-y-4 overflow-y-auto px-3 pb-3',
          effectiveDock === 'bottom' ? 'grid-cols-[repeat(auto-fit,minmax(14.5rem,1fr))]' : 'grid-cols-1',
        )}
      >
        {children}
      </div>
    </section>
  );
}

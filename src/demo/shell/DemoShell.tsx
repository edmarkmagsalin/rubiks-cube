import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ControlPanel } from './ControlPanel';
import { useDockLayout } from './useDockLayout';

export interface DemoShellProps {
  title: string;
  /** Icon shown before the title. */
  icon?: ReactNode;
  /** Shown right after the title (badges, links). */
  headerStart?: ReactNode;
  /** Shown at the right end of the header (theme toggle, links). */
  headerEnd?: ReactNode;
  /** A slim banner under the header (info or warning messages). */
  notice?: ReactNode;
  panelTitle?: string;
  /** Prefix for the remembered dock and open state, so several demos can coexist. */
  storageKey: string;
  /** The control sections. */
  panel: ReactNode;
  /** The stage: whatever the demo shows. It fills the space the panel leaves free. */
  children: ReactNode;
}

/**
 * Reusable demo page: header, full-size stage and a translucent control panel
 * that docks left, right or bottom. It knows nothing about what it displays.
 */
export function DemoShell({ title, icon, headerStart, headerEnd, notice, panelTitle, storageKey, panel, children }: DemoShellProps) {
  const layout = useDockLayout(storageKey);
  const panelRef = useRef<HTMLElement>(null);
  const [panelSize, setPanelSize] = useState(0);

  // Keep the stage clear of the panel: measure it and pad that side of the stage.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setPanelSize(layout.effectiveDock === 'bottom' ? rect.height : rect.width);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [layout.effectiveDock, layout.open]);

  const gap = panelSize + 12;
  const stagePadding: CSSProperties =
    layout.effectiveDock === 'bottom' ? { paddingBottom: gap } : layout.effectiveDock === 'left' ? { paddingLeft: gap } : { paddingRight: gap };

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        {icon}
        <h1 className="text-sm font-semibold">{title}</h1>
        {headerStart}
        <div className="flex-1" />
        {headerEnd}
      </header>
      {notice}
      <main className="relative min-h-0 flex-1">
        <div className="size-full" style={stagePadding}>
          {children}
        </div>
        <ControlPanel
          title={panelTitle}
          dock={layout.dock}
          effectiveDock={layout.effectiveDock}
          open={layout.open}
          showDockSwitch={!layout.narrow}
          onDockChange={layout.setDock}
          onOpenChange={layout.setOpen}
          panelRef={panelRef}
        >
          {panel}
        </ControlPanel>
      </main>
    </div>
  );
}

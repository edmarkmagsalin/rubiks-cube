import { Package } from '@phosphor-icons/react';

/** Small pill that links to the package page on npm. */
export function NpmBadge({ name, version }: { name: string; version?: string }) {
  return (
    <a
      href={`https://www.npmjs.com/package/${name}`}
      target="_blank"
      rel="noreferrer"
      title={`View ${name} on npm`}
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Package size={14} />
      npm
      {version && <span className="tabular-nums text-foreground">v{version}</span>}
    </a>
  );
}

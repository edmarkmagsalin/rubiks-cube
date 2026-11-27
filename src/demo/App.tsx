import { useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  Copy,
  Cpu,
  Cube,
  Hand,
  Image as ImageIcon,
  Info,
  Palette,
  Pause,
  Play,
  Shuffle,
  SpeakerHigh,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { RubiksCube, type LogoOptions, type RubiksCubeHandle } from '../RubiksCube';
import { DEFAULT_COLORS, FACES, type FaceColors } from '../core/constants';
import type { BackendKind } from '../core/webgpu';
import { formatMove, formatMoves, randomScramble, type Move } from '../core/moves';
import { SOLVED_STATE } from '../core/cubeState';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorSwatches, ControlSection, DemoShell, NpmBadge, SliderField, SwitchField } from './shell';

const PACKAGE_NAME = '@edmarkmagsalin/rubiks-cube';

const SAMPLE_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
      '<circle cx="128" cy="128" r="118" fill="#1d4ed8"/>' +
      '<path d="M128 52l22 52h56l-45 33 17 54-50-33-50 33 17-54-45-33h56z" fill="#fff"/></svg>',
  );

export function App() {
  const cubeRef = useRef<RubiksCubeHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [backend, setBackend] = useState<BackendKind | null>(null);
  const [duration, setDuration] = useState(300);
  const [sequence, setSequence] = useState("R U R' U' F2");
  const [stateInput, setStateInput] = useState('');
  const [currentState, setCurrentState] = useState(SOLVED_STATE);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [colors, setColors] = useState<FaceColors>({ ...DEFAULT_COLORS });
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState(0.75);
  const [logoRotation, setLogoRotation] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(0.5);

  // Props demo: open the page with ?state=<54 letters>&moves=R U R' U' to render a state / play moves on load.
  const initial = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return { state: q.get('state') ?? undefined, moves: q.get('moves') ?? undefined };
  }, []);

  const guard = (fn: () => void | Promise<unknown>) => {
    setError(null);
    Promise.resolve()
      .then(fn)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const logo: LogoOptions | null = logoSrc ? { src: logoSrc, scale: logoScale, rotation: logoRotation } : null;

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (logoSrc && logoSrc.startsWith('blob:')) URL.revokeObjectURL(logoSrc);
    setLogoSrc(URL.createObjectURL(file));
  };

  const onMoveEnd = (move: Move, source: 'api' | 'user') =>
    setLastMove(`${formatMove(move)} (${source === 'user' ? 'dragged' : 'played'})`);

  const notice =
    backend === 'webgl2' ? (
      <div role="status" className="flex shrink-0 items-start gap-2 bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Info size={16} className="mt-px shrink-0" />
        <span>
          WebGPU is not available in this browser, so the WebGL2 fallback is in use. Rendering still works, but WebGPU is
          recommended for best performance.
        </span>
      </div>
    ) : undefined;

  const panel = (
    <>
      <ControlSection title="Moves" icon={<Play size={14} />}>
        <div className="flex gap-1.5">
          <Input
            className="h-8 min-w-0 flex-1 font-mono text-xs"
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guard(() => cubeRef.current?.applyMoves(sequence))}
            placeholder="R U R' U' F2 M x"
            aria-label="Move sequence"
          />
          <Button size="icon" className="size-8" title="Play" aria-label="Play" onClick={() => guard(() => cubeRef.current?.applyMoves(sequence))}>
            <Play size={14} weight="fill" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            title="Scramble"
            aria-label="Scramble"
            onClick={() => guard(() => cubeRef.current?.applyMoves(formatMoves(randomScramble(20))))}
          >
            <Shuffle size={14} />
          </Button>
          <Button
            variant={paused ? 'secondary' : 'outline'}
            size="icon"
            className="size-8"
            title={paused ? 'Resume' : 'Pause'}
            aria-label={paused ? 'Resume' : 'Pause'}
            aria-pressed={paused}
            onClick={() => {
              if (paused) cubeRef.current?.resume();
              else cubeRef.current?.pause();
              setPaused(!paused);
            }}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Last move: <strong className="font-medium text-foreground">{lastMove ?? 'none yet'}</strong>
        </p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Hand size={14} className="mt-px shrink-0" />
          <span>
            Drag the background to rotate, drag the cube to turn a layer. Shift / Ctrl / Cmd + drag, or two fingers, turns the whole cube.
          </span>
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </ControlSection>

      <ControlSection title="State" icon={<UploadSimple size={14} />}>
        <Input
          className="h-8 font-mono text-xs"
          value={stateInput}
          onChange={(e) => setStateInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guard(() => cubeRef.current?.setState(stateInput))}
          placeholder="54 letters, U R F D L B order"
          aria-label="Cube state"
        />
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => guard(() => cubeRef.current?.setState(stateInput))}>
            <UploadSimple size={14} /> Set
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setError(null);
              cubeRef.current?.reset();
              setCurrentState(SOLVED_STATE);
            }}
          >
            <ArrowCounterClockwise size={14} /> Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => guard(() => navigator.clipboard.writeText(currentState))}
          >
            <Copy size={14} /> Copy
          </Button>
        </div>
        <p className="truncate font-mono text-[11px] text-muted-foreground" title={currentState}>
          {currentState}
        </p>
      </ControlSection>

      <ControlSection title="Appearance" icon={<Palette size={14} />}>
        <ColorSwatches
          items={FACES.map((f) => ({ key: f, label: f, value: colors[f] }))}
          onChange={(key, value) => setColors({ ...colors, [key]: value })}
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="Default colors"
            aria-label="Default colors"
            onClick={() => setColors({ ...DEFAULT_COLORS })}
          >
            <ArrowCounterClockwise size={14} />
          </Button>
        </ColorSwatches>
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={14} /> Logo
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLogoSrc(SAMPLE_LOGO)}>
            Sample
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!logoSrc} onClick={() => setLogoSrc(null)}>
            <X size={14} /> Remove
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-3">
          <SliderField label="Size" value={logoScale} min={0.2} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={setLogoScale} />
          <SliderField label="Rotate" value={logoRotation} min={0} max={359} step={1} format={(v) => `${v}\u00b0`} onChange={setLogoRotation} />
        </div>
      </ControlSection>

      <ControlSection title="Playback" icon={<SpeakerHigh size={14} />}>
        <SliderField label="Speed" value={duration} min={80} max={1000} step={10} format={(v) => `${v} ms`} onChange={setDuration} />
        <SwitchField label="Sound" checked={soundOn} onChange={setSoundOn} />
        <SliderField label="Volume" value={volume} min={0} max={1} step={0.05} disabled={!soundOn} format={(v) => `${Math.round(v * 100)}%`} onChange={setVolume} />
      </ControlSection>
    </>
  );

  return (
    <DemoShell
      title="Rubik’s Cube"
      icon={<Cube size={20} />}
      storageKey="demo-shell:rubiks-cube"
      headerStart={
        <>
          <NpmBadge name={PACKAGE_NAME} />
          {backend && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
              <Cpu size={14} />
              {backend === 'webgpu' ? 'WebGPU' : 'WebGL2 (fallback)'}
            </span>
          )}
        </>
      }
      headerEnd={<ThemeToggle />}
      notice={notice}
      panel={panel}
    >
      <RubiksCube
        ref={cubeRef}
        colors={colors}
        logo={logo}
        state={initial.state}
        moves={initial.moves}
        moveDuration={duration}
        sound={soundOn}
        volume={volume}
        onBackendReady={setBackend}
        onMoveEnd={onMoveEnd}
        onStateChange={setCurrentState}
        onError={(e) => setError(e.message)}
      />
    </DemoShell>
  );
}

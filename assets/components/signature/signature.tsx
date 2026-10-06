import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/* ══ Signature pad ════════════════════════════════════════
   Sign on the line. The ink thins as the pen moves faster and
   pools as it slows, the way a real nib does — which is most
   of what makes a scribble read as a signature rather than a
   trace of the mouse.

   ── AND THEN IT GETS OUT OF THE WAY ─────────────────────
   Pause after the last stroke and the pad folds itself into a
   small pill that says Signed — the whole card shrinking into
   the confirmation, rather than a line of small print under
   the signature. Press the pill to sign again.

   ── CLEAR REWINDS ───────────────────────────────────────
   Clear does not wipe. The ink un-draws, last point first, all
   the way back to the first touch — the signature taken back
   in the order it was given.

   ── SVG, NOT A CANVAS ───────────────────────────────────
   Every segment is its own short curve with its own width. A
   canvas would need its pixel ratio guessed for a block the
   wall draws at 0.8 and the overlay at 1.4, and would not
   follow the Fill control without being told to repaint; an
   SVG is crisp at any scale and its ink is currentColor. */

const W = 320;
const H = 180;
/* where the line is, in the block's own pixels */
const LINE_Y = 128;
const INSET = 28;
/* what the pad folds into */
const PILL_W = 112;
const PILL_H = 40;

type Pt = { x: number; y: number; w: number };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/* one stroke as short quadratic pieces through the midpoints,
   each as wide as the pen was there */
function pieces(s: Pt[], upto: number, key: string) {
  const out: React.ReactNode[] = [];
  const n = Math.min(s.length, upto);
  if (n <= 0) return out;
  if (n === 1 || s.length === 1) {
    out.push(<circle key={key} cx={s[0].x} cy={s[0].y} r={s[0].w / 2} fill="currentColor" />);
    return out;
  }
  for (let i = 1; i < n; i++) {
    const a = s[i - 1];
    const b = s[i];
    const start = i === 1 ? a : { x: (s[i - 2].x + a.x) / 2, y: (s[i - 2].y + a.y) / 2 };
    const end = i === s.length - 1 ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    out.push(
      <path
        key={`${key}-${i}`}
        d={`M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${a.x.toFixed(1)} ${a.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
        strokeWidth={((a.w + b.w) / 2).toFixed(2)}
      />,
    );
  }
  return out;
}

export function Signature({
  /* how heavy the pen is, 0..100 */
  pen = 50,
  /* how much the hand's wobble is taken out, 0..100 */
  smooth = 50,
  ink = "Black",
  /* how fast Clear un-draws, 0..100 */
  rewind = 50,
  corner = 16,
}: {
  pen?: number;
  smooth?: number;
  ink?: string;
  rewind?: number;
  corner?: number;
} = {}) {
  const pad = useRef<HTMLDivElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const [, setV] = useState(0);
  const redraw = () => setV((v) => v + 1);
  const [cut, setCut] = useState<number | null>(null);
  const [signed, setSigned] = useState(false);
  const down = useRef(false);
  const last = useRef({ x: 0, y: 0, t: 0, w: 0 });
  const later = useRef(0);
  const raf = useRef(0);
  const knobs = useRef({ pen, smooth, rewind });
  knobs.current = { pen, smooth, rewind };

  useEffect(() => () => {
    clearTimeout(later.current);
    cancelAnimationFrame(raf.current);
  }, []);

  /* the pen's two widths, both of which move with the knob so
     neither end of it is a pen that cannot vary */
  const widths = () => {
    const p = clamp(knobs.current.pen, 0, 100) / 100;
    return { thin: 0.8 + p * 2, thick: 2.2 + p * 5 };
  };

  /* the pointer, in the block's own pixels — the block is drawn
     scaled on the wall and in the overlay */
  const local = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };

  const rewinding = cut !== null;
  const total = strokes.current.reduce((n, s) => n + s.length, 0);
  const inked = total > 0;

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rewinding || signed) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a scripted pointer */ }
    down.current = true;
    clearTimeout(later.current);
    setSigned(false);
    const p = local(e);
    const { thin, thick } = widths();
    const w = (thin + thick) / 2;
    last.current = { ...p, t: performance.now(), w };
    strokes.current.push([{ ...p, w }]);
    redraw();
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!down.current) return;
    const raw = local(e);
    const l = last.current;
    /* smoothing: the pen follows the hand on a lag */
    const k = 1 - (clamp(knobs.current.smooth, 0, 100) / 100) * 0.75;
    const x = l.x + (raw.x - l.x) * k;
    const y = l.y + (raw.y - l.y) * k;
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < 0.8) return;
    const t = performance.now();
    const v = d / Math.max(1, t - l.t);
    const { thin, thick } = widths();
    /* fast is thin, slow pools; and the width itself eases, so
       a single quick frame cannot make a notch in the line */
    const target = thick - (thick - thin) * clamp(v / 1.6, 0, 1);
    const w = l.w + (target - l.w) * 0.35;
    last.current = { x, y, t, w };
    strokes.current[strokes.current.length - 1].push({ x, y, w });
    redraw();
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
    if (!down.current) return;
    down.current = false;
    clearTimeout(later.current);
    /* a pause after the last stroke is what signing IS */
    later.current = window.setTimeout(() => {
      if (!down.current && strokes.current.length) {
        setSigned(true);
      }
    }, 1500);
  };

  const clear = () => {
    if (!inked || rewinding) return;
    clearTimeout(later.current);
    setSigned(false);
    const n = total;
    const per = 2 + ((100 - clamp(knobs.current.rewind, 0, 100)) / 100) * 8;
    const dur = clamp(n * per, 350, 2400);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setCut(Math.round(n * (1 - ease(k))));
      if (k < 1) {
        raf.current = requestAnimationFrame(step);
        return;
      }
      strokes.current = [];
      setCut(null);
    };
    raf.current = requestAnimationFrame(step);
  };

  /* the pill, pressed: the ink goes while nobody can see it,
     and the pad opens back out empty */
  const again = () => {
    strokes.current = [];
    setSigned(false);
  };

  /* draw up to the cut, stroke by stroke */
  const ink$: React.ReactNode[] = [];
  let left = cut ?? Infinity;
  strokes.current.forEach((s, i) => {
    if (left <= 0) return;
    ink$.push(...pieces(s, left, String(i)));
    left -= s.length;
  });

  const r = clamp(corner, 0, 28);
  /* the Clear pill sits 10 in: concentric once there is a curve */
  const inner = Math.max(0, r - 10 * Math.min(1, r / 20));

  return (
    /* a fixed frame, so folding into the pill never rescales
       the block on the wall */
    <div className="sig-frame" style={{ width: W, height: H }}>
    <div
      ref={pad}
      className="sig"
      data-ink={ink}
      data-inked={(inked && !rewinding && !signed) || undefined}
      data-signed={signed || undefined}
      style={{
        /* width and height, never a scale: the corner has to stay
           a corner all the way down to the pill */
        width: signed ? PILL_W : W,
        height: signed ? PILL_H : H,
        "--r": signed ? `${PILL_H / 2}px` : `${r}px`,
        "--inner": `${Math.min(14, inner)}px`,
      } as React.CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* everything drawn on the pad, on one layer centred in the
          card: signing, it shrinks with the card into the pill's
          middle instead of being cut off by its edges */}
      <div className="sig-face">
      <span className="sig-line" style={{ top: LINE_Y, left: INSET, right: INSET }} aria-hidden="true" />
      <span className="sig-hint" aria-hidden="true">Sign here</span>
      <svg
        className="sig-ink"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label={inked ? "Signature" : "Empty signature pad"}
      >
        {ink$}
      </svg>
      </div>
      <button
        type="button"
        className="sig-clear"
        tabIndex={inked && !rewinding && !signed ? 0 : -1}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={clear}
      >
        Clear
      </button>
      <span className="sig-said" aria-live="polite">
        {signed && (
          <button
            type="button"
            className="sig-pill"
            aria-label="Signed. Sign again"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={again}
          >
            <Check size={14} strokeWidth={2.6} className="sig-check" />
            Signed
          </button>
        )}
      </span>
    </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Pointer capture is best effort and must never be the thing
   that decides whether the rest of a handler runs. It throws
   for a pointer id the element does not own, and anything
   sequenced after it is then silently skipped. Arm state
   first, capture last, and swallow the failure. */
const grab = (e: React.PointerEvent) => {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* the gesture still works through ordinary bubbling */
  }
};

/* ══ 3 · stepper that becomes a slider ════════════════════
   Tap for one, hold to sweep. A stepper is precise and slow;
   a slider is fast and vague. Almost every product picks one
   and makes the other job painful. This is both, on the same
   control, chosen by how long you hold it — so the coarse
   move never costs you the fine one. */

const WAKE = 260;      // hold this long and the rail appears

/* 23 is half of the 46px pill, so the default is the shape it
   already is and the slider only runs downwards from it. */
const STEP_CORNER = 23;

export function Stepper({ corner = STEP_CORNER }: { corner?: number } = {}) {
  const [v, setV] = useState(24);
  const [sweeping, setSweeping] = useState(false);
  /* which end is under the finger — that edge sinks a touch */
  const [held, setHeld] = useState<-1 | 0 | 1>(0);
  const rail = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const from = useRef({ x: 0, v: 0, dir: 1, stepped: false });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = (dir: 1 | -1) => (e: React.PointerEvent) => {
    e.stopPropagation();
    from.current = { x: e.clientX, v, dir, stepped: false };
    setHeld(dir);
    timer.current = window.setTimeout(() => { setSweeping(true); }, WAKE);
    grab(e);
  };

  const drag = (e: React.PointerEvent) => {
    if (!sweeping) return;
    const w = rail.current?.offsetWidth ?? 200;
    /* the whole rail spans 100, so the sweep is proportional
       to how wide the control actually is */
    const next = clamp(Math.round(from.current.v + ((e.clientX - from.current.x) / w) * 100), 0, 100);
    /* a sweep is the one gesture here that produces a
       continuous value, so it gets the continuous voice —
       pitched to where it has got to, and floored so a fast
       drag across the rail is a rise and not a rattle */
    setV(next);
  };

  const lift = () => {
    window.clearTimeout(timer.current);
    setHeld(0);
    if (!sweeping && !from.current.stepped) {
      from.current.stepped = true;
      setV((n) => clamp(n + from.current.dir, 0, 100));
    }
    setSweeping(false);
  };

  return (
    <div
      className="step-well"
      style={{ "--step-r": `${clamp(corner, 0, STEP_CORNER)}px` } as React.CSSProperties}
    >
      <div
        className="step-pill gpane"
        data-sweep={sweeping}
        /* a press sinks its own end; a sweep takes over from it */
        data-press={!sweeping && held ? (held < 0 ? "l" : "r") : undefined}
        ref={rail}
      >
        <button
          className="step-side"
          onPointerDown={press(-1)}
          onPointerMove={drag}
          onPointerUp={lift}
          onPointerCancel={lift}
          aria-label="Down"
        >
          <Minus size={16} strokeWidth={2} />
        </button>

        <span className="step-value">{v}</span>

        <button
          className="step-side"
          onPointerDown={press(1)}
          onPointerMove={drag}
          onPointerUp={lift}
          onPointerCancel={lift}
          aria-label="Up"
        >
          <Plus size={16} strokeWidth={2} />
        </button>

        <i className="step-fill" style={{ transform: `scaleX(${v / 100})` }} />
      </div>
      {/* ── no caption ───────────────────────────────────────
          There was a line of small caps under the pill that
          read "sweeping" while you held it, and it was doing
          two unhelpful things at once. It said in a word what
          the control was already showing you — the pill widens,
          the rail fills, the number swells — and because it was
          a flex sibling of the pill, its arrival RESIZED the
          column and shoved the pill 5px up out from under your
          own finger, mid-gesture.

          A control that moves when you touch it is worse than
          one that says nothing. */}
    </div>
  );
}

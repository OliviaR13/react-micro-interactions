import { useEffect, useRef, useState } from "react";

/* ══ Step player ══════════════════════════════════════════
   A row of dots and a play button. The dot for the current
   step is stretched into a bar that fills while the step runs;
   when it is full the bar eases over to the next dot, and a
   small wave runs through the dots it crossed.

   ── EVERY DOT IS A PILL WITH TWO EDGES ──────────────────
   There is no separate "active bar" travelling over the dots.
   Each dot is a pill with a left and a right edge, and the
   current step is simply the dot whose slot is wide. Changing
   step changes two slot widths and every edge eases to where
   its slot now is — which is what moves the bar, shrinks the
   old one and slides the dots in between.

   ── THE WAKE ────────────────────────────────────────────
   Chosen on the canvas from six ways of changing step, and
   then from seven kinds of ripple. The dots the bar passed
   over stand up and settle one after another, in the order it
   crossed them, and the bar it landed on answers last — a
   boat's wake rather than a stone dropped in a pond.

   Wake is also the knob, and its two ends were two of the
   seven: at 100 the whole wake, at 0 only the dot beside the
   landing moves, and the landing bar gives a small squash
   instead of a lift. Between them the wake reaches back over
   fewer dots and the landing's lift turns over into the
   squash. */

/* ── inlined from lab/spring ──────────────────────── */
/* ── one spring, for everything that settles ───────────────
   The maths was already on this bench twice, copied by hand:
   Humidity's wheel and Brightness's column both accumulate
   velocity toward a target, damp it, and snap when both the
   delta and the velocity fall under 0.02. Two copies is a
   coincidence; five would be a policy, so it comes out here
   before the elastic blocks are written against it.

   The two shipped copies are deliberately NOT refactored onto
   this. They work, they are tuned, and rewriting the innards
   of two live components to prove a point about duplication
   is how a good afternoon becomes a bad one. This is the one
   new code uses.

   Frames, not milliseconds. `dt` is expressed in sixtieths of
   a second and the damping is RAISED to it rather than
   multiplied by it, so a dropped frame decays the same amount
   of energy as the two frames it replaced. Multiplying is the
   version that makes a spring behave differently on a busy
   page, which is the hardest kind of bug to see.

   The loop parks itself the moment the value has settled.
   CLAUDE.md is not complimentary about the one permanent
   requestAnimationFrame already on this bench and there is no
   case for five more. */

/* Read once, the way the wheel and the pill nav do. A
   preference, not a live input. */
const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ── inlined from lab/Sound ──────────────────────── */
/* ══ Sound ════════════════════════════════════════════════
   A now-playing pill that opens into a player.

   ONE NUMBER IS THE STATE. There is a single spring running
   0 → 100, and every position, size, radius and type size
   below is read off it. Nothing has a transition of its own
   and nothing is on a clock — which is the whole reason the
   transformation reads as one object changing rather than as
   several elements that were told to move at the same time.
   With eight CSS transitions there are eight chances for one
   of them to arrive early; with one spring there are none.

   THE COVER IS THE HINGE. It is the only thing on the pill
   big enough to be recognised, so it is the thing the eye
   tracks, and it never disappears or crossfades — it travels
   from a 44px square at the left of a bar to a 220px square
   at the top of a card. Everything else takes its lead from
   where the cover went.

   The width never changes. A pill that also got wider would
   be growing in two directions at once, and the second one
   adds nothing: what a player does when it opens is show you
   more, downward. Holding the width still also means the
   right-hand controls only have to travel, not resize and
   travel — they slide in from the end of the bar and settle
   into a row under the art. */

const QUART = (t: number) => 1 - (1 - t) ** 4;
/* in AND out, for the one thing here that is a round trip
   between two shapes rather than an arrival at one */
const SWING = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

function useTween(to: number, ms: number, instant = false, ease = QUART) {
  const [at, setAt] = useState(to);
  const cur = useRef(to);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = to;
      setAt(to);
      return;
    }
    const from = cur.current;
    if (from === to) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      cur.current = from + (to - from) * ease(t);
      setAt(cur.current);
      raf.current = t < 1 ? requestAnimationFrame(step) : 0;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [to, ms, instant, ease]);

  return at;
}

/* ── the play mark is DRAWN, not swapped ───────────────────
   Two icons exchanged is a cut, however short you make the
   crossfade, and a transport button is the one control here
   you press more than once — a cut you see forty times is the
   thing you end up looking at.

   So both marks are the SAME two quadrilaterals, and the
   difference between them is where eight points are. The
   pause is a pair of bars; the play is that pair with the
   inner edges pulled to the middle and collapsed to a point,
   which is a triangle split down its own axis. Nothing
   appears and nothing leaves — the shapes are continuous the
   whole way, so there is no frame where the button is
   ambiguous about what it does.

   The points are lucide's own, so it sits at the same weight
   as the skip glyphs beside it: bars at x 6..10 and 14..18,
   a triangle from 6.5 to 20, stroked 2 with a round join,
   which is where the softened corners come from.

   Wound the same way in both — top-left, top-right,
   bottom-right, bottom-left — or the halves would turn
   inside out on the way across. The play's right half is a
   triangle written as a quad with its two right points on
   top of each other. */
const PAUSE_L = [6, 4, 10, 4, 10, 20, 6, 20] as const;
const PLAY_L = [6.5, 4, 13.25, 8, 13.25, 16, 6.5, 20] as const;
const PAUSE_R = [14, 4, 18, 4, 18, 20, 14, 20] as const;
const PLAY_R = [13.25, 8, 20, 12, 20, 12, 13.25, 16] as const;

const quad = (a: readonly number[], b: readonly number[], t: number) => {
  let d = "";
  for (let i = 0; i < 8; i += 2)
    d += `${i ? "L" : "M"}${mix(a[i], b[i], t).toFixed(2)} ${mix(
      a[i + 1],
      b[i + 1],
      t,
    ).toFixed(2)}`;
  return `${d}Z`;
};

function Mark({
  playing,
  size,
  still,
}: {
  playing: boolean;
  size: number;
  still: boolean;
}) {
  /* 0 is the pause, 1 is the play. Eased both ends, unlike
     the box's own move: this one leaves a shape as well as
     arriving at one, and a curve that only softens the
     landing snaps out of the shape it was. */
  const t = useTween(playing ? 0 : 1, 300, still, SWING);

  /* ── the goo ─────────────────────────────────────────────
     Zero at both ends and one in the middle, so everything
     below is a bulge on the way rather than a difference
     between the two states — press twice and it lands on
     exactly what it started as.

     Three things ride it, and they are all the same idea:
     the mark squashes across as it stretches up, the two
     halves lean into each other until they touch, and the
     whole thing tips a few degrees and comes back level. A
     shape that changes size without ever changing volume is
     what makes something read as soft rather than as
     redrawn. The tilt swaps sign with the direction, so
     pausing is not just playing run backwards. */
  const goo = Math.sin(clamp(t, 0, 1) * Math.PI);
  const pull = 1.6 * goo;
  const tip = (playing ? -9 : 9) * goo;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      /* per cent, not pixels: this is the element's own box
         and the box is whatever size the morph is at. */
      style={{
        transformOrigin: "50% 50%",
        transform: `rotate(${tip}deg) scale(${1 - 0.13 * goo}, ${1 + 0.11 * goo})`,
      }}
    >
      <path d={quad(PAUSE_L, PLAY_L, t)} transform={`translate(${pull} 0)`} />
      <path d={quad(PAUSE_R, PLAY_R, t)} transform={`translate(${-pull} 0)`} />
    </svg>
  );
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/* ── OUT, NOT IN-OUT ─────────────────────────────────────
   The fill arrives at a steady speed, and an ease-in-out
   leaves from a standstill — so for the first hundred-odd ms
   after a bar was full it barely moved, and the row read as
   freezing at the one moment it should be handing over. An
   ease-out leaves at speed and does its slowing on arrival. */
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);

/* a dot, the bar it becomes, and the air between them.
   Small on purpose. It was 14 / 64 / 12 and read as a toy
   rather than a control — and the wall draws a block up to
   1.25x, so what is written here is the SMALL end of what
   anybody sees. */
const DOT = 8;
const BAR = 36;
const GAP = 8;
/* the slab's inset round the row. Its height is the dot plus
   twice this, and the button beside it is that same height,
   so the two pills are one height by construction. */
const PAD = 14;
const H = DOT + PAD * 2;

/* the slide from one step to the next, ms — a touch longer
   than it was, because an ease-out spends its time landing */
const MOVE = 520;
/* the wave: when it starts after the move does, and how long
   one dot takes to stand up and settle. Earlier than it was,
   to follow an ease-out that covers most of its ground early. */
const LEAD = 60;
const RISE = 300;

export const MIN_STEPS = 3;
export const MAX_STEPS = 8;

/* where each dot's two edges belong, for a given current step */
const layout = (n: number, at: number) => {
  const out: [number, number][] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const w = i === at ? BAR : DOT;
    out.push([x, x + w]);
    x += w + GAP;
  }
  return out;
};

/* ── the wake, from the knob ─────────────────────────────
   `amp` is how far a dot stands up (a scale on its height),
   `reach` how many crossed dots back from the landing still
   answer, `self` the landing bar's share — positive lifts,
   negative squashes. */
const wakeOf = (w: number) => ({
  amp: mix(0.26, 0.34, w),
  reach: 1 + Math.round(w * 7),
  self: mix(-0.7, 0.3, w),
  stagger: mix(70, 55, w),
});

/* a spring for the rare edge with no timed move to follow —
   a knob changing the layout while nothing is animating */
const tune = (k: number, zeta: number) => ({ k, d: 1 - 2 * zeta * Math.sqrt(k) });
const SETTLE = tune(0.16, 1);

type Tween = { from: number; to: number; t0: number };
type Edge = { x: number; v: number; tw?: Tween };
type Dot = { l: Edge; r: Edge; ink: number };

export function StepPlayer({
  /* how many steps, MIN_STEPS..MAX_STEPS */
  steps = 5,
  /* seconds a step takes to fill */
  pace = 3,
  /* how far back the ripple runs, 0..100 */
  wake = 100,
}: {
  steps?: number;
  pace?: number;
  wake?: number;
} = {}) {
  const n = clamp(Math.round(steps), MIN_STEPS, MAX_STEPS);
  const still = stillness();
  const wk = wakeOf(clamp(wake, 0, 100) / 100);

  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  /* bumped each frame something moves, and nothing else reads it */
  const [, setTick] = useState(0);

  const prog = useRef(0);
  const dots = useRef<Dot[]>([]);
  const raf = useRef(0);
  const live = useRef({ at, playing, n, pace, wk });
  live.current = { at, playing, n, pace, wk };
  /* the wave running through the row, and where it came from */
  const wave = useRef<{ t0: number; origin: number; from: number } | null>(null);

  /* the dots follow the count; new ones start where they belong */
  if (dots.current.length !== n) {
    const slots = layout(n, Math.min(at, n - 1));
    dots.current = slots.map(([l, r], i) => ({
      l: { x: l, v: 0 },
      r: { x: r, v: 0 },
      ink: i < at ? 1 : 0,
    }));
  }
  if (at > n - 1) {
    /* a knob took the step we were on away */
    queueMicrotask(() => { setAt(n - 1); prog.current = 0; });
  }

  /* ── the one loop ────────────────────────────────────────
     Runs while anything is moving or the step is filling, and
     stops itself when neither is true, so a paused player on
     the wall costs nothing. Everything below reads refs, so the
     loop is started once per wake rather than per render. */
  const run = () => {
    if (raf.current) return;
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      const { at: cur, playing: on, n: count, pace: secs, wk: w } = live.current;
      const slots = layout(count, cur);
      let busy = false;

      /* the fill, and what happens when it is full */
      if (on) {
        prog.current += (dt * 16.67) / (Math.max(0.5, secs) * 1000);
        busy = true;
        if (prog.current >= 1) {
          if (cur < count - 1) {
            prog.current = 0;
            go(cur + 1, false);
          } else {
            prog.current = 1;
            setPlaying(false);
          }
        }
      }

      dots.current.forEach((d, i) => {
        const [tl, tr] = slots[i] ?? [0, 0];
        for (const [e, target] of [[d.l, tl], [d.r, tr]] as const) {
          if (still) { e.x = target; e.v = 0; e.tw = undefined; continue; }
          if (e.tw) {
            const u = clamp((t - e.tw.t0) / MOVE, 0, 1);
            e.x = mix(e.tw.from, e.tw.to, easeOut(u));
            if (u >= 1) e.tw = undefined;
            busy = true;
            continue;
          }
          e.v += (target - e.x) * SETTLE.k * dt;
          e.v *= Math.pow(SETTLE.d, dt);
          e.x += e.v * dt;
          if (Math.abs(target - e.x) < 0.02 && Math.abs(e.v) < 0.02) { e.x = target; e.v = 0; }
          else busy = true;
        }
        /* visited is full ink, the current one is the fill,
           the rest are empty. Eased toward, so a restart drains
           the row instead of blinking it. */
        const want = i < cur ? 1 : i === cur ? prog.current : 0;
        const next = still ? want : d.ink + (want - d.ink) * Math.min(1, 0.22 * dt);
        d.ink = Math.abs(want - next) < 0.002 ? want : next;
        if (d.ink !== want) busy = true;
      });

      if (wave.current && t - wave.current.t0 < LEAD + (w.reach + 1) * w.stagger + RISE) busy = true;
      else wave.current = null;

      setTick((k) => k + 1);
      raf.current = busy ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };

  /* the handle is cleared as well as cancelled: `run` reads a
     non-zero handle as "already running", and StrictMode's
     rehearsal unmount would otherwise leave one behind that
     nothing is running under */
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; }, []);
  /* a knob moving is a reason to re-settle */
  useEffect(() => { run(); }, [n, pace, at, playing]);

  /* ── changing step ───────────────────────────────────────
     Every edge gets one timed move to its new place, and the
     wave is started from where the bar left. */
  function go(to: number, fromHand: boolean) {
    const { at: cur, n: count } = live.current;
    if (to === cur) return;
    const will = layout(count, to);
    const now = performance.now();
    if (!still) {
      dots.current.forEach((d, i) => {
        d.l.tw = { from: d.l.x, to: will[i][0], t0: now };
        d.r.tw = { from: d.r.x, to: will[i][1], t0: now };
      });
      wave.current = { t0: now, origin: to, from: cur };
    }
    live.current.at = to;
    setAt(to);
    if (fromHand) prog.current = 0;
    run();
  }

  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    /* from the end, a press starts over — and the bar crosses
       the whole row back to the first dot */
    if (at === n - 1 && prog.current >= 1) {
      prog.current = 0;
      go(0, true);
    }
    setPlaying(true);
  };

  const pick = (i: number) => {
    if (i === at) return;
    go(i, true);
  };

  /* ── the wake, this frame ────────────────────────────────
     Only the dots the bar crossed, in the order it crossed
     them, and only as far back from the landing as the knob
     reaches; the landing bar answers last. The ink shares the
     transform, so the two never disagree about the shape. */
  const now = performance.now();
  const shape = (d: Dot, i: number) => {
    let sy = 1;
    const w = wave.current;
    if (w) {
      const span = Math.abs(w.origin - w.from);
      const skip = Math.max(0, span - wk.reach);
      const lo = Math.min(w.from, w.origin);
      const hi = Math.max(w.from, w.origin);
      let delay = -1;
      let share = 1;
      if (i === w.origin) {
        delay = Math.min(span, wk.reach) * wk.stagger;
        share = wk.self;
      } else if (i >= lo && i <= hi) {
        /* its place in the crossing, and whether it is near
           enough the landing to be in the wake at all */
        const k = Math.abs(i - w.from);
        if (span - k <= wk.reach) delay = (k - skip) * wk.stagger;
      }
      if (delay >= 0) {
        const u = (now - w.t0 - LEAD - delay) / RISE;
        if (u > 0 && u < 1) sy = 1 + Math.sin(Math.PI * u) * wk.amp * share;
      }
    }
    return `translateX(${d.l.x.toFixed(2)}px) scaleY(${sy.toFixed(3)})`;
  };

  const width = layout(n, 0).at(-1)![1];

  return (
    <div className="spl" data-playing={playing} role="group" aria-label={`Step ${at + 1} of ${n}`}>
      <div className="spl-row">
        <div className="spl-slab" style={{ padding: PAD, borderRadius: H / 2 }}>
          <div className="spl-track" style={{ width, height: DOT }}>
            {dots.current.map((d, i) => {
              const w = Math.max(0, d.r.x - d.l.x);
              return (
                <button
                  key={i}
                  className="spl-dot"
                  aria-label={`Step ${i + 1}`}
                  aria-current={i === at ? "step" : undefined}
                  onClick={() => pick(i)}
                  style={{ transform: shape(d, i), width: w }}
                >
                  <i
                    className="spl-ink"
                    style={{
                      /* never narrower than a dot, so a fill
                         starting is a dot of ink and not a
                         sliver */
                      width: d.ink > 0.001 ? Math.max(Math.min(DOT, w), w * d.ink) : 0,
                      /* …and that dot fades in over the first few
                         per cent, or a step that has only just
                         started looks like one already done */
                      opacity: i === at ? Math.min(1, d.ink * 14) : 1,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="spl-slab spl-tool" style={{ width: H, height: H, borderRadius: H / 2 }}>
          <button
            className="spl-go"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
          >
            <Mark playing={playing} size={14} still={still} />
          </button>
        </div>
      </div>
    </div>
  );
}

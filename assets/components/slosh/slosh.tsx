import { useEffect, useRef } from "react";

/* ══ playful blocks ═══════════════════════════════════════
   Two components whose behaviour is the joke. The material
   stays as quiet as everything else on this bench — no
   confetti, no exclamation marks, no sound. If the decoration
   is doing the work then the interaction is not.

   THE JOKE HAS TO RESOLVE. A button that never lets itself be
   clicked is friction with a smirk on it. A button that
   dodges four times and then gives up is a small story with
   an ending, and the ending is the reason it is worth
   shipping rather than a garnish on top of one.

   Which makes one rule absolute here: none of these may trap
   anybody. Every one of them completes, every one of them
   completes within a few seconds, and every one of them
   completes from the keyboard on the first try — the tease is
   a pointer phenomenon and a person who is not using a
   pointer is not the audience for it. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* Read once, like the wheel and the pill nav do. This is a
   preference, not a live input — a person who changes it
   mid-session gets it on the next render of the page, which
   is soon enough and costs nothing to be wrong about. */
const still = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ══ 3 · Slosh ════════════════════════════════════════════
   A slider whose value has mass.

   The handle is rigid — it is under your finger and anything
   under a finger that lags it is broken. The FILL is a second
   spring behind it, softer and barely damped, so a fast drag
   throws it past the handle, into the end stop, and rocks it
   back two or three times before it settles. Release halfway
   and the handle coasts on the velocity it actually had
   rather than stopping dead where you let go.

   The tilt is what sells it as liquid. A bar that lags is a
   laggy bar; a bar whose leading edge leans in the direction
   it is travelling is a surface with a meniscus on it. Same
   lag, entirely different object.

   Nothing here goes through React. The loop writes width, a
   custom property and one text node straight onto three
   elements, and it stops the moment everything is at rest —
   there is one permanent rAF on this bench already and
   CLAUDE.md is not complimentary about it. */

/* the track's corner. 13 is what it was drawn at and 20 is
   half of its 40px height — the pill, which is as round as a
   40px track can be. The knob inside stays a circle: it is a
   ball in a slot, and a square ball is a different object. */
const SLO_CORNER = 13;
const SLO_MAX = 20;

export function Slosh({
  /* 0 is a rigid fill, 100 is loose liquid. 15 is a fill with
     a little give rather than a wave in a glass — at 40 the
     surface was the loudest thing on a block whose subject is
     the value being set. */
  viscosity = 15,
  /* how far it coasts after release, 0..100 */
  momentum = 55,
  /* lean on the leading edge, 0..100 */
  tilt = 45,
  /* the corner it is cut with */
  corner = SLO_CORNER,
}: {
  viscosity?: number;
  momentum?: number;
  tilt?: number;
  corner?: number;
} = {}) {
  const track = useRef<HTMLDivElement | null>(null);
  const fillEl = useRef<HTMLDivElement | null>(null);
  const knobEl = useRef<HTMLDivElement | null>(null);
  const reduced = still();

  /* the handle, its velocity after release, and the fill
     chasing it with a velocity of its own */
  const val = useRef(62);
  const hv = useRef(0);
  const fill = useRef(62);
  const fv = useRef(0);
  const held = useRef(false);
  const raf = useRef(0);
  /* the last two samples, which is all a release velocity is */
  const last = useRef({ v: 62, t: 0 });

  /* live, so the loop reads what the panel is currently set
     to without restarting on every drag of a knob */
  const knobs = useRef({ viscosity, momentum, tilt, reduced });
  knobs.current = { viscosity, momentum, tilt, reduced };

  /* the loop parks itself when everything is at rest, so
     every handler below needs a way to wake it back up */
  const run = useRef<() => void>(() => {});

  useEffect(() => {
    const paint = () => {
      const f = fillEl.current;
      const k = knobEl.current;
      const t = track.current;
      if (!f || !k || !t) return;
      f.style.width = `${fill.current.toFixed(2)}%`;
      k.style.left = `${val.current.toFixed(2)}%`;
      /* the meniscus. Proportional to how fast the fill is
         actually moving, so it is upright at rest and cannot
         be a decoration — there is nothing to decorate when
         nothing is travelling. */
      const lean = knobs.current.reduced
        ? 0
        : clamp((knobs.current.tilt / 100) * fv.current * 3, -20, 20);
      f.style.setProperty("--lean", `${lean.toFixed(2)}px`);
      t.setAttribute("aria-valuenow", String(Math.round(val.current)));
    };

    const rest = () =>
      !held.current &&
      Math.abs(hv.current) < 0.01 &&
      Math.abs(fv.current) < 0.01 &&
      Math.abs(val.current - fill.current) < 0.02;

    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      const { viscosity: v, momentum: m, reduced: flat } = knobs.current;

      /* the coast. Friction is per frame, so it is raised to
         dt rather than multiplied by it — a dropped frame must
         not double the deceleration. */
      if (!held.current && hv.current) {
        val.current += hv.current * dt;
        hv.current *= Math.pow(0.86 + (m / 100) * 0.115, dt);
        if (val.current <= 0 || val.current >= 100) {
          val.current = clamp(val.current, 0, 100);
          hv.current = 0;
        }
        if (Math.abs(hv.current) < 0.01) hv.current = 0;
      }

      const soft = flat ? 0 : v / 100;
      if (soft === 0) {
        /* 0 is an ordinary slider and has to be exactly that,
           not a very stiff spring that still rings */
        fill.current = val.current;
        fv.current = 0;
      } else {
        /* stiffness falls and damping rises together: thin
           liquid is slow to answer and slow to forget, which
           is the same thing said twice and is why these are
           one knob rather than two */
        const stiff = 0.34 - soft * 0.29;
        const damp = 0.74 + soft * 0.22;
        fv.current += (val.current - fill.current) * stiff * dt;
        fv.current *= Math.pow(damp, dt);
        fill.current += fv.current * dt;
        /* the end stop is a wall, and a wall gives some back.
           Without this the overshoot at the top of the track
           is simply swallowed and the liquid stops behaving
           like liquid exactly where you are looking at it. */
        if (fill.current > 100) {
          fill.current = 100;
          fv.current = -fv.current * 0.42;
        } else if (fill.current < 0) {
          fill.current = 0;
          fv.current = -fv.current * 0.42;
        }
        if (Math.abs(val.current - fill.current) < 0.02 && Math.abs(fv.current) < 0.02) {
          fill.current = val.current;
          fv.current = 0;
        }
      }

      paint();
      if (rest()) {
        raf.current = 0;
        prev = 0;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };

    run.current = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };
    paint();
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, []);

  /* offset maths, then divided by the zoom: the same rect the
     canvas would skew, used only for its origin and its
     scale */
  const readAt = (clientX: number) => {
    const t = track.current;
    if (!t) return 0;
    const box = t.getBoundingClientRect();
    const k = box.width / (t.offsetWidth || box.width) || 1;
    return clamp(((clientX - box.left) / k / t.offsetWidth) * 100, 0, 100);
  };

  const grab = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    held.current = true;
    hv.current = 0;
    val.current = readAt(e.clientX);
    last.current = { v: val.current, t: e.timeStamp };
    run.current();
  };

  const move = (e: React.PointerEvent) => {
    if (!held.current) return;
    const v = readAt(e.clientX);
    const dt = Math.max(1, e.timeStamp - last.current.t);
    /* per frame, not per ms — the whole loop is in frames and
       a release velocity in the other unit is a hundred times
       too big */
    hv.current = ((v - last.current.v) / dt) * 16.67;
    last.current = { v, t: e.timeStamp };
    val.current = v;
    run.current();
  };

  const drop = () => {
    if (!held.current) return;
    held.current = false;
    /* it leaves along the velocity it actually had, capped so
       a flick across the whole track does not simply pin it */
    hv.current = clamp(hv.current, -6, 6);
    if (knobs.current.reduced) hv.current = 0;
    run.current();
  };

  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? val.current + step
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? val.current - step
      : e.key === "Home" ? 0
      : e.key === "End" ? 100
      : null;
    if (to === null) return;
    e.preventDefault();
    hv.current = 0;
    val.current = clamp(to, 0, 100);
    run.current();
  };

  return (
    <div
      className="ply slo"
      style={{ "--slo-r": `${clamp(corner, 0, SLO_MAX)}px` } as React.CSSProperties}
    >
      {/* ── NOTHING BUT THE TRACK ────────────────────────
          There was a label and a big number over it, and the
          number was the best argument for removing them: it
          read the FILL rather than the handle, so it lagged
          and overshot and rocked into place — a second telling
          of the one thing the liquid is already saying, in
          digits, louder than the thing itself.

          The slosh is the component. A caption and a readout
          bracketing a track is what every slider in every kit
          looks like, and it was the only part of this one that
          was. */}
      <div
        className="slo-track"
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Flow"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={62}
        onPointerDown={grab}
        onPointerMove={move}
        onPointerUp={drop}
        onPointerCancel={drop}
        onKeyDown={key}
      >
        <div className="slo-fill" ref={fillEl} />
        <div className="slo-knob" ref={knobEl} />
      </div>
    </div>
  );
}

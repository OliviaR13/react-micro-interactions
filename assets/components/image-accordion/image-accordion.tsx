import { useEffect, useRef, useState } from "react";

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

/* 0..100 into the two numbers a spring actually has.

   50 is what Humidity and Brightness were tuned at, which is
   the rule every elastic knob on this bench follows — see
   lab/motion. Turn the panel to the middle and nothing has
   changed.

   Both ends have to be usable, which is what fixes the range:
   at 0 it is slow and heavy and still arrives, at 100 it is
   quick with a visible overshoot, and nowhere in between does
   it ring for longer than it takes to read. */
/* The pair is chosen by DAMPING RATIO and then written back
   as stiffness and decay, because the ratio is the thing a
   person is actually setting and the two numbers on their own
   do not say what they add up to.

     zeta = -ln(d) / (2 * sqrt(k))

   The first version of this ran 0.06..0.26 stiffness against
   0.93..0.74 decay, which reads as a sensible spread and is
   not one: it puts zeta between 0.15 and 0.16 across the
   WHOLE range, so every setting overshot by about sixty per
   cent and the knob only changed how fast it did it. Pull's
   return went 130px past its own resting position and lifted
   the content off the top of the card.

     0   → zeta ~0.85, heavy, arrives without a ring
     50  → zeta ~0.41, near where Humidity and Brightness sit
     100 → zeta ~0.20, lively, two visible rebounds

   Both ends shippable, which is the constraint that fixed the
   numbers rather than taste. */
const springOf = (tune: number) => ({
  /* stiffness: how hard it is pulled toward the target */
  k: 0.08 + (tune / 100) * 0.16,
  /* decay, per frame: how much of the velocity survives */
  d: 0.62 + (tune / 100) * 0.2,
});

/* Units matter. The snap threshold is absolute, so a caller
   works in pixels or in 0..100 — a spring driven over 0..1
   would be "settled" before it had visibly moved. */
function useSpring(target: number, tune = 50, instant = false) {
  const [at, setAt] = useState(target);
  const cur = useRef(target);
  const vel = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = target;
      vel.current = 0;
      setAt(target);
      return;
    }
    const { k, d } = springOf(tune);
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      vel.current += (target - cur.current) * k * dt;
      vel.current *= Math.pow(d, dt);
      cur.current += vel.current * dt;
      if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
        cur.current = target;
        vel.current = 0;
        setAt(target);
        raf.current = 0;
        return;
      }
      setAt(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    /* `tune` sits here beside `target` for the reason
       Brightness spells out: the loop closes over it, so
       without it a knob turned mid-flight would do nothing
       until something else restarted the effect. Restarting
       picks up from the refs, so it continues rather than
       snapping. */
  }, [target, tune, instant]);

  return at;
}

/* Read once, the way the wheel and the pill nav do. A
   preference, not a live input. */
const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* SHOTS was Bencho's own pictures, which is not licensed
   to travel. Point this at yours. */
const SHOTS: { name: string; src: string }[] = [];

/* ══ Image accordion ═══════════════════════════════════════
   A row of pictures cropped to slivers. Point at one and it
   opens; the others give up exactly what it takes.

   ── THE ROW IS A FIXED WIDTH, AND THAT IS THE COMPONENT ───
   Nothing here grows. The strip is 340px whatever is
   happening inside it, so opening a picture is a NEGOTIATION
   rather than an expansion: every pixel the one you are
   pointing at gains, the other four have paid for between
   them. That is what makes it feel like one object with
   pieces rather than five cards that happen to be in a line —
   and it is why the layout is flexbox with five grow numbers
   rather than five widths worked out by hand. Flex does the
   arithmetic of who pays, at every count and every gap, and
   it cannot be got wrong.

   ── AND THE SWELL CARRIES ─────────────────────────────────
   The neighbours of the open picture open a little too. The
   reflex is one panel wide and four panels narrow, which
   reads as a switch being thrown; a falloff reads as a force
   arriving somewhere. Same argument the magnetic select makes
   about its cluster, and the same shape of arithmetic.

   `Reach` is that falloff, exposed — and it is the knob worth
   having here, because the two ends are two different
   components. Tight, ONE picture opens and the rest stay a
   set of slivers. Wide, the whole row leans toward your
   cursor and the open one is only the middle of a swell.

   ── WHY POINTING IS STABLE ────────────────────────────────
   Worth writing down, because a row that resizes under the
   cursor sounds like it should oscillate and does not: the
   picture you point at is the one that GROWS. Its edges move
   away from your pointer, never across it, so it cannot
   shrink out from under you and hand the hover to a
   neighbour. Everything that shrinks is something you are not
   on.

   Taken from a pattern Toggle Supply publishes — the fixed
   row, the falloff into the neighbours, the cover crop that
   re-frames instead of stretching. Written from scratch
   against Bencho's own spring and knobs rather than copied. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── the strip's own size ──────────────────────────────────
   Fixed, like every block here: the wall measures what a
   component draws and scales it, so a block that sized itself
   from its container would be a different shape in the wall,
   the overlay and the canvas.

   340 across and 300 down. At the default gap that is five
   pictures a little under 62 wide against 300 tall — about
   one to five, which is the ratio at which a photograph stops
   being a photograph and becomes a stripe of colour. That is
   the point of the shut state: you can see there are five
   pictures and you cannot see what any of them is.

   The strip's width is NOT a function of the count. Take a
   picture out of KEEP and the rest get wider rather than the
   block getting narrower — which is the right way round: the
   wall scales a block by its longest side, so a narrower strip
   would be a TALLER tile drawn smaller, and the block would
   change its footprint over a decision about its contents. */
const W = 340;
const H = 300;

/* ── the pictures ──────────────────────────────────────────
   The carousel's five, reused rather than another set of
   photographs inlined into the bundle. They are already
   800x1200 portrait, which is the one shape this block wants,
   and a second 150KB of base64 to show the same idea would be
   most of a megabyte of prompt for the person who copies it.

   ── NAMED, NOT TAKEN WHOLE ───────────────────────────────
   `SHOTS` itself would do the same thing today and would
   silently do something else the moment a sixth picture went
   into src/assets/carousel: the order there is whatever the
   filenames sort to, so a new file would arrive in this strip
   and change what it is, unasked. shots.ts carries each
   filename for exactly this reason and the carousel already
   picks by name.

   So this list is the block's own, and it is the one place to
   change what is in the strip or how many. */
const KEEP = ["bird", "cow", "house", "man", "queue"];
const PICS = KEEP.map((name) => SHOTS.find((s) => s.name === name)!);

/* ── the corner, and it FOLLOWS THE GAP ────────────────────
   A rounded picture next to a rounded picture with no air
   between them leaves a little notch of page showing at every
   join — eight of them, top and bottom, right down the middle
   of the strip. The usual fix is to pin the radius, which
   trades a knob for a bug.

   So the radius is the gap, capped at its own maximum. At Gap
   0 the pictures are square and the strip is one continuous
   band; by Gap 12 each picture is fully rounded and standing
   on its own. There is no setting in between where a notch
   can appear, because the radius can never be larger than the
   air it has to fit into.

   ── AND THE STRIP TAKES THE SAME NUMBER ──────────────────
   It used to keep a flat 12 of its own and clip, on the
   argument that the band should have round outer corners at
   Gap 0 whatever the pictures were doing. That argument was
   wrong and the result was visible: the strip's clip cuts the
   first picture's LEFT corners and the last one's RIGHT, so
   at any gap under 12 the two pictures on the ends were
   rounder on their outside edge than on their inside one, and
   rounder than the three in the middle. Five pictures, three
   different corners. Measured at the default: 12 on the ends
   against 8 everywhere else.

   One number now, read by the strip and by every picture in
   it, so they cannot disagree. The cost is real and small:
   at Gap 0 the band's own corners are square too. The clip
   stays, because flex widths land on fractions and a cell can
   overhang its container by a sub-pixel. */
const RMAX = 12;

/* ── how much the open one takes ───────────────────────────
   As a share of what an unopened picture has. 50 is the value
   this was drawn at — 1.8, so the open picture is nearly
   three times a resting one — which is the rule every elastic
   knob here follows: turn the panel to the middle and nothing
   has changed.

   Both ends are a row of pictures. At 0 it is a lean rather
   than an opening, which is a real and quieter version of
   this block; at 100 the open one is about two fifths of the
   strip and the rest are edges. */
const lift = (open: number) => 0.4 + (clamp(open, 0, 100) / 100) * 2.8;

/* ── and how far the swell carries ─────────────────────────
   A gaussian on the distance in pictures, so it is smooth and
   it never reaches a sixth picture in a row of five with
   anything you could see.

   0.35 puts the first neighbour at three ten-thousandths —
   off, in every sense that matters — and 1.25 puts it at
   better than half. The default of 35 lands it at a tenth,
   which is where a neighbour is visibly paying less than the
   ones further out without looking like it is opening too. */
const fall = (d: number, reach: number) => {
  const s = 0.35 + (clamp(reach, 0, 100) / 100) * 0.9;
  return Math.exp(-((d / s) ** 2));
};

export function Accordion({
  /* how much the open picture takes, 0..100 */
  open = 50,
  /* how far the swell carries into its neighbours, 0..100 */
  reach = 35,
  /* the spring, 0..100 — see springOf in ./spring */
  bounce = 10,
  /* the air between pictures, in px. The corner follows it. */
  gap = 8,
}: {
  open?: number;
  reach?: number;
  bounce?: number;
  gap?: number;
} = {}) {
  /* which picture the pointer is on, by index. Null rather
     than -1 so "none" cannot be confused with the first. */
  const [at, setAt] = useState<number | null>(null);
  const still = stillness();

  /* ── one spring each, and NO stagger ───────────────────────
     Every other cascade on this bench opens one element after
     another, and it would be wrong here. These five are not
     five things responding in turn, they are one width being
     divided — if the picture at the end gave up its share a
     beat after the one next to it, the strip would visibly
     fail to add up for that beat. They move together because
     they are the same measurement.

     Five, and one per picture: a hook cannot be drawn
     conditionally, and the count is the number of pictures
     rather than a knob — so KEEP above and this list are the
     same length, and changing one is changing both.
     Driven over 0..100 rather than over the grow number
     itself, which is the units note on useSpring — a spring
     run across a range of two would be settled before it had
     visibly moved. */
  const want = (i: number) => (at === null ? 0 : fall(Math.abs(i - at), reach) * 100);
  const a0 = useSpring(want(0), bounce, still);
  const a1 = useSpring(want(1), bounce, still);
  const a2 = useSpring(want(2), bounce, still);
  const a3 = useSpring(want(3), bounce, still);
  const a4 = useSpring(want(4), bounce, still);
  const swell = [a0, a1, a2, a3, a4];

  const g = clamp(gap, 0, 20);
  const k = lift(open);

  return (
    <div
      className="acc"
      /* the same radius the pictures take — see RMAX */
      style={{ width: W, height: H, gap: g, borderRadius: Math.min(RMAX, g) }}
      /* ── `out` with a containment test, not `leave` ───────
         The same swap the tilt card and the card stack make,
         and for the same reason: the rehearsal's last beat
         walks a scripted pointer off the block carrying
         `relatedTarget: null`, which React never turns into a
         leave — so every copy on the wall would finish its
         demo with a picture still held open. */
      onPointerOut={(e) => {
        const to = e.relatedTarget as Node | null;
        if (!to || !e.currentTarget.contains(to)) setAt(null);
      }}
      onPointerCancel={() => setAt(null)}
    >
      {PICS.map((pic, i) => {
        const u = swell[i] / 100;
        return (
          <div
            key={pic.name}
            className="acc-cell"
            data-open={at === i || undefined}
            style={{
              /* the whole layout, in one number per picture.
                 `flex-basis: 0` so the grow numbers are the
                 entire story and the pictures' own widths have
                 no vote — which is also why the cell carries
                 `min-width: 0` in the sheet: a flex item will
                 not shrink below its content by default, and
                 the content here is an image. */
              flexGrow: 1 + k * u,
              borderRadius: Math.min(RMAX, g),
            }}
            onPointerEnter={() => {
              if (at === i) return;
              setAt(i);
              /* the dock's note: a sound carrying `at` turns
                 running along a set into a scale rather than a
                 row of identical clicks */
            }}
          >
            {/* `cover` re-frames rather than stretching, which
                is the whole reason this reads as a window
                opening onto a picture instead of a picture
                being pulled about. The scale is set by the
                height, and the height never changes — so as
                the cell widens the crop simply admits more of
                the photograph on both sides, and nothing in it
                moves or resizes. */}
            <img src={pic.src} alt="" draggable={false} />
            {/* ── AND THERE IS NOTHING OVER THE PICTURE ──────
                The filename sat here in the corner of whichever
                one was open, on a scrim to keep it legible over
                snow. Both are gone.

                The argument for it was that the point of
                opening a panel is holding something a sliver
                cannot — which is a true thing about accordions
                and was not true about this one. What it
                actually held was a word nobody needed, and the
                scrim it needed in order to be read was a dark
                wash laid across the bottom of the one
                photograph you had just asked to see more of.
                The block says the picture being looked at is
                the one you can see more of; a caption over it
                is the first thing arguing with that. */}
          </div>
        );
      })}
    </div>
  );
}

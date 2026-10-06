import { useId, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/* ══ Palette ══════════════════════════════════════════════
   Three to five colours that go together, and a button that
   finds you another set.

   ── THE COLOURS ARE PICKED IN OKLCH ───────────────────────
   Which is the entire difference between this and the random
   hex generator everybody writes first. In HSL, `lightness`
   is a lie: hsl(60 90% 50%) is a bright yellow and
   hsl(240 90% 50%) is a near-black blue, at the same number.
   So a palette built by holding L and stepping the hue comes
   out with one swatch that glows and one you can barely see.

   OKLCH is perceptually uniform — equal steps in L look like
   equal steps — so a ramp written in it is a ramp you can
   actually see. The palette is generated there and converted
   to hex on the way out, because hex is what somebody wants
   to paste into their own file.

   ── AND THEY ARE A RAMP, NOT A SPIN ───────────────────────
   Four random hues do not make a palette however even their
   lightness is. What makes a set look chosen is that it
   agrees about one thing and varies another: these hold a
   hue family and ramp the LIGHTNESS across it, which is what
   a designer does by hand.

   Chroma peaks in the middle rather than being held flat, for
   the same reason a very light and a very dark colour cannot
   be vivid — there is no room left in the gamut, and asking
   for it is what makes generated palettes go chalky at one
   end and muddy at the other. */

/* ── inlined from lab/motionkit ──────────────────────── */
/* ══ liquid ═══════════════════════════════════════════════
   Shared parts for the Framer Motion layer: one spring, one
   goo filter, one velocity→skew binding.

   ── why the filter is a hook ────────────────────────────
   The filter is embedded in each component's own return, but
   its id CANNOT be a literal. Every block here renders twice
   at once — once in the wall card, once in the detail overlay
   — and duplicate SVG ids do not scope, they collide: the
   second instance silently steals the first one's filter.
   useId() gives each mount its own name.

   ── what the goo can and cannot do ──────────────────────
   This is feGaussianBlur + feColorMatrix, not a shader. The
   matrix multiplies alpha by `cut` and subtracts half of it,
   so alpha below 0.5 lands on zero and everything above 0.536
   is fully opaque. That hard edge is what fuses nearby shapes
   into one blob — and it is also why this must never touch
   text: glyph antialiasing lives entirely below 0.5, so type
   under this filter loses its edges and then itself. */

function useGoo(blur = 7, cut = 28) {
  /* useId yields ":r0:" — legal in an id attribute but not in
     a url(#…) reference, so strip the colons. */
  const id = `goo-${useId().replace(/:/g, "")}`;
  const goo = (
    <svg className="liq-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter
          id={id}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="smear" />
          <feColorMatrix
            in="smear"
            type="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${cut} ${-(cut / 2)}`}
          />
        </filter>
      </defs>
    </svg>
  );
  return { id, url: `url(#${id})`, goo };
}

/* ── inlined from lab/motion ──────────────────────── */
/* ── elastic, as numbers a person can hold ─────────────────
   Several blocks here are the same idea in different clothes:
   something travels, stretches on the way, and overshoots
   when it lands. Their character lives in a duration and in
   one control point of a bezier — which is exactly the kind
   of thing nobody should have to name in order to tune.

   So the outside of every elastic knob is 0..100 and the
   inside is real units, and **50 is always what the component
   was already tuned to**. Turn every knob on the bench to the
   middle and nothing has changed. That is what makes these
   safe to expose: the default is not a number somebody has to
   remember, it is the middle of the slider.

   Both ends have to be shippable, which is the constraint
   that actually shapes these curves. The ranges below stop
   where the effect stops being the thing it is — a bar that
   moves in 40ms still reads as a bar snapping to a slot; one
   that moves in 20ms reads as broken. */

/* How long it takes, slower to faster, as a multiplier on
   whatever the component's own tuned duration is. 0 is a
   little over half again as slow, 100 is two and a half times
   as fast, 50 is exactly 1. */
const rate = (speed: number) => 1.6 - (speed / 100) * 1.2;

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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── oklch → hex ───────────────────────────────────────────
   Björn Ottosson's matrices, unchanged. The path is
   oklch → oklab → LMS → linear sRGB → sRGB, and the only
   liberty taken is the clamp at the end: a colour outside the
   gamut is clipped per channel rather than gamut-mapped,
   which is the wrong answer in general and a fine one here
   because the chroma below never asks for one. */
function hex(L: number, C: number, H: number) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return (
    "#" +
    lin
      .map((v) => {
        const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055;
        return Math.round(clamp(g, 0, 1) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/* ── the most colour the screen can show ─────────────────
   Chroma is asked for boldly and then pulled back only as far
   as the gamut needs, per swatch. Clipping each channel instead
   keeps the brightness and bends the HUE — a vivid orange
   comes back as a yellow — which is why the old palettes kept
   their chroma timid everywhere rather than find the edge. */
function fits(L: number, C: number, H: number) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = 0.0005;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && bl >= -e && bl <= 1 + e;
}
function vivid(L: number, C: number, H: number) {
  let c = C;
  while (c > 0.01 && !fits(L, c, H)) c -= 0.004;
  return hex(L, c, H);
}

export type Swatch = { hex: string };

/* ── one palette, in one of five moods ───────────────────
   Every palette used to be the same recipe — one hue family
   ramping light to dark — so pressing for a new one changed the
   hue and kept the look, and after a few presses the block read
   as showing the same colours. Now each press picks a MOOD as
   well as a hue:

   · RAMP     one family, light to deep — the original, brighter
   · SPREAD   bright hues fanned 40–70° apart at a similar weight
   · PAIR     two near-opposite hues, a light and a deep of each
   · TRIAD    three hues a third of the wheel apart
   · ACCENT   soft brights with one deep, saturated note

   And it never lands near the last one: the base hue moves at
   least 60° round the wheel every press, so two sets in a row
   cannot share a colour region.

   Chroma is asked for high and pulled back only as far as the
   gamut needs — see `vivid` — so every swatch is as strong as
   the screen allows at its lightness. */
type Mood = "ramp" | "spread" | "pair" | "triad" | "accent";
const MOODS: Mood[] = ["ramp", "spread", "pair", "triad", "accent"];
let lastBase = Math.random() * 360;
let lastMood: Mood | null = null;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (h: number) => ((h % 360) + 360) % 360;

function make(n: number): Swatch[] {
  const base = wrap(lastBase + rnd(60, 300));
  lastBase = base;
  const pool = MOODS.filter((m) => m !== lastMood);
  const mood = pool[Math.floor(Math.random() * pool.length)];
  lastMood = mood;
  const dir = Math.random() < 0.5 ? -1 : 1;

  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p = n === 1 ? 0 : i / (n - 1);
    switch (mood) {
      case "ramp": {
        const step = rnd(14, 26) * dir;
        out.push([0.9 - p * 0.48, 0.12 + Math.sin(p * Math.PI) * 0.12, base + i * step]);
        break;
      }
      case "spread": {
        const step = rnd(40, 70) * dir;
        out.push([rnd(0.66, 0.8), 0.24, base + i * step]);
        break;
      }
      case "pair": {
        const other = i % 2 === 1;
        const deep = i >= n / 2;
        out.push([deep ? rnd(0.46, 0.56) : rnd(0.8, 0.88), 0.22, base + (other ? rnd(160, 190) : 0)]);
        break;
      }
      case "triad": {
        out.push([rnd(0.58, 0.82), 0.22, base + (i % 3) * 120 * dir + rnd(-8, 8)]);
        break;
      }
      default: {
        const deep = i === n - 1;
        out.push(deep ? [0.52, 0.26, base + 180 * dir] : [rnd(0.8, 0.87), 0.18, base + i * 18 * dir]);
      }
    }
  }
  /* light to deep across the bar, whatever the mood: a palette
     reads as a set when its values step, and as noise when
     they jump about */
  out.sort((x, y) => y[0] - x[0]);
  /* a yellow cannot be deep: below about 0.62 it stops being a
     colour and becomes olive or brown, which is the muddy
     swatch that made the ramps look tired */
  for (const c of out) {
    const h = wrap(c[2]);
    if (h > 60 && h < 120 && c[0] < 0.62) c[0] = 0.62 + (0.62 - c[0]) * 0.2;
  }
  return out.map(([L, C, H]) => ({ hex: vivid(L, C, wrap(H)) }));
}

/* ── the layout ────────────────────────────────────────────
   TWO PILLS SIDE BY SIDE: the colours in one, the refresh in
   its own. It was a single slab with the button tucked in at
   the right, which made the button part of the palette — and
   it is not, it is the thing that replaces the palette. A
   control that acts on an object should not be sitting inside
   it.

   Split, the two read as what they are: a display and a
   button. They share a height, a padding and a corner, so
   nothing about them says they are unrelated — only that they
   are two things.

   The swatches inside the first pill are still SEGMENTS of one
   bar rather than four cards in a row: a palette is one thing
   made of parts, and four separate tiles read as four separate
   decisions.

   The button pill's inside is one swatch square, and its
   button takes the swatch's corner — so the tool pill holds a
   swatch-shaped thing and the corner knob moves both. */
const W = 300;
/* the inset inside each pill. It was also the gap between
   them — see GAP, which is where that stopped being true. */
const PAD = 10;
const BAR_H = 58;
/* ── how wide the refresh is ───────────────────────────────
   The button is as TALL as a swatch and much narrower than
   one. It was a square, which made the tool pill the same
   shape as the thing it acts on and gave an 18px glyph a 58px
   box to sit in — a lot of empty pill for one icon.

   30 against a 58 height is nearly two to one, which is what
   makes it read as a KEY: an upright slot you press, rather
   than a tile that happens to have a glyph on it. There is no
   hover fill for it to need room for any more — the glyph
   just lightens — so the six pixels either side of the icon
   are the whole of what the button has to hold.

   Every pixel it gives up goes to the colours: the swatches
   are 53 wide now, against 45 when this was a square. */
const TOOL = 30;
/* ── the air between the two pills ─────────────────────────
   6, and it is no longer PAD. Those two were deliberately the
   same number once, back when the button sat INSIDE the slab:
   the gap beside the bar and the gap above it were the same
   kind of space, and two numbers there would have been a
   decision nobody made.

   They are two objects now, and the space BETWEEN two objects
   is not the space inside one. At 10 the pills read as two
   things that happen to be near each other; at 6 they read as
   a pair — near enough to belong together, far enough apart
   to be separate, which is exactly what they are. */
const GAP = 6;
const CORNER = 14;
const BASE = 760;
/* ── the gap between swatches ──────────────────────────────
   Small on purpose. The bar was one flush strip and the
   colours were segments of it, which meant the rounded ends
   had to come from the container clipping them — and a swatch
   that cannot leave its slot cannot overshoot, so the elastic
   on the way back was being cut off at the edges.

   Four is enough to read as four objects and not enough to
   stop reading as one bar. It is also what lets the goo do
   something at rest-adjacent moments: a blur of five bridges
   four pixels, so the swatches neck toward each other as they
   move and part again cleanly. */
const SEAM = 4;

/* ── the one way a colour becomes another one ──────────────
   ORB: the swatch draws into a circle, changes colour there,
   and spreads back out into its slot.

   There were five, then three, and now one. The other four
   were not broken — `pinch` necked into a droplet, `flip`
   turned edge-on, `split` parted in two, `bounce` squashed
   flat — but a block that ships four ways to do one thing is
   asking whoever opens it to rule out three by hand, and none
   of them said anything this does not.

   What every survivor had in common, and every discarded one
   lacked, is worth keeping written down: the swatch DEFORMS
   and swaps its colour at the frame there is least of it to
   look at. Nothing here fades one colour into another. An
   alpha-contrast filter blurs SourceGraphic, so anything
   painting a new colour over an old one inside the same
   swatch shows you the two smeared together — every muddy
   value in between, and none of them in either palette. Each
   swatch is one solid colour at every frame, and the blur only
   ever bridges the gap BETWEEN swatches. That is liquid; the
   other thing is smear. */

/* how much blur the run carries. Zero at rest — see the note
   where it is used. */
const HEAT = 5;

/* ── they all go at once ───────────────────────────────────
   Every swatch runs the same clock. They used to be staggered,
   each on its own window of the run, so the change travelled
   along the bar — which is a nice effect and the wrong one
   here. A wave says the swatches are a sequence and that one
   caused the next; they are not, they are a set, and pressing
   refresh replaces all of them in the same instant. Together
   is what that press actually did.

   It also makes the goo mean more rather than less: four
   swatches contracting on the same frame leave four gaps
   opening at the same rate, and the bridge between them is one
   piece of motion instead of a blur chasing a wavefront. */

/* ── out fast, back PAST the mark ──────────────────────────
   The deformation is not a sine. A sine is symmetric and
   lands exactly on rest, which is a shape being resized; what
   makes these read as elastic is that the return overshoots —
   the swatch comes back a few per cent bigger than it needs to
   be and settles. That is the whole difference between
   `animated` and `springy`, and it costs one back-out curve.

   The change happens at OUT, the top of the deformation, and
   the longer tail after it is the settle. */
const OUT = 0.4;
const back = (k: number) => {
  const c = 1.7;
  const u = k - 1;
  return 1 + (c + 1) * u ** 3 + c * u ** 2;
};
const swellOf = (ti: number) =>
  ti <= 0 ? 0 : ti < OUT ? 1 - (1 - ti / OUT) ** 3 : 1 - back((ti - OUT) / (1 - OUT));

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function Palette({
  /* how many colours, 3..5 */
  count = 4,
  /* the swatch's corner, 0..29 — half of a 58px swatch, which
     is the pill, so the slider runs from square to as round as
     the shape can be. The ceiling moves with BAR_H; past half
     the height a rounded rectangle stops changing. */
  corner = CORNER,
  /* how quickly a colour changes, 0..100 */
  morph = 50,
}: {
  count?: number;
  corner?: number;
  morph?: number;
} = {}) {
  const n = clamp(Math.round(count), 3, 5);
  const [pal, setPal] = useState<Swatch[]>(() => make(n));
  const [next, setNext] = useState<Swatch[] | null>(null);
  const [t, setT] = useState(0);
  const raf = useRef(0);
  const spins = useRef(0);
  const still = stillness();

  /* ── the goo rides the run ───────────────────────────────
     Zero at rest, so the seams are as crisp as two rectangles
     — a standing blur would smear neighbouring colours into
     each other and turn the bar into one gradient. It only
     reaches while something is moving, and because every
     swatch is a single solid colour at every frame, the blur
     it applies can only ever bridge the gap BETWEEN two
     swatches. That is the liquid; there is no smear anywhere
     inside a colour. */
  const heat = Math.sin(Math.PI * clamp(t, 0, 1)) * HEAT;
  const { url: gooUrl, goo } = useGoo(heat, 26);

  /* the palette follows the knob without waiting for a press */
  if (pal.length !== n) {
    setPal(make(n));
    setNext(null);
  }

  const roll = () => {
    /* a press mid-run is ignored rather than queued: a second
       set arriving over a half-finished one would leave some
       swatches showing a palette that no longer exists */
    if (raf.current) return;
    spins.current += 1;

    const fresh = make(n);
    if (still) {
      setPal(fresh);
      return;
    }

    setNext(fresh);
    const ms = BASE * rate(clamp(morph, 0, 100));
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setT(p);
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = 0;
        setPal(fresh);
        setNext(null);
        setT(0);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  /* the tool pill takes the same padding as the other one, so
     the two come out the same height without either being told
     what the other is */
  const toolW = TOOL + PAD * 2;
  const barW = W - toolW - GAP - PAD * 2;
  /* the seams come out of the row before it is divided, so
     the swatches stay equal whatever the count is */
  const seg = (barW - SEAM * (n - 1)) / n;
  const step = seg + SEAM;
  const r = clamp(corner, 0, BAR_H / 2);
  /* ── the slab's corner, and why it is not just r + PAD ────
     Concentric is the right rule for a curve wrapping another
     curve: stay one padding out and the two stay parallel.
     But at r = 0 there is no curve to stay parallel TO, and a
     flat rule leaves square swatches sitting in a rounded
     slab — two different decisions in one object, which is
     the thing this knob exists to keep in agreement.

     So the offset FADES IN over the first CORNER pixels. The
     default and the top of the slider are untouched — 14
     still gives 24, 29 still gives 39 — only the bottom end,
     which is the end that was wrong. */
  const slabR = r + PAD * Math.min(1, r / CORNER);

  /* ── the beat ────────────────────────────────────────────
     The whole colour pill dips while the swatches are drawn
     in, and comes back a hair past its own size — the swatches
     contracting is a small motion happening inside a box that
     is not moving, and the box giving with them is what makes
     the press land on the palette rather than on four shapes
     in it.

     This is the one place here that uses a SCALE rather than
     writing width and height, which is normally how a corner
     radius gets dragged out of shape. At three and a half per
     cent it is under a pixel of radius, and more to the point
     nobody reads a pulse as a change of shape — they read it
     as a pulse. Writing the size instead would relayout the
     bar under the swatches every frame, which is the thing
     actually worth avoiding.

     Raw `swellOf`, not the clamped `d` the swatches use: the
     tail of that curve goes past rest, so the pill returns
     slightly over 1 and settles. That overshoot IS the beat —
     clamp it away and this is just a shrink. */
  const beat = 1 - 0.035 * swellOf(clamp(t, 0, 1));

  return (
    <div className="pal" style={{ width: W, gap: GAP }}>
      <div
        className="pal-slab"
        style={{ padding: PAD, borderRadius: slabR, scale: beat }}
      >
        {/* No clip and no corner of its own. Each swatch
            carries its own radius, so the bar is only a box to
            position them in — and a bar that clipped would cut
            off the overshoot, which is the part of the motion
            worth keeping. */}
        <div className="pal-bar" style={{ height: BAR_H, width: barW }}>
          <div className="pal-blobs" aria-hidden="true" style={{ filter: gooUrl }}>
            {pal.map((c, i) => {
              /* one clock, read by every swatch — see the note
                 above on why they are not staggered */
              const ti = clamp(t, 0, 1);
              /* the change happens at the top of the
                 deformation, which is the frame there is least
                 of the swatch to see */
              const shown = next && ti >= OUT ? next[i].hex : c.hex;
              const d = Math.max(0, swellOf(ti));

              /* into a circle and back out into its slot */
              const side = mix(seg, BAR_H * 0.66, d);
              const h = mix(BAR_H, BAR_H * 0.66, d);
              return (
                <span
                  key={i}
                  className="pal-seg"
                  style={{
                    background: shown,
                    width: side,
                    height: h,
                    top: (BAR_H - h) / 2,
                    borderRadius: mix(r, h / 2, d),
                    transform: `translateX(${(i * step + (seg - side) / 2).toFixed(2)}px)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── the button, in a pill of its own ────────────────
          Same padding and same corner as the palette's, and
          the button inside it is one swatch square wearing the
          swatch's radius — so the corner knob moves this too
          and the two pills never disagree about what a corner
          is here. */}
      <div className="pal-slab pal-tool" style={{ padding: PAD, borderRadius: slabR }}>
        <button
          className="pal-go"
          onClick={roll}
          aria-label="Generate a new palette"
          style={{ width: TOOL, height: BAR_H, borderRadius: r }}
        >
          {/* a turn per press, and it keeps turning the same
              way — a glyph that unwound would say "undo" */}
          <RefreshCw
            size={18}
            strokeWidth={2.2}
            style={{ rotate: `${spins.current * 180}deg` }}
          />
        </button>
      </div>

      {goo}
    </div>
  );
}

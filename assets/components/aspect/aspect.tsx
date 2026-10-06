import { useRef, useState } from "react";

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

/* SHEEP was Bencho's own pictures, which is not licensed
   to travel. Point this at yours. */
const SHEEP: string = "";

/* ══ Aspect ═══════════════════════════════════════════════
   A picture and three shapes to put it in.

   THE THREE FORMATS HAVE THE SAME AREA. That is the whole
   idea and it is not how most crop switchers are built —
   the common version fixes the width and lets the height do
   whatever the ratio says, which means the landscape is a
   third of the portrait and switching feels like the picture
   grew rather than like it was cropped. Equal area is what a
   crop actually is: the same amount of picture, held a
   different way. 276x207, 239x239 and 207x276 are within
   0.02% of each other.

   It also decides the frame. Every shape fits inside one
   276x276 square, so the block's bounding box is the biggest
   any of them gets and the wall never rescales it mid-move.

   NO CROP IN THE FILE. The source is 3:4 and stays that way
   — see scripts/sheep.sh — so `cover` does all three crops
   from one picture, and the portrait tab is the whole
   illustration rather than a slice of it. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* the square the three shapes fit inside, and the block's
   own width */
const W = 276;
const GAP = 16;
const BAR = 36;

const SHAPES = [
  { id: "land", w: 276, h: 207, label: "Landscape, 4 by 3" },
  { id: "square", w: 239, h: 239, label: "Square, 1 by 1" },
  { id: "tall", w: 207, h: 276, label: "Portrait, 3 by 4" },
] as const;

/* ── the icons are the shapes ──────────────────────────────
   Drawn rather than imported, and lucide does ship a
   rectangle in each orientation. The reason not to use them
   is that here the icon is not a symbol FOR the format, it
   IS the format — so it has to be at the real ratio, and
   lucide's rectangles are at whatever ratio looked right in
   a 24 grid.

   Same constant area as the pictures, for the same reason:
   three marks of visibly different size would say the
   formats are different sizes, which is the thing the block
   is at pains to say they are not. 13 square, and the other
   two are that area at 4:3 and 3:4. */
const MARK = {
  land: { x: 1.5, y: 3.38, w: 15, h: 11.25 },
  square: { x: 2.5, y: 2.5, w: 13, h: 13 },
  tall: { x: 3.38, y: 1.5, w: 11.25, h: 15 },
} as const;

const BASE = 520;

export function Aspect({
  corner = 18,
  /* how quickly the frame changes shape, 0..100 — 50 is the
     tuned 520ms */
  morph = 50,
}: { corner?: number; morph?: number } = {}) {
  const [at, setAt] = useState(1);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const ms = Math.round(BASE * rate(clamp(morph, 0, 100)));
  const shape = SHAPES[at];

  const pick = (i: number, focus = false) => {
    if (i === at) return;
    setAt(i);
    if (focus) tabs.current[i]?.focus();
  };

  /* ── arrows move the choice ──────────────────────────────
     One of the three is always chosen, which makes this a
     radio group rather than a row of buttons — and a radio
     group is driven with the arrow keys, with only the
     chosen one in the tab order. Tab reaches the control,
     arrows choose inside it. */
  const key = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1
      : 0;
    if (!d) return;
    e.preventDefault();
    pick((at + d + SHAPES.length) % SHAPES.length, true);
  };

  return (
    <div
      className="asp"
      style={{ width: W, height: W + GAP + BAR, ["--asp-ms" as string]: `${ms}ms` }}
    >
      {/* The stage is the full square and never changes, so
          the picture is centred in a box that is not moving.
          Sizing the stage to the picture instead would make
          the tabs below it climb and drop as the shape
          changed — the one thing on this block that has no
          business moving. */}
      <div className="asp-stage" style={{ height: W }}>
        {/* ── width and height, NEVER a scale ─────────────
            The same rule the detail overlay's block follows,
            for the same reason: a scaled box drags its corner
            radius with it, and the corner has to read as the
            same rounded frame throughout rather than as a
            rectangle being stretched. `cover` is what keeps
            the picture itself undistorted while the frame
            moves — so this reads as a crop changing, which is
            what it is, rather than as an image being
            squashed. */}
        <div
          className="asp-pic"
          style={{
            width: shape.w,
            height: shape.h,
            borderRadius: clamp(corner, 0, 40),
            backgroundImage: `url(${SHEEP})`,
          }}
        />
      </div>

      <div className="asp-tabs" role="radiogroup" aria-label="Aspect ratio" onKeyDown={key}>
        {/* ── the thumb ───────────────────────────────────
            One element sliding, not three backgrounds fading.
            A fill that appears under the new tab while
            another disappears is two events; a thumb that
            travels is one, and it is the one that says these
            three are positions of the same control. */}
        <span
          className="asp-thumb"
          aria-hidden="true"
          style={{ transform: `translateX(${at * 100}%)` }}
        />
        {SHAPES.map((s, i) => {
          const m = MARK[s.id];
          return (
            <button
              key={s.id}
              ref={(el) => { tabs.current[i] = el; }}
              className="asp-tab"
              role="radio"
              aria-checked={i === at}
              aria-label={s.label}
              /* the chosen one is the only one in the tab
                 order — see the note on `key` */
              tabIndex={i === at ? 0 : -1}
              onClick={() => pick(i)}
            >
              <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
                <rect
                  x={m.x}
                  y={m.y}
                  width={m.w}
                  height={m.h}
                  rx={2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

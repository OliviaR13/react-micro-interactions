import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Liquid } from "liquid-gooey";

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

/* the elastic, as specified: ζ = 14 / (2·√(220·0.5)) ≈ 0.67,
   so it overshoots about 6% before it settles. A deliberate
   bounce, not a wobble. */
const LIQUID = {
  type: "spring" as const,
  stiffness: 220,
  damping: 14,
  mass: 0.5,
};

/* ── inlined from lab/Gooey ──────────────────────── */
/* ══ Gooey ════════════════════════════════════════════════
   What is left of the two library-surfaced components that
   used to live here: the measurement every liquid-gooey group
   on the bench needs. Liquid tabs and the Plus menu are gone;
   this is the part of them that turned out to be the reusable
   half, and Balance, the Selection list, the Humidity wheel
   and the Sleep dial all still call it.

   ── what the library actually does ──────────────────────
   The usual gooey effect runs blur + alpha-contrast over your
   real UI, which is why it is normally confined to decorative
   circles: text goes soft, images smear, and the contrast step
   eats shadows. liquid-gooey splits it in two. An SVG layer
   carries a silhouette of your elements and takes the whole
   filter; your actual DOM rides crisp on top of it, untouched.
   Same liquid, none of the tax — and it is the same discipline
   our own filter needs, since text under an alpha threshold
   loses its edges and then itself.

   ── the two patterns, which are not interchangeable ─────
   MORPH gives the library the position: pass x/y and it
   animates the element and the liquid together, so pieces that
   separate stay bridged until the goo can no longer hold them.
   The split IS the effect.

   MOVE gives the position to you: move the element however you
   like and the surface trails it as liquid rubber with a
   droplet tail. A filter has no memory of motion — a shape
   that crossed two pixels and one that crossed the whole track
   arrive identical — and this is the part that fixes that. */

/* ── the zoom correction, applied to someone else's SVG ──────
   liquid-gooey measures its items with getBoundingClientRect
   and draws them as SVG user units. Those are the same number
   only while no ancestor is scaled — and on this bench every
   component sits inside a scaled card, so the transform lands
   twice and the silhouette drifts from its element in
   proportion to both the scale and the distance from the
   origin. Measured: 0.1px at scale 1, 22px at 1.09, 124px at
   1.4.

   Everything the library computes is in screen px, so scaling
   its layer by 1/k converts the whole coordinate space back to
   layout px in one move, and the card's own transform then
   renders it correctly. Same k = rect.width / offsetWidth the
   rest of the bench uses.

   MOVE ONLY. Morph positions its items with a CSS transform on
   a real wrapper, in layout px, which scales correctly on its
   own — apply this there and you over-correct: the silhouette
   comes out 1/k the size of its button, so the blob is smaller
   than the element and every icon looks off-centre inside it.
   Measured on the plus menu: button 58px, blob 46px, and up to
   10px of offset. Without it, 58 and 58, dead on. */
function useGooScale() {
  const box = useRef<HTMLDivElement | null>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const next = (r.width / (el.offsetWidth || r.width)) || 1;
      setK((was) => (Math.abs(was - next) < 0.001 ? was : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    /* the card also rescales when the overlay opens, which is a
       transform change and not a resize */
    const t = window.setInterval(read, 500);
    return () => { ro.disconnect(); window.clearInterval(t); };
  }, []);
  return { box, k };
}

const rad = (d: number) => (d * Math.PI) / 180;

/* ══ 1 · sleep, a two handle arc ══════════════════════════
   Same tick language as the humidity wheel, but the value is
   a range rather than a point, so the ticks fill between the
   two handles and the drag picks whichever handle is nearer.

   ── NO PANE ─────────────────────────────────────────────
   It used to sit on a .gcard: a frosted 388px block with a
   title in the corner. The block was doing nothing the dial
   could not do for itself — a ring of ticks is already a
   shape, and putting a rectangle round it only said "this is
   a component" to a page that has already said so with a
   card. The wheel stands in the section on its own now.

   What the pane WAS doing, quietly, was supplying contrast.
   Everything here is drawn in ink at low opacity, and the
   frosted panel sat a step lighter than the wall behind it,
   so 0.13 was enough for an unlit tick. Straight onto the
   card's grey it is not — hence the raised floors below. The
   pane was load-bearing for legibility even though it was
   decoration for layout, which is the usual way a background
   turns out to matter.

   ── the handles are DOM, not SVG ────────────────────────
   They were <circle>s inside the dial. They are elements over
   it now, because liquid-gooey works on rendered rects and
   cannot see into an SVG — and the merge is worth the move:
   when the two handles come together the goo bridges them, so
   a sleep window closing to nothing reads as one body rather
   than as two discs overlapping. The ticks stay in the SVG,
   where they belong: a 2px stroke under a goo filter is a
   stroke the alpha step erases. */

const SN = 48;          // one tick per half hour
const SR = 56;          // inner radius
const SCX = 100;
const SCY = 100;

export function Sleep({
  /* The grid the handles land on, in minutes. It is Feel and
     not Form: nothing about it changes what the dial looks
     like standing still, and everything about it changes what
     dragging one feels like — 5 is a smooth sweep, 30 is a
     control that clicks into place. */
  snap = "15",
  /* how finely the band is cut */
  density = SN,
  /* the inner radius the ticks stand on */
  reach = SR,
}: {
  snap?: string;
  density?: number;
  reach?: number;
}) {
  const [bed, setBed] = useState(1380);   // 23:00
  const [wake, setWake] = useState(390);  // 06:30
  const [grab, setGrab] = useState<null | "bed" | "wake">(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /* the library measures in screen pixels and every card on
     this bench is drawn at a fraction — see Gooey.tsx */
  const { box, k } = useGooScale();

  const dur = (wake - bed + 1440) % 1440;
  const inRange = (m: number) => ((m - bed + 1440) % 1440) < dur;

  const angleOf = (m: number) => rad((m / 1440) * 360 - 90);

  const minutesFrom = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const b = svg.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 200 - SCX;
    const y = ((e.clientY - b.top) / b.height) * 200 - SCY;
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    /* 1440 minutes over the step gives the number of stops on
       the dial, so the snap is one number and not two kept in
       agreement */
    const min = Number(snap) || 15;
    return Math.round((deg / 360) * (1440 / min)) * min;
  };

  const gap = (a: number, b: number) => {
    const d = Math.abs(a - b) % 1440;
    return Math.min(d, 1440 - d);
  };

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const m = minutesFrom(e);
    const which = gap(m, bed) <= gap(m, wake) ? "bed" : "wake";
    setGrab(which);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    which === "bed" ? setBed(m % 1440) : setWake(m % 1440);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!grab) return;
    const m = minutesFrom(e) % 1440;
    /* the hour of the day as the pitch, so dragging a handle
       round the face rises and falls with the clock */
    grab === "bed" ? setBed(m) : setWake(m);
  };

  /* Where each handle sits, in the dial's own 200-unit space,
     converted to a pixel offset from the centre. One function,
     used by the SVG's own geometry and by the DOM handles over
     it, so the two cannot drift apart. */
  const DIAL = 288;
  const knobAt = (m: number) => {
    const a = angleOf(m);
    const u = (reach + 11) * (DIAL / 200);
    return { x: Math.cos(a) * u, y: Math.sin(a) * u };
  };

  return (
    <div className="slp" ref={box} style={{ "--k": k } as React.CSSProperties}>
      <div className="slp-dial">
      <svg
        ref={svgRef}
        className="g-arc"
        viewBox="0 0 200 200"
        data-dragging={!!grab}
        role="group"
        aria-label="Sleep window"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => setGrab(null)}
        onPointerCancel={() => setGrab(null)}
      >
        {Array.from({ length: density }, (_, i) => {
          /* derived, not the 30 it used to be: 30 was 1440/48
             written out, and the moment the count moves that
             constant stops closing the circle */
          const m = i * (1440 / density);
          const on = inRange(m);
          /* ── FOUR LENGTHS, AND THEY ARE CLOSE TOGETHER ────
             The lit ticks were 22 against an unlit 10, which
             made the chosen range a solid black wedge — a
             SHAPE laid over the dial rather than part of it.
             Then they were 12, which is the other failure: a
             chosen tick barely longer than an unchosen one and
             a long way short of the quarter marks, so the four
             quarters read as the loudest thing on a dial whose
             subject is the range.

             15 against the quarters' 17 is the pair reading as
             one family — the range is plainly the longer half
             of the face without any tick in it out-shouting
             the marks that say where you are. */
          /* ── the quarter test is on the INDEX, not the clock
             `m % 360 === 0` asks for six-hourly marks, and a
             tick only lands on one when the density divides
             into the day the right way — at 40 or 56 there
             would simply be none. `i * 4 % density` asks where
             the tick is ROUND THE DIAL, which is what a quarter
             mark means, and it is true at exactly four ticks
             for every setting of the knob.

             The hour tier went with it. It had the same fault
             and worse — hour marks existed only at 24, 48, 72
             and 96 — and this dial is not about hours any
             more. Two lengths, four long ones. */
          const quarter = (i * 4) % density === 0;
          const len = quarter ? (on ? 19 : 17) : on ? 15 : 9;

          /* ── how far into the range it is, from the NEARER
                 end ─────────────────────────────────────────
             The delay that makes the wave. Measured from
             whichever handle is closer, which means the
             newly-lit ticks beside the handle you are actually
             dragging go first without the component having to
             know which handle that is: they are the ones near
             it, so their number is small. */
          const step = 1440 / density;
          const fromBed = ((m - bed + 1440) % 1440) / step;
          const fromWake = ((wake - m + 1440) % 1440) / step;
          const order = Math.round(Math.min(fromBed, fromWake));
          const a = angleOf(m);
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          return (
            <line
              /* ── THE KEY CARRIES THE STATE ────────────────
                 A CSS animation does not re-fire when an
                 attribute changes; it fires when the element
                 MOUNTS. So the key says whether the tick is
                 lit, and a tick that becomes lit is a new
                 element as far as React is concerned — which
                 is what starts its draw. Ticks that were
                 already lit keep their key, keep their
                 element, and do not re-animate, so growing the
                 range ripples only along the part that grew.

                 Same idiom as the Pro sheet's reel, where a
                 wrapping card comes back under a new `gen` so
                 it mounts fresh instead of sliding across. */
              key={on ? `${i}+` : i}
              data-on={on || undefined}
              style={{ ["--d" as string]: order }}
              x1={SCX + cos * reach} y1={SCY + sin * reach}
              x2={SCX + cos * (reach + len)} y2={SCY + sin * (reach + len)}
              /* ── normalised, so the draw is a fraction ─────
                 `pathLength="1"` makes the dash units the
                 stroke's own length, which is different for a
                 quarter mark and a plain one — without it the
                 keyframes would need a number per tick. */
              pathLength={1}
              strokeDasharray={1}
              stroke="currentColor"
              /* 0.24, not 0.13. The frosted pane used to sit a
                 step lighter than the wall and an unlit tick
                 had that to be dark against; straight onto the
                 card's grey, 0.13 measured about 1.2:1 and
                 simply was not there. The lit ticks come up
                 too so the ratio between them holds. */
              strokeOpacity={on ? 0.9 : 0.24}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}

      </svg>

      {/* ── the handles ──────────────────────────────────────
          Over the dial, not inside it. Both live in one liquid
          group, so as the window closes they neck and finally
          fuse — the goo says "these two are about to be the
          same moment" before the clock does.

          IN FLOW, in one grid cell, displaced by transform.
          Absolutely positioned they give the library no rect
          to measure and it draws bodies of radius zero: every
          number right and nothing on screen.

          The fill is OPAQUE on purpose. It is the fill's alpha
          that feeds the goo, and the contrast row erases
          anything under about 0.39 — a translucent white here
          would vanish entirely rather than look faint. */}
      <Liquid
        className="slp-knobs"
        blur={4}
        contrast={16}
        fill="var(--fill-slab, var(--board))"
        /* ── A SHADOW, AND NO RING ────────────────────────
           The handles carried a 1px outline as well, which is
           what an object needs when it has to hold its own
           against a busy ground. These sit on a ring of thin
           ticks with air between them: the shadow already
           separates them, and the outline was a second edge
           drawn a pixel inside the first. Two edges on a 20px
           circle is most of what you see of it.

           It also means nothing on this block has an edge any
           more, which is why the Stroke control went with
           it. */
        shadow="0 2px 8px rgba(var(--shadow-rgb), 0.24)"
        filterPadding={40}
      >
        {([["bed", bed], ["wake", wake]] as const).map(([k, m]) => {
          const at = knobAt(m);
          const held = grab === k;
          return (
            <Liquid.Item
              key={k}
              effect="move"
              move={{ springiness: 0.5, trail: 0.18 }}
            >
              <motion.span
                className="slp-knob"
                data-held={held || undefined}
                /* Framer springs the grab, which used to be a
                   jump from r 5.4 to 6.4 between two frames. */
                animate={{ scale: held ? 1.22 : 1 }}
                transition={LIQUID}
                style={{ x: at.x, y: at.y }}
              >
                {/* the start handle carries a dot, the end one
                    stays open — the only thing telling you
                    which end of the night you have hold of */}
                {k === "bed" && <i className="slp-pip" />}
              </motion.span>
            </Liquid.Item>
          );
        })}
      </Liquid>

      <div className="slp-mid">
        <span className="slp-figure">
          {Math.floor(dur / 60)}
          <span className="slp-unit" data-pair="true">h</span>
          {String(dur % 60).padStart(2, "0")}
          <span className="slp-unit">m</span>
        </span>
      </div>
      </div>

    </div>
  );
}

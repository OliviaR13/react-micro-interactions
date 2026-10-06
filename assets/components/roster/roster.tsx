import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
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

/* AVATARS was Bencho's own pictures, which is not licensed
   to travel. Point this at yours. */
const AVATARS: Record<string, string> = {};

/* the one helper this file wants from the shared kit */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── E · roster ─────────────────────────────────────────────
   One cast, used twice. These are the same four faces the
   reorder list carries, with the same names on them — a bench
   that invents a new set of people for every component is a
   bench where the people are noise. Reusing them makes the
   photographs read as a house cast rather than as stock.

   THE HEADER IS GONE. "Other members" over a list of members,
   and "4 PLAYERS" over four visible rows, were both captions
   counting what was already in front of you. What is left is
   the list and the action.

   AND THE ACTION IS OUTSIDE THE BOX. It used to float inside,
   over the last row, which meant the panel had to carry 68px
   of dead padding to make room for it and the button was
   permanently obscuring content. Outside, it is the width of
   the thing it acts on, it obscures nothing, and the box goes
   back to being exactly as tall as its rows. */
/* ── THE ROW'S GEOMETRY, IN ONE PLACE ──────────────────────
   These three were two: 50 and 4 lived in the stylesheet, and
   the 54 they add up to lived here. Two sources of one truth,
   and the moment the row came down to 46 to make this block
   the assignees' size, the hover mark went on stepping 54 and
   standing 50 tall — drifting four pixels further off the row
   with every step down the list.

   So the numbers are declared here and published to the CSS as
   variables. Framer animates `y` as a number and cannot read a
   custom property, which is why this direction and not the
   other: the one that has to be a number owns them, and the
   stylesheet reads what it is given. */
const ROW_H = 46;
const ROW_GAP = 4;

const PEOPLE = [
  { id: "mara", name: "Nadia Okonkwo", handle: "@nadia" },
  { id: "ines", name: "Tomas Cardoso", handle: "@tomas" },
  { id: "kai", name: "Kai Brenner", handle: "@kai" },
  { id: "sofia", name: "Lukas Lindqvist", handle: "@lukas" },
];

/* ══ E · selection list ═══════════════════════════════════
   Pick people, then act on the picks.

   ── the action is part of the list ──────────────────────
   The button used to sit under the card permanently, greyed
   out and saying "Send request" to nobody. A disabled control
   is a promise you are not keeping: it occupies the space, it
   reads as pressable, and it answers nothing about WHY it will
   not go.

   It is made of the same liquid as the list now. With nothing
   picked it is tucked inside the card's own body — one shape,
   no button — and the first pick pushes it out and lets the
   goo neck and break. Un-pick everything and it is drawn back
   in. The button does not appear, it SEPARATES, which is the
   one thing a metaball can say that a fade cannot: that these
   two were always the same object.

   ── what the filter cannot carry ────────────────────────
   The tick's glyph. A goo pass is a blur followed by a steep
   alpha contrast, and a 1.9px stroke is thinned past the
   threshold and erased — the plus would simply stop existing.
   So the DISC is the liquid body, and it swells and settles on
   the library's spring as it fills, while the plus and the
   check ride crisp on top of it. That is the same division
   every liquid component here makes: the surface is the
   library's, the content is ours. */
/* the button's height and the air above it, inside the card —
   how much of the card's foot is hidden while nothing is picked */
/* the button's height, and the width it grows out of */
const CTA_H = 44;

/* the card's corner. The button inside it takes this less the
   10px between them. */
const RST_CORNER = 20;

export function Roster({
  /* how many people are on the list, 2..4 */
  /* three by default; the knob offers two or three */
  rows = 3,
  /* the card's corner, px — the button follows it */
  corner = RST_CORNER,
}: {
  rows?: number;
  corner?: number;
} = {}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  /* which row the pointer is on. A travelling indicator needs
     an index, not a :hover — CSS can shade the row under the
     cursor but it cannot carry one shape from row to row, and
     the carrying is the whole effect. */
  /* Which row, and whether the mark is shown — two values,
     because one cannot do both: `?? 0` on the way out walks
     the mark up to the first row while it fades. Same fix as
     the create menu. */
  /* the library measures in screen pixels and every card on
     this bench is drawn at a fraction — see Gooey.tsx */
  const { box, k } = useGooScale();

  const toggle = (id: string) => {
    setSent(false);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  /* The list, at the length that was asked for. Clamped rather
     than trusted: this arrives from a URL as readily as from
     the panel, and a slice past the end would render an empty
     card rather than refusing one bad number. */
  const list = PEOPLE.slice(0, Math.max(2, Math.min(PEOPLE.length, Math.round(rows))));

  const r = clamp(corner, 0, 40);

  const ready = picked.length > 0;
  const out = ready || sent;

  /* ── ONE SPRING FOR THE CARD AND ITS BUTTON ──────────────
     How much of the card's foot is hidden, in px: CTA_ROOM shut,
     0 open. The clip AND the button's fade, rise and scale are
     all read off this one number, so they cannot drift apart.

     It was two animations — the clip as an animated string and
     the button on springs of its own with a delay — and a string
     interpolation interrupted halfway (pick, unpick, pick) could
     be left mid-value, which is the card that stayed tall. A
     spring on a plain number is only ever somewhere between its
     ends and always on its way to the latest target. */
  /* ── THE ACTION GROWS OUT OF ITS OWN MIDDLE ──────────────
     No longer dropped from under the card: it starts as a pill
     one button tall at the centre of its slot and widens to the
     full row on a lively spring, going a few pixels past and
     settling back — the bounce. Its own WIDTH, not a scale, so
     the corners and the words are never stretched; the slot it
     sits in never changes size, so nothing below it moves. The
     label waits until there is room for it. */
  const grow = useSpring(out ? 1 : 0, { stiffness: 320, damping: 21, mass: 0.9 });
  useEffect(() => { grow.set(out ? 1 : 0); }, [out, grow]);
  const ctaW = useTransform(grow, (v) => `calc(${CTA_H}px + (100% - ${CTA_H}px) * ${Math.max(0, v).toFixed(4)})`);
  const ctaOpacity = useTransform(grow, [0, 0.25], [0, 1]);
  const ctaText = useTransform(grow, [0.55, 0.9], [0, 1]);

  return (
    <div
      className="rst"
      ref={box}
      style={{
        "--k": k,
        /* the stylesheet's row, gap and hover mark all read
           these — see ROW_H above */
        "--rst-row": `${ROW_H}px`,
        "--rst-gap": `${ROW_GAP}px`,
        /* ── ONE KNOB, TWO CORNERS, ONE RATIO ─────────────
           The card is drawn at 20 and the button at 13, which
           is 0.65 of it, and that proportion is the thing worth
           keeping rather than either number. Driving both from
           one value at a fixed ratio means the pair looks
           deliberate at every setting instead of only at the
           one it was drawn at — square together at 0, and the
           button still the tighter of the two all the way up.

           They are SIBLINGS, not nested: the button sits under
           the card rather than inside it, so this is a shared
           corner language and not the concentric-radius rule.

           Past about 34 the button's share exceeds half its own
           44px height and the browser clamps it to a pill,
           which is the right end for it to arrive at and needs
           no arithmetic here to say so. */
        "--rst-r": `${r}px`,
        /* ── the hover mark, concentric with the card ──────
           The radius of a thing inside another, less the gap
           between them — the box's 10px padding — which is the
           rule every nested pair on this bench follows. It was
           a flat 13 against a card cut at 20, so the mark was
           rounder than the box holding it at the default and
           still 13 at every other setting of the knob.

           Capped at half the row, past which a rounded
           rectangle is a pill and a larger number draws the
           same shape. */
        "--rst-pill-r": `${Math.min(ROW_H / 2, Math.max(0, r - 10)).toFixed(1)}px`,
        /* inside the card now, so it follows the nesting rule:
           the card's corner less the 10px between them */
        "--rst-cta-r": `${Math.min(22, r * 0.65).toFixed(1)}px`,
      } as React.CSSProperties}
    >
      {/* ── NO LIQUID BETWEEN THE LIST AND ITS ACTION ─────
          The two used to be one goo group, so the button left
          the card by necking off it like a droplet. It read as
          the button being STUCK to the panel — a blob welded to
          an edge rather than a control — and at any bridge
          value there is a moment where the two are joined by
          something that is neither.

          They are two objects. The card is a card and the
          button is a button, and the honest way for a button
          that does not exist yet to arrive is to come out from
          under the thing it belongs to. See .rst-cta.

          The goo that is LEFT is the goo that was always doing
          real work: the hover mark travelling between rows, and
          the plus becoming a check. Those are single bodies
          changing shape, which is what a metaball is for. */}
      <div className="rst-stack">
        {/* ── THE CARD GROWS TO HOLD ITS ACTION ─────────────
            The button used to slide out from under the card as
            a second object. It lives INSIDE the card now, as its
            last row, and the card's foot opens to show it: the
            box is always its full height in layout and a clip
            hides the bottom band while nothing is picked. A
            clip is paint, not layout — the note on the button
            says what animating the real height cost the wall —
            and `round` keeps the corners the card's own at every
            frame of the spring. */}
        <motion.div className="rst-box">
            {/* ── the hover wash is each row's own ──────────
                It was one mark that TRAVELLED from row to row on
                a spring. Each row now carries its own, fading in
                under the pointer and out when it leaves, so
                moving down the list is one fading out as the
                next fades in — nothing slides. See .rst-row::before. */}
            {list.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  className="rst-row"
                  data-on={on}
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                >
                  <img className="rst-av" src={AVATARS[p.id]} alt="" />
                  <span className="rst-who">
                    <span className="rst-name">{p.name}</span>
                    <span className="rst-at">{p.handle}</span>
                  </span>
                  {/* the disc is liquid, the glyph is not — see
                      the note above the component */}
                  <Liquid
                    className="rst-tickgoo"
                    blur={4}
                    contrast={16}
                    fill={on ? "var(--fill-on, var(--ink))" : "transparent"}
                    filterPadding={24}
                  >
                    <Liquid.Item effect="move" move={{ springiness: 0.45, wobble: 0.8, trail: 0.2 }}>
                      <motion.span
                        className="rst-tick"
                        aria-hidden="true"
                        animate={{ scale: on ? 1.1 : 1 }}
                        transition={LIQUID}
                      >
                        {/* Unpicked, the mark is the OUTLINE of
                            the disc that is coming — not a plus
                            promising an add. A row you tick is
                            not a row you add something to, and
                            the empty ring is the one shape
                            everybody already reads as "not yet".

                            It lives here rather than in <Liquid>
                            because the goo filter thresholds
                            alpha and can only give back a solid
                            body; a ring drawn through it closes
                            into a blob. So the disc is the
                            filter's and the ring is the glyph
                            layer's, which is the same division
                            the check already worked under.

                            r is 10.9 of 24 units, half a unit
                            short of the box, so the 1.5 stroke
                            lands just inside the filled disc's
                            silhouette and the two read as one
                            object changing state. The check is
                            scaled to 0.78 about the centre. */}
                        <svg viewBox="0 0 24 24">
                          <circle className="rst-ring" cx="12" cy="12" r="10.9" />
                          <path className="rst-check" d="M8.26 12.31l2.57 2.57 4.91-5.15" />
                        </svg>
                      </motion.span>
                    </Liquid.Item>
                  </Liquid>
                </button>
              );
            })}
        </motion.div>
        {/* ── THE ACTION IS OUTSIDE THE CARD ───────────────────
            Its own button under the card again, not a row the
            card opens to reveal. It keeps its place in the stack
            whether or not it is showing — laying it out on arrival
            would re-pack the wall — and comes out from under the
            card on the same spring that used to open the card's
            foot: rising from tucked-under, unfolding as it clears. */}
        <motion.button
          className="rst-cta"
          data-out={out || undefined}
          disabled={!out}
          /* ── IT UNFOLDS, IT DOES NOT JUST DROP ──────────────
             A slide is one number changing, and one number is
             all it read as: the button appeared at full size
             the whole way down, so the only event was arrival.

             Three now, and they are deliberately out of step.
             It comes out SQUASHED — 0.88 across, 0.55 tall,
             which is roughly the shape of something still
             tucked under the card — and expands into itself as
             it clears. The vertical spring is softer than the
             horizontal one, so the width settles first and the
             height is still opening a beat later, which is
             what stops it reading as one box being scaled.

             All three are transforms. Nothing here lays out —
             the row stays reserved whether the button is in it
             or not, because animating a layout property inside
             a wall card re-packs the entire wall. */
          /* it rises into the band the card is opening, read off
             the same spring as the edge */
          style={{ opacity: ctaOpacity, width: ctaW }}
          whileTap={out ? { scale: 0.975 } : undefined}
          onClick={() => {
            if (!out) return;
            setSent(true);
            setPicked([]);
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={sent ? "sent" : String(picked.length)}
              className="rst-cta-label"
              style={{ opacity: ctaText }}
              initial={{ filter: "blur(3px)" }}
              animate={{ filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {sent
                ? "Requests sent"
                : `Send ${picked.length === 1 ? "request" : `${picked.length} requests`}`}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}

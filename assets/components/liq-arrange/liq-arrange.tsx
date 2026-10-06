import { useEffect, useId, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

/* ── what this block expects the page to provide ───────

#arr-goo — an SVG filter the stylesheet points at. Mount it once,
   anywhere in the page, inside an <svg width="0" height="0"
   style={{ position: "absolute" }}><defs>…</defs></svg>:

   <filter id="arr-goo" x="-50%" y="-50%" width="200%" height="200%"
           colorInterpolationFilters="sRGB">
     <feGaussianBlur in="SourceGraphic" stdDeviation={2.2} result="smear" />
     <feColorMatrix
       in="smear"
       type="matrix"
       values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -13"
     />
   </filter>
*/

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

/* ── token → real colour ─────────────────────────────────
   Framer interpolates colours, but only real ones. A custom
   property does not qualify twice over: getPropertyValue
   hands back the unresolved token stream, and half of these
   tokens are color-mix(), which is not a colour until
   something computes it.

   So we let the engine do it. A hidden probe inside the
   component inherits the component's own custom properties —
   including any [data-fill] or [data-surface] override on an
   ancestor — and `color` on it computes all the way down to
   an rgb triple we can hand to Framer.

   Re-read whenever the theme or fill flips, or the animation
   would tween toward the previous palette. */
function useTokens(
  ref: React.RefObject<HTMLElement | null>,
  names: string[],
): Record<string, string> {
  const [vals, setVals] = useState<Record<string, string>>({});
  const key = names.join("|");
  const last = useRef("");

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const read = () => {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
      host.appendChild(probe);
      const next: Record<string, string> = {};
      for (const n of names) {
        /* a bare token gets wrapped; anything else (a fallback
           chain, a literal) is already a colour expression */
        probe.style.color = n.startsWith("--") ? `var(${n})` : n;
        next[n] = getComputedStyle(probe).color;
      }
      probe.remove();
      const sig = JSON.stringify(next);
      if (sig !== last.current) {
        last.current = sig;
        setVals(next);
      }
    };

    read();

    /* every ancestor that can redefine the palette */
    const mo = new MutationObserver(read);
    const flags = ["data-theme", "data-fill", "data-surface", "data-stroke"];
    for (let el: HTMLElement | null = host; el; el = el.parentElement) {
      mo.observe(el, { attributes: true, attributeFilter: flags });
    }
    return () => mo.disconnect();
  }, [ref, key]);

  return vals;
}

/* AVATARS was Bencho's own pictures, which is not licensed
   to travel. Point this at yours. */
const AVATARS: Record<string, string> = {};

/* ══ Liquid ═══════════════════════════════════════════════
   Three metaball studies: a toggle, a reorderable list, and
   a create menu.

   RECONSTRUCTED. The original file was destroyed; this is
   rebuilt against the surviving stylesheet, which specifies
   the geometry, the layering and the timing exactly. The
   behaviour matches what index.css and the catalog demos
   require. The original's internal reasoning is not
   recoverable and is not reproduced here.

   ── the shared constraint ───────────────────────────────
   Everything on a filtered layer must be OPAQUE. The goo
   filter thresholds alpha, so a translucent fill under it
   disappears. That is why each of these has two layers: an
   opaque blob layer that carries the filter, and an unfiltered
   layer above it carrying the text — antialiased type would
   be eaten by the same threshold. */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ══ 2 · Arrange ══════════════════════════════════════════
   A reorderable list where the row you hold is free — nothing
   clamps it to a rail. Only its height decides where the list
   opens, and that reading is what gets clamped.

   The rows are rendered ONCE in a fixed DOM order and moved by
   transform, so .arr-row[3] is whoever was fourth in the data,
   not whoever is fourth on screen. The catalog's demo script
   depends on exactly that. */

type Person = { id: string; name: string; here: boolean; tint: string };

/* `id` is the avatar key in avatars.ts, so it stays put even when
   the name on the row changes — it names the photograph. */
const PEOPLE: Person[] = [
  { id: "mara", name: "Mara Quinn", here: true, tint: "#7c3aed" },
  { id: "ines", name: "Tomás Oliveira", here: false, tint: "#0e7490" },
  { id: "kai", name: "Lars Andersen", here: true, tint: "#b8431c" },
  { id: "sofia", name: "Sofia Ricci", here: false, tint: "#15803d" },
];

/* one number, read by both the stylesheet and the swell */
const PILL = 196;

const initials = (n: string) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/* the pitch the rows sit at, and the corner they are cut
   with. 22 is half of a 44px row, which is the pill. */
const STEP = 50;
/* the row's default corner. 22 is half of 44 and therefore a
   full pill, and the pill is where this landed: a rounded
   rectangle reads as a card in a list, which was the argument
   for 10, but these rows carry a face at one end and a handle
   at the other and the capsule is the shape that says so.

   It has to be stated HERE and not only in the panel. The wall
   renders every block with no options at all — `entry.render()`
   — so the card in the feed is drawn from these numbers and
   the overlay is drawn from the panel's. Left at 10 with the
   panel saying 22, the same component had square-ish corners
   in the feed and a pill in the overlay, which is exactly the
   fault the note on `lean` below warns about. */

const CORNER = 22;
const CORNER_MAX = 22;

export function Arrange({
  /* how much a flung row deforms, 0..100 */
  give = 50,
  /* how far it tilts into the throw, 0..100 */
  /* the panel's default and the component's have to agree, or
     a block lifted out of this project behaves differently
     from the one on the card */
  lean = 18,
  /* ── the row pitch, and it is not a knob any more ────────
     50 against a 44px row is a 6px gap, which is the spacing
     this list should have had from the start. It was a slider
     over 50..60 and every setting above the bottom of that
     range was airier than a list of names wants to be — a
     knob whose good answer is one of its ends is a decision
     that had not been taken yet.

     Still a prop, so a block lifted out of here can be spaced
     differently; simply not something the panel asks. */
  step = STEP,
  /* the row's corner, 0..22 — 22 is half of 44 and therefore
     a full pill, which is where it sits */
  corner = CORNER,
}: {
  give?: number;
  lean?: number;
  step?: number;
  corner?: number;
} = {}) {
  /* visual order, as data indices. The ONLY thing here that is
     React state — everything that moves is a motion value, so a
     drag re-renders when the order changes and not before. */
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3]);
  const [held, setHeld] = useState<number | null>(null);
  /* which row the pointer is over. A hover state and not a
     `:hover` rule, because what it drives is a spring in
     Framer rather than a colour — and because a row that is
     being DRAGGED has to keep showing its grip even when the
     pointer has left it, which a CSS hover cannot say. */
  const [over, setOver] = useState<number | null>(null);

  const grab = useRef<{ id: number; y: number; slot: number; last: number; at: number } | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  /* ── 2.6, down from 3.6 ──────────────────────────────────
     The blur is what fuses two rows, and it is also why the
     gaps did not read as equal. A threshold on summed alpha
     means the DRAWN edge of a row depends on how much
     neighbouring mass is inside its blur — and the two middle
     rows have a neighbour on each side where the top and
     bottom have one. Same geometry, measured identical to
     three decimals in both the overlay and the wall; different
     result on screen.

     At 3.6 the 6px gap was 1.7 blur radii, which is well
     inside the range where a neighbour contributes. At 2.6 it
     is 2.3, and the tail arriving from the far side is a
     fraction of what it was — so the end rows and the middle
     rows neck by amounts much closer together.

     Not lower, and not the pitch instead. The fusing IS this
     component: rows passing each other during a drag come far
     closer than 6px, and that is the moment the goo exists
     for. Softening it keeps that and quietens the resting
     state; opening the pitch would have cost the fusing at
     every distance. The threshold is untouched at 28 so this
     changes one thing. */
  const { url: gooUrl, goo } = useGoo(2.6, 28);

  /* resolved to real rgb, and re-resolved when Fill or Theme
     flips — Framer cannot tween a token or a color-mix() */
  const REST = "var(--fill-slab, var(--surface-2))";
  const T = useTokens(stage, [REST, "--lift", "--warm", "--ink", "--ink-2", "--ink-3", "--ink-4"]);

  /* One motion value per row, declared flat rather than mapped:
     four names is uglier than a loop and cannot get the hook
     order wrong if PEOPLE ever changes length. */
  const y0 = useMotionValue(0), y1 = useMotionValue(0);
  const y2 = useMotionValue(0), y3 = useMotionValue(0);
  const ys = useMemo(() => [y0, y1, y2, y3], [y0, y1, y2, y3]);

  /* the throw, as a value rather than as state — this changes on
     every pointermove and must not cost a render */
  const vel = useMotionValue(0);
  const squash = useTransform(vel, (v) => 1 + Math.abs(v) * (give / 100) * 0.12);
  const wide = useTransform(squash, (q) => 1 / q);
  const tilt = useTransform(vel, (v) => v * (lean / 100) * 2.6);

  /* Rows that are not in your hand spring to their slot. The
     held one is excluded: its value is being written directly
     from the pointer, and animating the same value would fight
     the finger for it. */
  useEffect(() => {
    order.forEach((id, slot) => {
      if (id === held) return;
      animate(ys[id], slot * step, LIQUID);
    });
  }, [order, step, held, ys]);

  const down = (id: number) => (e: React.PointerEvent) => {
    if (grab.current) return;
    /* capture so a drag that wanders off the row keeps
       reporting to it. It THROWS if the id is not a live
       pointer — a synthetic event from a test or a rehearsal
       is exactly that — and it was the first statement in the
       handler, so the throw took `setHeld` and the whole grab
       down with it. The drag is perfectly usable without the
       capture; it must not be able to prevent one. */
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* not a live pointer */ }
    grab.current = { id, y: e.clientY, slot: order.indexOf(id), last: e.clientY, at: performance.now() };
    setHeld(id);
    vel.set(0);
  };

  const move = (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    const el = stage.current;
    /* zoom correction: the card is scaled, so a screen delta is
       not a layout delta */
    const k = el ? (el.getBoundingClientRect().width / (el.offsetWidth || 1)) || 1 : 1;
    const d = (e.clientY - g.y) / k;

    /* THE fix for the jump. The held row is measured from the
       slot it was picked up in, never from the slot it is
       currently occupying — that one changes underneath the
       gesture as the list reorders, and reading it here made the
       row leap a full row-height at the exact moment the shuffle
       happened. Pinned to the finger means pinned to where the
       finger started. */
    ys[g.id].set(g.slot * step + d);

    const now = performance.now();
    const dt = Math.max(8, now - g.at);
    vel.set(clamp(((e.clientY - g.last) / k / dt) * 16, -3, 3));
    g.last = e.clientY;
    g.at = now;

    /* where the row's own height says it belongs — this reading
       is clamped, the row itself is not */
    const want = clamp(Math.round((g.slot * step + d) / step), 0, PEOPLE.length - 1);
    if (want !== order.indexOf(g.id)) {
      /* a detent: the one moment in the drag with a real event
         in it, so it gets the dry click rather than the slide */
      setOrder((o) => {
        const next = o.filter((x) => x !== g.id);
        next.splice(want, 0, g.id);
        return next;
      });
    }
  };

  const up = () => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    setHeld(null);
    vel.set(0);
  };

  return (
    <div
      className="arr-stage"
      ref={stage}
      style={{
        "--step": `${step}px`,
        "--pill": `${PILL}px`,
        /* ── the corner, and the METABALL cares about it ────
           Two round-ended rows fuse into a shape that still
           reads as rows; two square ones fuse into a bar with
           a notch, because the filter is bridging edges that
           were never going to meet at a tangent. So the knob
           is honest at both ends and the ends are genuinely
           different objects — which is the point of having it
           rather than an argument against.

           Capped at 22 because that is half of 44 and a
           radius past half the height is the same pill with a
           bigger number in it. */
        "--arr-r": `${clamp(corner, 0, CORNER_MAX)}px`,
      } as React.CSSProperties}
    >
      {goo}

      {/* the opaque layer that fuses */}
      <div className="arr-blobs" aria-hidden="true" style={{ filter: gooUrl }}>
        {PEOPLE.map((p, i) => {
          const isHeld = held === i;
          /* the hover lives on the BLOB, because the blob is
             what is painted — the row you point at is a layer
             above it and has no colour of its own */
          const warm = !isHeld && over === i;
          return (
            <motion.span
              key={p.id}
              className="arr-blob"
              style={{ y: ys[i] }}
              animate={{
                width: isHeld ? PILL + 12 : PILL,
                marginLeft: isHeld ? -(PILL / 2) - 6 : -(PILL / 2),
              }}
              transition={LIQUID}
            >
              <motion.span
                className="arr-skin"
                style={isHeld
                  ? { scaleX: wide, scaleY: squash, skewY: tilt }
                  : { scaleX: 1, scaleY: 1, skewY: 0 }}
                animate={{
                  backgroundColor: isHeld
                    ? T["--lift"]
                    : warm ? T["--warm"] : T[REST],
                }}
                transition={{ duration: 0.22 }}
              />
            </motion.span>
          );
        })}
      </div>

      {/* and the unfiltered layer that carries the type */}
      <div className="arr-ink">
        {PEOPLE.map((p, i) => {
          const isHeld = held === i;
          return (
            <motion.div
              key={p.id}
              className="arr-row"
              data-held={isHeld || undefined}
              style={{ y: ys[i] }}
              animate={{ color: isHeld ? T["--ink"] : T["--ink-2"] }}
              transition={{ duration: 0.2 }}
              onPointerDown={down(i)}
              onPointerMove={move}
              onPointerUp={up}
              onLostPointerCapture={up}
              onPointerEnter={() => setOver(i)}
              onPointerLeave={() => setOver((v) => (v === i ? null : v))}
            >
                            {/* ── nothing opens, and nothing is drawn ────────
                  There was a grip here — six dots, then two
                  lines — and a 14px slide of everything else to
                  make room for it. Both are gone. A row you can
                  pick up anywhere does not need a mark saying
                  where, and the mark was the only thing on this
                  block that appeared and disappeared under the
                  pointer; what it mostly did was make the row's
                  contents jump sideways every time you crossed
                  one. The hover is a change of TONE now, which
                  says the same thing and moves nothing. */}
              <span className="arr-slide">
              <motion.span
                className="arr-av"
                style={{ background: p.tint }}
                animate={{ scale: isHeld ? 1.08 : 1 }}
                transition={LIQUID}
              >
                {AVATARS[p.id] ? (
                  /* draggable={false} is load-bearing: an <img> is
                     natively draggable, so pressing the face began
                     an HTML5 drag, which cancels the pointer
                     sequence outright — the row simply would not
                     pick up if you happened to grab it there. */
                  <img src={AVATARS[p.id]} alt="" draggable={false} />
                ) : (
                  initials(p.name)
                )}
                <motion.span
                  className="arr-here"
                  animate={{
                    opacity: p.here ? 1 : 0,
                    boxShadow: `0 0 0 2px ${isHeld ? T["--lift"] : T[REST]}`,
                  }}
                  transition={{ duration: 0.22 }}
                />
              </motion.span>
              <span className="arr-label">{p.name}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

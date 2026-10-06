import { useLayoutEffect, useRef, useState } from "react";
import { Bookmark, Folder, House, Search, User } from "lucide-react";

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

/* How hard it lands.

   In a cubic-bezier the second control point's y is the whole
   of an overshoot: at 1 the thing stops dead on its target,
   and past 1 it travels beyond and comes back. Everything
   else in the curve is the approach and stays put.

   `tuned` is the y this component was drawn with, so 50
   returns it unchanged and the slider is centred on the
   design rather than on some shared average. */
const overshoot = (bounce: number, tuned: number) =>
  Number((1 + (bounce / 100) * (tuned - 1) * 2).toFixed(3));

/* the same, ready to drop into a transition */
const curve = (bounce: number, tuned: number, x1 = 0.28, x2 = 0.36) =>
  `cubic-bezier(${x1}, ${overshoot(bounce, tuned)}, ${x2}, 1)`;

/* the one helper this file wants from the shared kit */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Item = { key: string; label: string; Icon: typeof House };

/* the bar and the dock carry the same set: they are the same
   navigation in two different materials */
const BAR: Item[] = [
  { key: "home", label: "Home", Icon: House },
  { key: "search", label: "Search", Icon: Search },
  { key: "files", label: "Files", Icon: Folder },
  { key: "saved", label: "Saved", Icon: Bookmark },
  { key: "you", label: "You", Icon: User },
];

/* ══ icon nav, horizontal or vertical ═════════════════════
   Same two phase indicator as the segmented pill: the leading
   edge runs ahead, the pill dilates across both slots, then
   the trailing edge catches up and overshoots on landing. */

type Ind = { p: number; s: number };

/* the two shared mappings, so every elastic block on the
   bench is centred on 50 in the same way — see lab/motion */
const settle = (bounce: number) => ({
  /* transform and width overshoot by different amounts on
     purpose: the box arrives before its edges finish, which
     is what reads as give rather than as a bounce applied to
     a rectangle */
  move: curve(bounce, 1.28, 0.28, 0.36),
  size: curve(bounce, 1.34, 0.24, 0.38),
});

function IconNav({
  items,
  glyph = 17,
  /* "row" and "column", not "horizontal" and "vertical": the
     control that sets this is two slots in a 96px pill and
     those two words do not fit in it. A prop name is also a
     label here — the panel is generated from it. */
  axis = "row",
  dilate = 100,
  bounce = 50,
  speed = 50,
  hug = 6,
}: {
  items: Item[];
  /* the slot itself comes from --bar-slot, shared with the
     toolbar; only the glyph inside it is a prop */
  glyph?: number;
  axis?: "row" | "column";
  /* how much of the gap between the two slots the pill spans
     while in transit. At 0 it simply slides across; at 100 it
     covers both ends at once and the stretch is the whole
     gesture. */
  dilate?: number;
  bounce?: number;
  speed?: number;
  hug?: number;
}) {
  const vertical = axis === "column";
  const [active, setActive] = useState(items[0].key);
  const trackRef = useRef<HTMLElement | null>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<Ind | null>(null);
  const [phase, setPhase] = useState<"idle" | "stretch" | "settle">("idle");
  const indRef = useRef<Ind | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const measure = (k: string): Ind | null => {
    const el = refs.current[k];
    if (!el) return null;
    return vertical
      ? { p: el.offsetTop, s: el.offsetHeight }
      : { p: el.offsetLeft, s: el.offsetWidth };
  };

  useLayoutEffect(() => {
    const settle = () => {
      const next = measure(active);
      if (!next) return;
      indRef.current = next;
      setPhase("idle");
      setInd(next);
    };
    settle();
    const ro = new ResizeObserver(settle);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical]);

  const select = (k: string) => {
    if (k === active) return;
    /* pitched by seat, so moving right up the bar rises and
       coming back down falls — the indicator's travel, heard */
    const to = measure(k);
    const from = indRef.current;
    setActive(k);
    if (!to) return;
    window.clearTimeout(timer.current);
    if (!from) {
      indRef.current = to;
      setPhase("settle");
      setInd(to);
      return;
    }
    /* The full union of both slots is as far as it can go —
       past that it is a pill reaching for somewhere neither
       end is. Dilate scales back from there toward simply
       moving, so 0 is a slide and 100 is the stretch. */
    const start = Math.min(from.p, to.p);
    const end = Math.max(from.p + from.s, to.p + to.s);
    const grow = dilate / 100;
    setPhase("stretch");
    setInd({
      p: to.p + (start - to.p) * grow,
      s: to.s + (end - start - to.s) * grow,
    });
    /* the handoff rides the same clock as the phases, or a
       fast bar hands over long after it has finished
       stretching and a slow one hands over mid-stretch */
    timer.current = window.setTimeout(() => {
      indRef.current = to;
      setPhase("settle");
      setInd(to);
    }, 150 * rate(speed));
  };

  const style = ind
    ? vertical
      ? { transform: `translate3d(0, ${ind.p}px, 0)`, height: ind.s }
      : { transform: `translate3d(${ind.p}px, 0, 0)`, width: ind.s }
    : { opacity: 0 };

  /* Handed to CSS as custom properties rather than as inline
     transitions: the two phases are two rules keyed on
     data-phase, and reproducing that branch in JS would mean
     the component knowing which phase it is painting. It sets
     the numbers; the stylesheet still decides the shape. */
  const curve = settle(bounce);
  const vars = {
    "--nav-pad": `${hug}px`,
    "--ind-stretch": `${Math.round(190 * rate(speed))}ms`,
    "--ind-settle": `${Math.round(420 * rate(speed))}ms`,
    "--ind-move": curve.move,
    "--ind-size": curve.size,
  } as React.CSSProperties;

  return (
    <nav
      ref={trackRef as React.RefObject<HTMLElement>}
      className="gnav"
      data-orientation={vertical ? "vertical" : "horizontal"}
      style={vars}
      aria-label="Main"
    >
      <span className="gnav-ind" data-phase={phase} style={style} aria-hidden />
      {items.map(({ key, label, Icon }) => (
        <button
          key={key}
          ref={(el) => { refs.current[key] = el; }}
          className="gnav-item"
          data-active={active === key}
          aria-label={label}
          aria-current={active === key ? "page" : undefined}
          onClick={() => select(key)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Icon size={glyph} strokeWidth={2} />
        </button>
      ))}
    </nav>
  );
}

/* the bar's corner. 26 is half of the 52px it runs at, which
   is the pill it already is; the vertical variant was drawn at
   30 and follows the same knob rather than keeping a number of
   its own — a control that does nothing when you turn the bar
   on its side is worse than one that moves it four pixels. */
const NAV_CORNER = 26;

export function GlassIconBar(props: {
  glyph?: number;
  axis?: "row" | "column";
  dilate?: number;
  bounce?: number;
  speed?: number;
  hug?: number;
  /* the bar's own corner, 0..26 */
  corner?: number;
}) {
  /* the same stage the toolbar stands on, so the wall measures
     both the same and their glyphs land at one size */
  return (
    <div
      className="bar-well"
      style={{ "--gnav-r": `${clamp(props.corner ?? NAV_CORNER, 0, NAV_CORNER)}px` } as React.CSSProperties}
    >
      <IconNav items={BAR} {...props} />
    </div>
  );
}

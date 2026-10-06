import { useRef, useState } from "react";
import { Code, Frame, Plus, Slash, Spline, Square, Type } from "lucide-react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hold = (e: React.PointerEvent) => e.stopPropagation();

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

/* ══ 2 · radial, one gesture ══════════════════════════════
   The interesting part is not the fan. It is that opening,
   choosing and committing are the same gesture: press, drag
   toward what you want, let go. No second tap, no travel back
   to a menu that opened somewhere else.

   A plain tap still works and leaves it open, because not
   everyone will discover the drag — but the drag is the point,
   and once you have it you never tap again. */

/* Six, and the fan shows the first `count` of them. The order
   is the order they are dealt, so the ones that leave when the
   count comes down are the ones from the far end of the
   sweep. */
const ARC = [
  { key: "frame", label: "Frame", Icon: Frame },
  { key: "text", label: "Text", Icon: Type },
  { key: "shape", label: "Shape", Icon: Square },
  { key: "pen", label: "Pen", Icon: Spline },
  { key: "code", label: "Code", Icon: Code },
  { key: "line", label: "Line", Icon: Slash },
];

/* the count the geometry below was tuned at — see `reach` */
const DEALT = 5;

/* A half circle. It has to open up this far to pay for the
   options being both bigger and closer in: at 132 degrees,
   48px circles pulled to a 68px radius overlap each other by
   9px. Wider spread buys back the room the shorter radius
   took away. */
const SPREAD = 180;

/* The radius is set from the gap the buttons should leave each
   other, not picked by eye. Neighbours sit SPREAD/(n-1) apart,
   so the space between two 48px circles is the chord
   2·R·sin(step/2) minus their diameter. At 68 with a half
   circle that is 4px, and the fan still clears the 56px core
   by 16 and the well by 13. */
const RADIUS = 68;

export function Radial({
  radius = RADIUS,
  spread = SPREAD,
  /* how far apart the options leave the core. At 0 the fan
     opens as one shape; the higher it goes the more it reads
     as items being dealt out one after another. */
  stagger = 28,
  /* how many of them are on the fan, 2..6 */
  count = DEALT,
}: {
  radius?: number;
  spread?: number;
  stagger?: number;
  count?: number;
}) {
  const arc = ARC.slice(0, clamp(Math.round(count), 2, ARC.length));

  /* ── the radius holds the GAP, not the number ────────────
     RADIUS is derived from how much room two buttons should
     leave each other — the note above it does the arithmetic —
     and it was derived at five. Put six on the same arc and
     the step closes from 45 degrees to 36: the chord between
     two 48px circles falls to 42 and they overlap by six.

     So past five the fan opens outward by exactly what it
     takes to keep the chord it had. Below five it does not
     move at all: fewer options are further apart already, and
     pulling them in to keep the gap constant would crowd them
     onto the core.

     The knob still moves the radius at every count — this
     scales what it asks for rather than putting a floor under
     it, so there is no setting of the slider that does
     nothing. */
  const chordAt = (n: number) =>
    Math.sin((spread / (n - 1) / 2) * (Math.PI / 180));
  const reach = radius * Math.max(1, chordAt(DEALT) / chordAt(arc.length));
  const [open, setOpen] = useState(false);
  const [aim, setAim] = useState<number | null>(null);
  /* The chosen label is still tracked and still not shown.
     It was printed under the fan as a caption, which is the
     kind of text a component adds when it does not trust its
     own feedback — the arc closing onto the option you picked
     already said it. Kept because the state IS the answer the
     component produces, and a consumer of this block wants it
     even though the demo does not print it. */
  const [, setChose] = useState<string | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /* whether the fan was already open when this press began —
     a press always opens it, so without remembering the state
     beforehand there is no way to tell an opening tap from a
     closing one, and it could never be dismissed */
  const wasOpen = useRef(false);

  /* the fan sits above the button, centred on straight up */
  const angleOf = (i: number) =>
    -90 - spread / 2 + (spread / (arc.length - 1)) * i;

  const nearest = (dx: number, dy: number) => {
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    let best = 0;
    let gap = 999;
    arc.forEach((_, i) => {
      /* shortest way round the circle, so -170 and 170 read as
         20 apart rather than 340 */
      const d = 180 - Math.abs(Math.abs(a - angleOf(i)) % 360 - 180);
      if (d < gap) { gap = d; best = i; }
    });
    return best;
  };

  const start = (e: React.PointerEvent) => {
    e.stopPropagation();
    down.current = { x: e.clientX, y: e.clientY, moved: false };
    wasOpen.current = open;
    setOpen(true);
    setChose(null);
    grab(e);
  };

  const move = (e: React.PointerEvent) => {
    const d = down.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    /* a press that has not travelled is still a tap */
    if (Math.hypot(dx, dy) < 14) { setAim(null); return; }
    d.moved = true;
    const next = nearest(dx, dy);
    /* one note each time the aim crosses onto a different
       option — the fan is chosen by direction, and this is
       what tells you the direction landed somewhere */
    setAim(next);
  };

  const end = () => {
    const d = down.current;
    down.current = null;
    if (d?.moved && aim !== null) {
      setChose(ARC[aim].label);
      setOpen(false);
    } else if (wasOpen.current) {
      /* a tap on an open fan puts it away */
      setOpen(false);
    }
    setAim(null);
  };

  return (
    <div className="fan-well" ref={root}>
      <div className="fan-arc" data-open={open}>
        {arc.map((o, i) => {
          const a = (angleOf(i) * Math.PI) / 180;
          return (
            <button
              key={o.key}
              className="fan-opt gpane"
              data-live={aim === i}
              style={{
                transform: open
                  ? `translate(${Math.cos(a) * reach}px, ${Math.sin(a) * reach}px)`
                  : "translate(0, 0) scale(0.4)",
                transitionDelay: `${open ? i * stagger : 0}ms`,
              }}
              onClick={() => { setChose(o.label); setOpen(false); }}
              onPointerDown={hold}
              aria-label={o.label}
            >
              {/* 19 in a 48px circle. 16 was a third of it and
                  read as a label on a button rather than as the
                  tool itself — these are the only thing on the
                  fan, the words underneath being a hover state. */}
              <o.Icon size={19} strokeWidth={2} />
              <i className="fan-label">{o.label}</i>
            </button>
          );
        })}
      </div>

      <button
        className="fan-core"
        data-open={open}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label={open ? "Close" : "Add"}
      >
        <Plus size={22} strokeWidth={2} />
      </button>

    </div>
  );
}

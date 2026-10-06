import { useRef, useState } from "react";

/* ── C · tick chart, hover to scrub ────────────────────── */
const TICKS = 34;
/* ── C · progress ticks ─────────────────────────────────────
   Two numbers and a row of ticks, and nothing else.

   It used to carry a title, a status chip, a sentence of
   encouragement and a delta pill — four pieces of text
   explaining a bar that was already explaining itself. Every
   one of them was there because the block felt thin without
   them, which is the wrong reason to write a word: a
   component that needs a caption to feel finished is a
   component that has not finished.

   What is left is what the ticks cannot say on their own —
   the value, and the fact that scrubbing is a preview rather
   than a commitment. The delta only exists while you are
   scrubbing, because at rest there is nothing to be different
   from. */
export function Progress() {
  const committed = 66;
  const [cursor, setCursor] = useState<number | null>(null);
  const shown = cursor === null ? committed : Math.round(((cursor + 1) / TICKS) * 100);
  const filled = Math.round((shown / 100) * TICKS);
  const delta = shown - committed;

  /* ── THE ROW READS THE POINTER, THE TICKS DO NOT ─────────
     Every tick used to carry its own onPointerEnter, which is
     the obvious way to write this and works only with a mouse.
     A touch is captured to whatever it started on: drag your
     finger the length of the row and the browser keeps sending
     every event to the first tick you happened to land on, so
     enter never fires on any of the others and the scrubber
     sits still. It is not that the events are missing — they
     are all being delivered to the wrong element.

     One handler on the row, and the index comes from where the
     pointer actually is. That is the same answer for a mouse
     crossing tick 12 and a finger dragging over it, so the two
     stop being separate code paths. */
  const row = useRef<HTMLDivElement | null>(null);
  const down = useRef(false);

  const at = (clientX: number) => {
    const b = row.current?.getBoundingClientRect();
    if (!b || !b.width) return null;
    const i = Math.floor(((clientX - b.left) / b.width) * TICKS);
    return Math.min(TICKS - 1, Math.max(0, i));
  };

  /* ── one mark per tick crossed, not one per event ────────
     `click` bends with `at`, so running the length of the row
     is a rising scale rather than a row of identical noises,
     and it is the same gesture the dock makes when you sweep
     it. Guarded on the index actually changing, because a
     pointermove fires far more often than a tick is crossed. */
  const to = (i: number | null) => {
    setCursor((_was) => {
      return i;
    });
  };

  const track = (e: React.PointerEvent) => {
    /* a mouse scrubs on hover, the way it always did; a finger
       has to be down, or the row would answer a scroll passing
       over it */
    if (e.pointerType !== "mouse" && !down.current) return;
    to(at(e.clientX));
  };

  return (
    <div className="lab tik" style={{ width: 340 }}>
      <div className="tik-head">
        <span className="tik-fig">{shown}<i>%</i></span>
        {/* only while scrubbing, and only if it says something */}
        <span className="tik-delta" data-show={cursor !== null && delta !== 0} data-up={delta > 0}>
          {delta > 0 ? "+" : ""}{delta}
        </span>
      </div>

      <div
        className="tick-row"
        ref={row}
        onPointerDown={(e) => {
          down.current = true;
          /* it throws on a pointer id that is not live, which a
             scripted press is, and the scrub works without it */
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not live */ }
          to(at(e.clientX));
        }}
        onPointerMove={track}
        onPointerUp={() => { down.current = false; to(null); }}
        onPointerCancel={() => { down.current = false; to(null); }}
        onPointerLeave={() => { if (!down.current) to(null); }}
      >
        {Array.from({ length: TICKS }, (_, i) => (
          <div
            key={i}
            className="tick"
            data-on={i < filled}
            data-cursor={cursor !== null && i === cursor}
            style={{ height: `${52 + Math.round(Math.sin(i / 3.1) * 14) + (i < filled ? 26 : 0)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

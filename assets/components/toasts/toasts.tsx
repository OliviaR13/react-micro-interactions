import { useLayoutEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* every one of these lives on a canvas that pans on pointer
   drag, so anything draggable has to keep its gesture */
const hold = (e: React.PointerEvent) => e.stopPropagation();

/* ══ 2 · notify ═══════════════════════════════════════════
   The component is the button, alone in the middle of its
   stage. It used to raise a stack of draggable toasts, which
   made the study about the toasts rather than the button.

   A press does two things. The bell swings on a damped
   oscillation rather than a single shake — each pass smaller
   than the last, which is what a struck bell actually does.
   And the button stays down: it fills, and its label changes
   to the promise it just made. The confirmation is the
   control itself, so there is nothing to read and nothing to
   dismiss. Press it again to call the promise off.

   The label swap would jolt the pill from one width to
   another, so the two labels are stacked out of flow and the
   pill is given the width of whichever one is showing. It
   grows into its answer instead of snapping to it. */

/* 22 is half of the 44px button — the pill it already is */
const BELL_CORNER = 22;

export function Notify({ corner = BELL_CORNER }: { corner?: number } = {}) {
  const bell = useRef<HTMLSpanElement | null>(null);
  const say = useRef<HTMLSpanElement | null>(null);
  const [on, setOn] = useState(false);
  const [w, setW] = useState<number>();

  /* before paint, or the pill is briefly the wrong width */
  useLayoutEffect(() => {
    const shown = say.current?.querySelector<HTMLElement>('[data-show="true"]');
    if (shown) setW(shown.offsetWidth);
  }, [on]);

  const ring = () => {
    const b = bell.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* each strike restarts the swing rather than queueing one,
       so hammering the button reads as impatience, not lag */
    b?.getAnimations().forEach((a) => a.cancel());
    b?.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(-17deg)", offset: 0.11 },
        { transform: "rotate(14deg)", offset: 0.27 },
        { transform: "rotate(-9deg)", offset: 0.44 },
        { transform: "rotate(6deg)", offset: 0.61 },
        { transform: "rotate(-3deg)", offset: 0.78 },
        { transform: "rotate(0deg)" },
      ],
      { duration: 820, easing: "ease-out" }
    );
  };

  const push = () => {
    /* only the yes rings. Turning it off is not an event the
       bell should celebrate. */
    if (!on) { ring(); }
    setOn((v) => !v);
  };

  return (
    <div
      className="bell-well"
      style={{ "--bell-r": `${clamp(corner, 0, BELL_CORNER)}px` } as React.CSSProperties}
    >
      <button
        className="bell-btn gpane"
        data-on={on}
        aria-pressed={on}
        onClick={push}
        onPointerDown={hold}
      >
        <span ref={bell} className="bell-glyph">
          <Bell size={16} strokeWidth={2} />
        </span>
        <span
          ref={say}
          className="bell-say"
          data-ready={w !== undefined}
          style={{ width: w }}
        >
          <i data-show={!on}>Notify me</i>
          <i data-show={on}>You&rsquo;ll be notified</i>
        </span>
      </button>
    </div>
  );
}

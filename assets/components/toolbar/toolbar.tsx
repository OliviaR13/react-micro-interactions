import { useState } from "react";
import { Circle, Code, Frame, MousePointer2, Slash, Spline, Square, Star, Type } from "lucide-react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hold = (e: React.PointerEvent) => e.stopPropagation();

/* ══ 1 · canvas toolbar ═══════════════════════════════════
   A floating tool bar, the kind every canvas app grows. No
   title, no chip — it is a bar, and a bar is the whole
   component.

   The shape slot keeps whichever shape you last chose, so the
   bar teaches you your own habit instead of resetting to a
   default every time. That is the small thing these get wrong
   most often. */

const SHAPES = [
  { key: "rect", Icon: Square },
  { key: "oval", Icon: Circle },
  { key: "line", Icon: Slash },
  { key: "star", Icon: Star },
];

const TOOLS = [
  { key: "move", Icon: MousePointer2 },
  { key: "frame", Icon: Frame },
];

/* after the shape slot, still left of the divider: text is a
   thing you put ON the canvas, like a frame or a shape */
const PLACE = [
  { key: "text", Icon: Type },
];

/* right of the divider: the curve and the code, the two that
   are about paths and output rather than placing things. The
   hand went on 2026-09-26. */
const TAIL = [
  { key: "pen", Icon: Spline },
  { key: "code", Icon: Code },
];

/* ── the toolbar's two corners, and they are concentric ────
   The rail is 14 and the tools inside it are 10, which is the
   rail's radius less the 4px of padding between them — the
   rule that makes a corner hug what is inside it. So the knob
   sets the RAIL and the tools follow, and there is no setting
   where a square rail holds rounded tools. */
const BAR_CORNER = 15;
const BAR_MAX = 25;

export function Toolbar({ corner = BAR_CORNER }: { corner?: number } = {}) {
  const [tool, setTool] = useState("move");
  const [shape, setShape] = useState(SHAPES[0]);
  const [open, setOpen] = useState(false);

  const pick = (s: (typeof SHAPES)[number]) => {
    setShape(s);
    setTool("shape");
    setOpen(false);
  };

  const Btn = ({ k, Icon }: { k: string; Icon: typeof Square }) => (
    <button
      className="bar-tool"
      data-on={tool === k}
      onClick={() => { setTool(k); }}
      onPointerDown={hold}
      aria-label={k}
    >
      <Icon size={17} strokeWidth={2} />
    </button>
  );

  return (
    <div
      className="bar-well"
      style={{
        "--bar-r": `${clamp(corner, 0, BAR_MAX)}px`,
        "--bar-tool-r": `${Math.max(0, clamp(corner, 0, BAR_MAX) - 4)}px`,
      } as React.CSSProperties}
    >
      {open && (
        <div className="bar-flyout gpane">
          {SHAPES.map((s) => (
            <button
              key={s.key}
              className="bar-tool"
              data-on={shape.key === s.key}
              onClick={() => pick(s)}
              onPointerDown={hold}
              aria-label={s.key}
            >
              <s.Icon size={17} strokeWidth={2} />
            </button>
          ))}
        </div>
      )}

      <div className="bar-rail gpane">
        {TOOLS.map((t) => <Btn key={t.key} k={t.key} Icon={t.Icon} />)}

        {/* the shape slot: the face is the last shape used, the
            notch opens the rest */}
        <span className="bar-slot" data-on={tool === "shape"}>
          <button
            className="bar-tool"
            data-on={tool === "shape"}
            onClick={() => setTool("shape")}
            onPointerDown={hold}
            aria-label={shape.key}
          >
            <shape.Icon size={17} strokeWidth={2} />
          </button>
          <button
            className="bar-notch"
            data-open={open}
            onClick={() => { setOpen((o) => !o); }}
            onPointerDown={hold}
            aria-label="More shapes"
          />
        </span>

        {PLACE.map((t) => <Btn key={t.key} k={t.key} Icon={t.Icon} />)}

        <span className="bar-split" />
        {TAIL.map((t) => <Btn key={t.key} k={t.key} Icon={t.Icon} />)}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2, Undo2 } from "lucide-react";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hold = (e: React.PointerEvent) => e.stopPropagation();

/* ══ 4 · confirm in place ═════════════════════════════════
   The button becomes its own dialog. Nothing opens over the
   page, nothing shifts around it, and the choice stays under
   the cursor that asked for it — a modal moves your attention
   somewhere else to answer a question you just asked here.

   Undo lives in the same footprint too, on a timer, so the
   destructive path never needs a toast either. */

const GRACE = 4000;

/* 22 is half of the 44px shell — the pill it already is */
const SAY_CORNER = 22;

/* ── one pill, two widths ─────────────────────────────────
   "Delete" at rest; pressed, it deletes at once and the same
   pill springs wide to say so and offer Undo. No confirmation
   step: an undo that is right there is kinder than a question,
   because it asks only of the people who changed their mind. */
const SAY_W = 260;
const SAY_IDLE = 112;
const SAY_DONE = 206;

export function Confirm({ corner = SAY_CORNER }: { corner?: number } = {}) {
  const [phase, setPhase] = useState<"idle" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = () => {
    /* the one destructive action on the bench, and the only
       place `land` is used: something has happened and it is
       over. A bright note here would be celebrating a
       delete. */
    setPhase("done");
    timer.current = window.setTimeout(() => setPhase("idle"), GRACE);
  };
  const undo = () => {
    window.clearTimeout(timer.current);
    setPhase("idle");
  };

  /* out with a little give, back in firmly */
  const done = phase === "done";
  const w = done ? SAY_DONE : SAY_IDLE;
  const left = (SAY_W - w) / 2;
  const spring = done
    ? { type: "spring" as const, stiffness: 420, damping: 20, mass: 0.9 }
    : { type: "spring" as const, stiffness: 460, damping: 30, mass: 0.9 };
  const r = clamp(corner, 0, SAY_CORNER);

  return (
    <div
      className="say-well"
      data-phase={phase}
      style={{ "--say-r": `${r}px` } as React.CSSProperties}
    >
      <motion.span className="say-body" initial={false} animate={{ left, width: w }} transition={spring} />

      <AnimatePresence initial={false}>
        {!done && (
          <motion.button
            key="idle"
            className="say-face"
            style={{ left, width: w }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.08 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            onClick={commit}
            onPointerDown={hold}
          >
            <Trash2 size={15} strokeWidth={2} />
            Delete
          </motion.button>
        )}

        {done && (
          <motion.div
            key="done"
            className="say-merged"
            style={{ left, width: w }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
          >
            <span className="say-done">
              <Check size={14} strokeWidth={2} />
              Deleted
            </span>
            <button className="say-undo" onClick={undo} onPointerDown={hold}>
              <Undo2 size={13} strokeWidth={2} />
              Undo
            </button>
            <i className="say-fuse" style={{ animationDuration: `${GRACE}ms` }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

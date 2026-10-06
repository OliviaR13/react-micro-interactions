import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";

/* ══ Like ═════════════════════════════════════════════════
   A heart and a count. Press it and the heart vanishes, a disc
   blooms where it was and hollows out into a ring, seven pairs
   of coloured dots burst off the ring, and the heart springs
   back in red and past its size — while the count rolls up one.
   Press again and it empties and the count rolls back down.

   ── ONLY THE DIGITS THAT CHANGE ROLL ────────────────────
   An odometer, not a number being replaced: 1,284 to 1,285
   turns the last wheel and leaves the rest where they are,
   and 1,299 to 1,300 turns three, each a beat after the one
   to its right, the way a carry travels. Every digit is keyed
   by its place and its value, so a digit that did not change
   is the same element and never moves.

   ── UP FOR MORE, DOWN FOR LESS ─────────────────────────
   Liking rolls the new digit in from below and the old one out
   the top; unliking runs the other way. Direction is the whole
   difference between a count going up and a count being
   replaced. */

const H = 44;
const RED = "#e5484d";
/* the confetti: a pair of dots per spoke, never the same colour
   twice in a pair */
const CONFETTI = ["#f48ea7", "#cc8ef5", "#8ce8c3", "#91d2fa", "#f5a524", "#e5484d", "#9fc7fa"];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const fmt = (n: number) => n.toLocaleString("en-US");

function Roll({ value, up }: { value: number; up: boolean }) {
  const chars = fmt(value).split("");
  /* places counted from the right, so a new leading digit does
     not shift the keys of the ones already there */
  return (
    <span className="lk-count" aria-hidden="true">
      {chars.map((c, i) => {
        const place = chars.length - 1 - i;
        if (c === ",") return <span key={`c${place}`} className="lk-comma">,</span>;
        return (
          <span key={`p${place}`} className="lk-wheel">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={c}
                className="lk-digit"
                initial={{ y: up ? "100%" : "-100%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: up ? "-100%" : "100%", opacity: 0 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: place * 0.04 }}
              >
                {c}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

/* ── the effects ───────────────────────────────────────────
   Two ways for a like to land, one knob. Every one plays once
   per press from a layer keyed by the press, and every number
   in them is fixed rather than random: several copies share a
   wall and a bench, and must all do the same thing. */
export const EFFECTS = ["Bloom", "Firework"] as const;

/* a spread of fixed "random" numbers, one per particle */
const jit = (k: number, seed: number) => {
  const x = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Burst({ fx, fly, ink }: { fx: string; fly: number; ink: boolean }) {
  const c = (k: number) => (ink ? "var(--lk-on)" : CONFETTI[k % CONFETTI.length]);
  const style = (o: Record<string, string | number>) => o as React.CSSProperties;

  if (fx === "Firework") {
    /* thrown up and out, then they fall: the x is steady, the y
       is its own element on a rise-then-drop curve */
    return (
      <>
        {Array.from({ length: 12 }, (_, k) => {
          const a = -Math.PI / 2 + (k / 11 - 0.5) * Math.PI * 1.25;
          const v = 22 + fly * 22 + jit(k, 7) * 10;
          return (
            <span key={k} className="lk-fw" style={style({ "--x": `${Math.cos(a) * v}px`, "--d": `${jit(k, 8) * 60}ms` })}>
              <i style={style({ "--y": `${Math.sin(a) * v}px`, background: c(k) })} />
            </span>
          );
        })}
      </>
    );
  }
  /* Bloom: a disc that hollows into a ring, and pairs of confetti */
  return (
    <>
      <span className="lk-bloom" />
      {Array.from({ length: 7 }, (_, k) => (
        <span key={k} className="lk-spoke" style={style({ "--a": `${k * (360 / 7) - 90}deg` })}>
          <i style={style({ "--c": c(k) })} />
          <i style={style({ "--c": c(k + 3) })} />
        </span>
      ))}
    </>
  );
}

export function Like({
  /* the count before you press */
  start = 1300,
  /* how the like lands */
  effect = "Bloom",
  /* how far the particles fly, 0..100 */
  burst = 50,
  color = "Red",
  corner = H / 2,
}: {
  start?: number;
  effect?: string;
  burst?: number;
  color?: string;
  corner?: number;
} = {}) {
  const base = Math.max(0, Math.round(start));
  const [liked, setLiked] = useState(false);
  const [beat, setBeat] = useState(0);
  const count = base + (liked ? 1 : 0);
  const fly = clamp(burst, 0, 100) / 100;
  const r = clamp(corner, 0, H / 2);
  const ink = color === "Ink";
  const fx = (EFFECTS as readonly string[]).includes(effect) ? effect : "Bloom";

  const press = () => {
    const next = !liked;
    setLiked(next);
    if (next) {
      setBeat((b) => b + 1);
    }
  };

  return (
    <div className="lk-frame">
      <button
        type="button"
        className="lk"
        data-liked={liked || undefined}
        data-color={color}
        data-fx={fx}
        aria-pressed={liked}
        aria-label={`Like. ${fmt(count)} likes`}
        style={{ height: H, "--r": `${r}px`, "--lk-on": ink ? "var(--fill-on, var(--ink))" : RED } as React.CSSProperties}
        onClick={press}
      >
        <span className="lk-heart">
          {/* keyed by the press, so every like plays once */}
          <span key={liked ? `on${beat}` : "off"} className="lk-glyph" data-on={liked || undefined}>
            <Heart size={19} strokeWidth={2.3} fill={liked ? "currentColor" : "none"} />
          </span>
          {liked && fly > 0 && (
            <span key={beat} className="lk-burst" style={{ "--fly": fly } as React.CSSProperties} aria-hidden="true">
              <Burst fx={fx} fly={fly} ink={ink} />
            </span>
          )}
        </span>
        <Roll value={count} up={liked} />
      </button>
    </div>
  );
}

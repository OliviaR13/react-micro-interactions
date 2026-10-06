import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Check, Upload as UpIcon } from "lucide-react";

/* ══ Upload dropzone ══════════════════════════════════════
   A drop box, and three files lying on a tray under it. Pick
   one up and carry it into the box: it uploads there — name,
   a rolling percentage, a bar — ticks, and goes back to the
   tray so you can do it again.

   ── NO REAL FILES ───────────────────────────────────────
   The files are part of the block. Nothing is read from the
   desktop and nothing is sent anywhere; the drag is an ordinary
   pointer drag inside the block, which is also what lets the
   wall's scripted cursor demonstrate it.

   ── THE BOX INHALES, AND SWALLOWS ───────────────────────
   A plain filled box, no edge. A file carried over it is
   answered before it is let go: the box grows with a small
   bounce and the arrow lifts toward the hand. Let go and the
   file is SUCKED in — it accelerates toward the box's middle,
   shrinking and drawing out long as it goes — and the box gives
   a little gulp before the upload appears in it. Let go
   anywhere else and the file springs home.

   ── ONE OF THEM IS TOO BIG ──────────────────────────────
   The limit is fixed at 5 MB and the video is always over it,
   so dropping it shakes the box, says so in red and the file
   springs home. The picture always goes. */

/* ── inlined from lab/spring ──────────────────────── */
/* ── one spring, for everything that settles ───────────────
   The maths was already on this bench twice, copied by hand:
   Humidity's wheel and Brightness's column both accumulate
   velocity toward a target, damp it, and snap when both the
   delta and the velocity fall under 0.02. Two copies is a
   coincidence; five would be a policy, so it comes out here
   before the elastic blocks are written against it.

   The two shipped copies are deliberately NOT refactored onto
   this. They work, they are tuned, and rewriting the innards
   of two live components to prove a point about duplication
   is how a good afternoon becomes a bad one. This is the one
   new code uses.

   Frames, not milliseconds. `dt` is expressed in sixtieths of
   a second and the damping is RAISED to it rather than
   multiplied by it, so a dropped frame decays the same amount
   of energy as the two frames it replaced. Multiplying is the
   version that makes a spring behave differently on a busy
   page, which is the hardest kind of bug to see.

   The loop parks itself the moment the value has settled.
   CLAUDE.md is not complimentary about the one permanent
   requestAnimationFrame already on this bench and there is no
   case for five more. */

/* Read once, the way the wheel and the pill nav do. A
   preference, not a live input. */
const stillness = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const MAX = 5;

/* what it says the second time, and after */
const SNARK = [
  "Still 12.6 MB. It didn't shrink.",
  "Pushing harder won't help",
  "Have you tried compressing it?",
  "The box is full of excuses now",
  "No.",
];

type F = { id: string; name: string; ext: string; size: number; tint: string };

const FILES: F[] = [
  { id: "img", name: "mood.png", ext: "PNG", size: 2.4e6, tint: "#079455" },
  { id: "vid", name: "demo.mp4", ext: "MP4", size: 12.6e6, tint: "#155EEF" },
];

const fmt = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ── the file icon ─────────────────────────────────────────
   After Untitled UI's: a rounded page on a 40 grid with a thin
   grey outline and a folded corner, and the extension on a
   coloured label that sticks out past the page's left edge —
   the colour carries the kind before the word is read. */
function Page({ f, size = 40 }: { f: F; size?: number }) {
  return (
    <svg className="upl-page" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        className="upl-page-line"
        d="M7.75 4A3.25 3.25 0 0 1 11 .75h16c.121 0 .238.048.323.134l10.793 10.793a.46.46 0 0 1 .134.323v24A3.25 3.25 0 0 1 35 39.25H11A3.25 3.25 0 0 1 7.75 36z"
      />
      <path className="upl-page-line" d="M27 .5V8a4 4 0 0 0 4 4h7.5" />
      <rect width="29" height="16" x="1" y="18" rx="8" fill={f.tint} />
      <text x="15.5" y="29.3" textAnchor="middle" className="upl-page-ext">{f.ext}</text>
    </svg>
  );
}

function Roll({ value }: { value: number }) {
  const s = String(Math.round(value));
  return (
    <span className="upl-roll" aria-label={`${s}%`}>
      {s.split("").map((d, i) => (
        <span key={s.length - i} className="upl-roll-col">
          <span className="upl-roll-strip" style={{ transform: `translateY(${-Number(d)}em)` }}>
            {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
          </span>
        </span>
      ))}
      %
    </span>
  );
}

type Phase = { kind: "idle" } | { kind: "up"; f: F; p: number } | { kind: "done"; f: F };

export function Upload({
  /* how fast a file sends, 0..100 */
  speed = 50,
  /* how springy a file flies home, 0..100 */
  bounce = 40,
  corner = 16,
}: {
  speed?: number;
  bounce?: number;
  corner?: number;
} = {}) {
  const still = stillness();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [inBox, setInBox] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  /* what the box says when it refuses — null while it is not */
  const [refuse, setRefuse] = useState<string | null>(null);
  const tries = useRef(0);
  const cool = useRef(0);
  const [gulp, setGulp] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const now = useRef<HTMLSpanElement>(null);
  const tiles = useRef<Record<string, HTMLDivElement | null>>({});
  const shake = useAnimationControls();
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  const knobs = useRef({ speed });
  knobs.current = { speed };

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    timers.current.forEach(clearTimeout);
    clearTimeout(cool.current);
  }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  /* ── the pretend wire ──────────────────────────────────── */
  const send = (f: F) => {
    setInBox(f.id);
    if (still) { finish(f); return; }
    setPhase({ kind: "up", f, p: 0 });
    let p = 0;
    let prev = 0;
    const secs = (4 - (clamp(knobs.current.speed, 0, 100) / 100) * 3.2) * (0.7 + Math.min(1, f.size / 5e6) * 0.6);
    const tick = (t: number) => {
      const dt = prev ? Math.min(0.05, (t - prev) / 1000) : 0;
      prev = t;
      /* uneven on purpose: a steady climb reads as a timer */
      p = Math.min(1, p + (dt / secs) * (0.4 + Math.random() * 1.2));
      if (p >= 1) { raf.current = 0; finish(f); return; }
      setPhase({ kind: "up", f, p });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const finish = (f: F) => {
    tries.current = 0;
    setPhase({ kind: "done", f });
    /* the file goes back to the tray, ready to go again */
    later(() => { setPhase({ kind: "idle" }); setInBox(null); }, 1500);
  };

  /* ── trying again ─────────────────────────────────────────
     The first refusal is plain. Try the same file again and the
     box starts to answer back, a new line each time, the last one
     repeating — until a file that fits goes through, which puts it
     back to being polite. */
  const refuseIt = () => {
    const n = tries.current++;
    setRefuse(n === 0 ? `Too big — up to ${MAX} MB` : SNARK[Math.min(n - 1, SNARK.length - 1)]);
    shake.start({ x: [0, -7, 6, -4, 2, 0], transition: { duration: 0.38 } });
    later(() => setRefuse(null), 1800);
    /* "in a row" means close together: leave it alone a while and
       the next refusal is the polite one again */
    clearTimeout(cool.current);
    cool.current = window.setTimeout(() => { tries.current = 0; }, 8000);
  };

  /* ── carrying a file ───────────────────────────────────── */
  const drag = useRef<null | { id: string; x0: number; y0: number; k: number }>(null);

  const place = (id: string, dx: number, dy: number, lift: boolean) => {
    const el = tiles.current[id];
    if (!el) return;
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${lift ? 1.08 : 1}) rotate(${lift ? clamp(dx * 0.04, -6, 6) : 0}deg)`;
  };

  const hits = (e: React.PointerEvent) => {
    const r = zone.current?.getBoundingClientRect();
    return !!r && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
  };

  const onDown = (f: F) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (inBox === f.id) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a scripted pointer */ }
    const k = e.currentTarget.getBoundingClientRect().width / e.currentTarget.offsetWidth || 1;
    drag.current = { id: f.id, x0: e.clientX, y0: e.clientY, k };
    setHeld(f.id);
    place(f.id, 0, 0, true);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    place(g.id, (e.clientX - g.x0) / g.k, (e.clientY - g.y0) / g.k, true);
    const on = hits(e) && phase.kind === "idle";
    if (on !== over) {
      setOver(on);
    }
  };

  const onUp = (f: F) => (e: React.PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
    setHeld(null);
    setOver(false);
    if (!g) return;
    const inside = hits(e);
    if (inside && phase.kind === "idle") {
      if (f.size > MAX * 1e6) refuseIt();
      else {
        suck(f, (e.clientX - g.x0) / g.k, (e.clientY - g.y0) / g.k, g.k);
        return;
      }
    }
    /* springs home */
    place(f.id, 0, 0, false);
  };

  /* ── the suction ──────────────────────────────────────────
     From where it was let go to the box's middle, on an ease-IN:
     slow to leave and faster the nearer it gets, which is what
     reads as being pulled rather than as flying. It shrinks as it
     goes and draws out long in the direction of travel, then the
     box gulps and the upload takes its place. */
  const suck = (f: F, dx: number, dy: number, k: number) => {
    const el = tiles.current[f.id];
    const z = zone.current;
    if (!el || !z || still) { place(f.id, 0, 0, false); send(f); return; }
    const a = el.getBoundingClientRect();
    const b = z.getBoundingClientRect();
    const tx = dx + (b.left + b.width / 2 - (a.left + a.width / 2)) / k;
    const ty = dy + (b.top + b.height / 2 - (a.top + a.height / 2)) / k;
    /* drawn out along the pull, never turned: a tile rotated to
       face its travel went upside down on the way up and spun on
       a short pull. Up or down it goes tall, sideways it goes
       wide, and a pull too short to have a direction only shrinks */
    const ux = Math.abs(tx - dx);
    const uy = Math.abs(ty - dy);
    const squeeze = Math.hypot(ux, uy) < 24 ? "scale(0.16)" : uy >= ux ? "scale(0.14, 0.34)" : "scale(0.34, 0.14)";
    el.style.transition = "transform 380ms cubic-bezier(0.55, 0, 0.85, 0.3), opacity 300ms ease-in 80ms";
    el.style.transform = `translate(${tx}px, ${ty}px) ${squeeze}`;
    el.style.opacity = "0";
    later(() => { setGulp(true); later(() => setGulp(false), 460); }, 250);
    later(() => {
      /* put the tile home unseen, ready to pop back later */
      el.style.transition = "none";
      el.style.transform = "";
      el.style.opacity = "";
      send(f);
    }, 390);
  };

  /* ── the box hugs the upload ─────────────────────────────
     While a file is in it the box closes in round the upload row
     — measured, because the row is as wide as its name — and
     grows a little when the tick arrives; back to idle it opens
     out to the full drop box again. Width and height, never a
     scale, so its corner stays the corner. It shrinks inside a
     slot of fixed size, so nothing below it moves. */
  useLayoutEffect(() => {
    const z = zone.current;
    const n = now.current;
    if (!z) return;
    if (phase.kind === "idle" || !n) {
      z.style.width = "";
      z.style.height = "";
      return;
    }
    z.style.width = `${n.offsetWidth + 32}px`;
    z.style.height = `${n.offsetHeight + 28}px`;
  }, [phase.kind]);

  const r = Math.max(0, corner);
  const up = phase.kind !== "idle";
  const f = phase.kind !== "idle" ? phase.f : null;

  return (
    <div
      className="upl"
      data-held={held ? true : undefined}
      style={{ "--upl-r": `${r}px`, "--upl-spring": `cubic-bezier(0.3, ${1 + (bounce / 100) * 0.9}, 0.4, 1)` } as React.CSSProperties}
    >
      <motion.div animate={shake} className="upl-zone-wrap">
        <div
          ref={zone}
          className="upl-zone"
          data-over={over || undefined}
          data-refuse={refuse ? true : undefined}
          data-busy={up || undefined}
          data-gulp={gulp || undefined}
          aria-live="polite"
        >
          {!f ? (
            <>
              <span className="upl-icon"><UpIcon size={18} strokeWidth={2} /></span>
              <span className="upl-say">
                <b>{refuse ?? (over ? "Drop to upload" : "Drag a file here")}</b>
                <span>Up to {MAX} MB</span>
              </span>
            </>
          ) : (
            <span className="upl-now" key={f.id} ref={now}>
              <Page f={f} size={36} />
              <span className="upl-text">
                <span className="upl-name">{f.name}</span>
                <span className="upl-meta">
                  {fmt(f.size)} · {phase.kind === "done" ? "Uploaded" : <Roll value={phase.kind === "up" ? phase.p * 100 : 0} />}
                </span>
                <span className="upl-track">
                  <span className="upl-bar" style={{ transform: `scaleX(${phase.kind === "up" ? phase.p : 1})` }} />
                </span>
              </span>
              {/* the tick's room is kept from the start, so the box
                  is its final size before the tick arrives */}
              <span className="upl-end">
                {phase.kind === "done" && <span className="upl-tick"><Check size={12} strokeWidth={3} /></span>}
              </span>
            </span>
          )}
        </div>
      </motion.div>

      <div className="upl-tray">
        {FILES.map((file) => (
          <div key={file.id} className="upl-slot" data-empty={inBox === file.id || undefined}>
            <div
              ref={(el) => { tiles.current[file.id] = el; }}
              className="upl-file"
              data-held={held === file.id || undefined}
              data-gone={inBox === file.id || undefined}
              role="button"
              tabIndex={0}
              aria-label={`${file.name}, ${fmt(file.size)}. Drag into the box to upload, or press Enter.`}
              onPointerDown={onDown(file)}
              onPointerMove={onMove}
              onPointerUp={onUp(file)}
              onPointerCancel={onUp(file)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && phase.kind === "idle" && inBox !== file.id) {
                  e.preventDefault();
                  if (file.size > MAX * 1e6) refuseIt();
                  else send(file);
                }
              }}
            >
              <Page f={file} />
              <span className="upl-label">{file.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

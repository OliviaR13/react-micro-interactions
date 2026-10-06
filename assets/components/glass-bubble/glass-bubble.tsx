import { useEffect, useRef, useState } from "react";

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

/* COW was Bencho's own pictures, which is not licensed
   to travel. Point this at yours. */
const COW: string = "";

/* ══ Glass bubble, liquid ═════════════════════════════════
   A ball of glass you drag over a photograph. It bends what is
   under it — a little bigger in the middle, hard at the rim —
   splits the colour a hair at the very edge, catches the light
   along its top, and can be carried off the picture onto the
   card, where there is nothing to bend and it is only light and
   shadow.

   ── A SHADER, NOT A FILTER ──────────────────────────────
   The first Glass bubble was an SVG displacement map through a
   backdrop filter, and it is still there for the Lens page.
   What it could not do is know where its own edge was: a map
   is a picture, drawn once, so the rim was a band of numbers
   rather than a surface. Here the page is a texture and every
   pixel asks a signed distance function how far it is from
   the capsule's edge, which is what lets the bend, the rim
   light and the shadow all follow the SAME edge exactly —
   including while the capsule stretches under a fast drag.

   ── THE RIM READS OUTWARD ───────────────────────────────
   Near the edge each pixel samples from further out along the
   edge's normal, so the band round the rim shows what is just
   outside it, gathered in. That is what makes text curve at
   the edge of real glass. The middle only magnifies. */

/* ── the picture, and the room round it ─────────────────
   The photograph is square and the ball has the run of a
   margin on every side, so it can be carried half off the
   picture onto the card — the edge is something you cross, not
   a wall. The margin is part of the canvas and left clear, so
   the card itself shows through it. */
const PIC = 440;
const PAD = 90;
const W = PIC + PAD * 2;
const H = W;
/* the photograph's corner at rest; the Corner knob sets it */
const PIC_R = 40;
const VERT = `
attribute vec2 pos;
varying vec2 vUv;
void main() {
  vUv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D tex;
uniform vec2 res;
uniform vec2 c;
uniform vec2 b;
uniform float r;
uniform float bend;
uniform float fringe;
uniform float dark;
varying vec2 vUv;

float sdf(vec2 p) {
  vec2 q = abs(p - c) - b + vec2(r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

/* premultiplied: the margin round the picture is transparent,
   so the real card shows through it and the glass over it bends
   nothing — only its light and its shadow are left */
vec4 read(vec2 p) {
  return texture2D(tex, clamp(p / res, 0.0, 1.0));
}

void main() {
  vec2 p = vUv * res;
  float d = sdf(p);
  vec4 col = read(p);

  /* what it casts: soft, a little below. It darkens the picture
     where there is one and is a shadow of its own where there
     is not. */
  float ds = sdf(p - vec2(0.0, 9.0));
  float sh = (1.0 - smoothstep(-8.0, 26.0, ds)) * mix(0.14, 0.3, dark);
  if (d > 0.0) col = vec4(col.rgb * (1.0 - sh), col.a) + vec4(0.0, 0.0, 0.0, sh * (1.0 - col.a));

  if (d < 1.0) {
    float e = 1.5;
    vec2 n = normalize(vec2(
      sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)),
      sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e))
    ) + 1e-5);
    /* the bending band scales with the ball, so a big one is
       still a lens and a small one is not all rim */
    float bevel = min(b.y, max(22.0, b.y * 0.36));
    /* 0 at the rim, 1 once past the bevel */
    float t = clamp(-d / bevel, 0.0, 1.0);
    float edge = pow(1.0 - t, 2.4);

    vec2 mag = c + (p - c) / 1.1;
    vec2 off = n * edge * bevel * 1.1 * bend;
    vec2 q = mag + off;
    vec4 mid = read(q);
    vec4 g = vec4(read(q + off * fringe).r, mid.g, read(q - off * fringe).b, mid.a);

    /* the light: a thin lit band just inside the edge, bright
       where it faces up-left, a weaker catch on the far side
       where light has come through and out again */
    vec2 L = normalize(vec2(-0.55, -0.85));
    float rim = smoothstep(0.0, 1.6, -d) * (1.0 - smoothstep(1.6, 4.5, -d));
    float lit = max(dot(n, L), 0.0);
    float far = max(dot(n, -L), 0.0);
    g.rgb *= mix(1.03, 1.08, dark);
    /* light is added as light: colour and coverage together, so
       it shows on the card as well as on the picture */
    float light = rim * (0.18 + 0.75 * lit) + rim * far * 0.22 + edge * mix(0.05, 0.08, dark);
    g += vec4(vec3(light), light);
    g = clamp(g, 0.0, 1.0);

    float a = 1.0 - smoothstep(-0.6, 0.6, d);
    col = mix(col, g, a);
  }
  gl_FragColor = col;
}`;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* ── light or dark, read off the page ────────────────────
   The theme lives on <html data-theme>, so that is where this
   looks — not at the site's store, which keeps the block whole
   when it is copied out into somebody else's app. */
function useDark() {
  const read = () => document.documentElement.dataset.theme === "dark";
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function compile(gl: WebGLRenderingContext) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  return prog;
}

export function LiquidGlass({
  /* the ball's diameter, px */
  size = 180,
  /* how hard the rim bends, 0..100 */
  bend = 60,
  /* how far the colours part at the edge, 0..40 */
  fringe = 30,
  /* the photograph's corner, px */
  corner = PIC_R,
}: {
  size?: number;
  bend?: number;
  fringe?: number;
  corner?: number;
} = {}) {
  const dark = useDark();
  const still = stillness();
  const cv = useRef<HTMLCanvasElement | null>(null);
  const gl = useRef<{ g: WebGLRenderingContext; prog: WebGLProgram; tex: WebGLTexture } | null>(null);
  const page = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef(0);
  /* it starts on the picture, up and right of the middle */
  const state = useRef({ x: W * 0.6, y: H * 0.42, vx: 0, vy: 0, tx: W * 0.6, ty: H * 0.42 });
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const knobs = useRef({ size, bend, fringe, dark });
  knobs.current = { size, bend, fringe, dark };

  /* ── one frame ─────────────────────────────────────────── */
  const draw = () => {
    const G = gl.current;
    const c = cv.current;
    if (!G || !c) return;
    const { g, prog } = G;
    const k = c.width / W;
    const s = state.current;
    const { size: sz, bend: bd, fringe: fr, dark } = knobs.current;
    /* a fast drag stretches it along the way it is going and
       thins it across — the same volume, moving */
    const sp = Math.hypot(s.vx, s.vy);
    const stretch = still ? 0 : Math.min(0.14, sp * 0.012);
    const ax = sp > 0.01 ? Math.abs(s.vx) / sp : 1;
    const rad = clamp(sz, 100, 280) / 2;
    const bx = rad * (1 + stretch * ax - stretch * 0.5 * (1 - ax));
    const by = rad * (1 + stretch * (1 - ax) - stretch * 0.5 * ax);
    g.viewport(0, 0, c.width, c.height);
    g.useProgram(prog);
    const u = (n: string) => g.getUniformLocation(prog, n);
    g.uniform2f(u("res"), c.width, c.height);
    g.uniform2f(u("c"), s.x * k, s.y * k);
    g.uniform2f(u("b"), bx * k, by * k);
    g.uniform1f(u("r"), Math.min(bx, by) * k);
    g.uniform1f(u("bend"), clamp(bd, 0, 100) / 100);
    g.uniform1f(u("fringe"), clamp(fr, 0, 40) / 100);
    g.uniform1f(u("dark"), dark ? 1 : 0);
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  };

  /* ── the loop: a spring toward the hand, then stop ─────── */
  const run = () => {
    if (raf.current) return;
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      const s = state.current;
      if (still) { s.x = s.tx; s.y = s.ty; s.vx = 0; s.vy = 0; }
      else {
        const k = 0.22;
        const d = Math.pow(0.66, dt);
        s.vx = (s.vx + (s.tx - s.x) * k * dt) * d;
        s.vy = (s.vy + (s.ty - s.y) * k * dt) * d;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      draw();
      const moving = Math.abs(s.tx - s.x) > 0.05 || Math.abs(s.ty - s.y) > 0.05
        || Math.abs(s.vx) > 0.05 || Math.abs(s.vy) > 0.05 || grab.current;
      raf.current = moving ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };

  /* ── the page under the glass ──────────────────────────── */
  const paint = async () => {
    const c = cv.current;
    const G = gl.current;
    if (!c || !G) return;
    const pg = page.current ?? (page.current = document.createElement("canvas"));
    pg.width = c.width;
    pg.height = c.height;
    const x = pg.getContext("2d")!;
    const k = c.width / W;
    /* the margin stays clear: the card behind the canvas is
       the ground, whatever colour it is */
    x.clearRect(0, 0, pg.width, pg.height);
    const im = new Image();
    im.src = COW;
    await im.decode().catch(() => {});
    /* the photograph, square and rounded, cropped to fill */
    const px = PAD * k;
    const ps = PIC * k;
    const s = Math.max(ps / im.width, ps / im.height);
    const iw = im.width * s;
    const ih = im.height * s;
    x.save();
    x.beginPath();
    x.roundRect(px, px, ps, ps, clamp(corner, 0, 60) * k);
    x.clip();
    x.drawImage(im, px + (ps - iw) / 2, px + (ps - ih) / 2, iw, ih);
    x.restore();
    const { g, tex } = G;
    g.bindTexture(g.TEXTURE_2D, tex);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, pg);
    draw();
  };

  /* ── set up once ───────────────────────────────────────── */
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext("webgl", { antialias: true, premultipliedAlpha: true, alpha: true });
    if (!g) return;
    const prog = compile(g);
    if (!prog) return;
    const buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(prog, "pos");
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    const tex = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    gl.current = { g, prog, tex };
    /* NOT loseContext() here. StrictMode runs this cleanup and
       then the setup again on the SAME canvas, and a context
       that has been lost comes straight back from getContext
       still lost — a sad-face canvas. The browser frees it with
       the element. */
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      gl.current = null;
    };
  }, []);

  /* the page repaints when what is on it changes */
  useEffect(() => { paint(); }, [dark, corner]);
  /* the glass redraws when a knob moves */
  useEffect(() => { draw(); }, [size, bend, fringe]);

  /* ── the hand ──────────────────────────────────────────── */
  const at = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = r.width / W;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const onGlass = (p: { x: number; y: number }) => {
    const s = state.current;
    return Math.hypot(p.x - s.x, p.y - s.y) <= clamp(size, 100, 280) / 2 + 4;
  };

  return (
    <div className="lqg">
      <canvas
        ref={cv}
        className="lqg-canvas"
        style={{ width: W, height: H }}
        aria-label="A ball of glass over a photograph. Drag it."
        role="img"
        onPointerDown={(e) => {
          const p = at(e);
          if (!onGlass(p)) return;
          const s = state.current;
          grab.current = { dx: p.x - s.x, dy: p.y - s.y };
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* scripted */ }
          run();
        }}
        onPointerMove={(e) => {
          const p = at(e);
          const gr = grab.current;
          e.currentTarget.dataset.over = onGlass(p) || gr ? "true" : "false";
          if (!gr) return;
          const s = state.current;
          s.tx = clamp(p.x - gr.dx, 0, W);
          s.ty = clamp(p.y - gr.dy, 0, H);
          run();
        }}
        onPointerUp={() => {
          if (!grab.current) return;
          grab.current = null;
          run();
        }}
        onPointerCancel={() => { grab.current = null; run(); }}
      />
    </div>
  );
}

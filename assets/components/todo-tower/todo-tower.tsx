import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/* ══ Todo tower ════════════════════════════════════════════
   A list stacked like bricks, under gravity. Check one off and
   it is pulled out; take one out by hand and the rest come
   down after it. Pick anything up off the floor and put it
   back, or throw it.

   ── THE CARDS ARE RIGID BODIES NOW, AND THEY TURN ────────
   The version before this was bodies too, but only x and y:
   a card could slide off another and drop, and it dropped
   level, because nothing in it knew what an angle was. What
   was asked for next is the part that model could not fake —
   a card that is mostly hanging off the one under it TIPS,
   turning about the edge it was resting on, and goes over
   onto the floor on its side.

   That is torque, and torque needs a real solver, so the
   physics moved out to lab/rigid.ts: rotated boxes, contacts
   clipped to the faces that are actually touching, friction,
   and impulses solved together so a stack can stand. Nothing
   in this file decides that a card tips. It tips because its
   centre of mass is past the edge of its support and gravity
   does the rest.

   ── THE WHOLE CARD IS THE ROOM ───────────────────────────
   The block keeps its own fixed box — the wall fits and
   scales a block by that box, and a component that grew to
   its stage would feed back into its own scale forever. But
   the WORLD is not the box. The floor and walls are measured
   off the stage the block is drawn in — the grey card on the
   wall, the big stage in the overlay — and converted into the
   block's own pixels, so a card can be thrown into a corner
   of the grey that the tower's box never reached. Anywhere
   without a stage around it (a search thumbnail, a board on
   the canvas) the world falls back to the box itself. */

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

/* ── inlined from lab/rigid ──────────────────────── */
/* ══ rigid boxes ═══════════════════════════════════════════
   A small 2D rigid-body solver for rectangles, after Erin
   Catto's Box2D-Lite: separating-axis collision with clipped
   contact points, then sequential impulses with friction and
   warm starting. It is the smallest thing that gets the one
   behaviour the todo tower needs and a column of numbers
   cannot fake — a card that is more than half off what it is
   standing on TURNS about the edge and goes over.

   Units are the component's own pixels, y UP, angles in
   radians counter-clockwise. A body with invM 0 does not
   answer forces: the floor and walls are that, and so is a
   card in your hand, which is moved by setting its velocity
   and pushes everything else out of the way. */

type Body = {
  id: number;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  hw: number;
  hh: number;
  invM: number;
  invI: number;
  friction: number;
};

type Contact = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  sep: number;
  key: number;
  pn: number;
  pt: number;
  mn: number;
  mt: number;
  bias: number;
  fresh: boolean;
};

type Arbiter = { a: Body; b: Body; cs: Contact[]; friction: number };

function box(id: number, x: number, y: number, hw: number, hh: number, friction: number, mass = 1): Body {
  const still = mass === 0;
  return {
    id, x, y, a: 0, vx: 0, vy: 0, w: 0, hw, hh, friction,
    invM: still ? 0 : 1 / mass,
    invI: still ? 0 : 12 / (mass * (4 * hw * hw + 4 * hh * hh)),
  };
}

/* the mass a held card had, so letting go can give it back */
const massOf = (hw: number, hh: number) => ({ invM: 1, invI: 12 / (4 * hw * hw + 4 * hh * hh) });

/* ── collision ──────────────────────────────────────────── */

type Clip = { x: number; y: number; k: [number, number, number, number] };
const E1 = 1, E2 = 2, E3 = 3, E4 = 4;

const keyOf = (k: Clip["k"]) => k[0] | (k[1] << 4) | (k[2] << 8) | (k[3] << 12);

function incident(hx: number, hy: number, px: number, py: number, c: number, s: number, nx0: number, ny0: number): [Clip, Clip] {
  /* the normal in the incident box's own frame, reversed */
  const nx = -(c * nx0 + s * ny0);
  const ny = -(-s * nx0 + c * ny0);
  let a: Clip, b: Clip;
  if (Math.abs(nx) > Math.abs(ny)) {
    if (nx > 0) {
      a = { x: hx, y: -hy, k: [0, 0, E3, E4] };
      b = { x: hx, y: hy, k: [0, 0, E4, E1] };
    } else {
      a = { x: -hx, y: hy, k: [0, 0, E1, E2] };
      b = { x: -hx, y: -hy, k: [0, 0, E2, E3] };
    }
  } else if (ny > 0) {
    a = { x: hx, y: hy, k: [0, 0, E4, E1] };
    b = { x: -hx, y: hy, k: [0, 0, E1, E2] };
  } else {
    a = { x: -hx, y: -hy, k: [0, 0, E2, E3] };
    b = { x: hx, y: -hy, k: [0, 0, E3, E4] };
  }
  for (const v of [a, b]) {
    const x = v.x, y = v.y;
    v.x = px + c * x - s * y;
    v.y = py + s * x + c * y;
  }
  return [a, b];
}

function clip(vin: Clip[], nx: number, ny: number, offset: number, edge: number): Clip[] {
  const out: Clip[] = [];
  const d0 = nx * vin[0].x + ny * vin[0].y - offset;
  const d1 = nx * vin[1].x + ny * vin[1].y - offset;
  if (d0 <= 0) out.push(vin[0]);
  if (d1 <= 0) out.push(vin[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    const v: Clip = {
      x: vin[0].x + t * (vin[1].x - vin[0].x),
      y: vin[0].y + t * (vin[1].y - vin[0].y),
      k: d0 > 0 ? [...vin[0].k] : [...vin[1].k],
    };
    if (d0 > 0) {
      v.k[0] = edge;
      v.k[2] = 0;
    } else {
      v.k[1] = edge;
      v.k[3] = 0;
    }
    out.push(v);
  }
  return out;
}

function collide(A: Body, B: Body): Contact[] {
  const cA = Math.cos(A.a), sA = Math.sin(A.a);
  const cB = Math.cos(B.a), sB = Math.sin(B.a);
  const dpx = B.x - A.x, dpy = B.y - A.y;
  const dAx = cA * dpx + sA * dpy, dAy = -sA * dpx + cA * dpy;
  const dBx = cB * dpx + sB * dpy, dBy = -sB * dpx + cB * dpy;
  const a11 = Math.abs(cA * cB + sA * sB), a12 = Math.abs(-cA * sB + sA * cB);
  const a21 = Math.abs(-sA * cB + cA * sB), a22 = Math.abs(sA * sB + cA * cB);

  const fAx = Math.abs(dAx) - A.hw - (a11 * B.hw + a12 * B.hh);
  const fAy = Math.abs(dAy) - A.hh - (a21 * B.hw + a22 * B.hh);
  if (fAx > 0 || fAy > 0) return [];
  const fBx = Math.abs(dBx) - (a11 * A.hw + a21 * A.hh) - B.hw;
  const fBy = Math.abs(dBy) - (a12 * A.hw + a22 * A.hh) - B.hh;
  if (fBx > 0 || fBy > 0) return [];

  const REL = 0.95, ABS = 0.01;
  let axis = 0;
  let sep = fAx;
  let nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
  if (fAy > REL * sep + ABS * A.hh) {
    axis = 1; sep = fAy;
    nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA;
  }
  if (fBx > REL * sep + ABS * B.hw) {
    axis = 2; sep = fBx;
    nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB;
  }
  if (fBy > REL * sep + ABS * B.hh) {
    axis = 3; sep = fBy;
    nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB;
  }

  let fnx: number, fny: number, front: number, snx: number, sny: number, neg: number, pos: number;
  let negE: number, posE: number, inc: [Clip, Clip];
  if (axis === 0 || axis === 1) {
    fnx = nx; fny = ny;
    const hmain = axis === 0 ? A.hw : A.hh;
    const hside = axis === 0 ? A.hh : A.hw;
    front = A.x * fnx + A.y * fny + hmain;
    if (axis === 0) { snx = -sA; sny = cA; negE = E3; posE = E1; } else { snx = cA; sny = sA; negE = E2; posE = E4; }
    const side = A.x * snx + A.y * sny;
    neg = -side + hside;
    pos = side + hside;
    inc = incident(B.hw, B.hh, B.x, B.y, cB, sB, fnx, fny);
  } else {
    fnx = -nx; fny = -ny;
    const hmain = axis === 2 ? B.hw : B.hh;
    const hside = axis === 2 ? B.hh : B.hw;
    front = B.x * fnx + B.y * fny + hmain;
    if (axis === 2) { snx = -sB; sny = cB; negE = E3; posE = E1; } else { snx = cB; sny = sB; negE = E2; posE = E4; }
    const side = B.x * snx + B.y * sny;
    neg = -side + hside;
    pos = side + hside;
    inc = incident(A.hw, A.hh, A.x, A.y, cA, sA, fnx, fny);
  }

  const c1 = clip(inc, -snx, -sny, neg, negE);
  if (c1.length < 2) return [];
  const c2 = clip(c1, snx, sny, pos, posE);
  if (c2.length < 2) return [];

  const out: Contact[] = [];
  for (const v of c2) {
    const s = fnx * v.x + fny * v.y - front;
    if (s > 0) continue;
    const k = v.k;
    const key = axis >= 2 ? keyOf([k[2], k[3], k[0], k[1]]) : keyOf(k);
    out.push({
      x: v.x - s * fnx, y: v.y - s * fny, nx, ny, sep: s, key,
      pn: 0, pt: 0, mn: 0, mt: 0, bias: 0, fresh: true,
    });
  }
  return out;
}

/* ── the world ──────────────────────────────────────────── */

type World = {
  bodies: Body[];
  gravity: number;
  restitution: number;
  arbiters: Map<string, Arbiter>;
  /* the id of the body in a hand, if any — see CARRY */
  held: number | null;
};

const world = (gravity: number, restitution: number): World => ({
  bodies: [], gravity, restitution, arbiters: new Map(), held: null,
});

/* ── how well a carried stack holds on ──────────────────────
   Both are multiples of the cards' own friction, so Slip still
   means what it says with a card in the hand: a slippery tower
   sheds its riders sooner.

   GRIP is how much of the hand's sideways acceleration reaches
   a rider directly, as μ·g. CARRY is the friction of the real
   contacts inside the stack, which take up whatever GRIP did not
   pass on — at the card's foot, which is what tips it. */
const GRIP = 8;
const CARRY = 1.6;
const isStatic = (b: Body) => b.invM === 0 && b.invI === 0;

/* a body leaving takes its contacts with it, or whatever was
   resting on it keeps being held up by an impulse from nothing */
function remove(W: World, id: number) {
  W.bodies = W.bodies.filter((b) => b.id !== id);
  for (const [k, arb] of W.arbiters) if (arb.a.id === id || arb.b.id === id) W.arbiters.delete(k);
}

const SLOP = 0.5;
const BIAS = 0.2;
/* ── the most a contact may push two bodies apart, px/s ─────
   Overlap is corrected by a push proportional to how deep it
   is, and a card set down INTO the tower by the hand can be a
   whole card deep. Uncapped, that push arrived as a launch —
   the card and the ones under it jumped as if they had bounced.
   Capped, an overlap is eased out in a few frames instead. */
const PUSH = 90;
/* below this closing speed a contact is resting, not a hit —
   restitution on a resting contact is a stack that hums */
const RVEL = 90;
const ITER = 12;

/* `hit` hears the hardest fresh impact of the step, px/s */
function step(W: World, dt: number, hit?: (speed: number) => void) {
  const inv = 1 / dt;
  const B = W.bodies;
  let hardest = 0;

  for (let i = 0; i < B.length; i++) {
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i], b = B[j];
      const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      /* ── two bodies that cannot move have no contact ─────
         and must not KEEP one. This `continue` used to come
         before the key, so a card resting on the floor that
         was then made immovable left its old floor contact in
         the map, still solved every step — with no mass on
         either side, 1/0, and the card's position went to NaN.
         A NaN card is drawn nowhere and can never be picked up
         again, which is exactly how it presented. */
      if (a.invM === 0 && b.invM === 0 && a.invI === 0 && b.invI === 0) {
        W.arbiters.delete(key);
        continue;
      }
      const r = Math.hypot(a.hw, a.hh) + Math.hypot(b.hw, b.hh);
      const cs = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 > r * r ? [] : collide(a, b);
      if (!cs.length) {
        W.arbiters.delete(key);
        continue;
      }
      const old = W.arbiters.get(key);
      if (old && old.a === a) {
        for (const c of cs) {
          const o = old.cs.find((p) => p.key === c.key);
          if (o) {
            c.pn = o.pn;
            c.pt = o.pt;
            c.fresh = false;
          }
        }
      }
      W.arbiters.set(key, { a, b, cs, friction: Math.sqrt(a.friction * b.friction) });
    }
  }

  /* ── friction while something is carried ──────────────────
     Grip only WITHIN the carried stack — the held card and the
     cards riding on it — so they move as one. The held card
     slides freely over everything else: the floor, the walls,
     and the cards it was resting on. That last one mattered:
     grip against the cards underneath dragged a card being
     slid off the tower back behind the pointer, and the cards
     riding on it ran ahead and fell off. */
  const held = W.held === null ? null : B.find((x) => x.id === W.held) ?? null;
  if (held) {
    const carried = new Set<Body>([held, ...riders(W, held)]);
    for (const arb of W.arbiters.values()) {
      if (carried.has(arb.a) && carried.has(arb.b)) arb.friction = CARRY * Math.sqrt(arb.a.friction * arb.b.friction);
      else if (arb.a === held || arb.b === held) arb.friction = 0;
    }
  }

  for (const b of B) {
    if (b.invM === 0) continue;
    b.vy -= W.gravity * dt;
    /* a whisper of air, so a card spinning on one corner comes
       to a stop in a lifetime rather than a very long one */
    b.w *= 0.995;
  }

  for (const { a, b, cs } of W.arbiters.values()) {
    for (const c of cs) {
      const r1x = c.x - a.x, r1y = c.y - a.y;
      const r2x = c.x - b.x, r2y = c.y - b.y;
      const rn1 = r1x * c.nx + r1y * c.ny;
      const rn2 = r2x * c.nx + r2y * c.ny;
      const kn = a.invM + b.invM + a.invI * (r1x * r1x + r1y * r1y - rn1 * rn1) + b.invI * (r2x * r2x + r2y * r2y - rn2 * rn2);
      c.mn = kn > 1e-12 ? 1 / kn : 0;
      const tx = c.ny, ty = -c.nx;
      const rt1 = r1x * tx + r1y * ty;
      const rt2 = r2x * tx + r2y * ty;
      const kt = a.invM + b.invM + a.invI * (r1x * r1x + r1y * r1y - rt1 * rt1) + b.invI * (r2x * r2x + r2y * r2y - rt2 * rt2);
      c.mt = kt > 1e-12 ? 1 / kt : 0;
      c.bias = Math.min(PUSH, -BIAS * inv * Math.min(0, c.sep + SLOP));

      const dvx = b.vx - b.w * r2y - a.vx + a.w * r1y;
      const dvy = b.vy + b.w * r2x - a.vy - a.w * r1x;
      const vn = dvx * c.nx + dvy * c.ny;
      if (c.fresh && vn < -RVEL) {
        c.bias = Math.max(c.bias, -W.restitution * vn);
        hardest = Math.max(hardest, -vn);
      }

      const px = c.pn * c.nx + c.pt * tx;
      const py = c.pn * c.ny + c.pt * ty;
      a.vx -= a.invM * px; a.vy -= a.invM * py; a.w -= a.invI * (r1x * py - r1y * px);
      b.vx += b.invM * px; b.vy += b.invM * py; b.w += b.invI * (r2x * py - r2y * px);
    }
  }

  for (let it = 0; it < ITER; it++) {
    for (const { a, b, cs, friction } of W.arbiters.values()) {
      for (const c of cs) {
        const r1x = c.x - a.x, r1y = c.y - a.y;
        const r2x = c.x - b.x, r2y = c.y - b.y;

        let dvx = b.vx - b.w * r2y - a.vx + a.w * r1y;
        let dvy = b.vy + b.w * r2x - a.vy - a.w * r1x;
        const vn = dvx * c.nx + dvy * c.ny;
        let dpn = c.mn * (-vn + c.bias);
        const pn0 = c.pn;
        c.pn = Math.max(pn0 + dpn, 0);
        dpn = c.pn - pn0;
        let px = dpn * c.nx, py = dpn * c.ny;
        a.vx -= a.invM * px; a.vy -= a.invM * py; a.w -= a.invI * (r1x * py - r1y * px);
        b.vx += b.invM * px; b.vy += b.invM * py; b.w += b.invI * (r2x * py - r2y * px);

        dvx = b.vx - b.w * r2y - a.vx + a.w * r1y;
        dvy = b.vy + b.w * r2x - a.vy - a.w * r1x;
        const tx = c.ny, ty = -c.nx;
        const vt = dvx * tx + dvy * ty;
        let dpt = c.mt * -vt;
        const max = friction * c.pn;
        const pt0 = c.pt;
        c.pt = Math.min(max, Math.max(-max, pt0 + dpt));
        dpt = c.pt - pt0;
        px = dpt * tx; py = dpt * ty;
        a.vx -= a.invM * px; a.vy -= a.invM * py; a.w -= a.invI * (r1x * py - r1y * px);
        b.vx += b.invM * px; b.vy += b.invM * py; b.w += b.invI * (r2x * py - r2y * px);
      }
    }
  }

  for (const b of B) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.a += b.w * dt;
  }

  if (hit && hardest > 0) hit(hardest);
}

/* ── a hand that cannot crush ───────────────────────────────
   Steers a body toward a point, the way a held card follows the
   pointer. It used to SET the velocity toward the target every
   step, which is an unlimited force: press down into the tower
   and the held card drove a whole card-height into the stack,
   the solver could not push back against a speed rewritten
   every step, and when the overlap finally resolved it did so
   all at once — the tower exploded. Measured headless: 29.5px
   of overlap and cards leaving at 970px/s.

   Two limits, and both are needed:

   · the hand ACCELERATES the body toward where it should be
     going, capped at `accel`, rather than teleporting its speed
     there — so the push it can deliver is bounded
   · it will not keep driving INTO anything it is already
     pressed against. For each contact the body has that is
     deeper than a pixel, the part of the hand's velocity along
     that contact's normal, into the other body, is taken away.
     The card stops at the surface and slides along it, the way
     a hand pressing on a stack of books does not go through
     them. */
/* nothing is kept between steps any more; still exported so a
   caller letting go has one place to say so */
const release = (_b: Body) => {};

function steer(
  W: World,
  b: Body,
  tx: number,
  ty: number,
  dt: number,
  {
    speed = 2400,
    accel = 40000,
    turn = 14,
    tvx = 0,
    tvy = 0,
  }: { speed?: number; accel?: number; turn?: number; tvx?: number; tvy?: number } = {},
) {

  /* ── follow without swinging ──────────────────────────────
     The velocity asked for is the POINTER's own velocity, plus
     a closing speed toward it that is never faster than the
     card could brake from in the distance left. The first
     version asked for distance / (6 steps), capped only by top
     speed — and with the pull capped too it built up more speed
     than it could shed, overshot, and swung back and forth
     round a pointer that had stopped: measured, 344px behind on
     a quick move and still swinging 270px either side of it
     half a second after the hand was still. */
  const ex = tx - b.x, ey = ty - b.y;
  const dist = Math.hypot(ex, ey);
  const close = dist > 0 ? Math.min(speed, dist / (dt * 8), Math.sqrt(1.2 * accel * dist)) / dist : 0;
  let wantX = tvx + ex * close;
  let wantY = tvy + ey * close;
  const len = Math.hypot(wantX, wantY);
  if (len > speed) {
    wantX *= speed / len;
    wantY *= speed / len;
  }
  const dv = accel * dt;
  let vx = b.vx + Math.max(-dv, Math.min(dv, wantX - b.vx));
  /* gravity is added by the step, so the hand holds it up here */
  let vy = b.vy + Math.max(-dv, Math.min(dv, wantY - b.vy)) + W.gravity * dt;

  const carried = riders(W, b);
  const aboard = new Set(carried);
  for (const arb of W.arbiters.values()) {
    if (arb.a !== b && arb.b !== b) continue;
    /* never "into" what it is carrying: the stack on its back
       presses down under its own weight, and reading that as an
       obstacle refused to lift a card with anything on it */
    if (aboard.has(arb.a === b ? arb.b : arb.a)) continue;
    /* against a floor or wall, stop at the surface. Against
       another card, only once it is really being crushed — cards
       resting ON the held one sink a pixel or two under their
       own weight, and treating that as a wall would make it
       impossible to lift a card with a stack on it */
    const depth = isStatic(arb.a === b ? arb.b : arb.a) ? -1 : -2.5;
    for (const c of arb.cs) {
      if (c.sep > depth) continue;
      /* the normal points from a to b: into the OTHER body is
         +n when this is a, -n when this is b */
      const nx = arb.a === b ? c.nx : -c.nx;
      const ny = arb.a === b ? c.ny : -c.ny;
      const into = vx * nx + vy * ny;
      if (into > 0) {
        vx -= into * nx;
        vy -= into * ny;
      }
    }
  }
  /* ── and whatever is riding on it comes along ─────────────
     The cards resting on the held one — and the ones resting on
     THOSE, up the stack — get the same change of velocity the
     hand gives it, this step. That is what holding a stack is:
     the hand does not have to drag them along by friction, so it
     never has to be gentle to keep them on.

     The version before this switched to a soft pull (2500 px/s²)
     whenever anything sat on the card, so friction could keep up.
     The stack stayed on and the drag went to treacle — measured
     400 to 480px behind the pointer with one to five cards on top,
     and with five it had not even arrived when the move ended.
     With riders carried, it is the same firm hand either way.

     Only the linear velocity is shared. Gravity and torque still
     act on each rider, so a card hanging far off the edge of the
     stack still tips and falls; it just is not left behind. */
  /* ── riders are pulled toward the hand's speed, by grip ────
     Each card riding on the held one accelerates toward the
     held card's velocity — as fast as grip allows and no faster.
     A calm carry stays inside that and the stack comes along as
     one. A jerk, a shake or a dead stop asks for more: the rider
     gets what grip can give, lags, slides, and past the edge
     tips and falls.

     Matching a VELOCITY, not handing on a change in one. The
     earlier version passed each rider the change the hand made
     to the held card's speed; as long as nothing ever slipped
     that was exact, but the moment a rider lagged, its friction
     held the card back, the hand's next change was smaller, the
     rider got less, and it lagged more — every card slid off
     even on a calm carry.

     Sideways is friction: μ·g, times GRIP because a pointer
     starts and stops far more abruptly than any real hand, and
     at plain μ·g nothing survived a mouse.

     Up is the card below pushing, and has no limit. DOWN IS
     NOTHING BUT GRAVITY. Nothing holds a card onto the one under
     it, so when the hand stops rising — or drops — faster than
     gravity can slow the card on top, that card keeps going and
     leaves: a gentle lift makes it hop, a flick throws it at the
     ceiling. It was held down at up to thirty times gravity for
     a while, so that cards would not hop at the top of every
     lift; that also meant nothing could ever be thrown, and it
     was not physics. */
  for (const r of carried) {
    const side = r.friction * GRIP * W.gravity * dt;
    r.vx += Math.max(-side, Math.min(side, vx - r.vx));
    r.vy += Math.max(0, vy - r.vy);
  }
  b.vx = vx;
  b.vy = vy;
  b.w = Math.max(-turn, Math.min(turn, -b.a * turn));
}

/* everything resting on `base`, directly or through other cards:
   a contact counts when its normal points UP from the lower body */
function riders(W: World, base: Body): Body[] {
  const out: Body[] = [];
  const seen = new Set<Body>([base]);
  const queue = [base];
  while (queue.length) {
    const low = queue.shift()!;
    for (const arb of W.arbiters.values()) {
      if (arb.a !== low && arb.b !== low) continue;
      const other = arb.a === low ? arb.b : arb.a;
      if (seen.has(other) || isStatic(other) || !arb.cs.length) continue;
      const up = arb.a === low ? arb.cs[0].ny : -arb.cs[0].ny;
      if (up < 0.5) continue;
      seen.add(other);
      out.push(other);
      queue.push(other);
    }
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── the brick ──────────────────────────────────────────────
   Bigger than it was (170x30) and fewer of them: a card has to
   be large enough to read as an object that can fall over
   rather than a line of type that moves. */
const CW = 206;
const CH = 46;
const HW = CW / 2;
const HH = CH / 2;
const MAX = 8;

/* ── the block's own box — what the wall measures and scales ──
   The height follows the count, because the box is the tower's
   room wherever there is no stage around it to measure: a board
   on the bench, a search thumbnail. At a fixed 320 a tower of
   eight (368 of card) did not fit in its own world, the walls
   closed on it, and it stood there squashed and shivering.
   Six is 276 and still leaves the default box at 320, so the
   shape of the block on the wall has not moved. */
const W = 300;
const BASE_H = 320;
const boxH = (n: number) => Math.max(BASE_H, n * CH + 40);

/* air between the grey card's edge and the walls, so a card
   against the side is not cut by the card's rounded corner */
const INSET = 10;

/* gravity, px/s² */
const grav = (v: number) => 900 + (clamp(v, 0, 100) / 100) * 3300;

/* ── no bounce, and no knob for it ─────────────────────────
   These are blocks. A card landing back on the tower came off
   it again, and at any setting that could be seen that read as
   rubber rather than as a brick settling onto a brick. Nothing
   keeps any speed off an impact; the landing is the end. */
const RESTITUTION = 0;

/* Slip is friction, turned over — 0 is a grippy card that
   stays where it lands, 100 is one that skates — and it sets
   how crooked the tower is stacked to begin with. */
const frictionOf = (sl: number) => 0.85 - sl * 0.65;

/* ── the fixed step ─────────────────────────────────────────
   The solver runs at 240Hz whatever the display does. A stack
   is a set of contacts being held up by impulses, and a long
   step lets a card sink far enough in one go that the solver
   spends the next ten pushing it back out — which is a tower
   that shivers. Small steps are what let it stand still. */
const DT = 1 / 240;
const MAXSTEPS = 16;

/* at rest when every card is this slow for this many steps */
const REST_V = 6;
const REST_W = 0.04;
const REST_N = 60;

const GRAB = 4;
const VMAX = 1800;

/* how hard pulling one out scrapes the ones above it */
const SCRAPE = 150;

/* written down, not rolled: every copy of the block on a wall
   has to draw the same tower standing still */
const LEAN = [-0.42, 0.68, -0.15, 0.51, -0.86, 0.24, 0.73, -0.57];

const TODOS = [
  "Reply to Nadia",
  "Renew the domain",
  "Book the flights",
  "Export the icons",
  "Pay the invoice",
  "Call the landlord",
  "Back up the drive",
  "Water the plants",
];

type Room = { l: number; r: number; top: number; floor: number };
type Pose = { id: number; x: number; y: number; a: number };

/* WALL ids sit well clear of the cards' */
const FLOOR = 100, LEFT = 101, RIGHT = 102, ROOF = 103;

const tower = (n: number, sl: number, fr: number, lift = 0): Body[] =>
  Array.from({ length: n }, (_, i) =>
    box(
      i,
      LEAN[i % LEAN.length] * sl * 16,
      /* TODOS[0] reads first, so it is the card on TOP */
      HH + (n - 1 - i) * CH + lift,
      HW,
      HH,
      fr,
    ),
  );

export function Tower({
  gravity = 50,
  slip = 45,
  count = 6,
}: {
  gravity?: number;
  slip?: number;
  count?: number;
} = {}) {
  const n = clamp(Math.round(count), 3, MAX);
  const sl = clamp(slip, 0, 100) / 100;
  const fr = frictionOf(sl);
  const still = stillness();

  const W0 = useRef<World>(world(grav(gravity), RESTITUTION));
  const [poses, setPoses] = useState<Pose[]>([]);
  const [going, setGoing] = useState<Pose | null>(null);
  const [hand, setHand] = useState<number | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const H = boxH(n);
  /* read by the callbacks, which must not be rebuilt — and by
     the loop, which must not see a stale one */
  const box0 = useRef(H);
  box0.current = H;
  const room = useRef<Room>({ l: -W / 2, r: W / 2, top: H, floor: 0 });
  const raf = useRef(0);
  const running = useRef(false);
  const calm = useRef(0);
  const lastHit = useRef(0);
  const grip = useRef<{
    id: number;
    /* where on the card it was taken hold of, in the card's
       own frame */
    lx: number;
    ly: number;
    ox: number;
    oy: number;
    tx: number;
    ty: number;
    /* the pointer's velocity in world px/s, smoothed */
    vx: number;
    vy: number;
    t: number;
    live: boolean;
  } | null>(null);

  const draw = useCallback(() => {
    setPoses(
      W0.current.bodies
        .filter((b) => b.id < FLOOR)
        .map((b) => ({ id: b.id, x: b.x, y: b.y, a: b.a })),
    );
  }, []);

  /* ── the room ─────────────────────────────────────────────
     Screen to the block's own pixels: the stage's edges, taken
     relative to the block's box and divided by the scale the
     wall drew it at. y is measured UP from the box's bottom. */
  const measure = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const k = el.getBoundingClientRect().width / el.offsetWidth || 1;
    const me = el.getBoundingClientRect();
    const stage = el.closest(".bench-card-stage, .dtl-stage");
    const s = stage ? stage.getBoundingClientRect() : me;
    const inset = stage ? INSET : 0;
    /* never smaller than the block's own box. While the overlay
       opens, the stage starts at the size of the wall's card
       and grows round a block already drawn big — for those
       frames the "room" is narrower and lower than the tower
       standing in it, and a ceiling built there came down
       through the top card and shoved it off sideways. */
    room.current = {
      l: Math.min(-W / 2, (s.left - me.left) / k - W / 2 + inset),
      r: Math.max(W / 2, (s.right - me.left) / k - W / 2 - inset),
      top: Math.max(box0.current, (me.bottom - s.top) / k - inset),
      floor: Math.min(0, (me.bottom - s.bottom) / k),
    };
  }, []);

  /* ── the floor, the walls and the ceiling ─────────────────
     Moved in place, never replaced. The solver remembers each
     contact between one step and the next, keyed by the two
     bodies in it, and that memory is what lets a stack stand
     still; a floor rebuilt as a new object on every resize
     threw it away and the tower crept. Returns whether
     anything actually moved, so a resize that changed nothing
     does not wake a tower at rest. */
  const walls = useCallback(() => {
    const { l, r, top, floor } = room.current;
    const wide = r - l + 400;
    const tall = top - floor + 400;
    const mid = (l + r) / 2;
    const T = W0.current;
    const want: [number, number, number, number, number][] = [
      [FLOOR, mid, floor - 100, wide / 2, 100],
      [LEFT, l - 100, floor + tall / 2 - 200, 100, tall / 2],
      [RIGHT, r + 100, floor + tall / 2 - 200, 100, tall / 2],
      [ROOF, mid, top + 100, wide / 2, 100],
    ];
    let moved = false;
    for (const [id, x, y, hw, hh] of want) {
      const b = T.bodies.find((c) => c.id === id);
      if (!b) {
        T.bodies.push(box(id, x, y, hw, hh, fr, 0));
        moved = true;
      } else if (Math.abs(b.x - x) + Math.abs(b.y - y) + Math.abs(b.hw - hw) + Math.abs(b.hh - hh) > 0.5) {
        Object.assign(b, { x, y, hw, hh, friction: fr });
        moved = true;
      }
    }
    if (!moved) return false;
    /* a card left outside a room that just shrank is put back
       inside it, or the wall would appear through it */
    for (const b of T.bodies) {
      if (b.id >= FLOOR) continue;
      b.x = clamp(b.x, l + HW, r - HW);
      b.y = clamp(b.y, floor + HH, top - HH);
    }
    return true;
  }, [fr]);

  const run = useCallback(() => {
    if (running.current) return;
    running.current = true;
    calm.current = 0;
    let prev = 0;
    let acc = 0;

    const hit = (v: number) => {
      const now = performance.now();
      if (v > 700 && now - lastHit.current > 180) {
        lastHit.current = now;
      }
    };

    const tick = (t: number) => {
      /* the LIVE world, every frame. A knob that rebuilds the
         tower swaps the world out from under a running loop, and
         a loop holding the old one simulated a tower nobody
         could see while the new one hung in the air */
      const T = W0.current;
      acc += prev ? Math.min((t - prev) / 1000, MAXSTEPS * DT) : DT;
      prev = t;
      const g = grip.current;
      /* a pointer that has stopped sends no events at all, so its
         last speed would otherwise be kept forever and carry the
         card on past a hand that is standing still */
      if (g && t - g.t > 34) {
        g.vx *= 0.4;
        g.vy *= 0.4;
      }
      let steps = 0;
      while (acc >= DT && steps < MAXSTEPS) {
        if (g && g.live) {
          const b = T.bodies.find((c) => c.id === g.id);
          if (b) {
            /* the hand steers the card toward where the pointer
               holds it — with a capped pull, and never further
               into anything it is already pressed against. See
               steer() in rigid.ts for the tower it used to
               explode. */
            const c = Math.cos(b.a), s = Math.sin(b.a);
            const px = g.tx - (c * g.lx - s * g.ly);
            const py = g.ty - (s * g.lx + c * g.ly);
            /* and the pointer's own speed, so the card moves WITH
               the hand instead of chasing where it last was */
            steer(T, b, px, py, DT, { tvx: g.vx, tvy: g.vy });
          }
        }
        step(T, DT, hit);
        acc -= DT;
        steps++;
      }

      let moving = !!(g && g.live);
      for (const b of T.bodies) {
        if (b.id >= FLOOR) continue;
        /* a last net under the solver: a card that ever goes
           non-finite is put back in the room rather than being
           lost for good — invisible and impossible to pick up */
        if (!Number.isFinite(b.x + b.y + b.a + b.vx + b.vy + b.w)) {
          const { l, r, top } = room.current;
          Object.assign(b, { x: clamp(0, l + HW, r - HW), y: top - HH, a: 0, vx: 0, vy: 0, w: 0 });
          for (const [k, arb] of T.arbiters) if (arb.a === b || arb.b === b) T.arbiters.delete(k);
        }
        if (Math.hypot(b.vx, b.vy) > REST_V || Math.abs(b.w) > REST_W) moving = true;
      }
      calm.current = moving ? 0 : calm.current + steps;
      draw();

      if (calm.current < REST_N) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      for (const b of T.bodies) {
        b.vx = 0;
        b.vy = 0;
        b.w = 0;
      }
      running.current = false;
      raf.current = 0;
    };
    raf.current = requestAnimationFrame(tick);
  }, [draw]);

  /* reduced motion: the same world, settled at once and drawn
     where it ends up, with nothing seen in between */
  const settle = useCallback(() => {
    const T = W0.current;
    for (let i = 0; i < 2400; i++) step(T, DT);
    for (const b of T.bodies) {
      b.vx = 0;
      b.vy = 0;
      b.w = 0;
    }
    draw();
  }, [draw]);

  const go = useCallback(() => (still ? settle() : run()), [still, settle, run]);

  /* ── build, and rebuild when a knob moves ─────────────────
     Count and Slip change what the tower IS, so they stand a
     fresh one up. Gravity and Bounce are properties of the
     world and are simply handed to it. */
  useLayoutEffect(() => {
    cancelAnimationFrame(raf.current);
    running.current = false;
    measure();
    const T = world(grav(gravity), RESTITUTION);
    T.bodies = tower(n, sl, fr);
    W0.current = T;
    walls();
    setGoing(null);
    setHand(null);
    grip.current = null;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, sl]);

  useEffect(() => {
    W0.current.gravity = grav(gravity);
  }, [gravity]);

  /* the stage changes size with the window and while the
     overlay opens round it; the room follows */
  useEffect(() => {
    const el = wrap.current;
    const stage = el?.closest(".bench-card-stage, .dtl-stage");
    if (!el) return;
    const ro = new ResizeObserver(() => {
      measure();
      if (walls()) go();
    });
    ro.observe(el);
    if (stage) ro.observe(stage);
    return () => ro.disconnect();
  }, [measure, walls, go]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      running.current = false;
    },
    [],
  );

  /* ── the list fills itself back up ────────────────────────
     A block that can be emptied and not filled works once, and
     the wall plays every card's demo unattended. The new tower
     arrives from above and lands. */
  useEffect(() => {
    if (poses.length > 0 || going || hand !== null) return;
    const wait = window.setTimeout(() => {
      measure();
      const T = W0.current;
      const lift = Math.max(0, Math.min(140, room.current.top - room.current.floor - n * CH - 4));
      T.bodies = [...tower(n, sl, fr, room.current.floor + lift), ...T.bodies.filter((b) => b.id >= FLOOR)];
      T.arbiters.clear();
      draw();
      go();
    }, 700);
    return () => clearTimeout(wait);
  }, [poses, going, hand, n, sl, fr, measure, draw, go]);

  /* everything resting above the one that left gets a shove as
     it goes — a brick does not leave a stack politely */
  const scrape = (gone: Body) => {
    for (const c of W0.current.bodies) {
      if (c.id >= FLOOR || c.id === gone.id || c.y <= gone.y) continue;
      const far = Math.max(1, (c.y - gone.y) / CH);
      c.vx += (Math.random() * 2 - 1) * (0.3 + sl) * SCRAPE / far;
    }
  };

  const strike = (id: number) => {
    if (going || hand !== null) return;
    const T = W0.current;
    const b = T.bodies.find((c) => c.id === id);
    if (!b) return;
    setGoing({ id: b.id, x: b.x, y: b.y, a: b.a });
    scrape(b);
    remove(T, id);
    draw();
    go();
    window.setTimeout(() => setGoing((cur) => (cur?.id === id ? null : cur)), still ? 0 : 320);
  };

  /* ── the hand ─────────────────────────────────────────────
     Screen to world: the pointer's offset inside the block's
     box, divided by the drawn scale, y turned upright. */
  const local = (x: number, y: number) => {
    const el = wrap.current!;
    const r = el.getBoundingClientRect();
    const k = r.width / el.offsetWidth || 1;
    return { x: (x - r.left) / k - W / 2, y: (r.bottom - y) / k, k };
  };

  /* ── WHICH card a press is for is asked of the WORLD ───────
     It was the card's own element that listened, and a card
     lying on its side is a 46px sliver — 37 on the wall — so a
     press that looked like it was on it could land a hair off
     and pick up nothing. The press is heard by the whole stage
     now and the solver's own boxes answer it, each grown by a
     few screen pixels of reach, nearest edge wins and the one
     drawn on top breaks a tie. */
  const REACH = 12;
  const pick = (px: number, py: number, k: number) => {
    let best: Body | null = null;
    let near = REACH / k;
    for (const b of W0.current.bodies) {
      if (b.id >= FLOOR) continue;
      const dx = px - b.x, dy = py - b.y;
      const c = Math.cos(-b.a), s = Math.sin(-b.a);
      const ox = Math.max(0, Math.abs(c * dx - s * dy) - HW);
      const oy = Math.max(0, Math.abs(s * dx + c * dy) - HH);
      const d = Math.hypot(ox, oy);
      if (d < near || (d === near && best && b.id > best.id)) {
        near = d;
        best = b;
      }
    }
    return best;
  };

  /* the latest of everything the listeners need, so the ones
     attached once to the stage never read a stale render */
  const live = useRef({ going, hand });
  live.current = { going, hand };

  const take = (e: PointerEvent) => {
    if (e.button !== 0 || live.current.going || live.current.hand !== null || grip.current) return;
    /* a checkbox is a checkbox, and the stage's own buttons
       are not the tower's to take */
    if ((e.target as HTMLElement).closest("button")) return;
    if (!wrap.current) return;
    measure();
    const p = local(e.clientX, e.clientY);
    const b = pick(p.x, p.y, p.k);
    if (!b) return;
    const dx = p.x - b.x, dy = p.y - b.y;
    const c = Math.cos(-b.a), s = Math.sin(-b.a);
    grip.current = {
      id: b.id,
      lx: c * dx - s * dy,
      ly: s * dx + c * dy,
      ox: e.clientX,
      oy: e.clientY,
      tx: p.x,
      ty: p.y,
      vx: 0,
      vy: 0,
      t: e.timeStamp,
      live: false,
    };
    /* the window hears the rest of the gesture, so it cannot be
       lost to a capture that failed or a pointer that left the
       card, the stage or the page */
    bound.current = { move, drop };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
  };

  const move = (e: PointerEvent) => {
    const g = grip.current;
    if (!g) return;
    const p = local(e.clientX, e.clientY);
    const { l, r, top, floor } = room.current;
    const nx = clamp(p.x, l, r), ny = clamp(p.y, floor, top);
    const dt = Math.max(4, e.timeStamp - g.t) / 1000;
    /* smoothed, because pointer events arrive unevenly and one
       late event would read as a sudden stop */
    g.vx = g.vx * 0.5 + ((nx - g.tx) / dt) * 0.5;
    g.vy = g.vy * 0.5 + ((ny - g.ty) / dt) * 0.5;
    g.t = e.timeStamp;
    g.tx = nx;
    g.ty = ny;
    if (!g.live) {
      if (Math.hypot(e.clientX - g.ox, e.clientY - g.oy) < GRAB) return;
      g.live = true;
      setHand(g.id);
      const b = W0.current.bodies.find((c) => c.id === g.id);
      if (b) {
        /* ── in the hand it is HEAVY, not immovable ─────────
           It was weightless-and-unstoppable, and a hand that
           cannot be stopped ploughs: carried through the foot
           of the tower it scooped the whole stack up and threw
           it. Four cards' weight, with its speed set toward the
           pointer every step, still clears a path — but the
           cards it meets are shoved rather than launched, and
           the floor and walls stop it like anything else. */
        const m = massOf(HW, HH);
        b.invM = m.invM * 0.25;
        b.invI = m.invI * 0.25;
        /* ── it slides on walls, it grips cards ─────────────
           The world knows which body is in the hand, and uses
           that to make it frictionless against the floor and
           walls (so a card on its end does not jam on the wall
           it is lifted along) while cards stacked on it grip
           hard and come with it. See CARRY in rigid.ts. */
        W0.current.held = g.id;
        /* ── the SHORT way back to level ────────────────────
           A card that tumbled can be carrying an angle of
           several whole turns, and levelling that out spun it
           through every one of them — straight through the
           pile, looking like the card would not come away.
           Wrapped to within half a turn, a card on its side
           turns a quarter and one upside down turns a half.
           The grip point is re-read in the wrapped frame so
           the card does not jump under the finger. */
        const wrapped = b.a - Math.round(b.a / (2 * Math.PI)) * 2 * Math.PI;
        b.a = wrapped;
        scrape(b);
      }
      run();
    }
  };

  /* the pair actually attached, so taking them off never
     misses because a render made new functions in between */
  const bound = useRef<{ move: (e: PointerEvent) => void; drop: () => void } | null>(null);

  const drop = () => {
    const on = bound.current;
    bound.current = null;
    if (on) {
      window.removeEventListener("pointermove", on.move);
      window.removeEventListener("pointerup", on.drop);
      window.removeEventListener("pointercancel", on.drop);
    }
    const g = grip.current;
    grip.current = null;
    if (!g || !g.live) return;
    setHand(null);
    W0.current.held = null;
    const b = W0.current.bodies.find((c) => c.id === g.id);
    if (b) {
      /* its weight comes back and it keeps the speed the hand
         gave it — which is what makes a flick a throw */
      Object.assign(b, massOf(HW, HH));
      release(b);
      b.vx = clamp(b.vx, -VMAX, VMAX);
      b.vy = clamp(b.vy, -VMAX, VMAX);
    }
    go();
  };

  const hands = useRef({ take, drop });
  hands.current = { take, drop };
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const host = (el.closest(".bench-card-stage, .dtl-stage") as HTMLElement | null) ?? el;
    const down = (e: PointerEvent) => hands.current.take(e);
    host.addEventListener("pointerdown", down);
    return () => {
      host.removeEventListener("pointerdown", down);
      hands.current.drop();
    };
  }, []);

  const row = (p: Pose, out: boolean) => (
    <li
      key={p.id}
      className="twr-row"
      data-out={out || undefined}
      data-hand={hand === p.id || undefined}
      style={{
        width: CW,
        height: CH,
        marginLeft: -HW,
        /* centre-based and upright: the solver's y is up and
           its angle counter-clockwise, the page's are neither */
        transform: `translate(${p.x.toFixed(2)}px, ${(-(p.y - HH)).toFixed(2)}px) rotate(${(-p.a).toFixed(4)}rad)`,
      }}
    >
      <div className="twr-card">
        <button
          type="button"
          className="twr-check"
          aria-label={`Done: ${TODOS[p.id]}`}
          onClick={() => strike(p.id)}
        >
          <Check size={12} strokeWidth={3.4} />
        </button>
        <span className="twr-text">{TODOS[p.id]}</span>
      </div>
    </li>
  );

  return (
    <div className="twr" ref={wrap} style={{ width: W, height: H }}>
      <ul className="twr-pile">
        {/* by id, always, so React never reorders a node and a
            card in your hand keeps its identity through every
            collapse around it */}
        {[...poses].sort((a, b) => a.id - b.id).map((p) => row(p, false))}
        {going ? row(going, true) : null}
      </ul>
    </div>
  );
}

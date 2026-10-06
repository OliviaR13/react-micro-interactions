import { type ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Check, X } from "lucide-react";

/* ══ Asset swap ═══════════════════════════════════════════
   Two rounded slabs, one over the other, each holding a coin and
   an amount, and an arrow on the seam saying which way the swap
   goes. Press the arrow and it turns to point the other way.
   The slabs and the coins in them stay exactly where they are:
   only the direction changes, and the labels with it — whichever
   slab the arrow leaves is "You pay", the one it points at is
   "You receive".

   ── THE ARROW KEEPS TURNING ONE WAY ──────────────────────
   Half a turn every press, counted up rather than flipped
   between 0 and 180, so the second press carries on round
   instead of unwinding back the way it came.

   ── THE SLAB IS THE PICKER ───────────────────────────────
   Press a coin and the slab it sits in grows — the same element,
   its height animated — until it covers the whole block: the top
   slab down over the bottom one, the bottom slab up over the top.
   Its own face fades out and the list of coins loads inside it;
   pick one and it shrinks back to a slab. Nothing is laid over
   it and nothing replaces it. Picking
   the coin already on the other slab swaps the two, which is
   what every exchange does rather than allowing a coin for
   itself. */

const W = 320;
const CARD = 116;
const GAP = 3;
const PITCH = CARD + GAP;
const H = CARD * 2 + GAP;

/* THE NUMBERS COME FROM THE COINS. The paying slab holds a round
   amount of whatever it is — a lot that is ordinary for that coin,
   0.05 BTC, 1.5 ETH, 100 HYPE — and the receiving slab is what that
   buys at the two prices, less a 0.3% fee. Change either coin, or
   reverse the arrow, and both sides are worked out again. */
const FEE = 0.003;

/* price in dollars, dp the decimals shown, lot the round amount it pays */
type Coin = { sym: string; name: string; price: number; dp: number; lot: number; logo: ReactNode };

/* Every mark is one flat shape on a 32 grid. BTC, ZEC and QNT wear
   their own colours (BTC's ₿ and QNT's mark are the CC0 set's
   paths); ETH and HYPE are drawn here in a deep shade of their
   colour with the mark in a pale tint of it. In order of market
   cap, largest first. */
const COINS: Coin[] = [
  {
    sym: "BTC", name: "Bitcoin", price: 97700, dp: 5, lot: 0.05,
    /* Bitcoin's own orange and white, and its own ₿ (the CC0 set's
       path) — turned upright, since the official mark leans 14° */
    logo: (
      <>
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <path
          fill="#FFF"
          transform="rotate(-14 16 16)"
          d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"
        />
      </>
    ),
  },
  {
    sym: "ETH", name: "Ethereum", price: 3368.64, dp: 4, lot: 1.5,
    logo: (
      <>
        <circle cx="16" cy="16" r="16" fill="#1B1F4D" />
        <g fill="#B8C2FF">
          <path d="M16 6 10 16.2l6 3.6 6-3.6z" />
          <path d="M16 21.4l-6-3.6 6 8.2 6-8.2z" />
        </g>
      </>
    ),
  },
  {
    sym: "HYPE", name: "Hyperliquid", price: 38.2, dp: 3, lot: 100,
    logo: (
      <>
        <circle cx="16" cy="16" r="16" fill="#072723" />
        <path
          fill="#97FCE4"
          d="M7.5 16c0-4.4 2.6-6 5-6 1.9 0 2.6 1.7 3.5 1.7s1.6-1.7 3.5-1.7c2.4 0 5 1.6 5 6s-2.6 6-5 6c-1.9 0-2.6-1.7-3.5-1.7s-1.6 1.7-3.5 1.7c-2.4 0-5-1.6-5-6z"
        />
      </>
    ),
  },
  {
    sym: "ZEC", name: "Zcash", price: 52.4, dp: 3, lot: 40,
    /* Zcash's own colours: its gold, with the mark in black */
    logo: (
      <>
        <circle cx="16" cy="16" r="16" fill="#F4B728" />
        <g fill="#1A1A1A">
          <path d="M11 10h10v2.5l-6.4 7h6.4V22H11v-2.5l6.4-7H11z" />
          <rect x="15" y="7" width="2" height="3.5" rx="1" />
          <rect x="15" y="21.5" width="2" height="3.5" rx="1" />
        </g>
      </>
    ),
  },
  {
    sym: "QNT", name: "Quant", price: 104.5, dp: 3, lot: 20,
    /* Quant's own mark and colours, white on black, from the CC0 set */
    logo: (
      <>
        <circle cx="16" cy="16" r="16" fill="#000" />
        <g fill="#FFF">
          <path d="M10.556 6.744l5.226 6.251 3.506-2.106S15.054 5.113 13.93 5.52a186.291 186.291 0 01-3.374 1.223zm8.864 4.145s.795-1.427 1.192-3.33c0 0 3.969 1.63 2.447 5.708l-3.638-2.378z" />
          <path d="M23.06 13.267l.33 4.28 1.522-.203s.397-.136.33-.883c-.066-.816-.198-2.515-.198-2.515s.066-.407-.86-.543c-1.125-.204-1.125-.136-1.125-.136zm.33 4.281l-3.043 2.514 1.39 2.786s.33 1.087 1.323-.136c.926-1.223 1.323-1.427 1.256-2.174-.066-.748-.264-2.515-.926-2.99zm-3.11 2.514l-4.167-1.903-3.639 7.543s-.264.543.662.611c.926.136 2.448.476 3.242-.34.794-.747 3.903-5.911 3.903-5.911zm-4.167-1.971l-.397-5.028-8.997.612s-.53.068-.463 1.087c.066 1.359.198 2.854.198 2.854s-.066.611 1.125.68c1.19.067 8.402.067 8.534-.205z" />
        </g>
      </>
    ),
  },
];
/* ── or money: the same picker over currencies ─────────────
   A currency has no logo; what an exchange shows is its country's
   flag in a circle, and these are those — the circle-flags set
   (MIT, HatScripts). Each is drawn as an image rather than inlined,
   because every one of them masks itself with an id of "a", and six
   of those in one page would all resolve to the first. In order of
   how much each is traded, USD first. */
const FLAG: Record<string, string> = {
  USD: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PG1hc2sgaWQ9ImEiPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjU2IiBmaWxsPSIjZmZmIi8+PC9tYXNrPjxnIG1hc2s9InVybCgjYSkiPjxwYXRoIGZpbGw9IiNlZWUiIGQ9Ik0yNTYgMGgyNTZ2NjRsLTMyIDMyIDMyIDMydjY0bC0zMiAzMiAzMiAzMnY2NGwtMzIgMzIgMzIgMzJ2NjRsLTI1NiAzMkwwIDQ0OHYtNjRsMzItMzItMzItMzJ2LTY0eiIvPjxwYXRoIGZpbGw9IiNkODAwMjciIGQ9Ik0yMjQgNjRoMjg4djY0SDIyNFptMCAxMjhoMjg4djY0SDI1NlpNMCAzMjBoNTEydjY0SDBabTAgMTI4aDUxMnY2NEgwWiIvPjxwYXRoIGZpbGw9IiMwMDUyYjQiIGQ9Ik0wIDBoMjU2djI1NkgwWiIvPjxwYXRoIGZpbGw9IiNlZWUiIGQ9Im0xODcgMjQzIDU3LTQxaC03MGw1NyA0MS0yMi02N3ptLTgxIDAgNTctNDFIOTNsNTcgNDEtMjItNjd6bS04MSAwIDU3LTQxSDEybDU3IDQxLTIyLTY3em0xNjItODEgNTctNDFoLTcwbDU3IDQxLTIyLTY3em0tODEgMCA1Ny00MUg5M2w1NyA0MS0yMi02N3ptLTgxIDAgNTctNDFIMTJsNTcgNDEtMjItNjdabTE2Mi04MiA1Ny00MWgtNzBsNTcgNDEtMjItNjdabS04MSAwIDU3LTQxSDkzbDU3IDQxLTIyLTY3em0tODEgMCA1Ny00MUgxMmw1NyA0MS0yMi02N1oiLz48L2c+PC9zdmc+",
  EUR: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PG1hc2sgaWQ9ImEiPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjU2IiBmaWxsPSIjZmZmIi8+PC9tYXNrPjxnIG1hc2s9InVybCgjYSkiPjxwYXRoIGZpbGw9IiMwMDUyYjQiIGQ9Ik0wIDBoNTEydjUxMkgweiIvPjxwYXRoIGZpbGw9IiNmZmRhNDQiIGQ9Im0yNTYgMTAwLjIgOC4zIDI1LjVIMjkxbC0yMS43IDE1LjcgOC4zIDI1LjYtMjEuNy0xNS44LTIxLjcgMTUuOCA4LjMtMjUuNi0yMS43LTE1LjdoMjYuOHptLTExMC4yIDQ1LjYgMjQgMTIuMiAxOC45LTE5LTQuMiAyNi41IDIzLjkgMTIuMi0yNi41IDQuMi00LjIgMjYuNS0xMi4yLTI0LTI2LjUgNC4zIDE5LTE5ek0xMDAuMiAyNTZsMjUuNS04LjNWMjIxbDE1LjcgMjEuNyAyNS42LTguMy0xNS44IDIxLjcgMTUuOCAyMS43LTI1LjYtOC4zLTE1LjcgMjEuN3YtMjYuOHptNDUuNiAxMTAuMiAxMi4yLTI0LTE5LTE4LjkgMjYuNSA0LjIgMTIuMi0yMy45IDQuMiAyNi41IDI2LjUgNC4yLTI0IDEyLjIgNC4zIDI2LjUtMTktMTl6TTI1NiA0MTEuOGwtOC4zLTI1LjVIMjIxbDIxLjctMTUuNy04LjMtMjUuNiAyMS43IDE1LjggMjEuNy0xNS44LTguMyAyNS42IDIxLjcgMTUuN2gtMjYuOHptMTEwLjItNDUuNi0yNC0xMi4yLTE4LjkgMTkgNC4yLTI2LjUtMjMuOS0xMi4yIDI2LjUtNC4yIDQuMi0yNi41IDEyLjIgMjQgMjYuNS00LjMtMTkgMTl6TTQxMS44IDI1NmwtMjUuNSA4LjNWMjkxbC0xNS43LTIxLjctMjUuNiA4LjMgMTUuOC0yMS43LTE1LjgtMjEuNyAyNS42IDguMyAxNS43LTIxLjd2MjYuOHptLTQ1LjYtMTEwLjItMTIuMiAyNCAxOSAxOC45LTI2LjUtNC4yLTEyLjIgMjMuOS00LjItMjYuNS0yNi41LTQuMiAyNC0xMi4yLTQuMy0yNi41IDE5IDE5eiIvPjwvZz48L3N2Zz4=",
  JPY: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PG1hc2sgaWQ9ImEiPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjU2IiBmaWxsPSIjZmZmIi8+PC9tYXNrPjxnIG1hc2s9InVybCgjYSkiPjxwYXRoIGZpbGw9IiNlZWUiIGQ9Ik0wIDBoNTEydjUxMkgweiIvPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMTExLjMiIGZpbGw9IiNkODAwMjciLz48L2c+PC9zdmc+",
  GBP: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PG1hc2sgaWQ9ImEiPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjU2IiBmaWxsPSIjZmZmIi8+PC9tYXNrPjxnIG1hc2s9InVybCgjYSkiPjxwYXRoIGZpbGw9IiNlZWUiIGQ9Im0wIDAgOCAyMi04IDIzdjIzbDMyIDU0LTMyIDU0djMybDMyIDQ4LTMyIDQ4djMybDMyIDU0LTMyIDU0djY4bDIyLTggMjMgOGgyM2w1NC0zMiA1NCAzMmgzMmw0OC0zMiA0OCAzMmgzMmw1NC0zMiA1NCAzMmg2OGwtOC0yMiA4LTIzdi0yM2wtMzItNTQgMzItNTR2LTMybC0zMi00OCAzMi00OHYtMzJsLTMyLTU0IDMyLTU0VjBsLTIyIDgtMjMtOGgtMjNsLTU0IDMyLTU0LTMyaC0zMmwtNDggMzItNDgtMzJoLTMybC01NCAzMkw2OCAwSDB6Ii8+PHBhdGggZmlsbD0iIzAwNTJiNCIgZD0iTTMzNiAwdjEwOEw0NDQgMFptMTc2IDY4TDQwNCAxNzZoMTA4ek0wIDE3NmgxMDhMMCA2OFpNNjggMGwxMDggMTA4VjBabTEwOCA1MTJWNDA0TDY4IDUxMlpNMCA0NDRsMTA4LTEwOEgwWm01MTItMTA4SDQwNGwxMDggMTA4Wm0tNjggMTc2TDMzNiA0MDR2MTA4eiIvPjxwYXRoIGZpbGw9IiNkODAwMjciIGQ9Ik0wIDB2NDVsMTMxIDEzMWg0NUwwIDB6bTIwOCAwdjIwOEgwdjk2aDIwOHYyMDhoOTZWMzA0aDIwOHYtOTZIMzA0VjBoLTk2em0yNTkgMEwzMzYgMTMxdjQ1TDUxMiAwaC00NXpNMTc2IDMzNiAwIDUxMmg0NWwxMzEtMTMxdi00NXptMTYwIDAgMTc2IDE3NnYtNDVMMzgxIDMzNmgtNDV6Ii8+PC9nPjwvc3ZnPg==",
  CAD: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+PG1hc2sgaWQ9ImEiPjxjaXJjbGUgY3g9IjI1NiIgY3k9IjI1NiIgcj0iMjU2IiBmaWxsPSIjZmZmIi8+PC9tYXNrPjxnIG1hc2s9InVybCgjYSkiPjxwYXRoIGZpbGw9IiNkODAwMjciIGQ9Ik0wIDB2NTEyaDE0NGwxMTItNjQgMTEyIDY0aDE0NFYwSDM2OEwyNTYgNjQgMTQ0IDBaIi8+PHBhdGggZmlsbD0iI2VlZSIgZD0iTTE0NCAwaDIyNHY1MTJIMTQ0WiIvPjxwYXRoIGZpbGw9IiNkODAwMjciIGQ9Im0zMDEgMjg5IDQ0LTIyLTIyLTExdi0yMmwtNDUgMjIgMjMtNDRoLTIzbC0yMi0zNC0yMiAzM2gtMjNsMjMgNDUtNDUtMjJ2MjJsLTIyIDExIDQ1IDIyLTEyIDIzaDQ1djMzaDIydi0zM2g0NXoiLz48L2c+PC9zdmc+",
};
const flag = (sym: string) => <image href={FLAG[sym]} width="32" height="32" />;
const MONEY: Coin[] = [
  { sym: "USD", name: "US Dollar", price: 1, dp: 2, lot: 1000, logo: flag("USD") },
  { sym: "EUR", name: "Euro", price: 1.08, dp: 2, lot: 1000, logo: flag("EUR") },
  { sym: "JPY", name: "Japanese Yen", price: 0.0067, dp: 0, lot: 150000, logo: flag("JPY") },
  { sym: "GBP", name: "British Pound", price: 1.27, dp: 2, lot: 1000, logo: flag("GBP") },
  { sym: "CAD", name: "Canadian Dollar", price: 0.73, dp: 2, lot: 1000, logo: flag("CAD") },
];

/* each set, and the pair it opens on */
export const SETS: Record<string, { list: Coin[]; start: [string, string] }> = {
  Crypto: { list: COINS, start: ["BTC", "HYPE"] },
  Currency: { list: MONEY, start: ["USD", "EUR"] },
};
const BY = Object.fromEntries([...COINS, ...MONEY].map((c) => [c.sym, c])) as Record<string, Coin>;

/* money always shows its cents; a coin only the decimals it needs */
const units = (n: number, c: Coin) =>
  n.toLocaleString("en-US", { minimumFractionDigits: MONEY.includes(c) ? c.dp : 0, maximumFractionDigits: c.dp });
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function Logo({ coin, size }: { coin: Coin; size: number }) {
  return (
    <svg className="swp-logo" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {coin.logo}
    </svg>
  );
}

export function Swap({
  /* what is being swapped: crypto or currencies */
  assets = "Crypto",
  /* how much the arrow overshoots as it turns, 0..100 */
  bounce = 30,
  /* the slabs' corner, px */
  corner = 28,
}: {
  assets?: string;
  bounce?: number;
  corner?: number;
} = {}) {
  /* the coin in each slab, top then bottom */
  const set = SETS[assets] ?? SETS.Crypto;
  const [coins, setCoins] = useState<[string, string]>(set.start);
  /* a new set is a new start: its own pair, the picker shut */
  useEffect(() => {
    setCoins(set.start);
    setPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);
  /* how many presses so far: even, the arrow points down */
  const [turns, setTurns] = useState(0);
  /* which slab is open as the picker */
  const [pick, setPick] = useState<number | null>(null);
  /* which slab is drawn over everything: the open one, and it stays
     on top until it has finished shrinking back, or it would slip
     under its neighbour halfway home */
  const [lifted, setLifted] = useState<number | null>(null);
  const up = turns % 2 === 1;
  const spring = { type: "spring" as const, duration: 0.6, bounce: (Math.min(100, Math.max(0, bounce)) / 100) * 0.5 };
  /* the slab's growth: firm, with only a breath of overshoot */
  const grow = { type: "spring" as const, duration: 0.5, bounce: 0.12 };
  /* the button's corner follows the slabs', capped at a circle */
  const r = Math.min(corner, 20);
  const payer = up ? 1 : 0;
  /* what each slab reads: the payer its coin's lot, the other what
     that lot buys after the fee, each with its own dollar value */
  const paid = BY[coins[payer]];
  const value = paid.lot * paid.price;
  const shown = (i: number) => {
    const c = BY[coins[i]];
    const v = i === payer ? value : value * (1 - FEE);
    return { amount: units(i === payer ? c.lot : v / c.price, c), fiat: usd(v) };
  };

  const open = (slot: number) => {
    setPick(slot);
    setLifted(slot);
  };

  const choose = (sym: string) => {
    if (pick === null) return;
    const slot = pick, other = 1 - pick;
    setCoins((c) => {
      const next: [string, string] = [c[0], c[1]];
      /* the coin already on the other slab trades places with this one */
      if (c[other] === sym) next[other] = c[slot];
      next[slot] = sym;
      return next;
    });
    setPick(null);
  };

  /* Escape shuts the picker */
  useEffect(() => {
    if (pick === null) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPick(null); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pick]);

  return (
    <div className="swp" style={{ width: W, height: H, ["--swp-r" as string]: `${corner}px` }}>
      {coins.map((sym, i) => {
        const coin = BY[sym];
        const on = pick === i;
        /* the OTHER slab, while this one's neighbour is open */
        const squeezed = pick !== null && !on;
        /* the slab's role, which the picker keeps as its heading — it
           is the same slab, still saying what it is for */
        const role = i === payer ? "You pay" : "You receive";
        return (
          <motion.div
            key={i}
            className="swp-card"
            data-lifted={lifted === i || undefined}
            initial={false}
            /* THE SLAB IS THE PICKER: the same element, its height
               grown to the whole block — down from the top slab, up
               from the bottom one */
            animate={{
              top: on ? 0 : i * PITCH,
              height: on ? H : CARD,
              /* the neighbour is SQUEEZED: pressed toward its far edge
                 by the slab growing into it. Flattened on the same
                 curve that grows the open slab, so its near edge stays
                 just ahead of the growing one instead of being run
                 over — it visibly gives, then fades out before it is
                 flat */
              scaleY: squeezed ? 0.02 : 1,
              opacity: squeezed ? 0 : 1,
            }}
            style={{ transformOrigin: i === 0 ? "50% 0%" : "50% 100%" }}
            transition={{
              default: grow,
              /* no overshoot here: past flat a scale turns inside out */
              scaleY: { type: "spring", duration: 0.5, bounce: 0 },
              opacity: squeezed ? { delay: 0.1, duration: 0.14 } : { delay: 0.06, duration: 0.2 },
            }}
            /* lowered only when a SHRINK lands: the open finishing can
               report in after a close has already started */
            onAnimationComplete={(d) => {
              if ((d as { height?: number }).height === CARD && pick === null) setLifted((l) => (l === i ? null : l));
            }}
            role={on ? "dialog" : undefined}
            aria-label={on ? `${role}: choose a coin` : undefined}
          >
            {/* what the slab shows: pinned to the edge the slab grows
                away from, so it never moves; it fades as the list
                arrives and comes back as the slab shuts */}
            <motion.div
              className="swp-face"
              style={i === 0 ? { top: 0 } : { bottom: 0 }}
              initial={false}
              animate={{ opacity: on ? 0 : 1 }}
              transition={on ? { duration: 0.12 } : { delay: 0.14, duration: 0.2 }}
              aria-hidden={on || undefined}
            >
              <span className="swp-label">{role}</span>
              <span className="swp-amount">{shown(i).amount}</span>
              <span className="swp-fiat">{shown(i).fiat}</span>
              <button
                type="button"
                className="swp-coin"
                onClick={() => open(i)}
                tabIndex={pick === null ? 0 : -1}
                aria-label={`${coin.name}. Choose another coin`}
              >
                <Logo coin={coin} size={22} />
                {coin.sym}
              </button>
            </motion.div>
            {/* the list loads inside once the slab is mostly open,
                and goes before it starts to shut */}
            <AnimatePresence>
              {on && (
                <motion.div
                  className="swp-pick-in"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.22 } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  <div className="swp-pick-head">
                    <span>{role}</span>
                    <button type="button" className="swp-pick-x" onClick={() => setPick(null)} aria-label="Close">
                      <X size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                  {set.list.map((c) => (
                    <button key={c.sym} type="button" className="swp-pick-row" onClick={() => choose(c.sym)}>
                      <Logo coin={c} size={24} />
                      <span className="swp-pick-sym">{c.sym}</span>
                      <span className="swp-pick-name">{c.name}</span>
                      {coins[i] === c.sym && <Check className="swp-pick-on" size={16} strokeWidth={2.4} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      <motion.button
        type="button"
        className="swp-flip"
        style={{ borderRadius: r }}
        initial={false}
        /* the arrow leaves as soon as a slab starts to open, and only
           comes back once that slab is home — lifted clears when
           the shrink lands, not when the close is asked for */
        animate={{ rotate: turns * 180, scale: lifted === null ? 1 : 0.5, opacity: lifted === null ? 1 : 0 }}
        transition={{
          default: spring,
          scale: lifted === null ? { type: "spring", duration: 0.4, bounce: 0.35 } : { duration: 0.12 },
          opacity: { duration: lifted === null ? 0.18 : 0.1 },
        }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setTurns((n) => n + 1);
        }}
        tabIndex={pick === null ? 0 : -1}
        aria-label={`Paying ${coins[payer]} for ${coins[1 - payer]}. Reverse`}
      >
        <ArrowDown size={18} strokeWidth={2.2} />
      </motion.button>
    </div>
  );
}

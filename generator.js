/* ============================================================================
   MULTI-ROUND AUCTION DRILL GENERATOR
   ----------------------------------------------------------------------------
   Turns a lesson's `pos` hint into a real, self-consistent practice deal:

     1. Deal four hands.
     2. Simulate the auction from the dealer using the game's own BID.chooseBid
        for every seat EXCEPT at South's target decision point.
     3. The instant it is South's turn AND the auction matches the lesson's
        position (reach) AND South's hand fits the lesson (target) — stop.
     4. The correct answer is BID.chooseBid(South) at that point, so the drill
        can never contradict how the bots actually bid. Others' bids in the
        prefix are also chooseBid's, so the whole auction is bot-consistent.

   Engine-agnostic: inject the game's real modules. In the standalone lab,
   inject the same extracted ENG/AUC/BID.

     const gen = makeGenerator({ ENG, AUC, BID });
     const drill = gen.generate(lesson);   // lesson from curriculum.js
        -> { ok, southHand, dealer, calls, answer, choices, ev } | { ok:false }

   South (the learner) is always seat 0. Partner = 2, LHO = 1, RHO = 3.
   ========================================================================== */

export function makeGenerator({ ENG, AUC, BID, PLY }) {
  const PARTNER = 2, LHO = 1, RHO = 3, SOUTH = 0;

  function deal() {
    const d = ENG.shuffle(ENG.makeDeck());
    return [d.slice(0, 13), d.slice(13, 26), d.slice(26, 39), d.slice(39, 52)];
  }

  // ---- parse the auction-so-far into the facts the reach predicates need ----
  function parse(calls, dealer) {
    const info = AUC.auctionInfo(calls, dealer);
    const firstBid = calls.find((c) => c.k === "B") || null;
    const opener = firstBid ? firstBid.by : -1;
    const bidsBy = (seat) => calls.filter((c) => c.by === seat);
    const lastBidBy = (seat) => {
      const b = bidsBy(seat).filter((c) => c.k === "B");
      return b.length ? b[b.length - 1] : null;
    };
    const southBids = bidsBy(SOUTH);
    const partnerBids = bidsBy(PARTNER).filter((c) => c.k === "B");
    const southRealBids = southBids.filter((c) => c.k === "B");
    const southSuits = new Set(southRealBids.map((b) => b.strain));
    const rank = { C: 0, D: 1, H: 2, S: 3 }; // bidding rank for reverse detection
    // opener reversed = two suit bids, the SECOND a genuinely new suit (not South's,
    // not a rebid) ranking higher than the first, shown at the 2 level.
    const isReverse = (bids) => {
      const s = bids.filter((b) => b.k === "B" && b.strain !== "NT");
      if (s.length < 2) return false;
      const a = s[0], b = s[1];
      return a.strain in rank && b.strain in rank && rank[b.strain] > rank[a.strain] &&
        b.level === a.level + 1 && a.level === 1 &&
        b.strain !== a.strain && !southSuits.has(b.strain); // new suit, not a raise of South
    };
    // count trailing passes right now
    let consec = 0;
    for (let i = calls.length - 1; i >= 0; i--) { if (calls[i].k === "P") consec++; else break; }
    return {
      calls, info, opener, firstBid,
      allPass: calls.length > 0 && calls.every((c) => c.k === "P"),
      southBidCount: southRealBids.length,
      southHasNoBid: southBids.every((c) => c.k !== "B"),
      southFirstBid: southRealBids[0] || null,
      southOpeningIsMajor: !!(southRealBids[0] && southRealBids[0].level === 1 &&
        (southRealBids[0].strain === "H" || southRealBids[0].strain === "S")),
      southPassCount: southBids.filter((c) => c.k === "P").length,
      partnerBidCount: partnerBids.length,
      partnerBids,
      partnerFirstBid: partnerBids[0] || null,
      partnerReversed: isReverse(partnerBids),
      partnerLastBid: lastBidBy(PARTNER),
      rhoLastBid: lastBidBy(RHO),
      lhoLastBid: lastBidBy(LHO),
      partnerLastCall: bidsBy(PARTNER).slice(-1)[0] || null,
      rhoLastCall: bidsBy(RHO).slice(-1)[0] || null,
      lhoLastCall: bidsBy(LHO).slice(-1)[0] || null,
      consecPass: consec,
      lastBid: info.lastBid, lastBidder: info.lastBidder,
    };
  }

  const isMajor = (s) => s === "H" || s === "S";
  const isMinor = (s) => s === "C" || s === "D";
  const isSuit = (s) => s === "C" || s === "D" || s === "H" || s === "S";

  // ---- reach(): is South facing the lesson's decision right now? ----
  // Each entry fixes the dealer (relative to South=0) so the auction shape
  // is predictable, and tests the parsed auction.
  const POS = {
    "open":      { dealer: 0, reach: (p) => p.calls.length === 0 },
    "open-3rd":  { dealer: 2, reach: (p) => p.calls.length === 2 && p.allPass },
    "open-4th":  { dealer: 1, reach: (p) => p.calls.length === 3 && p.allPass },

    "resp-maj":  { dealer: 2, reach: (p) => p.southHasNoBid && p.partnerLastBid &&
                     p.partnerLastBid.level === 1 && isMajor(p.partnerLastBid.strain) &&
                     p.partnerBidCount === 1 && p.opener === PARTNER },
    "resp-min":  { dealer: 2, reach: (p) => p.southHasNoBid && p.partnerLastBid &&
                     p.partnerLastBid.level === 1 && isMinor(p.partnerLastBid.strain) &&
                     p.partnerBidCount === 1 && p.opener === PARTNER },
    "resp-nt":   { dealer: 2, reach: (p) => p.southHasNoBid && p.partnerLastBid &&
                     p.partnerLastBid.strain === "NT" && p.partnerLastBid.level <= 2 &&
                     p.partnerBidCount === 1 && p.opener === PARTNER },
    "resp-2c":   { dealer: 2, reach: (p) => p.southHasNoBid && p.partnerLastBid &&
                     p.partnerLastBid.level === 2 && p.partnerLastBid.strain === "C" &&
                     p.opener === PARTNER },
    "resp-weak": { dealer: 2, reach: (p) => p.southHasNoBid && p.partnerLastBid &&
                     p.opener === PARTNER && isSuit(p.partnerLastBid.strain) &&
                     ((p.partnerLastBid.level === 2 && p.partnerLastBid.strain !== "C") ||
                      p.partnerLastBid.level >= 3) },

    "op-rebid":  { dealer: 0, reach: (p) => p.southBidCount === 1 && p.opener === SOUTH &&
                     p.partnerBidCount >= 1 },
    "rp-rebid":  { dealer: 2, reach: (p) => p.southBidCount === 1 && p.opener === PARTNER &&
                     p.partnerBidCount >= 2 },

    "compete":   { dealer: 3, reach: (p) => p.southHasNoBid && p.opener === RHO &&
                     p.calls.length === 1 && p.rhoLastBid && p.rhoLastBid.level === 1 &&
                     isSuit(p.rhoLastBid.strain) },
    "advance":   { dealer: 1, reach: (p) => p.southHasNoBid && p.opener === LHO &&
                     p.partnerLastCall && (p.partnerLastCall.k === "B" || p.partnerLastCall.k === "D") &&
                     p.calls.length >= 2 },
    // partner opened, RHO overcalled, South acts -> the negative-double seat
    "neg-dbl":   { dealer: 2, reach: (p) => p.southHasNoBid && p.opener === PARTNER &&
                     p.partnerLastBid && p.partnerLastBid.level === 1 && isSuit(p.partnerLastBid.strain) &&
                     p.rhoLastBid && isSuit(p.rhoLastBid.strain) },
    "balance":   { dealer: 1, reach: (p) => p.southHasNoBid && p.info.opened &&
                     p.consecPass === 2 && p.lastBid && p.lastBid.level <= 2 },
    // opponent opened, passed to partner who balanced, now South responds
    "resp-balance": { dealer: 3, reach: (p) => p.southBidCount === 0 && p.southPassCount >= 1 &&
                       p.opener !== PARTNER && p.opener !== SOUTH && p.partnerLastCall &&
                       (p.partnerLastCall.k === "B" || p.partnerLastCall.k === "D") },
    // RHO opens 1NT, South acts directly (Cappelletti)
    "vs-1nt":    { dealer: 3, reach: (p) => p.southHasNoBid && p.opener === RHO && p.calls.length === 1 &&
                     p.rhoLastBid && p.rhoLastBid.level === 1 && p.rhoLastBid.strain === "NT" },
    // partner opens 1-major, RHO makes a takeout double, South acts (Jordan)
    "resp-vs-dbl": { dealer: 2, reach: (p) => p.southHasNoBid && p.opener === PARTNER &&
                     p.partnerLastBid && p.partnerLastBid.level === 1 && isMajor(p.partnerLastBid.strain) &&
                     p.rhoLastCall && p.rhoLastCall.k === "D" },
    // South opens 1-suit, LHO overcalls, partner negative-doubles, South answers
    "op-negdbl": { dealer: 0, reach: (p) => p.southBidCount === 1 && p.opener === SOUTH &&
                     p.partnerLastCall && p.partnerLastCall.k === "D" &&
                     p.lhoLastBid && p.lhoLastBid.strain !== "NT" },
    // South opens, responder uses fourth-suit-forcing, South answers (South's 3rd bid)
    "op-fsf": { dealer: 0, reach: (p) => {
        if(p.opener !== SOUTH || p.southBidCount !== 2) return false;
        const pl = p.partnerLastBid;
        if(!pl || pl.strain === "NT" || pl.level < 2) return false;
        const ours = p.calls.filter(c => c.k === "B" && c.strain !== "NT" && (c.by === SOUTH || c.by === PARTNER));
        const before = new Set(ours.slice(0, -1).map(c => c.strain));
        return before.size === 3 && !before.has(pl.strain);
      } },
  };

  // ---- per-lesson refinements so drills are on-concept, not just legal ----
  // clean:  no opponent has bid before South acts (convention is "on")
  // partnerAction: require partner's last call to be a bid ("B") or double ("D")
  // answerOk(answer, ev, p): the drill must show this action to count
  const cue = (a, e, p) => a.k === "B" && p.rhoLastBid && a.level === 2 && a.strain === p.rhoLastBid.strain;
  const CFG = {
    "r-stayman":  { clean: true, answerOk: (a) => a.k === "B" && a.level === 2 && a.strain === "C" },
    "r-transfer": { clean: true, answerOk: (a) => a.k === "B" && a.level === 2 && (a.strain === "D" || a.strain === "H") },
    "r-2sminor":  { clean: true, answerOk: (a) => a.k === "B" && a.level === 2 && a.strain === "S" },
    "r-ntinvite": { clean: true },
    "r-gerber":   { clean: true },
    "r-higher-nt":{ clean: true },
    "rm-min": { clean: true }, "rm-inv": { clean: true }, "rm-gf": { clean: true },
    "rn-min": { clean: true }, "rn-inv": { clean: true }, "rn-gf": { clean: true },
    "rn-slam": { clean: true },
    "r-weak": { clean: true },
    "c-respover":   { partnerAction: "B" },
    "d-resptakeout":{ partnerAction: "D" },
    "d-takeout":    { answerOk: (a) => a.k === "D" },
    "c-michaels":   { answerOk: cue },
    "c-unusual":    { answerOk: (a) => a.k === "B" && a.level === 2 && a.strain === "NT" },
    "c-jumpover":   { answerOk: (a, e, p) => a.k === "B" && isSuit(a.strain) && p.rhoLastBid &&
                        AUC.bidVal(a) >= AUC.bidVal({ level: 2, strain: p.rhoLastBid.strain }) },
    "c-over1":      { answerOk: (a) => a.k === "B" || a.k === "D" },
    "n-what":       { answerOk: (a) => a.k === "D" },
    "ro-dbl":       { answerOk: (a) => a.k === "D" || (a.k === "B") },
    "b-what":       { answerOk: (a) => a.k !== "P" },
    "b-nt":         { answerOk: (a) => a.k === "B" && a.strain === "NT" },
    // ---- B: sharper auction targeting (uses `also`, checked at reach time) ----
    // opener rebids after partner's LIMIT RAISE (jump to 3 of opener's major)
    "or-limit":  { also: (p) => p.southOpeningIsMajor && p.partnerLastBid &&
                     p.partnerLastBid.level === 3 && p.partnerLastBid.strain === p.southFirstBid.strain },
    // responder's rebid after opener REVERSED (over a 1-level response, to avoid
    // the bot's unfinished 2-over-1 handling)
    "rv-respafter": { also: (p) => p.partnerReversed && p.southFirstBid && p.southFirstBid.level === 1 },
    // responder's rebid after a 2-over-1 (first response was a 2-level new suit)
    "ra-2over1": { also: (p) => p.southFirstBid && p.southFirstBid.level === 2 &&
                     ["C","D","H","S"].includes(p.southFirstBid.strain) },
    // new conventions
    "c-capp":    { answerOk: (a) => a.k === "D" || (a.k === "B" && a.level === 2) },
    "d-jordan":  { answerOk: (a) => (a.k === "B" && a.level === 2 && a.strain === "NT") || a.k === "R" },
    "n-resp":    { answerOk: (a) => a.k === "B" },
    "fsf-what":  { clean: true, answerOk: (a, e, p) => {
                     if(a.k !== "B" || a.strain === "NT" || a.level < 2) return false;
                     const ours = new Set(p.calls.filter(c => c.k === "B" && c.strain !== "NT" && (c.by === 0 || c.by === 2)).map(c => c.strain));
                     return ours.size === 3 && !ours.has(a.strain);
                   } },
    "fsf-opener": { clean: true, answerOk: (a) => a.k === "B" } };

  // ---- target(): does South's hand fit THIS lesson (not just this position)? ----
  // Keeps drills on-topic. Answer still comes from chooseBid regardless.
  const has4Major = (ev) => ev.len.H >= 4 || ev.len.S >= 4;
  const has5Major = (ev) => ev.len.H >= 5 || ev.len.S >= 5;
  const longMinor = (ev) => Math.max(ev.len.C, ev.len.D) >= 6;
  const TARGET = {
    // responses to a major
    "rm-min": (e) => e.hcp >= 6 && e.hcp <= 9,
    "rm-inv": (e) => e.hcp >= 10 && e.hcp <= 11,
    "rm-gf":  (e) => e.hcp >= 12,
    "rm-rebid": () => true,
    // responses to a minor
    "rn-min": (e) => e.hcp >= 6 && e.hcp <= 10,
    "rn-inv": (e) => e.hcp >= 10 && e.hcp <= 12,
    "rn-gf":  (e) => e.hcp >= 13,
    // responses to NT
    "r-stayman":  (e) => has4Major(e) && !has5Major(e) && e.hcp >= 8,
    "r-transfer": (e) => has5Major(e),
    "r-2sminor":  (e) => longMinor(e) && e.hcp <= 7,
    "r-ntinvite": (e) => e.hcp >= 8 && e.hcp <= 9,
    "r-gerber":   (e) => e.hcp >= 15,
    "r-higher-nt":() => true,
    // strong / weak responses
    "r-2c":   () => true,
    "r-weak": () => true,
    // opener rebids (South's opening hand strength)
    "or-min": (e) => e.tp >= 12 && e.tp <= 15,
    "or-inv": (e) => e.tp >= 16 && e.tp <= 18,
    "or-gf":  (e) => e.tp >= 19,
    "rv-opener": (e) => e.tp >= 16,
    // responder's later rebids
    "ra-weak": (e) => e.hcp >= 6 && e.hcp <= 11,
    "ra-forcing": (e) => e.hcp >= 12,
    "ra-2over1": (e) => e.hcp >= 10,
    "c-capp": () => true,
    "d-jordan": (e) => e.hcp >= 10,
    "n-resp": () => true,
    "fsf-what": (e) => e.hcp >= 12,
    "fsf-opener": () => true,
    "rn-slam": (e) => e.hcp >= 17,
    "or-2c": (e) => e.hcp >= 22,
    // competitive
    "c-over1": (e) => e.hcp >= 8 && e.hcp <= 17,
    "c-over2": (e) => e.hcp >= 10 && e.hcp <= 17,
    "c-jumpover": (e) => e.hcp >= 5 && e.hcp <= 10,
    "c-michaels": () => true,
    "c-unusual": () => true,
    "d-takeout": (e) => e.hcp >= 12,
    "c-respover": () => true,
    "d-resptakeout": () => true,
    "n-what": () => true,
    "ro-dbl": () => true,
    "b-what": () => true,
    // openings (single round) already keyed by their own predicates in the lab,
    // but provide light targets so mixed generation stays on-topic:
    "o-1nt":   (e) => e.balanced && e.hcp >= 13 && e.hcp <= 19,
    "o-highnt":(e) => e.balanced && e.hcp >= 20,
    "o-suit":  (e) => e.tp >= 13 && e.tp <= 21 && !e.balanced,
    "o-whichminor": (e) => e.len.S < 5 && e.len.H < 5 && e.len.D < 5 && e.len.C < 5,
    "o-third":  (e) => e.hcp >= 9 && e.hcp <= 12,
    "o-fourth": (e) => e.hcp + e.len.S >= 13,
    "o-weak2":  (e) => e.hcp >= 5 && e.hcp <= 11,
    "o-preempt":(e) => e.hcp <= 10,
    "o-2c":     (e) => e.hcp >= 20 || e.tp >= 22,
  };

  // ---- distractor choices: always include the truth + Pass + nearby legals ----
  function buildChoices(answer, calls, dealer) {
    const key = (c) => c.k === "B" ? `B${c.level}${c.strain}` : c.k;
    const legal = [];
    const push = (c) => { if (AUC.callLegal(c, calls, dealer)) legal.push(c); };
    push({ k: "P" });
    push({ k: "D" });
    push({ k: "R" });
    for (let lvl = 1; lvl <= 7; lvl++) for (const st of ENG.STRAINS) push({ k: "B", level: lvl, strain: st });

    const answerKey = key(answer);
    // score legal calls by proximity to the answer, prefer same strain / adjacent level
    const av = answer.k === "B" ? AUC.bidVal(answer) : -1;
    const scored = legal
      .filter((c) => key(c) !== answerKey)
      .map((c) => {
        let s = 0;
        if (c.k === "P") s = 2;
        else if (c.k === "D" || c.k === "R") s = 6;
        else if (answer.k === "B") {
          const d = Math.abs(AUC.bidVal(c) - av);
          s = d <= 5 ? 1 : d <= 10 ? 3 : 8; // within a level / two levels
          if (c.strain === answer.strain) s -= 1;
        } else s = 4;
        return { c, s: s + Math.random() * 0.5 };
      })
      .sort((a, b) => a.s - b.s)
      .slice(0, 4)
      .map((x) => x.c);

    const all = [answer, ...scored];
    // dedupe + shuffle
    const seen = new Set(), out = [];
    for (const c of ENG.shuffle(all)) { const k = key(c); if (!seen.has(k)) { seen.add(k); out.push(c); } }
    return out.slice(0, 5);
  }

  // ---- D: evaluation drills (no auction; answer computed from the hand) ----
  const quickTricks = (ev) => {
    let qt = 0;
    for (const s of ["S", "H", "D", "C"]) {
      const r = ev.by[s], a = r.includes("A"), k = r.includes("K"), q = r.includes("Q"), l = ev.len[s];
      if (a && k) qt += 2; else if (a && q) qt += 1.5; else if (a) qt += 1;
      else if (k && q) qt += 1; else if (k && l >= 2) qt += 0.5;
    }
    return qt;
  };
  const shapeClass = (ev) => {
    const [a, b, c] = ev.shape; // sorted desc
    if (ev.balanced) return "Balanced";
    if (a >= 6 && b <= 3) return "One-suiter";
    if (a === 4 && b === 4 && c === 4) return "Three-suiter";
    if (a === 5 && b === 4 && c === 4) return "Three-suiter";
    if (a >= 5 && b >= 4) return "Two-suiter";
    return "One-suiter";
  };
  const numericChoices = (ans, spread = 3) => {
    const set = new Set([ans]);
    let d = 1;
    while (set.size < 5) { if (ans - d >= 0) set.add(ans - d); set.add(ans + d); d++; if (d > spread + 4) break; }
    return ENG.shuffle(Array.from(set)).slice(0, 5).sort((a, b) => a - b);
  };
  function ruleOf20Sum(ev) {
    const L = [ev.len.S, ev.len.H, ev.len.D, ev.len.C].sort((a, b) => b - a);
    return ev.hcp + L[0] + L[1];
  }

  const EVAL = {
    hcp: (ev) => ({
      prompt: "How many high-card points?",
      answerLabel: String(ev.hcp),
      why: `A=4, K=3, Q=2, J=1 \u2014 this hand totals ${ev.hcp} HCP.`,
      choices: numericChoices(ev.hcp).map((n) => ({ label: String(n), correct: n === ev.hcp })),
    }),
    tp: (ev) => ({
      prompt: "How many total points (HCP + long-suit points)?",
      answerLabel: String(ev.tp),
      why: `${ev.hcp} HCP plus ${ev.tp - ev.hcp} for length (one per card past the fourth in a suit) = ${ev.tp} total points.`,
      choices: numericChoices(ev.tp).map((n) => ({ label: String(n), correct: n === ev.tp })),
    }),
    r20: (ev) => {
      const open = ev.tp >= 13 || (ev.tp === 12 && ruleOf20Sum(ev) >= 20);
      return {
        prompt: "First or second seat \u2014 open or pass?",
        answerLabel: open ? "Open" : "Pass",
        why: open
          ? `${ev.tp} total points${ev.tp < 13 ? `, and HCP + your two longest suits = ${ruleOf20Sum(ev)} (\u2265 20)` : ""} \u2014 worth an opening bid.`
          : `Only ${ev.tp} total points and HCP + two longest suits = ${ruleOf20Sum(ev)} (< 20) \u2014 pass.`,
        choices: [{ label: "Open", correct: open }, { label: "Pass", correct: !open }],
      };
    },
    shape: (ev) => {
      const ans = shapeClass(ev);
      return {
        prompt: "Classify this hand's shape.",
        answerLabel: ans,
        why: `Distribution ${ev.shape.join("-")} \u2014 ${ans.toLowerCase()}.`,
        choices: ["Balanced", "One-suiter", "Two-suiter", "Three-suiter"].map((l) => ({ label: l, correct: l === ans })),
      };
    },
    qt: (ev) => {
      const qt = quickTricks(ev);
      const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
      const opts = new Set([qt]); let d = 0.5;
      while (opts.size < 5) { if (qt - d >= 0) opts.add(qt - d); opts.add(qt + d); d += 0.5; if (d > 3) break; }
      return {
        prompt: "How many quick tricks?",
        answerLabel: fmt(qt),
        why: `Quick tricks: AK=2, AQ=1\u00bd, A=1, KQ=1, Kx=\u00bd \u2014 this hand has ${fmt(qt)}.`,
        choices: ENG.shuffle(Array.from(opts)).slice(0, 5).sort((a, b) => a - b).map((n) => ({ label: fmt(n), correct: n === qt })),
      };
    },
  };
  function generateEval(lesson) {
    const q = EVAL[lesson.drill.q];
    if (!q) return { ok: false, reason: "unknown eval question: " + lesson.drill.q };
    const hand = deal()[0];
    const ev = BID.evalHand(hand);
    return { ok: true, kind: "eval", lesson: lesson.id, southHand: hand, ev, ...q(ev) };
  }

  // ---- C: opening-lead drills (answer from the game's own PLY oracle) ----
  const cardKey = (c) => c.rank + c.suit;
  const RVL = ENG.RANKVAL;
  const LEAD_WHY = {
    LEAD_SEQ: (p) => `Top of a sequence in ${suitWord(p.suit)} \u2014 the ${p.top} is a safe, constructive lead that promotes your lower cards.`,
    LEAD_4TH: (p) => `Fourth-best from your longest suit (${suitWord(p.suit)}) \u2014 the classic lead to develop length.`,
    LEAD_ACE: (p) => `Against a suit contract you don't underlead an ace, so lead the ace of ${suitWord(p.suit)}.`,
    LEAD_LOW: (p) => `Lead a low ${suitWord(p.suit)} \u2014 a quiet, safe choice with nothing better to attack.`,
    ONLY: () => `Only one card to lead.`,
  };
  const suitWord = (s) => ({ S: "spades", H: "hearts", D: "diamonds", C: "clubs" }[s] || s);

  // natural lead candidate from a single suit's cards (desc)
  function suitLeadCandidate(cards, isNT) {
    if (!cards.length) return null;
    const d = cards.slice().sort((a, b) => RVL[b.rank] - RVL[a.rank]);
    // top of a 2+ sequence of honors
    for (let i = 0; i + 1 < d.length; i++)
      if (RVL[d[i].rank] - RVL[d[i + 1].rank] === 1 && RVL[d[i].rank] >= 11) return d[i];
    if (!isNT && d[0].rank === "A") return d[0];       // ace from length vs suit
    if (d.length >= 4) return d[3];                     // fourth best
    return d[d.length - 1];                             // low
  }
  function leadChoices(hand, answer, isNT) {
    const bySuit = { S: [], H: [], D: [], C: [] };
    for (const c of hand) bySuit[c.suit].push(c);
    const cands = [];
    for (const s of ["S", "H", "D", "C"]) {
      const c = suitLeadCandidate(bySuit[s], isNT);
      if (c) cands.push(c);
    }
    // ensure the answer is present, then fill with other-suit candidates
    const out = [answer], seen = new Set([cardKey(answer)]);
    for (const c of ENG.shuffle(cands)) { if (!seen.has(cardKey(c))) { seen.add(cardKey(c)); out.push(c); } }
    return ENG.shuffle(out).slice(0, Math.min(5, Math.max(4, out.length)));
  }
  function generateLead(lesson, tries = 12000) {
    if (!PLY) return { ok: false, reason: "no play oracle (PLY) injected" };
    const wantNT = lesson.drill.strain === "NT";
    for (let t = 0; t < tries; t++) {
      const hands = deal();
      const dealer = (Math.random() * 4) | 0;
      const calls = [];
      let guard = 0;
      while (guard++ < 40) {
        const info = AUC.auctionInfo(calls, dealer);
        if (info.ended) break;
        const seat = AUC.turnSeat(calls, dealer);
        const c = BID.chooseBid(hands[seat], calls, dealer, seat);
        calls.push({ ...c, by: seat });
      }
      const info = AUC.auctionInfo(calls, dealer);
      if (!info.ended || info.passedOut || !info.contract) continue;
      const ct = info.contract;
      if (ct.declarer !== 3) continue;               // South (0) must be the opening leader
      const isNT = ct.strain === "NT";
      if (wantNT !== isNT) continue;
      const w = PLY.chooseCardWhy({
        hand: hands[0], trick: [], ledSuit: null, trump: ct.strain,
        seat: 0, declarer: 3, dummy: 1, seen: [],
      });
      const why = (LEAD_WHY[w.why.code] || (() => "Standard lead."))(w.why);
      return {
        ok: true, kind: "lead", lesson: lesson.id, dealer, calls, contract: ct,
        southHand: hands[0], answer: w.card, code: w.why.code, why,
        answerLabel: w.card.rank + w.card.suit,
        choices: leadChoices(hands[0], w.card, isNT),
      };
    }
    return { ok: false, reason: "did not converge (South rarely on lead vs this contract type)" };
  }

  // ---- the generator ----
  function generate(lesson, tries = 8000) {
    if (lesson.drill && lesson.drill.kind === "eval") return generateEval(lesson);
    if (lesson.drill && lesson.drill.pos === "lead") return generateLead(lesson);
    const spec = lesson.drill && POS[lesson.drill.pos];
    if (!spec) return { ok: false, reason: "no drillable position for this lesson" };
    const target = TARGET[lesson.id] || (() => true);
    const cfg = CFG[lesson.id] || {};
    const dealer = spec.dealer;

    for (let t = 0; t < tries; t++) {
      const hands = deal();
      const calls = [];
      let guard = 0;
      while (guard++ < 40) {
        const info = AUC.auctionInfo(calls, dealer);
        if (info.ended) break;
        const seat = AUC.turnSeat(calls, dealer);
        if (seat === SOUTH) {
          const p = parse(calls, dealer);
          if (spec.reach(p)) {
            // refinements: clean auction / partner's action / hand target / extra reach
            if (cfg.clean && (p.rhoLastBid || p.lhoLastBid)) break;
            if (cfg.partnerAction && (!p.partnerLastCall || p.partnerLastCall.k !== cfg.partnerAction)) break;
            if (cfg.also && !cfg.also(p)) break;
            const ev = BID.evalHand(hands[SOUTH]);
            if (!target(ev)) break;
            const answer = BID.chooseBid(hands[SOUTH], calls, dealer, SOUTH);
            if (cfg.answerOk && !cfg.answerOk(answer, ev, p)) break; // must show the concept
            return {
              ok: true, lesson: lesson.id, dealer,
              southHand: hands[SOUTH], calls: calls.slice(),
              answer, ev, choices: buildChoices(answer, calls, dealer),
            };
          }
        }
        const c = BID.chooseBid(hands[seat], calls, dealer, seat);
        calls.push({ ...c, by: seat });
      }
    }
    return { ok: false, reason: "did not converge within budget" };
  }

  // ---- audit(): which drillable lessons can the CURRENT bot actually produce? ----
  // Runs each lesson a few times; a lesson that never converges is either a
  // convention the bot doesn't play yet or one needing another oracle (leads).
  // The app calls this once at load to decide which drills to offer — so a
  // lesson activates automatically the moment the bot learns its convention.
  function audit(lessons, samples = 24, budget = 4000) {
    const out = {};
    for (const l of lessons) {
      if (!l.drill) { out[l.id] = { generatable: false, reason: "teach-only", rate: 0 }; continue; }
      if (l.drill.kind === "eval") { out[l.id] = { generatable: true, reason: "eval", rate: 1 }; continue; }
      if (l.drill.pos === "lead" && !PLY) { out[l.id] = { generatable: false, reason: "needs play oracle", rate: 0 }; continue; }
      let hit = 0;
      for (let i = 0; i < samples; i++) if (generate(l, budget).ok) hit++;
      out[l.id] = {
        generatable: hit > 0,
        rate: hit / samples,
        reason: hit > 0 ? "ok" : "bot does not play this convention yet",
      };
    }
    return out;
  }

  return { generate, audit, parse, POS, TARGET, CFG };
}

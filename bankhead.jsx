import React, { useReducer, useEffect, useRef } from "react";

/* ---- online multiplayer bindings (inert unless the shell provides them) ---- */
const __BH_INERT_NET = { role:"off", seat:0, status:"", room:null, snap:null, snapV:0, roster:[],
  names:["","","",""], namesV:0, target:100, full:false, myInitials:"", playerCount:0, downSeats:[],
  isSeatDown:()=>false, prefillCode:"", savedSession:null,
  setInitials(){}, hostGame(){}, joinGame(){}, rejoin(){}, goSolo(){}, backToLobby(){}, send(){}, broadcastState(){} };
const useBankheadNet = (typeof window!=="undefined" && window.useBankheadNet) || (()=>__BH_INERT_NET);
const OnlineBar     = (typeof window!=="undefined" && window.OnlineBar)     || (()=>null);
const OnlineScreens = (typeof window!=="undefined" && window.OnlineScreens) || (()=>null);

/* =======================================================================
   BANKHEAD — single pile · wilds are 2, 6, A
   2 = reset · 8 = transparent "play lower" · A = bank (contestable)
   Generalized to 2–4 players · one human (seat 0) vs up to 3 archetype bots.
   Bank answering uses the SINGLE-RESPONDER rule (only the next player answers
   a pending bank) — the literal generalization of the 2-player game, and the
   one the multiplayer simulations showed keeps banks resolving cleanly.
   ── TUNING ───────────────────────────────────────────────────────────── */
const HAND_SIZE_BY_N = { 2:6, 3:5, 4:4 };   // deepest hand per player count (sim-validated)
const handSize = (n)=> HAND_SIZE_BY_N[n] || 4;
// A round ends when someone empties their hand (only possible once the stock is
// dry); no blind stack, no match target — players set their own finish line.
// PICKUP: you may only pick up when you have NO legal play (never voluntarily).
// You take just the LAST 6 cards played to the pile into your hand; everything
// older is discarded OUT OF THE GAME. That bounded intake + permanent sink keeps
// hands small and guarantees the round terminates. HAND_CAP is a rare backstop:
// if a pickup ever leaves you holding more than it, you discard down to it (your
// choice) and those cards also leave play.
const HAND_CAP = 10;
// Card scores compress to 1 / 2 / 3 (was 5 / 10 / 15); royal-suit bonus scales to
// +1 to match. Going-out bonus is raised to 10 — about a solid bank's worth on the
// new scale (~30% of the ~34 average round) so going out matters without dwarfing
// banking. (Strict 15% of the average would be ~5; this is a deliberate bump.)
const OUT_BONUS = 10;
// Decks are fixed by head-count: a duel runs on one deck, 3–4 players on two.
const decksFor = (n)=> n>=3 ? 2 : 1;

/* ── cards ───────────────────────────────────────────────────────────── */
const SUITS = ["S","H","D","C"];
const SUIT_GLYPH = { S:"♠", H:"♥", D:"♦", C:"♣" };
const SUIT_COLOR = { S:"var(--sp)", C:"var(--cl)", D:"var(--di)", H:"var(--he)" };
const RANKS = ["3","4","5","6","7","8","9","10","J","Q","K","A","2"];
const VAL = { "3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14 };
const SORT_VAL = { ...VAL, "2":2 };   // 2 sorts lowest when ordering a hand for display
const sortHand = (hand, mode)=>{
  const arr=[...hand];
  if(mode==="suit") arr.sort((a,b)=>(SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit))||(SORT_VAL[a.rank]-SORT_VAL[b.rank]));
  else if(mode==="rank") arr.sort((a,b)=>(SORT_VAL[a.rank]-SORT_VAL[b.rank])||(SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)));
  return arr;  // mode "dealt" leaves the held order untouched
};

let UID = 0;
const shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
function makeDeck(decks){
  const d=[];
  for(let n=0;n<decks;n++) for(const r of RANKS) for(const s of SUITS) d.push({id:++UID,rank:r,suit:s});
  return shuffle(d);
}
const label=(c)=>c.rank+SUIT_GLYPH[c.suit];

/* ── the 2/6/A engine (ported verbatim) ──────────────────────────────── */
function situation(pile){
  if(pile.length===0) return {kind:"openEmpty"};
  const top=pile[pile.length-1];
  const beneath=pile.length>=2?pile[pile.length-2]:null;
  if(top.rank==="A") return {kind:"aceBank"};
  if(top.rank==="2") return {kind:"on2"};
  if(top.rank==="6"){
    if(!beneath)            return {kind:"plain8"};
    if(beneath.rank==="2")  return {kind:"bank8on2"};
    if(beneath.rank==="6")  return {kind:"bank8on8"};
    if(beneath.rank==="A")  return {kind:"bank8onA"};
    return {kind:"invert", rank:beneath.rank};
  }
  return {kind:"climb", rank:top.rank};
}
function legal(r, S){
  if(r==="2") return "reset";
  if(r==="6"){
    switch(S.kind){
      case "openEmpty": return "plain8";
      case "climb":     return "invert";
      case "on2":       return "bank";
      case "plain8":    return "bank";
      case "invert":    return "bank";
      case "aceBank":   return "steal";
      case "bank8on2": case "bank8on8": case "bank8onA": return "steal";
    }
  }
  if(r==="A"){
    switch(S.kind){
      case "plain8": case "invert": return "bank";   // Ace plays on a non-banking 6 too — it banks
      case "bank8on2": case "bank8on8": case "bank8onA": return "steal";
      case "aceBank": return "steal";
      default:        return "bank";
    }
  }
  switch(S.kind){
    case "openEmpty": case "on2": return "ok";
    case "climb":     return VAL[r]>=VAL[S.rank] ? "ok" : "no";
    case "plain8":    return VAL[r]<6 ? "ok" : "no";
    case "invert":    return VAL[r]<6 ? "ok" : "no";
    case "aceBank":   return "no";
    case "bank8on2":  return VAL[r]<6 ? "ok" : "no";
    case "bank8on8":  return VAL[r]<6 ? "ok" : "no";
    case "bank8onA":  return VAL[r]<6 ? "ok" : "no";   // 6 is OPAQUE: a 6-bank always demands under 6 (3–5), whatever sits beneath
  }
  return "no";
}
const isBank=(S)=> S.kind==="aceBank"||S.kind==="bank8on2"||S.kind==="bank8on8"||S.kind==="bank8onA";
function boardDemand(S){
  switch(S.kind){
    case "openEmpty": return {main:"PLAY ANYTHING", sub:"2 · 6 · A are wild"};
    case "on2":       return {main:"PLAY ANYTHING", sub:"a 2 just reset it"};
    case "climb":     return {main:`PLAY ≥ ${S.rank}`, sub:"or a 2 · 6 · A"};
    case "plain8":    return {main:"PLAY < 6", sub:"6 played · or 2·6·A"};
    case "invert":    return {main:"PLAY < 6", sub:"6 played · or 2·6·A"};
    case "aceBank":   return {main:"ACE BANK", sub:"answer 2·6·A — or pass"};
    case "bank8on2":  return {main:"6-ON-2 BANK", sub:"under 6 · 2·6·A — or pass"};
    case "bank8on8":  return {main:"6-ON-6 BANK", sub:"under 6 · 2·6·A — or pass"};
    case "bank8onA":  return {main:"6-ON-ACE BANK", sub:"under 6 · 2·6·A — or pass"};
    default:          return {main:"—", sub:""};
  }
}
const topFour=(pile)=> pile.length>=4 && pile.slice(-4).every(c=>c.rank===pile[pile.length-1].rank);

/* ── combos: sets only; four-of-a-kind banks ─────────────────────────── */
function comboType(cards){
  if(cards.length===1) return "single";
  if(cards.every(c=>c.rank===cards[0].rank)) return "set";
  return "invalid";
}
function comboLegal(cards, S){
  const type=comboType(cards);
  if(type==="invalid") return {ok:false,type};
  const ok = legal(cards[0].rank,S)!=="no";
  const bankFour = ok && type==="set" && cards.length>=4;
  return {ok, type, bank: bankFour };
}

/* ── scoring ──────────────────────────────────────────────────────────── */
const tier=(r)=> (r==="A"||r==="2"||r==="6")?3 : (r==="10"||r==="J"||r==="Q"||r==="K")?2 : 1;
const scoreBank=(cards)=>cards.reduce((s,c)=>s+tier(c.rank),0);
const potValue=(cards)=>scoreBank(cards);
const activeZone=(p)=> "hand";  // no blind stack any more — you always play from hand

/* =======================================================================
   BOT ARCHETYPES — span the winning-strategy surface
   ===================================================================== */
const PROFILES = {
  // ================= EXPERT (5) =================
  counter: {
    key:"counter", name:"The Counter", role:"Card Counter", glyph:"\u229F", color:"#8b95a3", diff:5,
    blurb:"Tracks every wild that has left play and builds locks — banks free money the instant you can't answer.",
    bankMinPot:4, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.4, dumpWilds:false, epsilon:0.05, refined:true, mem:1.0, countRanks:13, countFocus:"broad",
    respondStealPot:1, respondAcePot:2, respondResetPot:4, lastDitchStealPot:1,
  },
  shark: {
    key:"shark", name:"The Shark", role:"Exploiter", glyph:"\u23C3", color:"#d4b13e", diff:5,
    blurb:"Counts the wilds AND learns your habits — retunes its own memory and aggression to punish how you play.",
    bankMinPot:3, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.4, dumpWilds:false, epsilon:0.05, refined:true, exploit:true, mem:1.0, adapt:true, countFocus:"wilds",
    respondStealPot:2, respondAcePot:2, respondResetPot:3, lastDitchStealPot:1,
  },
  apex: {
    key:"apex", name:"The Apex", role:"Endgame Specialist", glyph:"\u273A", color:"#e0517a", diff:5,
    blurb:"Counts like the Counter, but won't burn a scarce wild to bank a tiny pot — and when it goes out, it angles the royal suit toward the cards it has banked. A patient endgame play.",
    bankMinPot:4, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.4, dumpWilds:false, epsilon:0.05, refined:true, apex:true,
    mem:1.0, countRanks:13, countFocus:"broad",
    respondStealPot:1, respondAcePot:2, respondResetPot:4, lastDitchStealPot:1,
  },
  // ================= HARD (4) =================
  miser: {
    key:"miser", name:"The Miser", role:"Hoarder", glyph:"\u2B23", color:"#9b8bd0", diff:3,
    blurb:"Hoards every wild and answers every bank — a patient wall that denies its way to the win with no memory at all.",
    bankMinPot:6, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.22, dumpWilds:false, epsilon:0.05, refined:true, count:false,
    respondStealPot:1, respondAcePot:1, respondResetPot:2, lastDitchStealPot:1,
  },
  vault: {
    key:"vault", name:"The Vault", role:"Banker", glyph:"\u25C6", color:"#d4af37", diff:4,
    blurb:"Lets pots fatten and builds 6-on-2 locks — now reads the spent wilds and banks heavy only when it's safe.",
    bankMinPot:5, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.25, dumpWilds:false, epsilon:0.07, refined:true, mem:0.72, countRanks:5, countFocus:"wilds",
    respondStealPot:1, respondAcePot:1, respondResetPot:4, lastDitchStealPot:1,
  },
  // ================= TRICKY (3) =================
  vulture: {
    key:"vulture", name:"The Vulture", role:"Sniper", glyph:"\u2A58", color:"#4fa39a", diff:4,
    blurb:"Does little but snipe — steals and cancels relentlessly, timing the kill when the wilds run dry.",
    bankMinPot:5, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.4, dumpWilds:false, epsilon:0.10, refined:true, mem:0.40, countRanks:3, countFocus:"wilds",
    respondStealPot:2, respondAcePot:2, respondResetPot:3, lastDitchStealPot:1,
  },
  gremlin: {
    key:"gremlin", name:"The Gremlin", role:"Controller", glyph:"\u2726", color:"#2ca05a", diff:4,
    blurb:"Lives to steal and cancel your banks — and half-tracks the wilds to know when to pounce.",
    bankMinPot:3, holdAces:true, holdEights:true, holdTwos:true,
    shedDrive:0.5, dumpWilds:false, epsilon:0.12, refined:true, mem:0.40, countRanks:3, countFocus:"wilds",
    respondStealPot:1, respondAcePot:2, respondResetPot:2, lastDitchStealPot:1,
  },
  wildcard: {
    key:"wildcard", name:"The Wildcard", role:"Chaos", glyph:"\u274D", color:"#c77dba", diff:3,
    blurb:"Loose, streaky, and hard to read — a foggy memory and a coin-flip soul you can ride or get burned by.",
    bankMinPot:3, holdAces:false, holdEights:true, holdTwos:false,
    shedDrive:0.5, dumpWilds:false, epsilon:0.36, refined:false, mem:0.40, countRanks:2, countFocus:"wilds",
    respondStealPot:3, respondAcePot:4, respondResetPot:6, lastDitchStealPot:2,
  },
  // ================= EASY (2) =================
  squirrel: {
    key:"squirrel", name:"The Squirrel", role:"Hoarder", glyph:"\u25C8", color:"#c98f5a", diff:2,
    blurb:"Stashes a few wilds and banks once a pot feels comfy — tidy enough, but never reads the table.",
    bankMinPot:3, holdAces:true, holdEights:true, holdTwos:false,
    shedDrive:0.4, dumpWilds:false, epsilon:0.16, refined:false, count:false,
    respondStealPot:3, respondAcePot:4, respondResetPot:7, lastDitchStealPot:2,
  },
  magpie: {
    key:"magpie", name:"The Magpie", role:"Thief", glyph:"\u2727", color:"#6fa8c7", diff:2,
    blurb:"Snatches at shiny banks on impulse — opportunistic, but doesn't plan, deny, or count.",
    bankMinPot:2, holdAces:true, holdEights:false, holdTwos:false,
    shedDrive:0.5, dumpWilds:false, epsilon:0.18, refined:false, count:false,
    respondStealPot:2, respondAcePot:3, respondResetPot:9, lastDitchStealPot:3,
  },
  // ================= GENTLE (1) =================
  bolt: {
    key:"bolt", name:"The Bolt", role:"Rusher", glyph:"\u25B2", color:"#d6473b", diff:1,
    blurb:"Sheds fast to go out for the bonus, but still grabs a fat pot on the way past.",
    bankMinPot:4, holdAces:false, holdEights:false, holdTwos:false,
    shedDrive:1.0, dumpWilds:true, epsilon:0.06, refined:true, count:false,
    respondStealPot:6, respondAcePot:6, respondResetPot:999, lastDitchStealPot:999,
  },
  sprinter: {
    key:"sprinter", name:"The Sprinter", role:"Rusher+", glyph:"\u26A1", color:"#e8923a", diff:1,
    blurb:"Pure rush — never banks under a giant pot and races every hand to empty.",
    bankMinPot:7, holdAces:false, holdEights:false, holdTwos:false,
    shedDrive:1.0, dumpWilds:true, epsilon:0.05, refined:true, count:false,
    respondStealPot:8, respondAcePot:8, respondResetPot:999, lastDitchStealPot:999,
  },
};
const BRAIN_ORDER = ["vault","gremlin","squirrel"];
const ALL_BRAINS  = ["bolt","sprinter","squirrel","magpie","wildcard","gremlin","vulture","vault","miser","counter","shark","apex"];
// difficulty 1–5, set by a 10k-match mixed tournament + heads-up round-robin under the live rules
const DIFF_LABEL = ["","Gentle","Easy","Tricky","Hard","Expert"];

const pick=(arr)=>arr[(Math.random()*arr.length)|0];

function legalPlaysFromHand(hand, S){
  const byrank={};
  for(const c of hand){ (byrank[c.rank]=byrank[c.rank]||[]).push(c); }
  const plays=[];
  for(const r in byrank){
    if(legal(r,S)!=="no"){
      const cards=byrank[r];
      plays.push([cards[0]]);
      for(let k=2;k<=cards.length;k++) plays.push(cards.slice(0,k));
    }
  }
  return plays;
}
const playValue=(play)=>play.reduce((s,c)=>s+tier(c.rank),0);

/* ---- card counting with imperfect memory ----------------------------------
   A counter always sees its own hand and the live pile. Cards that have LEFT
   the table (banked or discarded) must be remembered — and memory is a dial:
   `mem` ∈ [0,1] is the fraction of those gone cards it still recalls. mem=1 is
   perfect recall; lower mem lets gone cards drift back into its believed-live
   pool, blurring its read of which banks are safe. unseen = full deck − (my
   hand + pile + recalled-gone) ≈ opponents' hands + stock. */
const COUNT_TIERS = [
  { key:"off",     label:"Off",     mem:0    },
  { key:"foggy",   label:"Foggy",   mem:0.40 },
  { key:"sharp",   label:"Sharp",   mem:0.72 },
  { key:"perfect", label:"Perfect", mem:1.0  },
];
const memToTier=(m)=>{ if(!m) return COUNT_TIERS[0];
  let best=COUNT_TIERS[0],bd=9; for(const t of COUNT_TIERS){const d=Math.abs(t.mem-m); if(d<bd){bd=d;best=t;}} return best; };
function defaultMem(key){ const pr=PROFILES[key]; if(!pr) return 0;
  if(typeof pr.mem==="number") return pr.mem; return pr.count?1:0; }
// effective counting level for a seat: explicit per-seat override, else the profile's default
function memLevel(s, pi){ const c=s.counts?s.counts[pi]:undefined;
  if(typeof c==="number") return c;
  if(c && typeof c==="object" && typeof c.fid==="number") return c.fid;
  return defaultMem(s.brains[pi]); }
// normalise a seat's per-seat counting entry into a full editable {fid,focus,n,suit} config
function countCfg(state, seat){
  const c=state.counts?state.counts[seat]:undefined;
  const pr=PROFILES[state.brains[seat]]||{};
  if(c && typeof c==="object") return {fid:c.fid==null?1:c.fid, focus:c.focus||pr.countFocus||"broad", n:c.n==null?(pr.countRanks==null?13:pr.countRanks):c.n, suit:c.suit||pr.countSuit||null};
  const fid=(typeof c==="number")?c:defaultMem(state.brains[seat]);
  return {fid, focus:pr.countFocus||"broad", n:pr.countRanks==null?13:pr.countRanks, suit:pr.countSuit||null};
}

// the full memory STRATEGY for a seat. Per-seat config may be a plain number (fidelity,
// strategy from the profile) or an object {fid, focus, n, suit} that overrides the strategy.
function memSpec(s, pi){
  const pr=PROFILES[s.brains[pi]]||{};
  const ov = s.counts ? s.counts[pi] : undefined;
  const ob = (ov && typeof ov==="object") ? ov : null;
  const raw = memLevel(s,pi);                     // 0..1 fidelity (off → null)
  if(raw<=0) return null;
  let N    = ob&&ob.n!=null    ? ob.n    : (pr.countRanks!=null? pr.countRanks : 13);
  let focus= ob&&ob.focus      ? ob.focus: (pr.countFocus || "broad");
  let suit = ob&&ob.suit       ? ob.suit : (pr.countSuit || null);
  if(pr.adapt){ const a=adaptCounting(s,pi,pr); N=a.N; focus=a.focus; suit=a.suit; }
  let ranks;
  if(focus==="suit"){ ranks=new Set(); if(!suit) suit="\u2660"; }   // pure suit tracker — weak for banking
  else ranks=new Set(focusOrder(focus).slice(0, Math.max(0,Math.min(13,N))));
  return { ranks, suit, recall:0.5+0.5*raw, noise:(1-raw)*0.45, N, focus };
}
// the Shark's adaptive counting: widen/narrow to the next opponent's sharpness, and make
// sure the wild they ANSWER with most is tracked even on a tight budget.
function adaptCounting(s, pi, pr){
  const opp=nxt(s,pi); const m=MEMORY[opp];
  let focus="wilds", N=5, suit=pr.countSuit||null;
  if(m && m.faced>=3){
    const fr=foldRate(opp);
    N = fr<0.30 ? 11 : (fr>0.65 ? 4 : 7);          // sharp answerer → count wider; over-folder → counting matters less
    if(defuseRate(opp)>0.30) N=Math.max(N,9);      // they escape with low cards → track the defusers (3–7) too
  }
  return {focus, N, suit};
}

// which ranks a LIMITED memory prioritises; the rank budget truncates this list.
// 2 and 6 answer every bank and A answers ace-banks, so "wilds"/"broad" front-load them;
// "face"/"low" are deliberately weaker reads (they watch the wrong cards first).
function focusOrder(focus){
  switch(focus){
    case "face": return ["K","Q","J","10","A","6","2","9","7","8","5","4","3"];
    case "low":  return ["3","4","5","8","7","2","6","A","9","10","J","Q","K"];
    default:     return ["6","2","A","3","4","5","8","7","9","10","J","Q","K"]; // wilds / broad / suit
  }
}
// mm is either a number (uniform recall of EVERY rank — the legacy dial) or a spec
// {ranks:Set, suit, recall} where only tracked ranks/suit are remembered. A gone card
// outside the tracked set is forgotten, so banks in those ranks read as still-answerable.
function unseenInfo(s, pi, mm=1){
  const total = 4*decksFor(s.n);
  const uniform = (typeof mm==="number");
  const recall = uniform ? mm : (mm.recall==null?1:mm.recall);
  const ranks  = uniform ? null : mm.ranks;
  const suit   = uniform ? null : mm.suit;
  const here={}, recd={};
  const addH=c=>{ here[c.rank]=(here[c.rank]||0)+1; };   // visible now (own hand + live pile)
  s.players[pi].hand.forEach(addH);
  s.pile.forEach(addH);
  if(s.royalCard) addH(s.royalCard);                      // the flipped potential-royal card is face-up to all
  const consider=c=>{                                     // gone (banked/discarded) — recalled only if tracked
    const tracked = uniform || (ranks&&ranks.has(c.rank)) || (suit&&c.suit===suit);
    if(tracked) recd[c.rank]=(recd[c.rank]||0)+recall;
  };
  s.banked.forEach(b=>b.forEach(consider));
  (s.discarded||[]).forEach(consider);
  const unseen={}; let U=0;
  for(const r of RANKS){
    const seen=(here[r]||0)+(recd[r]||0);
    const u=Math.max(0,total-seen); unseen[r]=u; U+=u;
  }
  return {unseen, U};
}
function answerRanksFor(kind){
  if(kind==="aceBank")  return ["2","6","A"];
  if(kind==="bank8on2") return ["2","6","A","3","4","5"];
  if(kind==="bank8on8") return ["2","6","A","3","4","5"];
  if(kind==="bank8onA") return ["2","6","A","3","4","5"];
  return [];
}
// P(the next responder's h-card sample of the U unseen cards holds >=1 of c answer cards)
function pAtLeastOne(c, h, U){
  if(c<=0||h<=0||U<=0) return 0;
  if(U-c < h) return 1;
  let p=1; for(let k=0;k<h;k++) p *= (U-c-k)/(U-k);
  return 1-p;
}
function pAnswerOfBank(s, pi, resultKind, mem=1){
  const {unseen,U}=unseenInfo(s,pi,mem);
  let c=0; for(const r of answerRanksFor(resultKind)) c+=unseen[r]||0;
  const next=nxt(s,pi);
  return pAtLeastOne(c, s.players[next].hand.length, U);
}

/* ---- opponent model (the Exploiter's memory of how each seat plays) ---- */
const MEMORY = {};
function memOf(seat){ return MEMORY[seat] || (MEMORY[seat]={faced:0,folded:0,banksMade:0,bankPotSum:0,ans:{}}); }
function resetMemory(){ for(const k in MEMORY) delete MEMORY[k]; }
function foldRate(seat){ const m=memOf(seat); return (m.folded+1.5)/(m.faced+3); }      // smoothed ~0.5 prior
// fraction of a seat's bank-answers that were low-ordinary DEFUSES (vs wild steals/resets)
function defuseRate(seat){ const a=memOf(seat).ans||{}; let lo=0,t=0;
  for(const r in a){ t+=a[r]; if(r==="3"||r==="4"||r==="5"||r==="6"||r==="7") lo+=a[r]; } return t? lo/t : 0; }
function observe(prev, action, next){
  if(!prev || prev.mode!=="play" || !action) return;
  const a=action.player;
  const facingBank = prev.pendingBanker!==null && prev.pendingBanker!==a
                  && isBank(situation(prev.pile)) && prev.current===a;
  if(facingBank){ const m=memOf(a); m.faced++;
    if(action.type==="PASS_BANK") m.folded++;
    else if(action.type==="PLAY" && action.cardIds && action.cardIds.length){
      const card=prev.players[a].hand.find(c=>c.id===action.cardIds[0]);
      if(card){ m.ans[card.rank]=(m.ans[card.rank]||0)+1; }   // which rank they answered with
    }
  }
  if(next.pendingBanker===a && prev.pendingBanker!==a){ const m=memOf(a); m.banksMade++; m.bankPotSum+=potValue(prev.pile); }
}


/* the suit where I most out-bank my rivals — the suit I want to be "royal" if I go out */
function royalTarget(s,pi){
  let best=null,bestMargin=-1e9;
  for(const su of SUITS){
    const mine=s.banked[pi].filter(c=>c.suit===su).length;
    let opp=0; for(let j=0;j<s.n;j++) if(j!==pi) opp=Math.max(opp, s.banked[j].filter(c=>c.suit===su).length);
    const margin=mine-opp;
    if(margin>bestMargin){ bestMargin=margin; best=su; }
  }
  return {suit:best, margin:bestMargin};
}
/* choose a normal-turn play; returns array of card objects, or null = pick up */
function botChoosePlayCards(s, pi, prof){
  const p=s.players[pi]; const pile=s.pile; const S=situation(pile);
  const plays=legalPlaysFromHand(p.hand, S);
  if(!plays.length) return null;
  const pot=potValue(pile);
  const endgame = s.stock.length===0;
  // --- table-reading metrics (refined bots act on these) ---
  const myHand=p.hand.length;
  let oppMinHand=Infinity; for(let j=0;j<s.n;j++) if(j!==pi) oppMinHand=Math.min(oppMinHand,s.players[j].hand.length);
  const iAmShortest = myHand<=oppMinHand;
  const someoneClose = prof.refined && oppMinHand<=3 && !iAmShortest;   // a rival is about to go out
  const outMode = prof.refined && myHand<=5 && (endgame || iAmShortest); // I should race to empty
  const eps = endgame ? Math.max(prof.epsilon, 0.30) : (outMode?0:prof.epsilon);

  // 1) four-of-a-kind — uncontested bank, always take
  for(const play of plays){ if(play.length>=4 && topFour([...pile,...play])) return play; }
  for(const play of plays){ if(topFour([...pile,...play])) return play; }
  // 2) contestable bank — threshold flexes with the table
  const bankPlays=plays.filter(pl=>{
    const r=pl[0].rank; const res=legal(r,S);
    return (r==="A"&&res==="bank")||(r==="6"&&res==="bank");
  });
  let bankThresh=prof.bankMinPot;
  if(someoneClose) bankThresh=Math.min(bankThresh,2);   // grab points before the round ends
  if(outMode && prof.shedDrive>=0.75) bankThresh=Math.min(bankThresh,2); // rusher: bank-and-shed a wild on the way out
  else if(outMode)                    bankThresh=Math.max(bankThresh,4); // others: don't strand on a small pot
  // Exploiter: bank into an over-folder freely; tighten against someone who always answers
  if(prof.exploit){
    const fr=foldRate(nxt(s,pi));
    if(fr>0.66) bankThresh=Math.max(1,bankThresh-1);   // reliable folder — bank a touch more freely
    else if(fr<0.28) bankThresh=bankThresh+2;          // reliable answerer — be a touch more selective
  }
  const mm = memSpec(s,pi); const counting = !!mm;
  if(bankPlays.length && !(endgame && pot<5)){
    if(prof.apex && counting){
      const noiseAmp=mm.noise;
      let best=null,bestEff=-1,bestP=1;
      for(const pl of bankPlays){
        let pA=pAnswerOfBank(s,pi,situation([...pile,...pl]).kind,mm);
        pA=Math.min(1,Math.max(0, pA+(Math.random()*2-1)*noiseAmp));
        const eff=pot*(1-pA);
        if(eff>bestEff){ bestEff=eff; bestP=pA; best=pl; }
      }
      // a lock still needs a real pot — don't burn a scarce Ace/8 to bank 1–2 scraps
      const lockFloor = someoneClose?1:3;
      if(best && (bestP<0.12 ? pot>=lockFloor : bestEff>=bankThresh)) return best;
    } else if(counting){
      // focused, imperfect memory: untracked ranks read as still-answerable, and lower
      // fidelity adds estimate noise — so a narrow/foggy counter misjudges some banks.
      const noiseAmp = mm.noise;
      let best=null,bestEff=-1,bestP=1;
      for(const pl of bankPlays){
        let pA=pAnswerOfBank(s,pi,situation([...pile,...pl]).kind, mm);
        pA=Math.min(1,Math.max(0, pA + (Math.random()*2-1)*noiseAmp));
        const eff=pot*(1-pA);
        if(eff>bestEff){ bestEff=eff; bestP=pA; best=pl; }
      }
      if(best && (bestP<0.12 ? pot>=1 : bestEff>=bankThresh)) return best;
    } else if(pot>=bankThresh){
      bankPlays.sort((a,b)=>a.length-b.length);
      return bankPlays[0];
    }
  }
  // 3) shed toward going out
  const hold=new Set();
  if(!outMode){                                         // racing out: hold nothing back
    if(prof.holdAces && !endgame) hold.add("A");
    if(prof.holdEights && !endgame) hold.add("6");
    if(prof.holdTwos && !endgame) hold.add("2");
  }
  const nonwild=plays.filter(pl=>!["2","6","A"].includes(pl[0].rank));
  let shedPool=nonwild.filter(pl=>!hold.has(pl[0].rank));
  if(!shedPool.length) shedPool=nonwild;
  if(shedPool.length){
    if(Math.random()<eps) return pick(shedPool);
    const opening=(S.kind==="openEmpty"||S.kind==="on2");
    if(outMode){
      // dump the most cards, clearing the lowest (hardest to replay) first while it's legal
      shedPool.sort((a,b)=> (b.length-a.length) || (VAL[a[0].rank]-VAL[b[0].rank]));
    } else if(opening){
      shedPool.sort((a,b)=> (VAL[a[0].rank]-VAL[b[0].rank]) || (b.length-a.length));
    } else if(prof.shedDrive>=0.75){
      shedPool.sort((a,b)=> (b.length-a.length) || (VAL[b[0].rank]-VAL[a[0].rank]));
    } else {
      shedPool.sort((a,b)=> (b.length-a.length) || (VAL[a[0].rank]-VAL[b[0].rank]));
    }
    return shedPool[0];
  }
  // no ordinary legal: spend a 2 to reset a clog
  const twos=plays.filter(pl=>pl[0].rank==="2");
  if(twos.length && (endgame || outMode || prof.dumpWilds || S.kind==="climb")){
    return twos.sort((a,b)=>b.length-a.length)[0];
  }
  // rusher (and anyone racing out): dump 8s as a harmless invert/plain8 —
  // but keep one 8 in reserve to steal/deny when a rival is about to go out
  if(prof.dumpWilds || outMode){
    const eightsInHand=p.hand.filter(c=>c.rank==="6").length;
    let wildShed=plays.filter(pl=>{
      const r=pl[0].rank; const res=legal(r,S);
      return (r==="6"&&(res==="invert"||res==="plain8")) || r==="2";
    });
    if(someoneClose && eightsInHand<=1) wildShed=wildShed.filter(pl=>pl[0].rank!=="6");
    if(wildShed.length){ wildShed.sort((a,b)=>b.length-a.length); return wildShed[0]; }
  }
  // only wilds legal — cheapest, sparing an Ace if possible
  const nonAce=plays.filter(pl=>pl[0].rank!=="A");
  if(nonAce.length){
    if(Math.random()<eps) return pick(nonAce);
    nonAce.sort((a,b)=> (playValue(a)-playValue(b)) || (a.length-b.length));
    return nonAce[0];
  }
  plays.sort((a,b)=>a.length-b.length);
  return plays[0];
}

/* answer a pending bank; returns array of one card, or null = pass */
function botChooseResponse(s, pi, prof){
  const p=s.players[pi]; const pile=s.pile; const S=situation(pile); const pot=potValue(pile);
  if(activeZone(p)==="faceDown") return null;
  const hand=p.hand;
  const eights=hand.filter(c=>c.rank==="6");
  const aces=hand.filter(c=>c.rank==="A");
  const twos=hand.filter(c=>c.rank==="2");
  const defuse=hand.filter(c=> legal(c.rank,S)==="ok" && !["2","6","A"].includes(c.rank));
  // deny harder when the banker is one card from going out (and the round-end bonus)
  const banker=s.pendingBanker;
  const bankerHand = banker!=null ? s.players[banker].hand.length : 99;
  const denyHard = prof.refined && bankerHand<=3;
  const stealPot = denyHard ? 1 : prof.respondStealPot;
  // steal with an 8 — denies the banker AND banks the pot for me
  if(eights.length && pot>=stealPot) return [eights[0]];
  // defuse with a low card — cancels the bank and sheds a dead card
  if(defuse.length){ defuse.sort((a,b)=>VAL[a.rank]-VAL[b.rank]); return [defuse[0]]; }
  // steal an Ace bank with an Ace
  if(aces.length && isBank(S) && pot>=(denyHard?1:prof.respondAcePot)) return [aces[0]];
  // spend a 2 to cancel a meaningful pot (pure denial)
  if(twos.length && pot>=(denyHard?1:prof.respondResetPot)) return [twos[0]];
  // last-ditch steal rather than gift a pot
  if(eights.length && pot>=prof.lastDitchStealPot) return [eights[0]];
  return null;   // pass — declining a bank is a legal strategic choice
}

/* =======================================================================
   STATE
   ===================================================================== */
function freshRound(scores, n, brains){
  const decks=decksFor(n);
  const deck=makeDeck(decks);
  const players=[];
  for(let i=0;i<n;i++) players.push({hand:deck.splice(0,handSize(n))});
  const royalCard = deck.length ? deck.pop() : null;   // bottom of stock, flipped face-up: the POTENTIAL royal suit
  return { mode:"play", n, brains:[...brains], decks, players, stock:deck, pile:[],
    scores:[...scores], roundScore:Array(n).fill(0), current:0, phase:"play",
    pendingBanker:null, lastBank:null, banked:Array.from({length:n},()=>[]),
    lastCardBy:Array(n).fill(null), royalSuit:null, royalCard, royalActivated:false, roundBreak:Array.from({length:n},()=>({})),
    stall:0, prevBanked:0, prevMinHand:handSize(n), prevStockLow:Infinity, discarded:[],
    roundStartedAt:null, roundEndedAt:null,
    log:["New round dealt. You open."] };
}
const SETUP = { mode:"setup", n:4, brains:["human","vault","gremlin","bolt"], counts:["human","vault","gremlin","bolt"].map(defaultMem) };

const clone=(s)=>{
  return {...s,
    players:s.players.map(p=>({hand:[...p.hand]})),
    stock:[...s.stock], pile:[...s.pile], scores:[...s.scores], roundScore:[...s.roundScore],
    banked:s.banked.map(b=>[...b]), lastCardBy:[...s.lastCardBy], brains:[...s.brains],
    roundBreak:s.roundBreak.map(r=>({...r})), log:[...s.log] };
};
const push=(log,l)=>[l,...log].slice(0,40);
const nxt=(s,i)=>(i+1)%s.n;
function replenish(s,pi){const p=s.players[pi];while(p.hand.length<handSize(s.n)&&s.stock.length)p.hand.push(s.stock.shift());}
function pull(p,zone,id){p[zone]=p[zone].filter(c=>c.id!==id);}
// human-facing card counts — the same signals the Apex/Counter read, surfaced so a person
// can learn to count too. Uses perfect recall: the bot's edge is its memory, not secret info.
function humanMetrics(s, seat){
  const total = 4*decksFor(s.n);
  const gone={}; RANKS.forEach(r=>gone[r]=0);
  s.banked.forEach(b=>b.forEach(c=>{ gone[c.rank]++; }));
  (s.discarded||[]).forEach(c=>{ gone[c.rank]++; });
  const suit={S:0,H:0,D:0,C:0};
  s.banked[seat].forEach(c=>{ suit[c.suit]=(suit[c.suit]||0)+1; });
  let crown=null,cmax=0; for(const su of SUITS){ if((suit[su]||0)>cmax){ cmax=suit[su]; crown=su; } }
  const next=nxt(s,seat), nextHand=s.players[next].hand.length;
  let shortestOpp=Infinity; for(let j=0;j<s.n;j++) if(j!==seat) shortestOpp=Math.min(shortestOpp,s.players[j].hand.length);
  const {unseen,U}=unseenInfo(s,seat,1);
  const S=situation(s.pile); let bankRead=null;
  if(isBank(S)){
    let c=0; answerRanksFor(S.kind).forEach(r=>c+=unseen[r]||0);
    bankRead={ c, U, p: pAtLeastOne(c, nextHand, U) };
  }
  const royalCard = s.royalCard || null;
  const myRoyalCardSuit = royalCard ? (suit[royalCard.suit]||0) : 0;   // how many of the POTENTIAL royal suit I've banked
  const handPenalty = scoreBank(s.players[seat].hand);                 // what my current hand would cost me right now
  return {total, gone, suit, crown, nextName:who(s,next), nextHand, shortestOpp, U, bankRead, royalCard, myRoyalCardSuit, handPenalty};
}
const who=(s,pi)=> pi===0 ? "You" : (s.brains[pi]==="human" ? `Player ${pi+1}` : PROFILES[s.brains[pi]].name);
// display identity for any seat — humans get their own glyph/colour so the table reads cleanly
const HUMAN_DISPLAY = { glyph:"☻", color:"var(--cyan)",
  blurb:"A person plays this seat on the same device — their hand stays hidden from everyone else until it's their turn." };
const seatProfile=(s,pi)=> s.brains[pi]==="human"
  ? { name:who(s,pi), role: pi===0?"you":"human", glyph:HUMAN_DISPLAY.glyph, color:HUMAN_DISPLAY.color }
  : PROFILES[s.brains[pi]];
// effective profile = base bot profile + any per-seat behaviour tuning the user dialed in
function effProfile(s,pi){
  const base=PROFILES[s.brains[pi]];
  if(!base) return base;
  const ov = s.tune ? s.tune[pi] : undefined;
  return ov ? {...base, ...ov} : base;
}

function doBank(s, banker){
  const pts=scoreBank(s.pile);
  s.roundScore[banker]+=pts; s.lastBank={by:banker,pts,n:s.pile.length};
  s.banked[banker].push(...s.pile);
  s.log=push(s.log,`★ ${who(s,banker)} BANK ${s.pile.length} cards · +${pts} pts.`);
  s.pile=[]; s.pendingBanker=null;
}
function checkOut(s,pi){
  const p=s.players[pi];
  if(!p.hand.length){                          // out = empty hand (no blind any more)
    s.phase="roundEnd"; s.roundEndedAt=Date.now();
    // ROYAL: the flipped potential-royal card claims the crown IF it could legally play on
    // the out-card; otherwise the out-card's own suit becomes royal. Decide this from the
    // out-card on top of the pile BEFORE any auto-bank clears it.
    const outCard = s.lastCardBy[pi] || null;
    const Sout = situation(s.pile);              // the out-card's situation, before any auto-bank
    const activated = !!(s.royalCard && legal(s.royalCard.rank, Sout)!=="no");
    const royal = activated ? s.royalCard.suit : (outCard ? outCard.suit : null);
    s.royalSuit = royal; s.royalActivated = activated;
    // a BANK as the final card (an Ace, or an 8 on a wild) banks the pile automatically — the
    // round is ending, so it's uncontested (nobody is left to answer).
    const bankOut = s.pile.length>0 && isBank(Sout);
    if(bankOut) doBank(s,pi);                     // banks the pile to the out-player
    s.roundBreak = Array.from({length:s.n},()=>({}));
    for(let j=0;j<s.n;j++){
      const royalCount = royal ? s.banked[j].filter(c=>c.suit===royal).length : 0;
      const royalPts = royalCount*1;
      const handPenalty = scoreBank(s.players[j].hand);   // cards left in hand subtract from your score
      s.roundScore[j] += royalPts - handPenalty;          // royal + hand penalty apply ONLY now
      s.roundBreak[j]={royalCount, royalPts, handPenalty, out: j===pi?OUT_BONUS:0};
    }
    s.roundScore[pi]+=OUT_BONUS;
    for(let j=0;j<s.n;j++) s.scores[j]+=s.roundScore[j];  // pts commit at round end
    s.log=push(s.log,`${who(s,pi)} OUT${bankOut?" — banks the pile":""} (+${OUT_BONUS}). Royal ${royal?SUIT_GLYPH[royal]:"—"}${activated?" \u2691":""}.`);
    return true;
  }
  return false;
}

/* settle the pile onto pendingBanker, advance turn helpers ─────────────── */
function afterPlayAdvance(s, pi){ if(!checkOut(s,pi)) s.current=nxt(s,pi); }

function playCards(s, pi, ids){
  if(s.phase!=="play"||pi!==s.current) return s;
  const p=s.players[pi];
  const cards=ids.map(id=>p.hand.find(c=>c.id===id)).filter(Boolean);
  if(!cards.length||cards.length!==ids.length) return s;
  const S=situation(s.pile);
  const res=comboLegal(cards,S);
  if(!res.ok) return s;
  const wasBank=isBank(S);
  for(const c of cards){ pull(p,"hand",c.id); s.pile.push(c); }
  if(s.roundStartedAt==null) s.roundStartedAt=Date.now();   // clock starts on the first card down
  s.lastCardBy[pi]=cards[cards.length-1];
  replenish(s,pi);
  const r=cards[0].rank;
  const what = res.type==="set" ? `a set of ${cards.length}×${r}` : label(cards[0]);

  if(topFour(s.pile)){                           // four-of-a-kind on top — uncontested bank
    s.log=push(s.log,`${who(s,pi)} completes FOUR ${r}s — BANK!`);
    doBank(s,pi);
    afterPlayAdvance(s,pi);
    return s;
  }
  const nowBank=isBank(situation(s.pile));
  if(r==="2"){                                   // reset / cancel
    s.pendingBanker=null;
    s.log=push(s.log,`${who(s,pi)} plays ${what}${wasBank?" — cancels the bank":""}.`);
  } else if(nowBank){
    const verb = wasBank ? "STEALS — bank pending" : "BANK pending";
    s.pendingBanker=pi;
    s.log=push(s.log,`${who(s,pi)} plays ${what} — ${verb}.`);
  } else {                                        // ordinary / defuse
    s.pendingBanker=null;
    s.log=push(s.log,`${who(s,pi)} plays ${what}${wasBank?" — defuses":""}.`);
  }
  afterPlayAdvance(s,pi);
  return s;
}

function passBank(s, pi){
  if(s.phase!=="play"||pi!==s.current) return s;
  if(s.pendingBanker===null || !isBank(situation(s.pile))) return s;
  const banker=s.pendingBanker;
  s.log=push(s.log,`${who(s,pi)} passes.`);
  doBank(s,banker);
  s.current=pi;                  // the passer opens the next pile
  return s;
}

function pickUp(s, pi){
  if(s.phase!=="play"||pi!==s.current) return s;
  if(isBank(situation(s.pile))) return s;
  if(!s.pile.length) return s;
  // you may pick up ONLY when you cannot play anything — never voluntarily
  if(legalPlaysFromHand(s.players[pi].hand, situation(s.pile)).length) return s;
  const p=s.players[pi]; const pile=s.pile;
  const c=Math.max(0, HAND_CAP - p.hand.length);   // room to fill your hand up to the cap
  const take=Math.min(c, pile.length);             // take the last c cards — or the whole pile if c >= m
  const took=pile.slice(pile.length-take);
  const sunk=pile.slice(0, pile.length-take);      // anything older is discarded out of play
  p.hand.push(...took);
  if(sunk.length) s.discarded=(s.discarded||[]).concat(sunk);
  s.pile=[]; s.pendingBanker=null;
  const tail = sunk.length ? ` · ${sunk.length} discarded` : "";
  s.log=push(s.log,`${who(s,pi)} can't play — takes ${took.length}${tail}.`);
  s.current=nxt(s,pi);
  return s;
}

/* wind-down terminator ──────────────────────────────────────────────────
   The pickup discard removes cards from play for good, so each round trends
   toward an end on its own (Monte-Carlo: ~0% stalls with no backstop). This
   wind-down stays only as cheap insurance for a pathological human game.
   We track real progress (a card banked, or a new global-minimum hand, or the
   stock draining to a new low); if a generous run of turns passes with none,
   the round ends and the shed-race leader (fewest cards) takes the bonus. */
function endStall(s){
  let pi=0; for(let j=1;j<s.n;j++) if(s.players[j].hand.length<s.players[pi].hand.length) pi=j;
  s.phase="roundEnd"; s.roundEndedAt=Date.now(); s.royalSuit=null; s.royalActivated=false;
  s.roundBreak=Array.from({length:s.n},()=>({}));
  for(let j=0;j<s.n;j++){
    const handPenalty = scoreBank(s.players[j].hand);
    s.roundScore[j]-=handPenalty;
    s.roundBreak[j]={royalCount:0, royalPts:0, handPenalty, out: j===pi?OUT_BONUS:0};
  }
  s.roundScore[pi]+=OUT_BONUS;
  for(let j=0;j<s.n;j++) s.scores[j]+=s.roundScore[j];
  s.log=push(s.log,`Round stalls — ${who(s,pi)} has the fewest cards (+${OUT_BONUS}).`);
}
function progress(s){
  if(s.phase!=="play") return;
  let minHand=Infinity, banked=0;
  for(let j=0;j<s.n;j++){ if(s.players[j].hand.length<minHand) minHand=s.players[j].hand.length; banked+=s.banked[j].length; }
  const stockLow=s.stock.length;
  // genuine progress: a card banked, someone reaches a new global-low hand, or the stock drains to a new low.
  // a deferred pickup (chancing) is none of these, so a true cycle still advances the clock.
  const adv = banked>s.prevBanked || minHand<s.prevMinHand || stockLow<s.prevStockLow;
  s.stall = adv ? 0 : s.stall+1;
  s.prevBanked = banked;
  if(minHand<s.prevMinHand) s.prevMinHand=minHand;
  if(stockLow<s.prevStockLow) s.prevStockLow=stockLow;
  if(s.stall > 24*s.n) endStall(s);
}

function reducer(state,a){
  if(a.type==="__SYNC__") return a.state;
  switch(a.type){
    case "SET_N":{
      const n=a.n; const brains=["human"];
      for(let i=1;i<n;i++) brains.push(BRAIN_ORDER[(i-1)%BRAIN_ORDER.length]);
      const counts=brains.map(defaultMem);
      return {...state, mode:"setup", n, brains, counts, tune:[]};
    }
    case "SET_BRAIN":{
      const brains=[...state.brains]; brains[a.seat]=a.key;
      const counts=[...(state.counts||[])]; counts[a.seat]=defaultMem(a.key);  // reset level to the new brain's default
      const tune=[...(state.tune||[])]; tune[a.seat]=undefined;                 // new brain → its own behaviour defaults
      return {...state, brains, counts, tune};
    }
    case "SET_TUNE":{
      const tune=[...(state.tune||[])]; tune[a.seat]={...(tune[a.seat]||{}), ...a.patch};
      return {...state, tune};
    }
    case "SET_COUNT":{
      const counts=[...(state.counts||[])]; const c=counts[a.seat];
      if(c && typeof c==="object") counts[a.seat]={...c, fid:a.mem};   // keep focus/breadth, change fidelity
      else counts[a.seat]=a.mem;                                       // plain level
      return {...state, counts};
    }
    case "SET_FOCUS":{
      const counts=[...(state.counts||[])]; counts[a.seat]={...countCfg(state,a.seat), focus:a.focus, suit:a.suit||countCfg(state,a.seat).suit};
      return {...state, counts};
    }
    case "SET_BREADTH":{
      const counts=[...(state.counts||[])]; counts[a.seat]={...countCfg(state,a.seat), n:a.n};
      return {...state, counts};
    }
    case "START": return {...freshRound(a.scores||Array(state.n).fill(0), state.n, state.brains), counts:[...(state.counts||[])], tune:[...(state.tune||[])]};
    case "RESUME": return {...freshRound(a.scores||Array(a.n).fill(0), a.n, a.brains), counts:a.brains.map(defaultMem), tune:[]};
    case "PLAY": {const s=playCards(clone(state),a.player,a.cardIds); progress(s); return s;}
    case "PASS_BANK": {const s=passBank(clone(state),a.player); progress(s); return s;}
    case "PICKUP": {const s=pickUp(clone(state),a.player); progress(s); return s;}
    case "NEW_ROUND": return {...freshRound(state.scores, state.n, state.brains), counts:[...(state.counts||[])]};
    case "TO_SETUP": return {...SETUP, n:state.n, brains:state.brains, counts:[...(state.counts||[])]};
    default: return state;
  }
}

function botAction(s){
  const pi=s.current; const prof=effProfile(s,pi); const p=s.players[pi];
  if(s.pendingBanker!==null && s.pendingBanker!==pi && isBank(situation(s.pile))){
    const ans=botChooseResponse(s,pi,prof);
    return ans ? {type:"PLAY",player:pi,cardIds:ans.map(c=>c.id)} : {type:"PASS_BANK",player:pi};
  }
  if(activeZone(p)==="faceDown") return {type:"PICKUP",player:pi};
  const play=botChoosePlayCards(s,pi,prof);
  if(!play) return {type:"PICKUP",player:pi};
  if(prof.apex && play.length===p.hand.length && play.length>1){
    // a same-rank out-set: the royalCard activates (or not) by rank, independent of which suit
    // is last. If it WON'T activate, the out-card's suit is royal — end on my best-banked suit.
    const activates = !!(s.royalCard && legal(s.royalCard.rank, situation([...s.pile, ...play]))!=="no");
    if(!activates){
      const rt=royalTarget(s,pi);
      play.sort((a,b)=>(a.suit===rt.suit?1:0)-(b.suit===rt.suit?1:0));
    }
  }
  return {type:"PLAY",player:pi,cardIds:play.map(c=>c.id)};
}

/* =======================================================================
   UI THEME (extends the felt-and-brass table)
   ===================================================================== */
const C={ feltA:"var(--bg)", feltB:"var(--bg)", felt:"var(--bg)",
  rail:"var(--bg)", railHi:"var(--bg)",
  gold:"var(--purple)", goldHi:"var(--purple)", brass:"var(--line)",
  cream:"var(--ink)", dim:"var(--dim)", card:"var(--card)", cardEdge:"var(--cardline)",
  ink:"var(--fillink)", red:"var(--red)", panel:"transparent" };
const btn=(kind="gold",small)=>{
  const base={borderRadius:0,fontWeight:700,padding:small?"5px 11px":"7px 13px",cursor:"pointer",
    fontSize:small?10.5:11,fontFamily:"var(--mono)",letterSpacing:".09em",textTransform:"uppercase",
    border:"1px solid var(--line)",background:"transparent",color:"var(--ink)"};
  if(kind==="gold") return {...base,background:"var(--green)",color:"var(--playink)",border:"1px solid var(--green)"};
  if(kind==="red")  return {...base,color:"var(--red)",border:"1px solid var(--red)"};
  return {...base,color:"var(--dim)"};   // felt / dark → ghost
};
const lbl={fontSize:9,letterSpacing:".18em",textTransform:"uppercase",color:"var(--dim)",fontWeight:700,fontFamily:"var(--mono)"};

const IDXSUIT=new Set(["J","Q","K","A"]);
const PIPS={
  "2":[[50,27],[50,73]],
  "3":[[50,27],[50,50],[50,73]],
  "4":[[34,27],[66,27],[34,73],[66,73]],
  "5":[[34,27],[66,27],[50,50],[34,73],[66,73]],
  "6":[[34,27],[66,27],[34,50],[66,50],[34,73],[66,73]],
  "7":[[34,27],[66,27],[50,38.5],[34,50],[66,50],[34,73],[66,73]],
  "8":[[34,27],[66,27],[50,38.5],[34,50],[66,50],[50,61.5],[34,73],[66,73]],
  "9":[[34,26],[66,26],[34,42],[66,42],[50,50],[34,58],[66,58],[34,74],[66,74]],
  "10":[[34,26],[66,26],[50,34],[34,42],[66,42],[34,58],[66,58],[50,66],[34,74],[66,74]],
};
const suitClass=su=>su==="S"?"s-sp":su==="H"?"s-he":su==="D"?"s-di":"s-cl";
const Corner=({rank,glyph,pos})=>(
  <div className={"idx "+pos}><span className="ir">{rank}</span>{glyph!=null&&<span className="is">{glyph}</span>}</div>
);
function Card({c,faceDown,onClick,disabled,selected,small}){
  if(faceDown) return <div onClick={onClick} className={"bhback"+(small?" sm":"")} style={{cursor:onClick?"pointer":"default"}}/>;
  const g=SUIT_GLYPH[c.suit];
  const wild=(c.rank==="2"||c.rank==="6"||c.rank==="A");
  const cls=["bhcard",suitClass(c.suit),small?"sm":"",selected?"sel":"",wild?"wild":"",
    (onClick&&!disabled)?"clk":"",disabled?"dis":""].filter(Boolean).join(" ");
  const idxGlyph=IDXSUIT.has(c.rank)?g:null;
  let center;
  if(c.rank==="A") center=<div className="mid ac">{g}</div>;
  else if(c.rank==="J"||c.rank==="Q"||c.rank==="K") center=<div className="mid fc">{c.rank}</div>;
  else center=<div className="ctr">{(PIPS[c.rank]||[]).map(([x,y],i)=>(
    <span key={i} className={"pip"+(y>50?" flip":"")} style={{left:x+"%",top:y+"%"}}>{g}</span>))}</div>;
  return <div onClick={disabled?undefined:onClick} className={cls}>
    <Corner rank={c.rank} glyph={idxGlyph} pos="tl"/>
    <Corner rank={c.rank} glyph={idxGlyph} pos="br"/>
    {center}
  </div>;
}
const Empty=({small})=><div className={"bhcard"+(small?" sm":"")} style={{background:"transparent",border:"1px dashed var(--line)"}}/>;

function OpponentStrip({s,pi,seatNames}){
  const prof=seatProfile(s,pi); const p=s.players[pi];
  const isHuman=s.brains[pi]==="human";
  const active=s.current===pi && s.phase==="play";
  const answering = active && s.pendingBanker!==null && s.pendingBanker!==pi && isBank(situation(s.pile));
  return (
    <div className={"opp"+(active?" act":"")} style={{"--accent":prof.color}}>
      <div className="top">
        <span className="gl">{prof.glyph}</span>
        <span className="nm" style={active?{color:"var(--accent)"}:undefined}>{nameOf(s,pi,seatNames)}</span>
      </div>
      <div className="meta">
        <div><span className="lbl2">hand</span><span className="v num">{p.hand.length}</span></div>
        <div><span className="lbl2">bank</span><span className="v num">{scoreBank(s.banked[pi])}</span></div>
        <div><span className="lbl2">pts</span><span className="v num">{s.scores[pi]}</span></div>
      </div>
      <div className="st">{active ? (isHuman?"their turn":answering?"answering…":"thinking…") : "\u00a0"}</div>
    </div>
  );
}

function RevealGate({s,seat,onReveal,seatNames}){
  return (
    <div style={{padding:"22px 14px",borderRadius:14,textAlign:"center",
      border:`2px solid ${HUMAN_DISPLAY.color}`,background:"transparent"}}>
      <div style={{fontSize:12.5,color:C.dim,marginBottom:4,fontFamily:"Georgia,serif"}}>pass the device to</div>
      <div style={{fontWeight:800,fontSize:21,color:HUMAN_DISPLAY.color,letterSpacing:1,marginBottom:2}}>{nameOf(s,seat,seatNames)}</div>
      <div style={{fontSize:11,color:C.dim,marginBottom:14}}>everyone else's hand stays hidden — tap when you're ready</div>
      <button style={btn("gold")} onClick={onReveal}>{HUMAN_DISPLAY.glyph} reveal my hand</button>
    </div>
  );
}

/* the card-counting panel: surfaces the Apex's decision signals so a person can learn to
   count too. `focus` (set when Help is pressed) highlights the signal behind the move. */
function CountsPanel({s, seat, focus}){
  const m = humanMetrics(s, seat);
  const hl = (k)=>({
    padding:"6px 8px", marginTop:6,
    border:"1px solid "+(focus===k?"var(--purple)":"var(--line)"),
    background: focus===k?"var(--selbg)":"transparent",
    boxShadow: focus===k?"0 0 0 1px var(--purple)":"none",
  });
  const WILD=[["2","resets — fewer left, fewer answers to your banks"],["6","banks on a wild · steals a bank"],["A","the bank card"]];
  const bar=(n,tot)=>{ const a=[]; for(let i=0;i<tot;i++) a.push(i<n); return a; };
  return (
    <div style={{marginTop:8, fontFamily:"var(--mono)"}}>
      <div className="lbl2" style={{opacity:.7,marginBottom:1}}>counts · what the Apex reads</div>

      <div style={hl("answers")}>
        <div className="lbl2" style={{marginBottom:4}}>answer cards out of play</div>
        {WILD.map(([r,desc])=>(
          <div key={r} style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
            <span style={{width:10,fontWeight:800,color:"var(--ink)",fontSize:12}}>{r}</span>
            <span style={{display:"inline-flex",gap:2}}>
              {bar(m.gone[r],m.total).map((on,i)=>(
                <span key={i} style={{width:7,height:11,background:on?"var(--pink)":"var(--line2)"}}/>
              ))}
            </span>
            <span style={{fontSize:10,color:"var(--ink)",minWidth:42}}>{m.gone[r]}/{m.total} gone</span>
            <span style={{fontSize:9,color:"var(--dim)"}}>{desc}</span>
          </div>
        ))}
      </div>

      <div style={hl("bankread")}>
        {m.bankRead ? (
          <div style={{fontSize:11,color:"var(--ink)",lineHeight:1.4}}>
            <b>{m.bankRead.c}</b> of {m.bankRead.U} unseen cards can beat the bank on the table — only <b>{m.nextName}</b> ({m.nextHand} cards) can answer, ≈ <b>{Math.round(m.bankRead.p*100)}%</b> to hold one.
          </div>
        ) : (
          <div style={{fontSize:11,color:"var(--dim)",lineHeight:1.4}}>only the <b style={{color:"var(--ink)"}}>next</b> player can answer a bank you make — bank when few answers are left and their hand is small.</div>
        )}
      </div>

      <div style={hl("suits")}>
        <div className="lbl2" style={{marginBottom:3}}>royal suit · your banked cards</div>
        {m.royalCard && <div style={{fontSize:10,color:"var(--ink)",marginBottom:3}}>
          potential royal: <b style={{color:SUIT_COLOR[m.royalCard.suit]}}>{m.royalCard.rank}{SUIT_GLYPH[m.royalCard.suit]}</b>
          {" "}— you've banked <b>{m.myRoyalCardSuit}</b> {SUIT_GLYPH[m.royalCard.suit]}</div>}
        <div style={{display:"flex",gap:12}}>
          {SUITS.map(su=>(
            <span key={su} style={{fontSize:13,fontWeight:su===m.crown?800:500,color:SUIT_COLOR[su],opacity:su===m.crown?1:.6}}>
              {SUIT_GLYPH[su]} {m.suit[su]||0}{su===m.crown&&m.suit[su]>0?" \u265B":""}
            </span>
          ))}
        </div>
        <div style={{fontSize:9,color:"var(--dim)",marginTop:2}}>
          {m.royalCard
            ? <>go out on a card the <b>{m.royalCard.rank}{SUIT_GLYPH[m.royalCard.suit]}</b> can follow to crown {SUIT_GLYPH[m.royalCard.suit]}; otherwise your out-card's suit is royal.</>
            : "the out-card's suit becomes royal."}
        </div>
      </div>

      <div style={hl("hand")}>
        <div style={{fontSize:10,color:"var(--dim)"}}>cards left in hand cost you points at round end — yours would cost <b style={{color:"var(--ink)"}}>−{m.handPenalty}</b> right now. Empty your hand.</div>
      </div>

      <div style={hl("table")}>
        <div style={{fontSize:10,color:"var(--dim)"}}>next after you: <b style={{color:"var(--ink)"}}>{m.nextName}</b> ({m.nextHand}) · shortest rival {m.shortestOpp}{m.shortestOpp<=3?" — someone may go out soon":""}</div>
      </div>
    </div>
  );
}
function HumanSide({s,seat,sel,setSel,dispatch,handSort,setHandSort,seatNames}){
  const p=s.players[seat];
  const active=s.current===seat && s.phase==="play";
  const zone=activeZone(p);
  const S=situation(s.pile);
  const bankPending = s.pendingBanker!==null && s.pendingBanker!==seat && isBank(S);
  const hasPlay = active && !bankPending && legalPlaysFromHand(p.hand, S).length>0;
  const selCards = sel.map(id=>p[zone]?.find?.(c=>c.id===id)).filter(Boolean);
  const combo = selCards.length ? comboLegal(selCards,S) : {ok:false,type:"single"};
  const playable = active && selCards.length>0 && combo.ok;
  const toggle=(id)=>setSel(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  const act=(a)=>{ dispatch(a); setSel([]); };
  // ── "ask the Counter": run the expert bot on this exact spot and surface its move ──
  const [hint,setHint]=React.useState(null);
  const [showCounts,setShowCounts]=React.useState(false);
  React.useEffect(()=>{ setHint(null); },[s.current,s.phase,s.pile.length,seat]);
  const askCounter=()=>{
    // run the strongest bot (Apex) on this exact spot and surface its move + the signal behind it
    const hs={...s, brains:[...s.brains], counts:[...(s.counts||[])],
      players:s.players.map((pl,i)=> i===seat?{...pl,hand:[...pl.hand]}:pl)};
    hs.brains[seat]="apex"; hs.counts[seat]=1.0;
    let a; try{ a=botAction(hs); }catch(_){ a=null; }
    if(!a){ setHint({text:"No suggestion.",focus:null}); return; }
    const cards=(a.cardIds||[]).map(id=>p.hand.find(c=>c.id===id)).filter(Boolean);
    const names=cards.map(label).join(" + ");
    if(a.type==="PASS_BANK"){ setSel([]); setHint({text:"Pass",focus:"bankread"}); return; }
    if(a.type==="PICKUP"){ setSel([]); setHint({text:"Take the last 6",focus:null}); return; }
    setSel(a.cardIds||[]);
    if(bankPending){ setHint({text:`Answer ${names}`,focus:"bankread"}); return; }
    const res=situation([...s.pile,...cards]);
    const focus = isBank(res) ? "answers" : (cards.length===p.hand.length ? "suits" : null);
    setHint({text:`${isBank(res)?"Bank":"Play"} ${names}`,focus});
  };
  const name = (cleanInitials((seatNames&&seatNames[seat])||"") || (seat===0 ? "YOU" : who(s,seat))).toUpperCase();
  const shown = sortHand(p.hand, handSort);
  const playLabel = selCards.length===0 ? "select a card"
    : combo.type==="set"&&selCards.length>=4 ? `bank ${selCards.length}×${selCards[0].rank}`
    : combo.type==="set"&&selCards.length>1 ? `play ${selCards.length}×${selCards[0].rank}`
    : combo.type==="invalid" ? "not a set"
    : `play ${label(selCards[0])}`;
  return (
    <>
      <div className="you">
        <span className="me">{name}{active&&<span className="turn"> · your turn</span>}</span>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span className="lbl2 num">total {s.scores[seat]} · +{s.roundScore[seat]}</span>
          <div className="sort">
            {["rank","suit","dealt"].map(m=>(
              <button key={m} className={handSort===m?"on":""} onClick={()=>setHandSort(m)}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="hand">
        {shown.length? shown.map(c=><Card key={c.id} c={c} selected={sel.includes(c.id)}
            onClick={active?()=>toggle(c.id):undefined}/>)
          : <span style={{color:"var(--dim)",fontSize:12,alignSelf:"center"}}>hand empty</span>}
      </div>

      <div className="acts">
        {active ? (
          <>
            <button className="btn primary" disabled={!playable}
              onClick={()=>playable&&act({type:"PLAY",player:seat,cardIds:sel})}>{playLabel}</button>
            {selCards.length>0 && <button className="btn ghost" onClick={()=>setSel([])}>clear</button>}
            {bankPending && <button className="btn danger" onClick={()=>act({type:"PASS_BANK",player:seat})}>pass</button>}
            {!bankPending && !hasPlay && s.pile.length>0 && <button className="btn danger" onClick={()=>act({type:"PICKUP",player:seat})}>pick up</button>}
          </>
        ) : <span style={{fontSize:11,color:"var(--dim)"}}>waiting for your turn…</span>}
      </div>

      <div className="hintline">
        {active && <>
          <button className={"tag"+(showCounts?" on":"")} onClick={()=>setShowCounts(v=>!v)}>Card Counting</button>
          <button className="tag" onClick={askCounter}>help</button>
          {hint && <span className="htxt">{hint.text}</span>}
        </>}
      </div>

      {showCounts && <CountsPanel s={s} seat={seat} focus={hint&&hint.focus}/>}
    </>
  );
}

/* =======================================================================
   SETUP SCREEN
   ===================================================================== */
function Setup({s,dispatch,seatNames,setSeatNames,target,setTarget,profiles,onShowStats,onShowRules,campaign,onResume,onDiscard}){
  const Seg=({val,opts,onPick})=>(
    <div style={{display:"inline-flex",borderRadius:9,overflow:"hidden",border:`1px solid ${C.brass}`}}>
      {opts.map(o=>(
        <button key={o.v} onClick={()=>onPick(o.v)}
          style={{padding:"7px 16px",fontFamily:"Georgia,serif",fontWeight:800,fontSize:13,cursor:"pointer",
            border:"none",borderRight:`1px solid ${C.brass}`,
            background:val===o.v?`linear-gradient(180deg,${C.goldHi},${C.gold})`:"transparent",
            color:val===o.v?"#3a2a05":C.cream}}>{o.l}</button>
      ))}
    </div>
  );
  const initialsField=(seat)=>{
    const v=seatNames[seat]||""; const known=profiles[cleanInitials(v)];
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:7}}>
        <span style={{...lbl,fontSize:9,color:C.dim}}>initials</span>
        <input value={v} maxLength={3} placeholder="—"
          onChange={(e)=>{ const a=[...seatNames]; a[seat]=cleanInitials(e.target.value); setSeatNames(a); }}
          style={{width:56,padding:"5px 8px",textAlign:"center",letterSpacing:2,textTransform:"uppercase",
            fontWeight:800,fontSize:14,background:"var(--bg)",color:"var(--ink)",border:"1px solid var(--line)",borderRadius:7,fontFamily:"var(--mono)"}}/>
        {known
          ? <span style={{fontSize:9.5,color:C.cyan}}>↩ {(known.total||0)>0?`resuming at ${known.total}`:"loaded"} · {known.wins}W / {known.games}G · best {known.best}</span>
          : (cleanInitials(v) ? <span style={{fontSize:9.5,color:C.dim}}>new profile — tracks from here</span> : <span style={{fontSize:9.5,color:C.dim,fontStyle:"italic"}}>optional · for score tracking</span>)}
      </div>
    );
  };
  return (
    <div style={{maxWidth:620,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:30,letterSpacing:7,color:C.goldHi,textShadow:"0 2px 4px #000"}}>BANKHEAD</div>
        <div style={{fontSize:12.5,color:C.dim,fontStyle:"italic",letterSpacing:.5,marginTop:2}}>
          press your luck · bank the pile · race your hand to empty</div>
      </div>

      {campaign && (()=>{
        const cs=campaign.scores||[]; const lead=cs.indexOf(Math.max(...cs));
        return (
        <div style={{marginBottom:14,padding:"12px 14px",borderRadius:14,
          border:`1px solid ${C.cyan}`,background:`${C.cyan}14`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{...lbl,fontSize:10,color:C.cyan}}>paused game</span>
            <span style={{fontSize:10,color:C.dim}}>{campaign.n}-player{campaign.target>0?` · to ${campaign.target}`:" · freeplay"}</span>
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:11}}>
            {Array.from({length:campaign.n}).map((_,j)=>{
              const bk=campaign.brains[j]; const isH=bk==="human";
              const label=isH?(cleanInitials(campaign.names?.[j]||"")||`P${j+1}`):PROFILES[bk]?.name||"bot";
              const glyph=isH?HUMAN_DISPLAY.glyph:PROFILES[bk]?.glyph; const col=isH?HUMAN_DISPLAY.color:PROFILES[bk]?.color;
              return (
              <div key={j} style={{minWidth:54}}>
                <div style={{fontSize:11,color:C.cream,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:col}}>{glyph}</span>{label}</div>
                <div style={{fontSize:18,fontWeight:800,color:j===lead?C.goldHi:C.cream}}>{cs[j]}</div>
              </div>);})}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <button style={{...btn("gold"),padding:"8px 16px",fontSize:13}} onClick={onResume}>▸ resume</button>
            <button className="tag" onClick={onDiscard}>discard</button>
            <span style={{fontSize:9.5,color:C.dim,fontStyle:"italic"}}>or set up a new table below</span>
          </div>
        </div>);
      })()}

      <div style={{display:"flex",flexDirection:"column",gap:14,padding:"16px 16px 18px",borderRadius:16,
        background:"transparent",border:`1px solid var(--line)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <span style={{...lbl,fontSize:11}}>players</span>
          <Seg val={s.n} opts={[{v:2,l:"2"},{v:3,l:"3"},{v:4,l:"4"}]} onPick={(n)=>dispatch({type:"SET_N",n})}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <span style={{...lbl,fontSize:11}}>play to</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>{target>0?"first past the post wins":"freeplay — no tracking"}</span>
            <Seg val={target} opts={[{v:50,l:"50"},{v:100,l:"100"},{v:150,l:"150"},{v:0,l:"\u221E"}]} onPick={(t)=>setTarget(t)}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <span style={{...lbl,fontSize:11}}>decks</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:10.5,color:C.dim,fontStyle:"italic"}}>
              {s.n>=3 ? "two decks keep the wilds flowing for 3–4" : "a duel runs lean on one"}</span>
            <span style={{padding:"7px 16px",borderRadius:9,border:`1px solid ${C.brass}`,
              background:`linear-gradient(180deg,${C.goldHi},${C.gold})`,color:"#3a2a05",
              fontFamily:"Georgia,serif",fontWeight:800,fontSize:13}}>
              {decksFor(s.n)} deck{decksFor(s.n)>1?"s":""}</span>
          </div>
        </div>

        <div style={{height:1,background:`linear-gradient(90deg,transparent,${C.brass},transparent)`,margin:"2px 0"}}/>

        <div style={{...lbl,fontSize:11}}>the seats — choose who sits where</div>

        {/* seat 1 is always you */}
        <div style={{padding:"9px 11px",borderRadius:11,
          border:`2px solid ${HUMAN_DISPLAY.color}`,background:`${HUMAN_DISPLAY.color}1f`}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={{color:HUMAN_DISPLAY.color,fontSize:17}}>{HUMAN_DISPLAY.glyph}</span>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontWeight:800,fontSize:13,color:C.cream}}>Seat 1 — You</div>
              <div style={{fontSize:10.5,color:C.dim}}>the human at the controls</div>
            </div>
            <span style={{...lbl,fontSize:8.5,color:HUMAN_DISPLAY.color,marginLeft:"auto"}}>human</span>
          </div>
          {initialsField(0)}
        </div>

        {s.brains.slice(1).map((bk,i)=>{
          const seat=i+1;
          return (
            <div key={seat} style={{padding:"9px 10px 11px",borderRadius:13,
              background:"var(--line2)",border:"1px solid var(--line)"}}>
              <div style={{...lbl,fontSize:10,color:C.goldHi,marginBottom:7}}>Seat {seat+1}</div>
              {(()=>{
                const pr = bk==="human"
                  ? {name:"You",role:"hot-seat",glyph:HUMAN_DISPLAY.glyph,color:HUMAN_DISPLAY.color,blurb:HUMAN_DISPLAY.blurb,diff:0}
                  : PROFILES[bk];
                const byTier={}; ALL_BRAINS.forEach(k=>{const d=PROFILES[k].diff;(byTier[d]=byTier[d]||[]).push(k);});
                return (
                  <>
                    <select value={bk} onChange={(e)=>dispatch({type:"SET_BRAIN",seat,key:e.target.value})}
                      style={{width:"100%",padding:"9px 11px",borderRadius:10,cursor:"pointer",
                        background:"var(--bg)",color:"var(--ink)",border:`1px solid ${pr.color}88`,
                        fontFamily:"Georgia,serif",fontWeight:700,fontSize:13}}>
                      <option value="human" style={{background:"var(--bg)",color:"var(--ink)"}}>You — hot-seat human</option>
                      {[5,4,3,2,1].map(d=>(
                        <optgroup key={d} label={DIFF_LABEL[d]+" \u00b7 "+"\u2605".repeat(d)} style={{background:"var(--bg)",color:"var(--ink)"}}>
                          {(byTier[d]||[]).map(k=>(
                            <option key={k} value={k} style={{background:"var(--bg)",color:"var(--ink)"}}>{PROFILES[k].glyph+"  "+PROFILES[k].name+" — "+PROFILES[k].role}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div style={{display:"flex",alignItems:"flex-start",gap:9,marginTop:9,padding:"9px 11px",borderRadius:11,
                      border:`1px solid ${pr.color}44`,background:`${pr.color}14`}}>
                      <span style={{color:pr.color,fontSize:20,lineHeight:1}}>{pr.glyph}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <span style={{fontFamily:"Georgia,serif",fontWeight:800,fontSize:14,color:C.cream}}>{pr.name}</span>
                          <span style={{...lbl,fontSize:8.5,color:pr.color,marginLeft:"auto"}}>{pr.role}</span>
                        </div>
                        <div style={{fontSize:10.5,color:C.dim,lineHeight:1.35,marginTop:3}}>{pr.blurb}</div>
                        {pr.diff>0 && (
                          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                            <span style={{...lbl,fontSize:8,color:C.dim}}>difficulty</span>
                            <div style={{display:"flex",gap:2}}>
                              {[1,2,3,4,5].map(nn=>(
                                <span key={nn} style={{width:14,height:5,borderRadius:2,
                                  background:nn<=pr.diff?pr.color:"var(--line)"}}/>
                              ))}
                            </div>
                            <span style={{...lbl,fontSize:8,color:pr.color}}>{DIFF_LABEL[pr.diff]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
              {(()=>{
                const isHuman = bk==="human";
                if(isHuman) return (
                  <div style={{marginTop:9,paddingTop:8,borderTop:"1px solid var(--line2)"}}>
                    {initialsField(seat)}
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                      <span style={{...lbl,fontSize:9,color:C.dim}}>card counting</span>
                      <span style={{fontSize:9,color:C.dim,fontStyle:"italic"}}>you count in your own head</span>
                    </div>
                  </div>
                );
                const cfg = countCfg(s, seat);
                const cur = cfg.fid;
                const curKey = memToTier(cur).key;
                const FOCI = [["wilds","Wilds"],["low","Low"],["face","Face"],["suit","Suit"]];
                const SUITS = ["\u2660","\u2665","\u2666","\u2663"];
                const setBreadth=(d)=>dispatch({type:"SET_BREADTH",seat,n:Math.max(1,Math.min(13,cfg.n+d))});
                return (
                  <div style={{marginTop:9,paddingTop:8,borderTop:"1px solid var(--line2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{...lbl,fontSize:9,color:C.dim}}>memory</span>
                      <span style={{fontSize:9,color:C.dim,fontStyle:"italic"}}>how sharply it recalls spent wilds — foggier memory misjudges banks</span>
                    </div>
                    <div style={{display:"inline-flex",borderRadius:8,overflow:"hidden",border:"1px solid var(--line)"}}>
                      {COUNT_TIERS.map(t=>{
                        const on=t.key===curKey;
                        return (
                          <button key={t.key} onClick={()=>dispatch({type:"SET_COUNT",seat,mem:t.mem})}
                            style={{padding:"4px 11px",cursor:"pointer",border:"none",borderRight:"1px solid var(--line2)",
                              fontFamily:"Georgia,serif",fontWeight:800,fontSize:10,letterSpacing:.3,
                              background:on?"var(--purple)":"transparent",
                              color:on?"var(--fillink)":C.dim}}>{t.label}</button>
                        );
                      })}
                    </div>
                    {cur>0 && (
                      <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{...lbl,fontSize:9,color:C.dim}}>tracks</span>
                        <div style={{display:"inline-flex",borderRadius:8,overflow:"hidden",border:"1px solid var(--line)"}}>
                          {FOCI.map(([k,label])=>{
                            const on=cfg.focus===k;
                            return (
                              <button key={k} onClick={()=>dispatch({type:"SET_FOCUS",seat,focus:k})}
                                style={{padding:"4px 9px",cursor:"pointer",border:"none",borderRight:"1px solid var(--line2)",
                                  fontFamily:"Georgia,serif",fontWeight:800,fontSize:10,letterSpacing:.3,
                                  background:on?"var(--purple)":"transparent",color:on?"var(--fillink)":C.dim}}>{label}</button>
                            );
                          })}
                        </div>
                        {cfg.focus==="suit" ? (
                          <div style={{display:"inline-flex",gap:3}}>
                            {SUITS.map(su=>{
                              const on=(cfg.suit||"\u2660")===su; const red=su==="\u2665"||su==="\u2666";
                              return (
                                <button key={su} onClick={()=>dispatch({type:"SET_FOCUS",seat,focus:"suit",suit:su})}
                                  style={{width:22,height:22,cursor:"pointer",borderRadius:6,
                                    border:on?"1px solid var(--purple)":"1px solid var(--line)",
                                    background:on?"var(--selbg)":"transparent",
                                    color:red?"var(--he)":"var(--ink)",fontSize:12,lineHeight:1}}>{su}</button>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
                            <button onClick={()=>setBreadth(-1)} style={{width:20,height:20,cursor:"pointer",borderRadius:6,
                              border:"1px solid var(--line)",background:"transparent",color:C.dim,fontSize:13,lineHeight:1}}>−</button>
                            <span style={{fontSize:10,color:"var(--ink)",minWidth:48,textAlign:"center",fontStyle:"italic"}}>{cfg.n} {cfg.n===1?"rank":"ranks"}</span>
                            <button onClick={()=>setBreadth(1)} style={{width:20,height:20,cursor:"pointer",borderRadius:6,
                              border:"1px solid var(--line)",background:"transparent",color:C.dim,fontSize:13,lineHeight:1}}>+</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              {(()=>{
                if(bk==="human") return null;
                const eff=effProfile(s,seat);
                const bp=eff.bankMinPot;
                const style = eff.shedDrive>=0.75?"rusher":(eff.holdAces&&eff.shedDrive<=0.3?"banker":"balanced");
                const STYLE=[["banker","Banker",{shedDrive:0.22,holdAces:true,holdEights:true,holdTwos:true,dumpWilds:false}],
                             ["balanced","Balanced",{shedDrive:0.5,holdAces:true,holdEights:true,holdTwos:true,dumpWilds:false}],
                             ["rusher","Rusher",{shedDrive:1.0,holdAces:false,holdEights:false,holdTwos:false,dumpWilds:true}]];
                const seg=(cur,opts)=>(
                  <div style={{display:"inline-flex",borderRadius:8,overflow:"hidden",border:"1px solid var(--line)"}}>
                    {opts.map(([k,lab,patch])=>(
                      <button key={k} onClick={()=>dispatch({type:"SET_TUNE",seat,patch})}
                        style={{padding:"4px 9px",cursor:"pointer",border:"none",borderRight:"1px solid var(--line2)",
                          fontFamily:"Georgia,serif",fontWeight:800,fontSize:10,letterSpacing:.3,
                          background:cur===k?"var(--purple)":"transparent",color:cur===k?"var(--fillink)":C.dim}}>{lab}</button>
                    ))}
                  </div>
                );
                const stepBtn={width:20,height:20,cursor:"pointer",borderRadius:6,border:"1px solid var(--line)",
                  background:"transparent",color:C.dim,fontSize:13,lineHeight:1};
                return (
                  <div style={{marginTop:9,paddingTop:8,borderTop:"1px solid var(--line2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{...lbl,fontSize:9,color:C.dim}}>behaviour</span>
                      <span style={{fontSize:9,color:C.dim,fontStyle:"italic"}}>how it weighs banking, racing out, and risk</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{...lbl,fontSize:9,color:C.dim}}>banks at pot ≥</span>
                        <button onClick={()=>dispatch({type:"SET_TUNE",seat,patch:{bankMinPot:Math.max(2,bp-1)}})} style={stepBtn}>−</button>
                        <span style={{fontSize:11,color:"var(--ink)",minWidth:14,textAlign:"center",fontWeight:700}}>{bp}</span>
                        <button onClick={()=>dispatch({type:"SET_TUNE",seat,patch:{bankMinPot:Math.min(9,bp+1)}})} style={stepBtn}>+</button>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{...lbl,fontSize:9,color:C.dim}}>style</span>{seg(style,STYLE)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}

        <div style={{fontSize:10.5,color:C.dim,fontStyle:"italic",lineHeight:1.5,marginTop:2}}>
          The core trio, strongest first: <b style={{color:PROFILES.gremlin.color}}>Gremlin</b> steals and cancels your
          banks, <b style={{color:PROFILES.vault.color}}>Vault</b> out-banks a passive table, and
          <b style={{color:PROFILES.bolt.color}}> Bolt</b> sheds out fast for the bonus. Then the specialists —
          the <b style={{color:PROFILES.counter.color}}>Counter</b> tracks every spent wild and banks the moment you can't
          answer, and the <b style={{color:PROFILES.shark.color}}>Shark</b> counts <i>and</i> learns your habits the longer you sit. The <b style={{color:PROFILES.apex.color}}>Apex</b> counts just as hard but plays patient — it won't spend a wild on scraps, and it angles the royal suit its way on the way out.
          Give <i>any</i> seat <b style={{color:"var(--ink)"}}>card-counting memory</b> — set its <i>fidelity</i> (Foggy→Perfect), <i>focus</i> (wilds, low cards, faces, or a single suit), and how many <i>ranks</i> it can hold at once. Wilds carry the signal, so a narrow wild-watcher is sharp but overconfident; a broad memory is disciplined. The <b style={{color:PROFILES.shark.color}}>Shark</b> retunes its own focus and breadth to how you play. Each bot also takes a <b style={{color:"var(--ink)"}}>behaviour</b> pass — how fat a pile before it banks, and whether it hoards wilds for big banks or races to empty its hand (<i>style</i>).
          Can't play at all? <b style={{color:"var(--ink)"}}>Take the last 6 cards</b> of the pile into your hand — the rest is discarded out of the game (you can never pick up by choice). Cards score 1·2·3 (face/ten 2, ace 3). No score cap: stop whenever you like.
        </div>

        <button style={{...btn("gold"),marginTop:4,fontSize:15,padding:"11px 14px"}} onClick={()=>{
          const init=Array(s.n).fill(0);
          for(let j=0;j<s.n;j++){ if(s.brains[j]==="human"){ const ini=cleanInitials(seatNames[j]); if(ini && profiles[ini]) init[j]=profiles[ini].total||0; } }
          dispatch({type:"START", scores:init});
        }}>
          deal the table ▸
        </button>
        <button className="tag" style={{alignSelf:"center",marginTop:2}} onClick={onShowStats}>profiles &amp; ranking</button>
        <button className="tag" style={{alignSelf:"center",marginTop:2}} onClick={onShowRules}>how to play &amp; counting</button>
      </div>
    </div>
  );
}

/* =======================================================================
   APP
   ===================================================================== */
const THEME_CSS=`
.bh{
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --k:1.2;   /* card size — one knob scales every card; sized so 6 fit on one line */
  --bg:#0f3b2b; --ink:#f2e8ce; --dim:#9a8f63; --line:rgba(212,175,55,.42); --line2:rgba(212,175,55,.20);
  --card:#f6efd9; --cardline:#cdc09a; --fill:#f2e8ce; --fillink:#0f3b2b;
  --purple:#e2c068; --pink:#ed7464; --cyan:#67cdbb; --green:#4fc47a;
  --yellow:#f0d27a; --orange:#e0a45a; --red:#ed7464; --comment:#9a8f63; --rule:#e2c068;
  --sp:#1c6fd4; --he:#b3232a; --di:#d6a51b; --cl:#1c7a3f;
  --spB:#1c6fd4; --heB:#b3232a; --diB:#d6a51b; --clB:#1c7a3f;
  --selbg:#efe2bd; --playink:#0d3322;
  background:var(--bg); color:var(--ink);
}
.bh[data-theme="blue"]{ --bg:#112c4f; --fillink:#112c4f; --playink:#0a1830; }
.bh[data-theme="red"]{ --bg:#3c1418; --fillink:#3c1418; --playink:#220a0c; }
.bh[data-theme="black"]{ --bg:#0d0d10; --fillink:#0d0d10; --playink:#060608; }
.bh[data-theme="cream"]{
  --bg:#f3ead4; --ink:#2b2517; --dim:#857852; --line:rgba(150,116,30,.55); --line2:rgba(150,116,30,.26);
  --card:#fdf9f1; --cardline:#d8c8a0; --fill:#fdf9f1; --fillink:#2b2517;
  --purple:#a87e22; --pink:#bb3b2a; --cyan:#157a70; --green:#2e8b50;
  --yellow:#9c7d18; --orange:#b5611f; --red:#c0392b; --comment:#857852; --rule:#a87e22;
  --sp:#1c6fd4; --he:#b3232a; --di:#b8890f; --cl:#1c7a3f;
  --spB:#1c6fd4; --heB:#b3232a; --diB:#b8890f; --clB:#1c7a3f;
  --selbg:#f2e7c6; --playink:#f6efda;
}
.bh *{font-family:var(--mono)!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
.bhcard{position:relative;width:calc(42px*var(--k));height:calc(58px*var(--k));flex:0 0 auto;background:var(--card);border:1px solid var(--cardline);cursor:default;user-select:none;transition:transform .08s;}
.bhcard.sm{width:calc(30px*var(--k));height:calc(42px*var(--k));}
.bhcard.clk{cursor:pointer;} .bhcard.dis{opacity:.34;}
.bhcard.s-sp{color:var(--sp);} .bhcard.s-he{color:var(--he);} .bhcard.s-di{color:var(--di);} .bhcard.s-cl{color:var(--cl);}
.bhcard.sel{background:var(--selbg);border-color:var(--purple);transform:translateY(calc(-8px*var(--k)));}
.bhcard.sel.s-sp{color:var(--spB);} .bhcard.sel.s-he{color:var(--heB);} .bhcard.sel.s-di{color:var(--diB);} .bhcard.sel.s-cl{color:var(--clB);}
.bhcard.wild::after{content:"";position:absolute;inset:calc(3px*var(--k));border:1px solid var(--purple);opacity:.8;pointer-events:none;}
.bhcard .idx{position:absolute;display:flex;flex-direction:column;align-items:center;line-height:.9;font-weight:700;}
.bhcard .idx.tl{top:calc(3px*var(--k));left:calc(4px*var(--k));} .bhcard .idx.br{bottom:calc(3px*var(--k));right:calc(4px*var(--k));transform:rotate(180deg);}
.bhcard .ir{font-size:calc(11px*var(--k));} .bhcard .is{font-size:calc(8px*var(--k));margin-top:calc(1px*var(--k));}
.bhcard.sm .ir{font-size:calc(8px*var(--k));} .bhcard.sm .is{font-size:calc(6px*var(--k));}
.bhcard .ctr{position:absolute;inset:0;}
.bhcard .pip{position:absolute;font-size:calc(9.5px*var(--k));line-height:1;transform:translate(-50%,-50%);}
.bhcard .pip.flip{transform:translate(-50%,-50%) rotate(180deg);}
.bhcard.sm .pip{font-size:calc(7px*var(--k));}
.bhcard .mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;}
.bhcard .mid.fc{font-size:calc(25px*var(--k));} .bhcard.sm .mid.fc{font-size:calc(17px*var(--k));}
.bhcard .mid.ac{font-size:calc(27px*var(--k));} .bhcard.sm .mid.ac{font-size:calc(18px*var(--k));}
.bhback{position:relative;width:calc(42px*var(--k));height:calc(58px*var(--k));flex:0 0 auto;border:1px solid var(--line);background:repeating-linear-gradient(135deg,var(--bg) 0 4px,var(--line2) 4px 5px);}
.bhback.sm{width:calc(30px*var(--k));height:calc(42px*var(--k));}
.bh select{background:var(--bg);color:var(--ink);border:1px solid var(--line);}
.bh option{background:var(--card);color:var(--sp);}
.bh .app{width:100%;max-width:394px;margin:0 auto;display:flex;flex-direction:column;gap:8px;}
.bh .num{font-variant-numeric:tabular-nums;}
.bh .hr2{height:1px;background:var(--line2);}
.bh .lbl2{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);}
.bh header{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--rule);padding-bottom:6px;}
.bh .wordmark{font-size:18px;font-weight:700;letter-spacing:.40em;padding-left:.40em;background:linear-gradient(92deg,var(--pink),var(--purple) 50%,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
.bh .target{font-size:10px;letter-spacing:.10em;color:var(--dim);}
.bh .toggle{display:flex;border:1px solid var(--line);}
.bh .toggle button{font:inherit;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;background:transparent;color:var(--dim);border:0;padding:4px 6px;cursor:pointer;}
.bh .toggle button.on{background:var(--purple);color:var(--fillink);}
.bh .toggle button+button{border-left:1px solid var(--line);}
.bh .opps{display:grid;border:1px solid var(--line);}
.bh .opp{padding:6px 8px 7px;border-left:1px solid var(--line2);min-width:0;}
.bh .opp:first-child{border-left:0;}
.bh .opp.act{background:var(--line2);}
.bh .opp .top{display:flex;align-items:center;gap:5px;}
.bh .opp .gl{font-size:13px;line-height:1;color:var(--accent);}
.bh .opp .nm{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bh .opp .meta{display:flex;gap:8px;margin-top:5px;}
.bh .opp .meta div{display:flex;flex-direction:column;gap:1px;}
.bh .opp .v{font-size:12.5px;font-weight:700;}
.bh .opp .meta div:nth-child(1) .v{color:var(--cyan);}
.bh .opp .meta div:nth-child(2) .v{color:var(--green);}
.bh .opp .meta div:nth-child(3) .v{color:var(--pink);}
.bh .opp .st{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-top:4px;min-height:11px;}
.bh .board{display:grid;grid-template-columns:64px minmax(0,1fr) 60px;grid-template-areas:"stock card pot" "royal census pot";align-items:stretch;border:1px solid var(--line);}
.bh .cell{padding:8px 10px;display:flex;flex-direction:column;justify-content:center;gap:4px;}
.bh .cell.stock{grid-area:stock;border-right:1px solid var(--line2);}
.bh .cell.pile{grid-area:card;}
.bh .cell.pot{grid-area:pot;border-left:1px solid var(--line2);}
.bh .cell.royal{grid-area:royal;border-top:1px solid var(--line2);border-right:1px solid var(--line2);}
.bh .cell.census{grid-area:census;border-top:1px solid var(--line2);}
.bh .stock{align-items:center;text-align:center;min-width:60px;}
.bh .stock .n{color:var(--comment);font-size:12px;font-weight:700;}
.bh .stack{width:30px;height:42px;border:1px solid var(--line);position:relative;background:repeating-linear-gradient(135deg,transparent 0 4px,var(--line2) 4px 5px);}
.bh .stack::after{content:"";position:absolute;inset:3px;border:1px solid var(--line2);}
.bh .pile{align-items:center;flex-direction:row;gap:10px;justify-content:center;}
.bh .demand{display:flex;flex-direction:column;gap:2px;width:152px;}
.bh .demand .big{font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--pink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bh .demand .lbl2{white-space:normal;letter-spacing:.09em;line-height:1.3;}
.bh .demand .big.bank{color:var(--red);}
.bh .pot{align-items:center;text-align:center;min-width:56px;}
.bh .pot .v{font-size:21px;font-weight:700;line-height:1;color:var(--yellow);}
.bh .you{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
.bh .you .me{font-size:11px;letter-spacing:.12em;font-weight:700;text-transform:uppercase;}
.bh .you .turn{color:var(--green);}
.bh .sort{display:flex;border:1px solid var(--line);}
.bh .sort button{font:inherit;font-size:9px;letter-spacing:.06em;text-transform:uppercase;background:transparent;color:var(--dim);border:0;border-left:1px solid var(--line2);padding:3px 7px;cursor:pointer;}
.bh .sort button:first-child{border-left:0;} .bh .sort button.on{background:var(--purple);color:var(--fillink);}
.bh .hand{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;padding:8px 4px 2px;min-height:62px;}
.bh .acts{display:flex;gap:7px;flex-wrap:wrap;align-items:center;justify-content:center;min-height:36px;}
.bh .acts .btn{white-space:nowrap;}
.bh .btn{font:inherit;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;background:transparent;color:var(--ink);border:1px solid var(--ink);padding:6px 12px;cursor:pointer;}
.bh .btn.primary{background:var(--green);color:var(--playink);border-color:var(--green);min-width:124px;text-align:center;}
.bh .btn.ghost{border-color:var(--line);color:var(--dim);}
.bh .btn.danger{border-color:var(--red);color:var(--red);background:transparent;}
.bh .btn:disabled{opacity:.32;cursor:default;color:var(--dim);border-color:var(--line);background:transparent;}
.bh .hintline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;justify-content:center;min-height:26px;}
.bh .tag{border:1px solid var(--purple);padding:3px 7px;letter-spacing:.10em;font-size:9px;text-transform:uppercase;color:var(--purple);white-space:nowrap;background:transparent;cursor:pointer;font-weight:700;}
.bh .tag.on{background:var(--purple);color:var(--fillink);}
.bh .hintline b{color:var(--ink);}
.bh .hintline .htxt{color:var(--dim);font-style:normal;line-height:1.3;}
.bh .log{font-size:10px;color:var(--dim);line-height:1.55;letter-spacing:.02em;text-align:center;}
.bh .log b{color:var(--ink);}
.bh .menu{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;}
`;

/* ---- on-device player profiles: initials → career stats, stored in localStorage ----
   Wrapped so it can never throw: in a sandbox with no storage it simply runs in-memory
   for the session; in a real deployment (web/published app) it persists on the device. */
const DB_KEY="bankhead.profiles.v1", LAST_KEY="bankhead.lastInitials.v1", CAMPAIGN_KEY="bankhead.campaign.v1";
function loadDB(){ try{ return JSON.parse(localStorage.getItem(DB_KEY))||{}; }catch(_){ return {}; } }
function saveDB(d){ try{ localStorage.setItem(DB_KEY, JSON.stringify(d)); }catch(_){} }
function loadLast(){ try{ return localStorage.getItem(LAST_KEY)||""; }catch(_){ return ""; } }
function saveLast(v){ try{ localStorage.setItem(LAST_KEY, v||""); }catch(_){} }
// the whole-table snapshot of a paused match (all seats incl. bots), for exact resume
function loadCampaign(){ try{ return JSON.parse(localStorage.getItem(CAMPAIGN_KEY))||null; }catch(_){ return null; } }
function saveCampaign(c){ try{ if(c) localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); else localStorage.removeItem(CAMPAIGN_KEY); }catch(_){} }
const cleanInitials=(v)=> (v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,3);
const blankProfile=()=>({games:0, wins:0, best:0, totalScore:0, rounds:0, roundsWon:0, total:0, history:[]});
// persist the table into every human profile AT THE END OF EVERY ROUND, so players can
// stop or pick up anytime. Per-round stats (rounds played, rounds gone out, running total)
// update every round; per-match stats (games, wins, best, history) update when the target is hit.
function persistRound(s, seatNames, target){
  const db=loadDB(); const max=Math.max(...s.scores);
  const matchDone = target>0 && max>=target;
  for(let j=0;j<s.n;j++){
    if(s.brains[j]!=="human") continue;
    const ini=cleanInitials(seatNames[j]); if(!ini) continue;
    const p = db[ini] || blankProfile();
    p.rounds=(p.rounds||0)+1;                                            // per round
    if(s.roundBreak && s.roundBreak[j] && s.roundBreak[j].out>0) p.roundsWon=(p.roundsWon||0)+1; // per round
    if(matchDone){
      const won = s.scores[j]===max;
      const place = 1 + s.scores.filter(v=> v>s.scores[j]).length;
      p.games+=1; if(won) p.wins+=1;                                     // per match
      p.best=Math.max(p.best, s.scores[j]); p.totalScore+=s.scores[j];
      p.history.unshift({t:Date.now(), score:s.scores[j], won, place, n:s.n});
      if(p.history.length>15) p.history.length=15;
      p.total=0;                 // campaign complete — start fresh next sitting
    } else {
      p.total=s.scores[j];       // mid-campaign — just save where they're at
    }
    db[ini]=p;
  }
  saveDB(db); return db;
}
// display name: a human seat shows its initials if set, otherwise the default label
const nameOf=(s,j,seatNames)=> s.brains[j]==="human"
  ? (cleanInitials((seatNames&&seatNames[j])||"") || who(s,j))
  : who(s,j);

// the profiles / ranking overlay — career stats and leaderboard across everyone tracked
function StatsScreen({profiles, onReset, onClose}){
  const [confirm,setConfirm]=React.useState(false);
  const rows=Object.entries(profiles||{})
    .map(([ini,p])=>({ini, ...p, rate: p.games?Math.round(100*p.wins/p.games):0, avg: p.games?Math.round(p.totalScore/p.games):0}))
    .sort((a,b)=> b.wins-a.wins || b.rate-a.rate || b.best-a.best || (b.rounds||0)-(a.rounds||0) || (b.total||0)-(a.total||0));
  return (
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(4,18,12,.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:14}}>
      <div style={{background:"var(--bg)",border:"2px solid var(--purple)",padding:"18px 18px 16px",maxWidth:480,width:"100%",maxHeight:"88vh",overflowY:"auto",fontFamily:"var(--mono)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:18,color:"var(--purple)",letterSpacing:1}}>PROFILES · RANKING</div>
          <button className="tag" onClick={onClose}>close</button>
        </div>
        {rows.length===0
          ? <div style={{fontSize:12,color:"var(--dim)",padding:"16px 2px",lineHeight:1.55}}>No matches recorded yet. In setup, set your initials and pick a target ("first to N points") — stats update every round and every match, tracked and ranked here.</div>
          : <>
            {rows.map((r,i)=>(
              <div key={r.ini} style={{padding:"9px 2px",borderBottom:"1px solid var(--line2)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:800,fontSize:11,color:i===0?"var(--purple)":"var(--dim)",minWidth:14}}>{i+1}</span>
                  <span style={{fontWeight:800,fontSize:16,color:"var(--ink)",letterSpacing:1}}>{r.ini}</span>
                  <span style={{display:"inline-flex",gap:2}}>
                    {r.history.slice(0,6).map((h,k)=>(<span key={k} style={{width:7,height:7,borderRadius:7,background:h.won?"var(--green)":"var(--line)"}}/>))}
                  </span>
                  <span style={{marginLeft:"auto",whiteSpace:"nowrap"}}>
                    <span style={{fontSize:8.5,color:"var(--dim)",textTransform:"uppercase",letterSpacing:.5,marginRight:5}}>now</span>
                    <span style={{fontSize:16,fontWeight:800,color:(r.total||0)>0?"var(--green)":"var(--dim)"}}>{r.total||0}</span>
                  </span>
                </div>
                <div style={{display:"flex",gap:14,marginTop:5,marginLeft:22,fontSize:10,color:"var(--dim)",flexWrap:"wrap"}}>
                  <span><b style={{color:"var(--cyan)"}}>{r.wins}/{r.games}</b> matches · {r.rate}%</span>
                  <span><b style={{color:"var(--ink)"}}>{r.rounds||0}</b> rounds · {r.roundsWon||0} out</span>
                  <span>best <b style={{color:"var(--pink)"}}>{r.best}</b></span>
                </div>
              </div>
            ))}
            <div style={{fontSize:9,color:"var(--dim)",marginTop:8,lineHeight:1.5}}>
              <b style={{color:"var(--cyan)"}}>matches</b> update when a target is reached · <b style={{color:"var(--ink)"}}>rounds</b> and <b style={{color:"var(--green)"}}>now</b> update every round
            </div>
          </>}
        <div style={{marginTop:14}}>
          {confirm
            ? <span style={{fontSize:11,color:"var(--he)"}}>erase every profile?
                <button className="tag" style={{marginLeft:8}} onClick={()=>{onReset();setConfirm(false);}}>yes, reset</button>
                <button className="tag" style={{marginLeft:6}} onClick={()=>setConfirm(false)}>cancel</button></span>
            : <button className="tag" onClick={()=>setConfirm(true)} disabled={rows.length===0} style={rows.length===0?{opacity:.4}:{}}>reset all</button>}
        </div>
      </div>
    </div>
  );
}

// how-to-play overlay — the rules, plus the Apex's card-counting playbook
const RULES_SECTIONS = [
  {h:"Object", lines:[
    "Bank the pile and empty your hand. Banked cards score; cards still in your hand at round end subtract. No fixed target — play to whatever finish you agree (first to N points, a set number of rounds, or best total when you stop).",
  ]},
  {h:"Cards", lines:[
    "Ranks low→high: 3 4 5 6 7 8 9 10 J Q K A. Three ranks are WILD: 2, 6, A (precedence 2 > 6 > A).",
    "Hand: 6 cards for 2 players · 5 for 3 · 4 for 4 — drawn back up from the stock until it runs dry. No reserve cards.",
    "Deck: one deck for 2 players, two decks for 3–4.",
  ]},
  {h:"Play", lines:[
    "Climb: play equal-or-higher than the top ordinary card — or any wild.",
    "You must play if you can. Stuck with no legal play → pick up: refill your hand to the cap of 10 from the top of the pile; everything underneath is discarded out of play.",
    "You may always PASS a pending bank by choice.",
    "The pile is open: on your turn you may review the cards already played to it. Lay each card so the earlier ranks stay visible (as in Rummy) — then the whole pile reads at a glance.",
  ]},
  {h:"The Wilds", lines:[
    "2 — resets the pile; the next card may be anything. Cancels a pending bank.",
    "6 — sends the pile UNDER-6: the next card must be a 3–5 (or a wild). A 6 played on a wild (2 / 6 / A) BANKS, and a 6 steals a pending bank.",
    "A — plays on ANYTHING: it banks the pile, or steals a pending bank into an Ace bank. The Ace bank is the hardest to answer (only 2 · 6 · A).",
  ]},
  {h:"Banking", lines:[
    "A bank is set by an Ace, a 6-on-a-wild, or four of a kind.",
    "Only the NEXT player may answer: 2 resets · 6 steals · A steals · a low 3–5 defuses a 6-bank · or pass to let it score.",
    "Four of a kind banks instantly and UNCONTESTED — no answer window.",
    "Banked cards are kept face-down and may NEVER be reviewed — once banked, you track them from memory like everyone else.",
  ]},
  {h:"Going Out & Scoring", lines:[
    "Go out by emptying your hand (only possible once the stock is dry). It ends the round instantly; the unbanked pile scores nothing.",
    "Score per banked card: number cards = 1 · 10–K = 2 · wilds (2·6·A) = 3.",
    "End of round: +10 for going out · cards left in hand SUBTRACT their tier value (a round can go negative) · +1 per banked card of the royal suit.",
    "Royal suit: the bottom stock card is flipped sideways at the deal. When someone goes out it crowns its own suit if it could legally follow the out-card; otherwise the out-card's suit is royal.",
    "Banking on the way out: if your last card is itself a bank (an Ace, or a 6 on a wild), you collect that pile uncontested as you go out — there's no one left to answer it.",
    "Stall safety net: if a round ever drags with no progress — no bank, nobody shedding down, the stock untouched — the app ends it and gives the going-out bonus to whoever holds the fewest cards. In practice it almost never fires.",
  ]},
];
const COUNTING_SECTIONS = [
  {h:"The one question", lines:[
    "Every bank is answered by the NEXT player only. So the whole game reduces to: can the next player answer? Counting turns that from a guess into a number.",
  ]},
  {h:"Read the counts (the counts button)", lines:[
    "Answer cards gone — how many 2s, 6s and Aces have left play. Wilds are the only cards that answer a bank, so the more that are gone, the safer your banks.",
    "Bank read — when a bank is live it shows how many unseen cards can beat it and the ≈% the next player holds one. A low % means it's safe to bank.",
  ]},
  {h:"When to bank", lines:[
    "Bank when the next player almost can't answer — most of the 2 / 6 / A (plus the low 3–5 that beat a 6-bank) are gone AND their hand is small. That's a lock.",
    "Don't burn a wild on scraps — wait for ~4+ points on the pile before you spend an Ace or 6.",
    "But grab early if a rival is down to ~3 cards — the round may end any second, so take a near-lock even for a small pot.",
    "Four of a kind: always slam it. It's uncontestable.",
  ]},
  {h:"Hold vs. shed", lines:[
    "Hoard your wilds (A, 6, 2) — they're your banking and answering tools, not filler.",
    "Shed low and wide: dump your biggest sets, clearing your lowest cards first (low cards are hardest to replay). Open a fresh pile LOW so you've room to climb.",
    "Switch to race mode only when your hand is small and the stock is dry or you're shortest — then dump everything, wilds included, to go out for the +10.",
  ]},
  {h:"Answering a bank", lines:[
    "Steal with a 6 whenever it's worth it — you deny them AND bank the pot yourself.",
    "Defuse a 6-bank cheaply with a low 3–5; steal an Ace bank with an Ace; reset a big pot with a 2.",
    "Pass on scraps — don't spend a wild to deny 1–2 points.",
    "Deny HARDEST when the banker is ~3 cards from going out — they'd take the pot AND the +10 bonus.",
  ]},
  {h:"Endgame / royal", lines:[
    "Bank heavily in one suit, then try to go out on a card the royal can follow (or on that suit) to cash +1 per banked card. The counts panel shows your strongest banked suit.",
  ]},
];
function RulesScreen({onClose}){
  const [tab,setTab]=React.useState("rules");
  const data = tab==="rules" ? RULES_SECTIONS : COUNTING_SECTIONS;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(4,18,12,.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:14}}>
      <div style={{background:"var(--bg)",border:"2px solid var(--purple)",padding:"18px 18px 16px",maxWidth:480,width:"100%",maxHeight:"88vh",overflowY:"auto",fontFamily:"var(--mono)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:18,color:"var(--purple)",letterSpacing:1}}>HOW TO PLAY</div>
          <button className="tag" onClick={onClose}>close</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          <button className={"tag"+(tab==="rules"?" on":"")} onClick={()=>setTab("rules")}>rules</button>
          <button className={"tag"+(tab==="counting"?" on":"")} onClick={()=>setTab("counting")}>counting like the apex</button>
        </div>
        {tab==="counting" && <div style={{fontSize:11,color:"var(--dim)",lineHeight:1.5,marginBottom:6}}>The exact playbook the Apex runs — using only the numbers the <b style={{color:"var(--ink)"}}>Card Counting</b> button shows you in-game.</div>}
        {data.map((sec,i)=>(
          <div key={i} style={{marginBottom:13}}>
            <div className="lbl2" style={{color:"var(--purple)",marginBottom:5,letterSpacing:1}}>{sec.h}</div>
            {sec.lines.map((ln,j)=>(
              <div key={j} style={{display:"flex",gap:7,marginBottom:5,fontSize:12,color:"var(--ink)",lineHeight:1.5}}>
                <span style={{color:"var(--purple)",flex:"0 0 auto"}}>·</span><span>{ln}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App(){
  const [s,dispatch]=useReducer(reducer,SETUP);
  const [sel,setSel]=React.useState([]);
  const [handSort,setHandSort]=React.useState("rank");
  const [theme,setTheme]=React.useState("casino");
  const [revealSeat,setRevealSeat]=React.useState(0);   // which human seat currently holds the device
  const [seatNames,setSeatNames]=React.useState(()=>{ const a=Array(4).fill(""); a[0]=loadLast(); return a; });
  const [target,setTarget]=React.useState(100);         // match target; 0 = freeplay (no auto-finish)
  const [profiles,setProfiles]=React.useState(()=>loadDB());
  const [campaign,setCampaign]=React.useState(()=>loadCampaign());
  const [showStats,setShowStats]=React.useState(false);
  const [showRules,setShowRules]=React.useState(false);
  const recordedRef=useRef(false);
  const timer=useRef(null);
  const focusRef=useRef(0);                              // last human seat to have acted
  const sRef=useRef(s); sRef.current=s;                  // current state for the observe hook

  const netRef = useRef(null);   // online layer, assigned just below

  // every gameplay dispatch flows through here so the Exploiter can watch the table.
  // PLAY / PASS_BANK feed the opponent model; START / RESUME wipe it (fresh read each match).
  const apply=React.useCallback((action)=>{
    if(netRef.current && netRef.current.role==="guest"){ netRef.current.send(action); return; }  // guests relay to host
    if(action.type==="START"||action.type==="RESUME") resetMemory();
    const prev=sRef.current;
    if(prev && prev.mode==="play" && (action.type==="PLAY"||action.type==="PASS_BANK")){
      try{ observe(prev, action, reducer(prev, action)); }catch(_){}
    }
    dispatch(action);
  },[]);

  // ---- online sync (inert unless a host/guest role is active) ----
  const net = useBankheadNet({
    onAction:(a)=>apply(a),
    onResume:(state,tgt)=>{ dispatch({type:"__SYNC__", state}); if(tgt!=null) setTarget(tgt); },
  });
  netRef.current = net;
  const online = net.role!=="off";
  const mySeat = net.seat;
  useEffect(()=>{ if(net.role==="host" && s.mode==="play") net.broadcastState(s, net.names, target); },[s, net.names, net.role, target]);
  useEffect(()=>{ if(net.role==="guest" && net.snap) dispatch({type:"__SYNC__", state:net.snap}); },[net.snapV]); // eslint-disable-line
  useEffect(()=>{ if(online && net.names){ setSeatNames(net.names.map(x=>x||"")); } },[net.namesV, online]); // eslint-disable-line
  useEffect(()=>{ if(net.role==="guest" && net.target!=null) setTarget(net.target); },[net.target, net.role]);
  const startOnline = React.useCallback((tgt, size)=>{
    const pc = Math.max(2, net.playerCount||2);
    const N = Math.max(pc, Math.min(4, size||pc));
    const brains = Array.from({length:N},(_,i)=> i<pc ? "human" : BRAIN_ORDER[(i-pc)%BRAIN_ORDER.length]);
    setTarget(tgt);
    apply({type:"RESUME", n:N, brains, scores:Array(N).fill(0)});
  },[net.playerCount]);

  // bot auto-play — and covers a human seat whose player is momentarily disconnected
  useEffect(()=>{
    if(netRef.current && netRef.current.role==="guest") return;   // guests never simulate
    if(s.mode!=="play"||s.phase!=="play") return;
    const nrole = netRef.current && netRef.current.role;
    const down = nrole==="host" && netRef.current.isSeatDown && netRef.current.isSeatDown(s.current);
    if(s.brains[s.current]==="human" && !down) return;   // a present human holds this seat
    const answering = s.pendingBanker!==null && s.pendingBanker!==s.current && isBank(situation(s.pile));
    const delay = down ? 2500 : (answering?460:640);
    const bs = (s.brains[s.current]==="human") ? {...s, brains:s.brains.map((b,i)=> i===s.current ? "vault" : b)} : s;
    timer.current=setTimeout(()=>{ apply(botAction(bs)); }, delay);
    return ()=>clearTimeout(timer.current);
  },[s]);

  // remember the most recent human seat to focus the table on them
  useEffect(()=>{ if(s.phase==="play" && s.brains[s.current]==="human") focusRef.current=s.current; },[s.current,s.phase]);
  // selection belongs to a single turn — clear it whenever the turn changes
  useEffect(()=>{ setSel([]); },[s.current,s.phase,s.mode]);

  // persist the table into the human profiles AT THE END OF EVERY ROUND (keyed on roundEndedAt
  // so it fires once). Mid-campaign it just saves the running totals; on the round that reaches
  // the target it also logs the completed match. Players can stop or pick up anytime.
  const matchOver = s.mode==="play" && s.phase==="roundEnd" && target>0 && Math.max(...(s.mode==="play"?s.scores:[0]))>=target;
  useEffect(()=>{
    if(!(s.mode==="play" && s.phase==="roundEnd" && s.roundEndedAt)) return;
    if(recordedRef.current===s.roundEndedAt) return;
    recordedRef.current=s.roundEndedAt;
    setProfiles(persistRound(s, seatNames, target));
    const me=cleanInitials(seatNames[0]); if(me) saveLast(me);
    // snapshot the whole table (all seats incl. bots) for exact resume — or clear it when done
    const done = target>0 && Math.max(...s.scores)>=target;
    const snap = done ? null : {scores:[...s.scores], brains:[...s.brains], names:Array.from({length:s.n},(_,j)=>cleanInitials(seatNames[j]||"")), n:s.n, target, ts:Date.now()};
    saveCampaign(snap); setCampaign(snap);
  },[s.phase, s.roundEndedAt, s.mode]); // eslint-disable-line

  // resume a paused match exactly — every seat, bots included, at their saved scores
  const resumeCampaign=()=>{
    const c=campaign; if(!c) return;
    const names=Array(4).fill(""); (c.names||[]).forEach((v,i)=>{ if(i<4) names[i]=cleanInitials(v); });
    setSeatNames(names); setTarget(c.target||0);
    recordedRef.current=null;
    apply({type:"RESUME", scores:c.scores, n:c.n, brains:c.brains});
    setSel([]);
  };
  const discardCampaign=()=>{ saveCampaign(null); setCampaign(null); };
  // leave to setup — snapshot the table first so it can be resumed, even mid-round
  const goSetup=()=>{
    if(s.mode==="play"){
      const done = target>0 && Math.max(...s.scores)>=target;
      if(done){ saveCampaign(null); setCampaign(null); }
      else {
        const snap={scores:[...s.scores], brains:[...s.brains], names:Array.from({length:s.n},(_,j)=>cleanInitials(seatNames[j]||"")), n:s.n, target, ts:Date.now()};
        saveCampaign(snap); setCampaign(snap);
      }
    }
    dispatch({type:"TO_SETUP"}); setSel([]);
  };
  // quit the current match outright — abandon it (no resume) and return to setup
  const quitMatch=()=>{
    recordedRef.current=null;
    saveCampaign(null); setCampaign(null);
    dispatch({type:"TO_SETUP"}); setSel([]);
  };
  // start a new match: wipe the seated humans' running totals, then go to setup to reconfigure
  const newMatchSetup=()=>{
    const db=loadDB(); let changed=false;
    for(let j=0;j<s.n;j++){ if(s.brains[j]==="human"){ const ini=cleanInitials(seatNames[j]); if(ini&&db[ini]){ db[ini].total=0; changed=true; } } }
    if(changed){ saveDB(db); setProfiles(db); }
    recordedRef.current=null;
    saveCampaign(null); setCampaign(null);
    dispatch({type:"TO_SETUP"}); setSel([]);
  };

  if(net.role!=="off" && s.mode!=="play"){
    return <OnlineScreens net={net} onStart={startOnline}/>;
  }

  if(s.mode==="setup"){
    return (
      <div className="bh" data-theme={theme} style={{minHeight:"100vh",background:"var(--bg)",padding:14}}>
        <style>{THEME_CSS}</style>
        <OnlineBar net={net}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <div className="toggle">
            {[["casino","Casino"],["blue","Blue"],["red","Red"],["black","Black"],["cream","Cream"]].map(([t,lab])=>(
              <button key={t} className={theme===t?"on":""} onClick={()=>setTheme(t)}>{lab}</button>
            ))}
          </div>
        </div>
        <Setup s={s} dispatch={apply} seatNames={seatNames} setSeatNames={setSeatNames}
          target={target} setTarget={setTarget} profiles={profiles} onShowStats={()=>setShowStats(true)} onShowRules={()=>setShowRules(true)}
          campaign={campaign} onResume={resumeCampaign} onDiscard={discardCampaign}/>
        {showStats && <StatsScreen profiles={profiles} onClose={()=>setShowStats(false)}
          onReset={()=>{ saveDB({}); setProfiles({}); }}/>}
        {showRules && <RulesScreen onClose={()=>setShowRules(false)}/>}
      </div>
    );
  }

  const S=situation(s.pile);
  const humanCurrent = s.phase==="play" && s.brains[s.current]==="human";
  const focus = online ? mySeat : (humanCurrent ? s.current : (focusRef.current<s.n ? focusRef.current : 0));
  const multiHuman = s.brains.filter(b=>b==="human").length>1;
  const needReveal = online ? false : (multiHuman && humanCurrent && s.current!==revealSeat);  // pass-device gate
  const selCards = sel.map(id=>s.players[focus].hand?.find?.(c=>c.id===id)).filter(Boolean);
  const over = s.phase==="roundEnd";
  const others = Array.from({length:s.n},(_,i)=>i).filter(i=>i!==focus);
  const outPlayer = s.roundBreak.findIndex(b=>b&&b.out);
  const leader = s.scores.indexOf(Math.max(...s.scores));
  const roundMs = (s.roundStartedAt&&s.roundEndedAt)?Math.max(0,s.roundEndedAt-s.roundStartedAt):0;
  const fmtDur=(ms)=>{ const t=Math.round(ms/1000), m=Math.floor(t/60), sec=t%60; return m?`${m}:${String(sec).padStart(2,"0")}`:`${sec}s`; };

  const dm = boardDemand(S);
  const topCard = s.pile.length? s.pile[s.pile.length-1] : null;
  let topRun=0; if(topCard){ for(let i=s.pile.length-1;i>=0&&s.pile[i].rank===topCard.rank;i--) topRun++; }
  const census=(()=>{ const p=s.pile, q=r=>p.filter(c=>c.rank===r).length,
    lows=p.filter(c=>c.rank==="3"||c.rank==="4"||c.rank==="5").length,
    highs=p.filter(c=>["7","8","9","10","J","Q","K"].includes(c.rank)).length,
    rs=s.royalCard?s.royalCard.suit:null;
    return {twos:q("2"),sixes:q("6"),aces:q("A"),lows,highs,rs,royals:rs?p.filter(c=>c.suit===rs).length:0}; })();
  const leadScore = Math.max(...s.scores, 0);

  return (
    <div className="bh" data-theme={theme} style={{minHeight:"100vh",background:"var(--bg)",padding:"12px 10px 18px"}}>
      <style>{THEME_CSS}</style>
      <OnlineBar net={net}/>
      <div className="app">

        <header>
          <div className="wordmark">BANKHEAD</div>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span className="target num">{target>0?`TO ${target}`:`LEAD ${leadScore}`}</span>
            <div className="toggle">
              {[["casino","Casino"],["blue","Blue"],["red","Red"],["black","Black"],["cream","Cream"]].map(([t,lab])=>(
                <button key={t} className={theme===t?"on":""} onClick={()=>setTheme(t)}>{lab}</button>
              ))}
            </div>
          </div>
        </header>

        <div>
          <div className="lbl2" style={{marginBottom:5}}>table</div>
          <div className="opps" style={{gridTemplateColumns:`repeat(${Math.max(others.length,1)},minmax(0,1fr))`}}>
            {others.map(pi=><OpponentStrip key={pi} s={s} pi={pi} seatNames={seatNames}/>)}
          </div>
        </div>

        <div className="board">
          <div className="cell stock">
            <span className="lbl2">stock</span>
            <div className="stack"/>
            <span className="n num">{s.stock.length}</span>
          </div>
          <div className="cell pile">
            {topCard
              ? <div style={{position:"relative",display:"inline-flex"}}>
                  <Card c={topCard}/>
                  {topRun>=2 && <span style={{position:"absolute",top:"calc(-6px*var(--k))",right:"calc(-6px*var(--k))",
                    zIndex:30,background:"var(--purple)",color:"var(--bg)",fontWeight:800,fontFamily:"var(--mono)",
                    fontSize:"calc(9px*var(--k))",lineHeight:1.25,padding:"0 calc(3px*var(--k))",
                    border:"1px solid var(--bg)"}}>×{topRun}</span>}
                </div>
              : <Empty/>}
            <div className="demand">
              <span className="lbl2">on the pile</span>
              <span className={"big"+(isBank(S)?" bank":"")}>{dm.main}</span>
              <span className="lbl2">{dm.sub}</span>
            </div>
          </div>
          <div className="cell pot">
            <span className="lbl2">pot</span>
            <span className="v num">{potValue(s.pile)}</span>
          </div>
          <div className="cell royal">
            {s.royalCard && (
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <span className="lbl2" style={{fontSize:7,letterSpacing:".04em"}}>royal?</span>
                <div style={{width:30,height:20,border:"1px solid var(--line2)",background:"var(--card)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:SUIT_COLOR[s.royalCard.suit],fontWeight:800,fontSize:11,lineHeight:1}}>
                  {s.royalCard.rank}<span style={{fontSize:12}}>{SUIT_GLYPH[s.royalCard.suit]}</span>
                </div>
              </div>
            )}
          </div>
          <div className="cell census">
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",flexWrap:"wrap",
              gap:"calc(5px*var(--k))",fontFamily:"var(--mono)",fontSize:"calc(9px*var(--k))",lineHeight:1.35,width:"100%",boxSizing:"border-box"}}>
              {[["2",census.twos],["6",census.sixes],["A",census.aces]].map(([r,nn])=>(
                <span key={r} style={{color:"var(--purple)",fontWeight:800}}>{r}<span style={{color:"var(--dim)",margin:"0 calc(2px*var(--k))",fontWeight:400}}>:</span><span style={{color:"var(--ink)",fontWeight:600}}>{nn}</span></span>
              ))}
              <span style={{color:"var(--line2)"}}>|</span>
              <span style={{color:"var(--dim)"}}>&lt;6<span style={{margin:"0 calc(2px*var(--k))"}}>:</span><b style={{color:"var(--ink)"}}>{census.lows}</b></span>
              <span style={{color:"var(--dim)"}}>&gt;6<span style={{margin:"0 calc(2px*var(--k))"}}>:</span><b style={{color:"var(--ink)"}}>{census.highs}</b></span>
              {census.rs && <>
                <span style={{color:"var(--line2)"}}>|</span>
                <span style={{color:SUIT_COLOR[census.rs],fontWeight:800}}>{SUIT_GLYPH[census.rs]}<span style={{color:"var(--dim)",margin:"0 calc(2px*var(--k))",fontWeight:400}}>:</span><span style={{color:"var(--ink)",fontWeight:600}}>{census.royals}</span></span>
              </>}
            </div>
          </div>
        </div>

        <div className="log">
          {[0,1,2].map(i=>{const l=s.log[i]; return <div key={i} style={{opacity:l?1-i*0.3:0}}>{l||"\u00a0"}</div>;})}
        </div>
        <div className="hr2"/>

        {needReveal
          ? <RevealGate s={s} seat={s.current} onReveal={()=>setRevealSeat(s.current)} seatNames={seatNames}/>
          : <HumanSide s={s} seat={focus} sel={sel} setSel={setSel} dispatch={apply}
              handSort={handSort} setHandSort={setHandSort} seatNames={seatNames}/>}

        <div className="menu">
          <button className="btn ghost" onClick={quitMatch}>quit match</button>
          <button className="btn ghost" onClick={newMatchSetup}>new match</button>
          <button className="btn ghost" onClick={()=>setShowStats(true)}>stats</button>
          <button className="btn ghost" onClick={goSetup}>pause</button>
        </div>

      </div>

      {showStats && <StatsScreen profiles={profiles} onClose={()=>setShowStats(false)}
        onReset={()=>{ saveDB({}); setProfiles({}); }}/>}

      {over&&<div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(4,18,12,.78)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"var(--bg)",border:"2px solid var(--purple)",
          padding:"22px 24px",textAlign:"center",maxWidth:440,width:"100%"}}>
          <div style={{fontWeight:800,fontSize:22,color:C.goldHi,letterSpacing:1,marginBottom:4,textShadow:"0 1px 3px #000"}}>
            {matchOver?"MATCH OVER":"ROUND OVER"}</div>
          <div style={{fontSize:12,color:C.cream,marginBottom:10}}>
            {matchOver
              ? <><b style={{color:C.goldHi}}>{nameOf(s,leader,seatNames)}</b> wins the match — first to {target}.</>
              : <>{outPlayer>=0?`${nameOf(s,outPlayer,seatNames)} went out (+${OUT_BONUS}).`:""} Leader: <b style={{color:C.goldHi}}>{nameOf(s,leader,seatNames)}</b>.</>}</div>
          {roundMs>0&&<div style={{fontSize:11,color:C.dim,marginBottom:10,letterSpacing:.5}}>
            ⧗ round played in <b style={{color:C.cream}}>{fmtDur(roundMs)}</b></div>}
          {s.royalSuit&&<div style={{fontSize:12.5,color:C.cream,marginBottom:12}}>
            royal suit <span style={{color:SUIT_COLOR[s.royalSuit],fontSize:18,verticalAlign:"middle"}}>{SUIT_GLYPH[s.royalSuit]}</span>
            <span style={{color:C.dim}}> — +1 per banked {SUIT_GLYPH[s.royalSuit]}</span>
            {s.royalCard&&<span style={{color:C.dim,fontSize:10,display:"block",marginTop:2}}>
              {s.royalActivated
                ? `the flipped ${s.royalCard.rank}${SUIT_GLYPH[s.royalCard.suit]} played on the out-card — its suit takes the crown`
                : `the flipped ${s.royalCard.rank}${SUIT_GLYPH[s.royalCard.suit]} couldn't follow the out-card — the out-card's suit takes the crown`}</span>}</div>}
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:16}}>
            {Array.from({length:s.n}).map((_,j)=>{const b=s.roundBreak[j]||{}; const me=j===0;
              const nm = nameOf(s,j,seatNames);
              const col = me?C.gold:seatProfile(s,j).color;
              return (
              <div key={j} style={{fontSize:13,color:C.cream,minWidth:84}}>
                <div style={{fontWeight:800,color:j===leader?C.goldHi:C.cream,fontSize:14.5}}>
                  {j===outPlayer?"★ ":""}{nm}</div>
                <div style={{color:col,fontWeight:800,fontSize:20}}>{s.scores[j]}</div>
                <div style={{fontSize:11,color:C.goldHi,marginTop:1}}>{s.roundScore[j]>=0?"+":""}{s.roundScore[j]} this round</div>
                <div style={{fontSize:10,color:C.dim,marginTop:1}}>
                  {b.out?`${b.out} out · `:""}{b.royalPts?`${b.royalPts} royal · `:""}{b.handPenalty?`−${b.handPenalty} hand`:""}
                  {!b.royalPts&&!b.out&&!b.handPenalty?"banks only":""}</div>
              </div>);})}
          </div>
          {matchOver
            ? <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button style={btn("gold")} onClick={newMatchSetup}>new match</button>
                <button className="tag" onClick={()=>setShowStats(true)}>view stats</button>
              </div>
            : <div style={{display:"flex",gap:10,justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
                <button style={btn("gold")} onClick={()=>{dispatch({type:"NEW_ROUND"});setSel([]);}}>deal next round</button>
                <button className="tag" onClick={()=>setShowStats(true)}>stats</button>
                <button className="tag" onClick={goSetup}>pause · saved</button>
              </div>}
        </div>
      </div>}
    </div>
  );
}

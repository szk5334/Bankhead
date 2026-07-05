import React, { useReducer, useEffect, useRef } from "react";

/* ---- online multiplayer bindings (inert unless the shell provides them) ---- */
const __BR_INERT_NET = { role:"off", seat:0, status:"", room:null, snap:null, snapV:0, roster:[],
  names:["","","",""], namesV:0, target:0, full:false, myInitials:"", playerCount:0, downSeats:[],
  isSeatDown:()=>false, prefillCode:"", savedSession:null, lobbyChat:[], roomChat:[], games:[], highScores:[], pub:null, pubV:0,
  requests:[], pendingRoom:null, started:false, availableSeats:()=>[],
  setInitials(){}, hostGame(){}, joinGame(){}, rejoin(){}, goSolo(){}, backToLobby(){}, closeRoom(){}, spectate(){},
  approveRequest(){}, denyRequest(){}, kickSeat(){}, cancelRequest(){},
  sendLobbyChat(){}, sendRoomChat(){}, send(){}, broadcastState(){} };
const useBridgeNet  = (typeof window!=="undefined" && (window.useGameNet || window.useBridgeNet)) || (()=>__BR_INERT_NET);
const OnlineBar     = (typeof window!=="undefined" && (window.GameBar || window.OnlineBar)) || (()=>null);
const OnlineScreens = (typeof window!=="undefined" && (window.LobbyScreens || window.OnlineScreens)) || (()=>null);
const SpectatorView = (typeof window!=="undefined" && window.SpectatorView) || (()=>null);

/* ==== Standard bridge core logic (verified modules, inlined & namespaced) ==== */
const ENG = (function(){
  /* Standard contract bridge engine — 52 cards, ranks 2..A (A high), 13 tricks. */
  
  const SUITS   = ["S","H","D","C"];                 // display order (spades high)
  const RANKS   = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const STRAINS = ["C","D","H","S","NT"];            // bidding order (clubs low)
  const STRAIN_IDX = { C:0, D:1, H:2, S:3, NT:4 };
  const SUIT_RANK  = { C:0, D:1, H:2, S:3 };         // for tie-break display only
  const RANKVAL = RANKS.reduce((m,r,i)=>(m[r]=i+2,m),{});   // 2->2 ... A->14
  
  let _uid=1;
  function makeDeck(){
    const d=[];
    for(const s of SUITS) for(const r of RANKS) d.push({ id:_uid++, rank:r, suit:s });
    return d;
  }
  function shuffle(a){
    a=a.slice();
    for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  
  // bids encode as level*5 + strainIndex for easy comparison
  function bidCode(level, strain){ return level*5 + STRAIN_IDX[strain]; }
  function decodeBid(code){ return { level: Math.floor(code/5), strain: STRAINS[code%5] }; }
  
  /* Standard trick resolution: if any trump was played, the highest trump wins;
     otherwise the highest card of the led suit wins. cards = [{rank,suit,player}]. */
  function resolveTrick(cards, ledSuit, trump){
    let best=cards[0], bestIsTrump=(trump!=="NT" && cards[0].suit===trump);
    for(let i=1;i<cards.length;i++){
      const c=cards[i];
      const cTrump=(trump!=="NT" && c.suit===trump);
      if(cTrump && !bestIsTrump){ best=c; bestIsTrump=true; continue; }
      if(cTrump===bestIsTrump){
        // same category — compare only if this card is in the category that can win
        const relevant = bestIsTrump ? true : (c.suit===ledSuit && best.suit===ledSuit);
        if(bestIsTrump){ if(RANKVAL[c.rank]>RANKVAL[best.rank]) best=c; }
        else {
          // non-trump: only led-suit cards can beat; a non-led non-trump can never win
          if(c.suit===ledSuit){ if(best.suit!==ledSuit || RANKVAL[c.rank]>RANKVAL[best.rank]) best=c; }
        }
      }
    }
    return { winner: best.player };
  }
  
  /* Legal plays: must follow the led suit if you hold any card of it; else anything. */
  function legalPlays(hand, ledSuit){
    if(!ledSuit) return hand.slice();
    const follow=hand.filter(c=>c.suit===ledSuit);
    return follow.length ? follow : hand.slice();
  }
  
  
  
  return { SUITS, RANKS, STRAINS, STRAIN_IDX, SUIT_RANK, RANKVAL,
  makeDeck, shuffle, bidCode, decodeBid, resolveTrick, legalPlays };
})();

const AUC = (function(){
  const { STRAINS, STRAIN_IDX } = ENG;
  
  /* A call is one of:
     {k:"P"}  pass
     {k:"D"}  double
     {k:"R"}  redouble
     {k:"B", level, strain}  a bid
     Each stored call also carries .by (seat).
     Auction context is derived by scanning the calls array (in call order). */
  
  const bidVal = (b)=> b.level*5 + STRAIN_IDX[b.strain];
  
  // summarize the auction so far. seats 0..3, partners = seat and seat^2? no: partners are i and (i+2)%4.
  function auctionInfo(calls, dealer){
    let lastBid=null, lastBidder=-1, dbl=0; // 0 none,1 doubled,2 redoubled
    let consecPass=0, opened=false;
    // track first mention of each strain by each SIDE (for declarer)
    const firstStrainBySide = { 0:{}, 1:{} }; // side 0 = seats {0,2}, side 1 = {1,3}
    const side = (seat)=> seat%2;
    for(const c of calls){
      if(c.k==="B"){
        opened=true; lastBid=c; lastBidder=c.by; dbl=0;
        const sd=side(c.by);
        if(firstStrainBySide[sd][c.strain]===undefined) firstStrainBySide[sd][c.strain]=c.by;
        consecPass=0;
      } else if(c.k==="D"){ dbl=1; consecPass=0; }
      else if(c.k==="R"){ dbl=2; consecPass=0; }
      else { consecPass++; }
    }
    // auction ends: 4 passes with no bid → passed out; or a bid then 3 passes
    let ended=false, passedOut=false;
    if(!opened && consecPass>=4){ ended=true; passedOut=true; }
    else if(opened && consecPass>=3){ ended=true; }
    // declarer: on the winning side, first to name the contract strain
    let declarer=-1, contract=null;
    if(ended && !passedOut && lastBid){
      const sd=side(lastBidder);
      declarer = firstStrainBySide[sd][lastBid.strain];
      contract = { level:lastBid.level, strain:lastBid.strain, dbl:(dbl===2?4:dbl===1?2:1), declarer };
    }
    return { lastBid, lastBidder, dbl, consecPass, opened, ended, passedOut, declarer, contract, firstStrainBySide };
  }
  
  // whose turn is it? dealer first, then clockwise. calls length tells us.
  function turnSeat(calls, dealer){ return (dealer + calls.length) % 4; }
  
  // is a call legal given the current auction?
  function callLegal(call, calls, dealer){
    const info = auctionInfo(calls, dealer);
    if(info.ended) return false;
    const seat = turnSeat(calls, dealer);
    if(call.k==="P") return true;
    if(call.k==="B"){
      if(call.level<1 || call.level>7) return false; // no bid above 7
      if(!info.lastBid) return true;
      return bidVal(call) > bidVal(info.lastBid);
    }
    if(call.k==="D"){
      // double an opponent's undoubled bid
      if(!info.lastBid || info.dbl!==0) return false;
      return (info.lastBidder%2) !== (seat%2);
    }
    if(call.k==="R"){
      // redouble your side's bid that an opponent has doubled
      if(!info.lastBid || info.dbl!==1) return false;
      return (info.lastBidder%2) === (seat%2);
    }
    return false;
  }
  
  // human-readable label
  function callLabel(c){
    if(c.k==="P") return "Pass";
    if(c.k==="D") return "Dbl";
    if(c.k==="R") return "Rdbl";
    const g={C:"♣",D:"♦",H:"♥",S:"♠",NT:"NT"}[c.strain];
    return c.level+g;
  }
  
  
  
  return { auctionInfo, turnSeat, callLegal, callLabel, bidVal };
})();

const SCO = (function(){
  /* Standard rubber-bridge scoring. */
  
  const isMinor = (st)=> st==="C"||st==="D";
  const isMajor = (st)=> st==="H"||st==="S";
  
  // trick score that goes BELOW the line for a made contract, on the bid level.
  function belowLineTrickScore(level, strain, dbl /*1|2|4*/){
    let per;
    if(strain==="NT") return (40 + 30*(level-1)) * dbl;
    per = isMinor(strain) ? 20 : 30;
    return per * level * dbl;
  }
  
  // Score one played hand. Inputs:
  //   contract {level, strain, dbl:1|2|4, declarer}   tricks = tricks won by the declaring side
  //   vulnerable = declaring side vulnerable?
  // Returns { made, below, above, under, over, detail } — below goes toward game, above is bonuses/penalties.
  function scoreHand(contract, tricks, vulnerable){
    const { level, strain, dbl } = contract;
    const need = 6 + level;
    const made = tricks >= need;
    let below=0, above=0;
    const detail = [];
    if(made){
      below = belowLineTrickScore(level, strain, dbl);
      detail.push(`contract ${below} below`);
      // overtricks
      const over = tricks - need;
      if(over>0){
        let ot=0;
        if(dbl===1){ const rate = (strain==="NT"||isMajor(strain))?30:20; ot = over*rate; }
        else if(dbl===2){ ot = over*(vulnerable?200:100); }
        else { ot = over*(vulnerable?400:200); }
        above += ot; detail.push(`+${ot} overtricks (${over})`);
      }
      // insult
      if(dbl===2){ above+=50; detail.push("+50 insult"); }
      else if(dbl===4){ above+=100; detail.push("+100 insult"); }
      // slam
      if(level===6){ const s=vulnerable?750:500; above+=s; detail.push(`+${s} small slam`); }
      else if(level===7){ const s=vulnerable?1500:1000; above+=s; detail.push(`+${s} grand slam`); }
      return { made:true, below, above, over, under:0, detail };
    } else {
      const under = need - tricks;
      let pen=0;
      if(dbl===1){ pen = under*(vulnerable?100:50); }
      else {
        // doubled schedule (redoubled = ×2)
        for(let i=1;i<=under;i++){
          let step;
          if(vulnerable){ step = (i===1)?200:300; }
          else { step = (i===1)?100 : (i<=3?200:300); }
          pen += step;
        }
        if(dbl===4) pen *= 2;
      }
      above = pen;  // note: penalty is credited to the OPPONENTS (caller assigns to the defending side)
      detail.push(`down ${under} = ${pen} to defenders`);
      return { made:false, below:0, above:pen, over:0, under, detail };
    }
  }
  
  // Honours held in ONE hand (optional). hand = array of {rank,suit}. trump strain.
  // Returns bonus points (0/100/150) for THAT hand.
  function honoursForHand(hand, strain){
    if(strain==="NT"){
      const aces = hand.filter(c=>c.rank==="A").length;
      return aces===4 ? 150 : 0;
    }
    const set = new Set(hand.filter(c=>c.suit===strain).map(c=>c.rank));
    const top = ["A","K","Q","J","10"].filter(r=>set.has(r)).length;
    return top===5 ? 150 : (top===4 ? 100 : 0);
  }
  
  
  
  return { belowLineTrickScore, scoreHand, honoursForHand, isMinor, isMajor };
})();

const BID = (function(){
  const { STRAINS } = ENG;
  const { auctionInfo, turnSeat, callLegal, bidVal } = AUC;
  
  const HCPV = { A:4, K:3, Q:2, J:1 };
  const ORDER = ["C","D","H","S"];
  const isMajor = (s)=> s==="H"||s==="S";
  const isMinor = (s)=> s==="C"||s==="D";
  
  /* ---------- hand evaluation ---------- */
  function evalHand(hand){
    const by = { S:[], H:[], D:[], C:[] };
    for(const c of hand) by[c.suit].push(c.rank);
    const RV = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14 };
    for(const s in by) by[s].sort((a,b)=>RV[b]-RV[a]);
    const len = { S:by.S.length, H:by.H.length, D:by.D.length, C:by.C.length };
    let hcp=0; for(const c of hand) hcp += HCPV[c.rank]||0;
    // long-suit distribution points (for suit-oriented valuation)
    let lp=0; for(const s of ORDER) if(len[s]>4) lp += len[s]-4;
    const shape = [len.S,len.H,len.D,len.C].slice().sort((a,b)=>b-a);
    const shapeKey = shape.join("");
    const balanced = shapeKey==="4333" || shapeKey==="4432" || shapeKey==="5332";
    // suit honor quality: count of top-3 (A,K,Q) and top-5
    const top3 = (s)=> by[s].filter(r=>r==="A"||r==="K"||r==="Q").length;
    const top5 = (s)=> by[s].filter(r=>["A","K","Q","J","10"].includes(r)).length;
    const longest = ORDER.slice().sort((a,b)=> (len[b]-len[a]) || (ORDER.indexOf(b)-ORDER.indexOf(a)))[0];
    const stopper = (s)=>{
      const rs=by[s];
      if(!rs) return false;   // NT or unknown strain has no single-suit stopper
      if(rs.includes("A")) return true;
      if(rs.includes("K") && len[s]>=2) return true;
      if(rs.includes("Q") && len[s]>=3) return true;
      if(rs.includes("J") && len[s]>=4) return true;
      return false;
    };
    return { by, len, hcp, lp, tp:hcp+lp, shape, balanced, longest, top3, top5, stopper, RV };
  }
  // dummy points for raising partner's suit: hcp + shortness (void5/singleton3/doubleton1) given fit
  function raiseValue(ev){
    let sp=0; for(const s of ORDER){ if(ev.len[s]===0) sp+=5; else if(ev.len[s]===1) sp+=3; else if(ev.len[s]===2) sp+=1; }
    return ev.hcp + sp;
  }
  function bestMinor(ev){ // longer minor, 4-4→D, 3-3→C
    if(ev.len.D>ev.len.C) return "D";
    if(ev.len.C>ev.len.D) return "C";
    return ev.len.D>=4 ? "D" : "C";
  }
  function ruleOf20(ev){ const two=[...ORDER].sort((a,b)=>ev.len[b]-ev.len[a]).slice(0,2); return ev.hcp + ev.len[two[0]] + ev.len[two[1]] >= 20; }
  
  /* ---------- auction parsing for a seat ---------- */
  function callsBy(calls){ const m={0:[],1:[],2:[],3:[]}; for(const c of calls) m[c.by].push(c); return m; }
  function lastBidOf(list){ for(let i=list.length-1;i>=0;i--) if(list[i].k==="B") return list[i]; return null; }
  function anyBid(list){ return list.some(c=>c.k==="B"); }
  
  // build a rich context for the seat about to call
  function context(calls, dealer, seat){
    const info = auctionInfo(calls, dealer);
    const by = callsBy(calls);
    const partner = (seat+2)%4;
    const lho = (seat+1)%4, rho = (seat+3)%4;
    const iOpened = anyBid(by[seat]);
    const partnerOpened = anyBid(by[partner]);
    const oppsBid = anyBid(by[lho]) || anyBid(by[rho]);
    // who opened the auction (first bid)?
    let openerSeat=-1; for(const c of calls){ if(c.k==="B"){ openerSeat=c.by; break; } }
    return { info, by, partner, lho, rho, iOpened, partnerOpened, oppsBid, openerSeat,
      myBids:by[seat], partnerBids:by[partner], lhoBids:by[lho], rhoBids:by[rho],
      myLast:lastBidOf(by[seat]), partnerLast:lastBidOf(by[partner]),
      lhoLast:lastBidOf(by[lho]), rhoLast:lastBidOf(by[rho]) };
  }
  
  const P={k:"P"}, DBL={k:"D"}, RDBL={k:"R"};
  const B=(level,strain)=>({k:"B",level,strain});
  
  /* ---- estimate partner's shown HCP range from their calls ---- */
  function estimatePartner(ctx){
    const bids = ctx.partnerBids.filter(c=>c.k==="B");
    if(!bids.length) return {min:0,max:0,bid:false};
    const first=bids[0];
    let min=6, max=21;
    if(first.strain==="NT"){
      if(first.level===1){ min=15; max=17; }
      else if(first.level===2){ min=20; max=21; }
      else if(first.level===3){ min=25; max=27; }
    } else if(first.level===2 && first.strain==="C"){ min=22; max=30; }
    else if(first.level===2){ min=5; max=11; }      // weak two
    else if(first.level===3){ min=5; max=10; }       // preempt
    else if(first.level===1){ min=12; max=21; }      // one of a suit (opener)
    const partnerOpened = ctx.openerSeat===ctx.partner;
    // refine an OPENER partner by their rebid ladder (classic SAYC)
    if(partnerOpened && bids.length>=2 && first.level===1 && first.strain!=="NT"){
      const rb=bids[1], myFirst=ctx.myBids.find(c=>c.k==="B");
      const openStrain=first.strain;
      const gap = bidVal(rb)-bidVal(first);
      if(rb.strain==="NT"){
        if(rb.level===1){ min=12; max=14; }
        else if(rb.level===2){ min=18; max=19; }
        else { min=19; max=21; }
      } else if(myFirst && rb.strain===myFirst.strain){        // raised my suit
        if(rb.level<= (rankLevelOfRaise(myFirst,1))){ min=12; max=15; }
        else if(rb.level===myFirst.level+2){ min=19; max=21; } // double-jump raise → to game usually
        else { min=16; max=18; }                                // jump raise / game try
      } else if(rb.strain===openStrain){                        // rebid own suit
        min=12; max= (rb.level>=first.level+2)?18:15;            // jump rebid = 16-18
        if(rb.level>=first.level+2) min=16;
      } else {                                                   // new suit
        const reverse = ORDER.indexOf(rb.strain)>ORDER.indexOf(openStrain) && rb.level>first.level;
        if(reverse){ min=16; max=18; }
        else if(gap>=6){ min=19; max=21; }                       // jump shift
        else { min=12; max=16; }
      }
    } else if(partnerOpened && bids.length>=2 && first.level===2 && first.strain==="C"){
      // strong 2C opener's rebid: NT rebid pins a balanced range; suit rebid shows a strong 5+ suit
      const rb=bids[1];
      if(rb.strain==="NT"){
        if(rb.level===2){ min=22; max=24; }        // 2C then 2NT
        else if(rb.level===3){ min=25; max=27; }   // 2C then 3NT
        else { min=22; max=30; }
      } else { min=22; max=30; }                    // 2C then a suit = huge, unbounded upward
    } else if(partnerOpened && bids.length>=2 && first.strain!=="NT" && first.level!==2){
      if(looksStrong(bids)) min=Math.max(min,16); else max=Math.min(max,17);
    }
    // if partner is the RESPONDER (I opened) their range is from responses
    if(ctx.iOpened && ctx.openerSeat!==ctx.partner){
      const r=first;
      const myOpen=ctx.myBids.find(c=>c.k==="B");
      if(r.strain==="NT" && r.level===1){ min=6; max=9; }
      else if(r.strain==="NT" && r.level===2){ min=13; max=15; }
      else if(r.strain==="NT" && r.level===3){ min=16; max=18; }
      else if(myOpen && r.strain===myOpen.strain){             // raised my suit
        if(r.level===myOpen.level+1){ min=6; max=10; }
        else if(r.level===myOpen.level+2){ min=10; max=12; }   // limit raise
        else { min=6; max=10; }
      }
      else if(r.level>=2 && r.strain!=="NT"){ min=10; max=21; } // 2-over-1
      else { min=6; max=12; }                                   // 1-level new suit
      if(bids.length>=2 && looksStrong(bids)) min=Math.max(min,12);
    }
    return {min,max,bid:true,first};
  }
  function rankLevelOfRaise(myFirst, extra){ return myFirst.level + extra; }
  function looksStrong(bids){
    // crude: a jump between successive own bids implies extras
    for(let i=1;i<bids.length;i++){
      if(bidVal(bids[i])-bidVal(bids[i-1])>=6) return true;
    }
    return false;
  }
  
  /* ======================================================================
     MAIN: choose a call for `seat` given the hand and auction so far.
     Returns a legal call. Falls back to Pass.
     ====================================================================== */
  function chooseBid(hand, calls, dealer, seat){
    const ev = evalHand(hand);
    const ctx = context(calls, dealer, seat);
    let call = decide(ev, ctx, hand, seat);
    // ---- sanity ceiling: don't climb past what our combined strength supports ----
    if(call && call.k==="B" && call.level>=5){
      const pl=ctx.partnerLast, myLast=ctx.myLast;
      // exemptions: convention answers/placements where high bids are demanded
      const answeringAces = pl && ((pl.strain==="NT"&&pl.level===4) || (pl.strain==="C"&&pl.level===4)); // Blackwood/Gerber ask
      const placingSlam    = myLast && ((myLast.strain==="NT"&&myLast.level===4) || (myLast.strain==="C"&&myLast.level===4)); // I asked, now placing
      if(!answeringAces && !placingSlam){
        const est=estimatePartner(ctx);
        const combined = ev.hcp + (est.bid?est.min:0) + Math.floor(ev.lp/2);
        let ceil=4;                         // game is the default ceiling
        if(combined>=37) ceil=7;
        else if(combined>=33) ceil=6;
        else if(combined>=28) ceil=5;       // minor-suit game / stretch
        if(call.level>ceil) call = P;
      }
    }
    if(!call || !callLegal(call, calls, dealer)){
      // try pass; if the intended bid was illegal, pass is the safe fallback
      call = P;
    }
    return call;
  }
  
  function decide(ev, ctx, hand, seat){
    const { info } = ctx;
    const iHaveBid = ctx.myBids.some(c=>c.k==="B");
    const iAmOpener = ctx.openerSeat===seat;
    const partnerIsOpener = ctx.openerSeat===ctx.partner;
    // -------- opening (no bid yet by anyone) --------
    if(!info.opened){
      return openingBid(ev, ctx);
    }
    // -------- I opened the auction; this is my rebid / later --------
    if(iAmOpener){
      return openerRebid(ev, ctx);
    }
    // -------- partner opened; I respond (responderBid dispatches to continuation) --------
    if(partnerIsOpener){
      return responderBid(ev, ctx);
    }
    // -------- opponents opened (neither partner nor I) --------
    // partner already acted (overcalled/doubled) → I advance
    if(ctx.partnerBids.some(c=>c.k==="B")) return advancerBid(ev, ctx);
    // I already overcalled → competitive continuation (treat my overcall as "opener")
    if(iHaveBid) return openerRebid(ev, ctx);
    // first chance to act over their opening
    return overcallBid(ev, ctx);
  }
  
  /* ---------------- OPENING ---------------- */
  function openingBid(ev, ctx){
    const { hcp, tp, balanced, len } = ev;
    // strong, artificial 2C
    if(hcp>=22 || (tp>=23 && longestGood(ev))) return B(2,"C");
    // balanced NT ladders
    if(balanced){
      if(hcp>=15 && hcp<=17) return B(1,"NT");
      if(hcp>=20 && hcp<=21) return B(2,"NT");
      if(hcp>=25 && hcp<=27) return B(3,"NT");
    }
    // one of a suit (all 12+ HCP, 13+ total points, or a shapely 11 by Rule of 20)
    if(hcp>=12 || tp>=13 || (ev.hcp>=11 && ruleOf20(ev))){
      // 5-card major (higher of 5-5/6-6)
      if(len.S>=5 || len.H>=5){
        if(len.S>len.H) return B(1,"S");
        if(len.H>len.S) return B(1,"H");
        return B(1,"S"); // 5-5 or 6-6 → higher
      }
      // no 5-card major → longer minor (4-4→D, 3-3→C); 4441 pick a minor
      return B(1, bestMinor(ev));
    }
    // weak two in D/H/S: 6-card suit, 5-10 hcp, decent suit, no better opening
    for(const s of ["S","H","D"]){
      if(len[s]===6 && ev.hcp>=5 && ev.hcp<=10 && ev.top3(s)>=1 && ev.top5(s)>=2 && !hasOutsideMajor4(ev,s)) return B(2,s);
    }
    // 3-level preempt: 7-card suit, ~5-10 hcp
    for(const s of ["S","H","D","C"]){
      if(len[s]>=7 && ev.hcp>=5 && ev.hcp<=10 && ev.top5(s)>=2) return B(3,s);
    }
    return P;
  }
  function longestGood(ev){ return ev.top3(ev.longest)>=2 && ev.len[ev.longest]>=5; }
  function hasOutsideMajor4(ev, s){ return ORDER.some(x=> x!==s && isMajor(x) && ev.len[x]>=4); }
  
  /* ---------------- RESPONDING TO PARTNER'S OPENING ---------------- */
  function responderBid(ev, ctx){
    const op = ctx.partnerBids.find(c=>c.k==="B"); // partner's first bid = the opening
    // if I've already responded once, this is my rebid → use the continuation driver
    if(ctx.myBids.some(c=>c.k==="B")) return responderContinue(ev, ctx, op);
    // route by opening type
    if(op.strain==="NT"){
      if(op.level===1) return respTo1NT(ev, ctx);
      if(op.level===2) return respTo2NT(ev, ctx);
      if(op.level===3) return P;
    }
    if(op.level===2 && op.strain==="C") return respTo2C(ev, ctx);
    if(op.level===2 && op.strain!=="C") return respToWeak2(ev, ctx, op);
    if(op.level===3) return respToPreempt(ev, ctx, op);
    if(op.level===1) return respTo1Suit(ev, ctx, op);
    return P;
  }
  
  function respTo1NT(ev, ctx){
    const h=ev.hcp, len=ev.len;
    // with a 5+ major, transfer; with 4-4 majors and game interest, Stayman
    const has5M = len.H>=5 || len.S>=5;
    // 8-9 invite, 10+ game, 0-7 signoff
    if(len.H>=5 && len.H>=len.S){
      // transfer to hearts (bid 2D)
      if(h>=10 || (h>=8 && len.H>=6)) { /* will complete after accept */ }
      return B(2,"D");
    }
    if(len.S>=5){
      return B(2,"H"); // transfer to spades
    }
    // Stayman with a 4-card major and invitational+ values
    if((len.H===4||len.S===4) && h>=8) return B(2,"C");
    // quantitative
    if(h>=8 && h<=9) return B(2,"NT");
    if(h>=10 && h<=15) return B(3,"NT");
    if(h>=16 && h<=17) return B(4,"NT"); // invite 6NT
    if(h>=18) return B(6,"NT");
    // long minor bust: transfer to clubs (2S) with 6+ minor and weak
    return P;
  }
  function respTo2NT(ev, ctx){
    const h=ev.hcp, len=ev.len;
    if(len.H>=5) return B(3,"D"); // transfer
    if(len.S>=5) return B(3,"H");
    if((len.H===4||len.S===4) && h>=4) return B(3,"C"); // Stayman
    if(h>=4 && h<=10) return B(3,"NT");
    if(h>=11) return B(4,"NT"); // quantitative slam invite
    return P;
  }
  function respTo2C(ev, ctx){
    // if partner (opener) has already rebid, handle continuation; else give first response
    const opnRebid = ctx.partnerBids.filter(c=>c.k==="B").length>=2;
    if(!opnRebid){
      const h=ev.hcp;
      if(h>=8 && ev.longest && ev.len[ev.longest]>=5 && ev.top3(ev.longest)>=1){
        // positive
        const s=ev.longest;
        return B(2, s==="C"?"C":s==="D"?"D":s); // natural positive
      }
      return B(2,"D"); // waiting
    }
    // after opener's rebid, keep bidding toward game (game-forcing)
    return continueGameForce(ev, ctx);
  }
  function respToWeak2(ev, ctx, op){
    const h=ev.hcp, s=op.strain, fit=ev.len[s];
    // raises are preemptive; 2NT is the feature/strength ask (forcing)
    if(h>=15 || (h>=13 && fit>=3)) return B(2,"NT"); // ask
    if(fit>=4) return B(4,s);   // extend the preempt / to play
    if(fit>=2 && h>=8 && h<=14 && raiseValue(ev)>= (op.level*0+8)) return B(3,s); // mild raise (preemptive)
    if(h>=14 && ev.balanced) return B(3,"NT");
    return P;
  }
  function respToPreempt(ev, ctx, op){
    const h=ev.hcp, s=op.strain, fit=ev.len[s];
    if(fit>=3 && (h+ev.lp)>=12) return B(4,s); // raise to game if likely
    if(h>=16 && ev.balanced && ev.stopper(s)) return B(3,"NT");
    if(fit<3 && h<16) return P;
    return P;
  }
  function respTo1Suit(ev, ctx, op){
    const s=op.strain, h=ev.hcp, len=ev.len;
    const rv = raiseValue(ev);
    const majorOpen = isMajor(s);
    // ---- support for opener's MAJOR ----
    if(majorOpen && len[s]>=3){
      if(rv>=13) return B(2,"NT");             // Jacoby 2NT game-forcing raise
      if(rv>=10 && rv<=11 && len[s]>=3) return B(3,s); // limit raise
      if(rv>=6 && rv<=9) return B(2,s);        // single raise
      if(rv<6 && len[s]>=4) return B(2,s);     // stretch weak raise with 4 trumps
    }
    // ---- 1-over-1 new suit at the one level (spades over hearts/minors, etc.) ----
    // respond a 4+ card suit up the line at the 1 level with 6+
    if(h>=6){
      // 1-level responses: bid a 4+ major at the 1 level, cheapest, spades priority if 5+
      const oneLevel = [];
      if(s!=="H" && len.H>=4 && higher("H",s)) oneLevel.push("H");
      if(s!=="S" && len.S>=4 && higher("S",s)) oneLevel.push("S");
      if(s==="C" && len.D>=4) oneLevel.push("D"); // 1D over 1C
      // pick longest, then up the line
      oneLevel.sort((a,b)=> (len[b]-len[a]) || (ORDER.indexOf(a)-ORDER.indexOf(b)));
      if(oneLevel.length) return B(1, oneLevel[0]);
    }
    // ---- 2-over-1 new suit (needs 10+; game-forcing-ish, treat as forcing) ----
    if(h>=10){
      const twoLevel = ORDER.filter(x=> x!==s && lowerRankThanOpening(x,s) && len[x]>=4 );
      // prefer a good 5+ suit; only bid a minor at 2-level if 4+
      twoLevel.sort((a,b)=> (len[b]-len[a]) || (ORDER.indexOf(b)-ORDER.indexOf(a)));
      for(const x of twoLevel){
        if(len[x]>=5 || (isMinor(x)&&len[x]>=4)) return B(2,x);
      }
    }
    // ---- support opener's MINOR (only if no major to show and enough) ----
    if(isMinor(s) && len[s]>=4){
      if(rv>=13 && !hasFourMajor(ev)) return B(3, s);  // strong minor raise (inverted-ish; keep simple)
      if(rv>=6 && rv<=10 && !hasFourMajor(ev)) return B(2, s);
    }
    // ---- notrump responses (no fit, no biddable suit) ----
    if(ev.balanced || !hasBiddableSuit(ev,s)){
      if(h>=6 && h<=9) return B(1,"NT");     // 1NT: 6-9, not forcing
      if(h>=13 && h<=15 && ev.balanced && allStopped(ev,s)) return B(2,"NT");
      if(h>=16 && h<=18 && ev.balanced && allStopped(ev,s)) return B(3,"NT");
    }
    if(h>=6 && h<=9) return B(1,"NT");
    return P;
  }
  // after I asked Blackwood (my last bid 4NT) and partner answered at the 5-level, place slam/game.
  function handleBlackwoodResult(ev, ctx){
    const myLast=ctx.myLast, pl=ctx.partnerLast;
    if(!(myLast && myLast.strain==="NT" && myLast.level===4)) return null;
    if(!(pl && pl.level===5 && pl.strain!=="NT")) return null;
    const idx={C:0,D:1,H:2,S:3}[pl.strain];           // 5C=0/4 aces,5D=1,5H=2,5S=3
    const partnerAces = idx;                            // (0 or 4 both map to 5C; treat as ≥? assume worst=0)
    const myAces = countAces(ev);
    const total = myAces + partnerAces;
    // agreed trump: prefer a real suit fit
    const fit=findFit(ev,ctx);
    const trump = fit ? fit.suit : lastOurSuit(ctx) || ev.longest;
    const mk=(L)=> bidVal(B(L,trump))>bidVal(ctx.info.lastBid)?B(L,trump):P;
    if(total<=2) return mk(5);           // missing 2+ aces → sign off in 5
    if(total>=4) return mk(7);           // all aces → grand
    return mk(6);                        // small slam
  }
  function lastOurSuit(ctx){ const all=[...ctx.myBids,...ctx.partnerBids].filter(c=>c.k==="B"&&c.strain!=="NT"); return all.length?all[all.length-1].strain:null; }
  
  /* responder's rebid: partner opened, I responded, partner rebid — now place the contract. */
  function responderContinue(ev, ctx, op){
    const bwr=handleBlackwoodResult(ev,ctx); if(bwr) return bwr;
    const est=estimatePartner(ctx);
    const combinedMin = ev.hcp + est.min;
    const combinedMax = ev.hcp + est.max;
    // if partner just asked Blackwood/Gerber, answer
    const bw=blackwoodResponse(ev,ctx); if(bw) return bw;
    const gb=gerberResponse(ev,ctx); if(gb) return gb;
    // did I show/find a fit? look for a suit where partner bid it and I have 3+, or I bid it and partner raised
    const fit = findFit(ev, ctx);
    return placeContract(ev, ctx, combinedMin, combinedMax, fit);
  }
  // find an agreed/likely trump fit (suit + our combined length estimate)
  function findFit(ev, ctx){
    const pB = ctx.partnerBids.filter(c=>c.k==="B");
    // the strong, artificial 2C opening is NOT a real club suit
    const strong2C = ctx.openerSeat===ctx.partner && pB[0] && pB[0].level===2 && pB[0].strain==="C";
    const partnerSuits = pB.filter((c,i)=> c.strain!=="NT" && !(strong2C && i===0)).map(c=>c.strain);
    const mySuits = ctx.myBids.filter(c=>c.k==="B" && c.strain!=="NT").map(c=>c.strain);
    // a raise happened: partner bid a suit I have 4+, or I bid a suit partner raised
    for(const s of partnerSuits){ if(ev.len[s]>=(isMajor(s)?3:4)) return {suit:s, len:ev.len[s]+ (isMajor(s)?5:5)}; }
    for(const s of mySuits){ if(partnerSuits.includes(s)) return {suit:s, len:ev.len[s]+3}; }
    // major suit where I have 5+ and partner opened NT and accepted transfer etc.
    for(const s of ["S","H"]){ if(ev.len[s]>=5 && partnerSuits.includes(s)) return {suit:s,len:ev.len[s]+3}; }
    return null;
  }
  // choose invite/game/slam/pass at the cheapest legal level given combined strength
  function placeContract(ev, ctx, cmin, cmax, fit){
    const legalNT=(L)=> bidVal(B(L,"NT"))>bidVal(ctx.info.lastBid);
    const raise=(s,L)=> B(L,s);
    // with 33+/37+ combined and a balanced hand, stoppers are guaranteed across the partnership
    const ntSlamOK = allStopped(ev,"") || ev.balanced;
    // GRAND SLAM zone (37+): drive to 7 when balanced/stopped or via Blackwood in a major fit
    if(cmin>=37){
      if(fit && isMajor(fit.suit) && bidVal(B(4,"NT"))>bidVal(ctx.info.lastBid)) return B(4,"NT"); // Blackwood → 7 after aces
      if(ntSlamOK && legalNT(7)) return B(7,"NT");
      if(fit && isMajor(fit.suit) && bidVal(B(7,fit.suit))>bidVal(ctx.info.lastBid)) return B(7,fit.suit);
    }
    // SMALL SLAM zone
    if(cmin>=33){
      if(fit && isMajor(fit.suit) && bidVal(B(4,"NT"))>bidVal(ctx.info.lastBid)) return B(4,"NT"); // Blackwood
      if(ntSlamOK && legalNT(6)) return B(6,"NT");
      if(fit && isMajor(fit.suit) && bidVal(B(6,fit.suit))>bidVal(ctx.info.lastBid)) return B(6,fit.suit);
    }
    if(fit && isMajor(fit.suit)){
      const s=fit.suit;
      if(cmin>=25) return legalOrPass(B(4,s),ctx);
      if(cmax>=24 && cmin>=22) return legalOrPass(B(3,s),ctx); // invite (only if not already at 3)
      return signoff(B(2,s),ctx);
    }
    if(fit && isMinor(fit.suit) && !balancedGameNT(ev,ctx,cmin)){
      const s=fit.suit;
      if(cmin>=29) return legalOrPass(B(5,s),ctx);
      return signoff(B(3,s),ctx);
    }
    // NT placement
    if(allStopped(ev,"") || ev.balanced){
      if(cmin>=25) return legalNT(3)?B(3,"NT"):P;
      if(cmin>=23) return legalNT(2)?B(2,"NT"):P;
      return P;
    }
    // no fit, not enough for NT → pass or take a cheap preference
    return P;
  }
  function balancedGameNT(ev,ctx,cmin){ return ev.balanced && cmin>=25 && allStopped(ev,""); }
  function legalOrPass(bid,ctx){ return bidVal(bid)>bidVal(ctx.info.lastBid) ? bid : P; }
  function signoff(bid,ctx){ return bidVal(bid)>bidVal(ctx.info.lastBid) ? bid : P; }
  
  function higher(a,b){ return ORDER.indexOf(a)>ORDER.indexOf(b); }
  function lowerRankThanOpening(x, s){ return ORDER.indexOf(x)<ORDER.indexOf(s); }
  function hasFourMajor(ev){ return ev.len.H>=4 || ev.len.S>=4; }
  function hasBiddableSuit(ev,s){ return ORDER.some(x=> x!==s && ev.len[x]>=4); }
  function allStopped(ev,openSuit){ return ORDER.every(x=> x===openSuit || ev.stopper(x)); }
  
  /* ---------------- OPENER'S REBID ---------------- */
  function openerRebid(ev, ctx){
    const myOpen = ctx.myBids.find(c=>c.k==="B");
    const pr = ctx.partnerLast;
    // partner passed / no response info → often pass or rebid
    if(!pr){ return P; }
    const h=ev.hcp, tp=ev.tp, s=myOpen?myOpen.strain:null;
  
    // If we opened 1NT/2NT and partner used Stayman/transfer, respond to the convention.
    if(myOpen && myOpen.strain==="NT"){
      return ntOpenerRebid(ev, ctx, myOpen);
    }
    if(myOpen && myOpen.level===2 && myOpen.strain==="C"){
      return twoCOpenerRebid(ev, ctx);
    }
  
    // if I asked Blackwood and partner answered → place slam
    const bwr = handleBlackwoodResult(ev, ctx);
    if(bwr) return bwr;
    // Blackwood / slam responses if partner asked
    const bw = blackwoodResponse(ev, ctx);
    if(bw) return bw;
    const gb = gerberResponse(ev, ctx);
    if(gb) return gb;
  
    // partner raised our suit → place the contract on combined strength
    if(pr.strain===s){
      const est=estimatePartner(ctx);
      const cmin=ev.tp+est.min, cmax=ev.tp+est.max;
      const fit={suit:s, len: ev.len[s]+4};
      return placeContract(ev, ctx, cmin, cmax, fit);
    }
    // partner responded 1NT (6-9): rebid
    if(pr.strain==="NT" && pr.level===1){
      // rebid a 6-card suit, or a lower new suit, or pass
      if(ev.len[s]>=6) return B(2,s);
      const second = secondSuit(ev, s, 2);
      if(second) return second;
      return P;
    }
    // partner bid a new suit
    if(pr.strain!==s){
      const rs=pr.strain;
      // raise partner's major with 4-card support
      if(isMajor(rs) && ev.len[rs]>=4){
        if(tp>=19) return B(4,rs);
        if(tp>=17) return B(3,rs);
        return B(2,rs);
      }
      // rebid NT with balanced extras
      if(ev.balanced){
        if(tp>=18 && tp<=19) return jumpNT(ev,ctx);
        if(tp>=12 && tp<=14 && canRebid1NT(ctx)) return B(1,"NT");
        if(tp>=12 && tp<=14) return B(ntLevelToRebid(ctx),"NT");
      }
      // rebid own 6-card suit
      if(ev.len[s]>=6){ return B(rebidLevel(ctx,s), s); }
      // show a second suit (lower ranking, non-reverse if minimum)
      const second = secondSuit(ev, s, rebidLevel(ctx,null));
      if(second) return second;
      // raise partner's minor
      if(isMinor(rs) && ev.len[rs]>=4) return B(minRaiseLevel(ctx,rs), rs);
      // fallback NT
      if(allStopped(ev,s)) return B(ntLevelToRebid(ctx),"NT");
      return P;
    }
    return P;
  }
  function allStoppedExcept(ev,s){ return ORDER.every(x=> x===s || ev.stopper(x)); }
  function canRebid1NT(ctx){ return bidVal(B(1,"NT")) > bidVal(ctx.info.lastBid); }
  function ntLevelToRebid(ctx){ // lowest legal NT level
    for(let L=1;L<=3;L++){ if(bidVal(B(L,"NT"))>bidVal(ctx.info.lastBid)) return L; } return 3;
  }
  function jumpNT(ctx){ return B(2,"NT"); }
  function rebidLevel(ctx, s){ for(let L=2;L<=4;L++){ if(s? bidVal(B(L,s))>bidVal(ctx.info.lastBid): true) return L; } return 2; }
  function minRaiseLevel(ctx,s){ for(let L=2;L<=5;L++){ if(bidVal(B(L,s))>bidVal(ctx.info.lastBid)) return L; } return 3; }
  function secondSuit(ev, openSuit, minLevel){
    // pick a 4+ suit other than opener's, lowest ranking that keeps it a non-reverse when minimum
    const cand = ORDER.filter(x=> x!==openSuit && ev.len[x]>=4);
    cand.sort((a,b)=> (ev.len[b]-ev.len[a]) || (ORDER.indexOf(a)-ORDER.indexOf(b)));
    if(!cand.length) return null;
    const x=cand[0];
    return B(2, x);
  }
  
  function ntOpenerRebid(ev, ctx, myOpen){
    // partner's last convention call
    const pl = ctx.partnerLast;
    if(!pl) return P;
    // Stayman (2C over 1NT, 3C over 2NT)
    const stayLevel = myOpen.level===1?2:3;
    if(pl.strain==="C" && pl.level===stayLevel){
      if(ev.len.H===4 && ev.len.S===4) return B(stayLevel,"H"); // show hearts first w/ both
      if(ev.len.H===4) return B(stayLevel,"H");
      if(ev.len.S===4) return B(stayLevel,"S");
      return B(stayLevel,"D"); // no 4-card major
    }
    // Transfers: over 1NT: 2D→H, 2H→S ; over 2NT: 3D→H, 3H→S
    const tRankBase = myOpen.level===1?2:3;
    if(pl.level===tRankBase && pl.strain==="D") return B(tRankBase,"H"); // accept transfer to hearts
    if(pl.level===tRankBase && pl.strain==="H") return B(tRankBase,"S"); // accept transfer to spades
    // partner invited 2NT/4NT (quantitative) → accept with a max
    if(pl.strain==="NT" && pl.level===2 && myOpen.level===1){ return (ev.hcp>=17)? B(3,"NT"):P; }
    if(pl.strain==="NT" && pl.level===4){ return (ev.hcp>=17)? B(6,"NT"):P; }
    // after we accepted a transfer and partner raised NT / bid game, pass or convert
    return P;
  }
  function twoCOpenerRebid(ev, ctx){
    const pl = ctx.partnerLast;
    const myBids = ctx.myBids.filter(c=>c.k==="B");
    if(myBids.length===1){
      // first rebid after 2C
      if(ev.balanced){
        if(ev.hcp>=22 && ev.hcp<=24) return B(2,"NT");
        if(ev.hcp>=25) return B(3,"NT");
      }
      // natural: bid longest suit at cheapest level (game forcing)
      const s=ev.longest;
      return B(cheapestSuitLevel(ctx,s), s);
    }
    // later — drive to game
    return continueGameForce(ev, ctx);
  }
  function cheapestSuitLevel(ctx,s){ for(let L=2;L<=4;L++){ if(bidVal(B(L,s))>bidVal(ctx.info.lastBid)) return L; } return 3; }
  
  /* ---------------- OVERCALLS / DOUBLES / ADVANCES ---------------- */
  function overcallBid(ev, ctx){
    const oppBid = ctx.info.lastBid;
    const oppOpen = firstOppBid(ctx);
    const h=ev.hcp;
    // 1NT overcall: 15-18 balanced with a stopper in their suit
    if(ev.balanced && h>=15 && h<=18 && ev.stopper(oppOpen.strain) && oppBid.level===1) return B(1,"NT");
    // takeout double: opening values, short in their suit, support for unbid suits
    if(h>=12 && ev.len[oppOpen.strain]<=2 && shapeForTakeout(ev, oppOpen.strain) && oppBid.level<=2){
      return DBL;
    }
    // simple suit overcall: a good 5+ suit, playing strength
    for(const s of ["S","H","D","C"]){
      if(s===oppOpen.strain) continue;
      if(ev.len[s]>=5 && ev.top5(s)>=2){
        // one level if legal & higher than their bid
        if(higherStrainSameLevel(s, oppBid)) return B(oppBid.level, s);
        // else two level needs a stronger hand/suit
        if(h>=10 && ev.top3(s)>=2) return B(oppBid.level+ (bidVal(B(oppBid.level,s))>bidVal(oppBid)?0:1), s);
      }
    }
    // weak jump overcall with a good 6-card suit
    for(const s of ["S","H","D","C"]){
      if(s===oppOpen.strain) continue;
      if(ev.len[s]>=6 && h>=6 && h<=10 && ev.top3(s)>=1){
        const L=oppBid.level+1; if(bidVal(B(L,s))>bidVal(oppBid)) return B(L,s);
      }
    }
    return P;
  }
  function firstOppBid(ctx){ for(const c of [...ctx.lhoBids,...ctx.rhoBids]){ if(c.k==="B") return c; }
    // fallback: scan info
    return ctx.info.lastBid; }
  function shapeForTakeout(ev, theirSuit){ // support (3+) for the other suits, esp. majors
    const others=ORDER.filter(x=>x!==theirSuit);
    const supp=others.filter(x=>ev.len[x]>=3).length;
    return supp>=3 || (isMinor(theirSuit) && ev.len.H>=4 && ev.len.S>=4);
  }
  function higherStrainSameLevel(s, oppBid){ return bidVal(B(oppBid.level,s))>bidVal(oppBid); }
  
  function advancerBid(ev, ctx){
    // partner overcalled or doubled; simple advances
    const pOver = ctx.partnerLast;
    if(!pOver) return P;
    if(pOver.k==="B"){
      const s=pOver.strain, h=ev.hcp;
      if(s!=="NT" && ev.len[s]>=3){
        if(h>=13) return cueRaise(ev,ctx,s);
        if(h>=10) return B(Math.min(3,pOver.level+1), s);
        if(h>=6)  return B(pOver.level+1, s);
      }
      if(h>=9 && ev.balanced) return B(pOver.strain==="NT"?3:1,"NT");
      return P;
    }
    return P;
  }
  function cueRaise(ev,ctx,s){ return B(Math.min(4,3), s); }
  
  /* ---------------- SLAM: Blackwood / Gerber ---------------- */
  // If PARTNER just bid 4NT (Blackwood) and there's an agreed trump/context, answer aces.
  function blackwoodResponse(ev, ctx){
    const pl = ctx.partnerLast;
    if(!pl || !(pl.strain==="NT" && pl.level===4)) return null;
    // only treat as Blackwood if a suit fit was established (not a jump from NT which is quantitative)
    const aces = countAces(ev);
    const step = aces%5; // 0/4→5C,1→5D,2→5H,3→5S
    const map = ["C","D","H","S","C"];
    const strain = (aces===4)?"C":map[aces];
    return B(5, aces===4?"C":map[aces]);
  }
  function gerberResponse(ev, ctx){
    const pl = ctx.partnerLast;
    if(!pl || !(pl.strain==="C" && pl.level===4)) return null;
    // Gerber only over our NT bid
    const myNT = ctx.myBids.some(c=>c.k==="B" && c.strain==="NT");
    if(!myNT) return null;
    const aces=countAces(ev);
    const map=["D","H","S","NT","D"];
    return B(4, map[aces]);
  }
  function countAces(ev){ let a=0; for(const s of ORDER) if(ev.by[s].includes("A")) a++; return a; }
  
  // generic "keep going to game" for GF auctions
  function continueGameForce(ev, ctx){
    const pl=ctx.partnerLast;
    const legal=(c)=> bidVal(c)>bidVal(ctx.info.lastBid);
    const est=estimatePartner(ctx);
    // conservative combined strength: partner's shown floor + my points
    const combined = ev.hcp + (est.bid?est.min:6) + Math.floor(ev.lp/2);
    // is there a known 8-card major fit?
    let fitSuit=null;
    for(const s of ["S","H"]){
      const pBidIt = ctx.partnerBids.some(c=>c.k==="B"&&c.strain===s);
      const iBidIt = ctx.myBids.some(c=>c.k==="B"&&c.strain===s);
      if(pBidIt && ev.len[s]>=3) fitSuit=s;
      else if(iBidIt && pBidIt) fitSuit=s;
    }
    const ntOK = ev.balanced && allStopped(ev,"");
    // ---- NT slam ladder (balanced auctions / partner rebid NT) ----
    if((pl && pl.strain==="NT") || ntOK){
      if(combined>=37 && legal(B(7,"NT"))) return B(7,"NT");
      if(combined>=33 && legal(B(6,"NT"))) return B(6,"NT");
      if(combined>=33 && legal(B(4,"NT"))) return B(4,"NT"); // quantitative invite
      const L=ntLevelToRebid(ctx); return B(Math.max(L,3),"NT");
    }
    // ---- suit fit: Blackwood toward slam, else raise to game ----
    if(fitSuit){
      if(combined>=33 && legal(B(4,"NT"))) return B(4,"NT"); // Blackwood (fit agreed)
      const target=Math.max(4, (pl&&pl.strain===fitSuit)?pl.level:4);
      for(let L=target; L<=7; L++){ if(legal(B(L,fitSuit))) return B(L,fitSuit); }
    }
    // ---- fallbacks (original behavior) ----
    if(pl && pl.strain!=="NT" && ev.len[pl.strain]>=3 && isMajor(pl.strain)){
      if(legal(B(4,pl.strain))) return B(4,pl.strain);
    }
    if(ntOK){ const L=ntLevelToRebid(ctx); return B(Math.max(L,3),"NT"); }
    const s=ev.longest; const L=cheapestSuitLevel(ctx,s); return B(L,s);
  }
  
  
  
  return { chooseBid, evalHand, context, raiseValue, ruleOf20 };
})();

const PLY = (function(){
  /* Standard contract-bridge card play — sound single-dummy technique.
     Every decision returns {card, why} so "teaching mode" can explain the exact
     card the engine chose (single source of truth). chooseCard() unwraps to the card.
  
     ctx = { hand, trick:[{rank,suit,player}], ledSuit, trump, seat, declarer, dummy,
             seen[], dummyHand?, mateHand? } */
  const { resolveTrick, legalPlays, RANKVAL } = ENG;
  
  const SUITS=["S","H","D","C"];
  const partnerOf=(s)=>(s+2)%4;
  const sideOf=(s)=>s%2;
  const W=(card,code,p)=>({card, why:Object.assign({code}, p||{})});
  
  const byAsc  =(cs)=> cs.slice().sort((a,b)=>RANKVAL[a.rank]-RANKVAL[b.rank]);
  const byDesc =(cs)=> cs.slice().sort((a,b)=>RANKVAL[b.rank]-RANKVAL[a.rank]);
  function buckets(hand){ const b={S:[],H:[],D:[],C:[]}; for(const c of hand) b[c.suit].push(c); return b; }
  function currentWinner(trick, ledSuit, trump){
    if(!trick.length) return { winner:-1, card:null };
    const r=resolveTrick(trick, ledSuit, trump);
    return { winner:r.winner, card:trick.find(c=>c.player===r.winner) };
  }
  function cheapestWinner(ctx, legal){
    const { trick, ledSuit, trump, seat } = ctx;
    const wins=legal.filter(card=>{
      const r=resolveTrick([...trick,{rank:card.rank,suit:card.suit,player:seat}], ledSuit, trump);
      return r.winner===seat;
    });
    return wins.length ? byAsc(wins)[0] : null;
  }
  function outstanding(suit, known, seen){
    const have=new Set();
    known.forEach(c=>{ if(c.suit===suit) have.add(c.rank); });
    (seen||[]).forEach(c=>{ if(c.suit===suit) have.add(c.rank); });
    return ["A","K","Q","J","10","9","8","7","6","5","4","3","2"].filter(r=>!have.has(r));
  }
  function topOut(suit, known, seen){ const o=outstanding(suit,known,seen); return o.length?RANKVAL[o[0]]:0; }
  
  // full-reason entry point
  function chooseCardWhy(ctx){
    const { hand, trick, ledSuit } = ctx;
    const legal = legalPlays(hand, trick.length? ledSuit : null);
    if(legal.length===1) return W(legal[0], "ONLY");
    return trick.length===0 ? chooseLead(ctx, legal) : chooseFollow(ctx, legal);
  }
  // card-only entry point (bots)
  function chooseCard(ctx){ return chooseCardWhy(ctx).card; }
  
  /* ---------- leading ---------- */
  function chooseLead(ctx, legal){
    const { seat, declarer } = ctx;
    const declaring = sideOf(seat)===sideOf(declarer);
    if(declaring && ctx.mateHand) return declarerLead(ctx, legal);
    return defenderLead(ctx, legal);
  }
  
  function declarerLead(ctx, legal){
    const { hand, mateHand, trump, seen } = ctx;
    const combined = hand.concat(mateHand);
    const known = combined;
    const hereB = buckets(hand), mateB = buckets(mateHand), combB = buckets(combined);
  
    // 1) draw trumps while opponents hold one and I own the master trump
    if(trump!=="NT"){
      const combT = combB[trump]||[];
      const oppT = outstanding(trump, known, seen);
      const iHaveMaster = combT.length && RANKVAL[byDesc(combT)[0].rank] > (oppT.length?RANKVAL[oppT[0]]:0);
      if(oppT.length>0 && iHaveMaster){
        const hereT = hereB[trump]||[];
        if(hereT.length){
          const top=byDesc(hereT)[0];
          if(RANKVAL[top.rank] >= (oppT.length?RANKVAL[oppT[0]]:0)) return W(top,"DECL_DRAW",{suit:trump,card:top.rank});
        }
      }
    }
    // 2) cash a side winner this hand holds
    for(const s of SUITS){
      if(s===trump) continue;
      const here=byDesc(hereB[s]||[]); if(!here.length) continue;
      if(RANKVAL[here[0].rank] > topOut(s, known, seen)) return W(here[0],"DECL_CASH",{suit:s,card:here[0].rank});
    }
    // 3) finesse: lead low toward a broken honour in the other hand
    const fin = finesseLead(ctx, hereB, mateB, known);
    if(fin) return W(fin.card,"DECL_FINESSE",{suit:fin.card.suit,honor:fin.honor});
    // 4) ruff a loser: short side suit here, trumps opposite
    if(trump!=="NT"){
      for(const s of SUITS){
        if(s===trump) continue;
        const here=hereB[s]||[];
        if(here.length && here.length<=2 && (mateB[trump]||[]).length){
          const losers=byAsc((here).filter(c=>RANKVAL[c.rank]<topOut(s,known,seen)));
          if(losers.length) return W(losers[0],"DECL_RUFF",{suit:s});
        }
      }
    }
    // 5) establish: low from the longest combined non-trump suit
    let best=null,len=-1;
    for(const s of SUITS){ if(s===trump) continue; const l=(combB[s]||[]).length; if(l>len && (hereB[s]||[]).length){ len=l; best=s; } }
    if(best && (hereB[best]||[]).length) return W(byAsc(hereB[best])[0],"DECL_ESTABLISH",{suit:best});
    return W(byAsc(legal)[0],"LEAD_LOW",{suit:byAsc(legal)[0].suit});
  }
  
  function finesseLead(ctx, hereB, mateB, known){
    const { seen } = ctx;
    let best=null, bestVal=-1;
    for(const s of SUITS){
      const mate=byDesc(mateB[s]||[]); const here=byAsc(hereB[s]||[]);
      if(!mate.length || !here.length) continue;
      const out=outstanding(s, known, seen);
      const topOutV = out.length?RANKVAL[out[0]]:0;
      for(const h of mate){
        const hv=RANKVAL[h.rank];
        if(hv<12) break;
        if(hv>topOutV) continue;
        const lead=here[0];
        if(RANKVAL[lead.rank] < hv && hv>bestVal){ bestVal=hv; best={card:lead, honor:h.rank}; }
      }
    }
    return best;
  }
  
  function topOfSequence(cards){
    const d=byDesc(cards);
    for(let i=0;i+1<d.length;i++){
      if(RANKVAL[d[i].rank]-RANKVAL[d[i+1].rank]===1 && RANKVAL[d[i].rank]>=11) return d[i];
    }
    return null;
  }
  function defenderLead(ctx, legal){
    const { hand, trump } = ctx;
    const seq=topOfSequence(hand);
    if(seq) return W(seq,"LEAD_SEQ",{suit:seq.suit,top:seq.rank});
    const b=buckets(hand);
    let best=null,len=-1;
    for(const s of SUITS){ if(s===trump) continue; if((b[s]||[]).length>len){ len=(b[s]||[]).length; best=s; } }
    const cand = best!=null ? byDesc(b[best]) : byDesc(legal);
    if(trump!=="NT" && cand.length && cand[0].rank==="A") return W(cand[0],"LEAD_ACE",{suit:cand[0].suit});
    if(cand.length>=4) return W(cand[3],"LEAD_4TH",{suit:cand[3].suit});
    if(cand.length) return W(byAsc(cand)[0],"LEAD_LOW",{suit:cand[0].suit});
    return W(byAsc(legal)[0],"LEAD_LOW",{suit:byAsc(legal)[0].suit});
  }
  
  /* ---------- following ---------- */
  function chooseFollow(ctx, legal){
    const { trick, ledSuit, trump, seat } = ctx;
    const pos=trick.length;
    const partner=partnerOf(seat);
    const cur=currentWinner(trick, ledSuit, trump);
    const partnerWinning = cur.winner===partner;
    const canFollow = legal.some(c=>c.suit===ledSuit);
  
    if(canFollow){
      const suitCards = legal.filter(c=>c.suit===ledSuit);
      if(partnerWinning) return W(byAsc(suitCards)[0],"F_DUCK_PARTNER");
      if(pos===3){ const w=cheapestWinner(ctx, suitCards); return w?W(w,"F_WIN_CHEAP",{card:w.rank}):W(byAsc(suitCards)[0],"F_CANT"); }
      if(pos===2){ const w=cheapestWinner(ctx, suitCards); return w?W(w,"F_3RD_HIGH",{card:w.rank}):W(byAsc(suitCards)[0],"F_CANT"); }
      return W(byAsc(suitCards)[0],"F_2ND_LOW");
    }
    if(trump!=="NT"){
      const myTr=legal.filter(c=>c.suit===trump);
      if(myTr.length && !partnerWinning){ const w=cheapestWinner(ctx, myTr); if(w) return W(w,"RUFF"); }
    }
    const d=discard(ctx, legal);
    return W(d,"DISCARD",{suit:d.suit});
  }
  function discard(ctx, legal){
    const { trump } = ctx;
    const pool = legal.filter(c=>c.suit!==trump).length ? legal.filter(c=>c.suit!==trump) : legal;
    const b=buckets(pool);
    let best=null,len=-1;
    for(const s of SUITS){ if(b[s].length>len){ len=b[s].length; best=s; } }
    return byAsc(b[best])[0];
  }
  
  
  
  return { chooseCard, chooseCardWhy, currentWinner, partnerOf, sideOf };
})();


/* =======================================================================
   DISPLAY CONSTANTS + SEAT / SIDE HELPERS
   ===================================================================== */
const SUIT_GLYPH   = { S:"\u2660\uFE0E", H:"\u2665\uFE0E", D:"\u2666\uFE0E", C:"\u2663\uFE0E" };
const STRAIN_GLYPH = { C:"\u2663\uFE0E", D:"\u2666\uFE0E", H:"\u2665\uFE0E", S:"\u2660\uFE0E", NT:"NT" };
const STRAIN_ORDER = ["C","D","H","S","NT"];
const SEAT_NAME = ["South","West","North","East"];
const SEAT_ABBR = ["S","W","N","E"];
const SIDE_NAME = ["N–S","E–W"];
const sideOf    = (seat)=> seat%2;                 // NS = {0,2}, EW = {1,3}
const partnerOf = (seat)=> (seat+2)%4;
const nextSeat  = (seat)=> (seat+1)%4;
const RVAL = ENG.RANKVAL;
const SUIT_DISPLAY = ["S","H","D","C"];
// group a hand by suit (♠♥♦♣), rank high→low within suit
function sortHandDisplay(hand){
  return [...hand].sort((a,b)=>{
    const sa=SUIT_DISPLAY.indexOf(a.suit), sb=SUIT_DISPLAY.indexOf(b.suit);
    if(sa!==sb) return sa-sb;
    return RVAL[b.rank]-RVAL[a.rank];
  });
}
// the declarer plays the dummy's cards
function controllerOf(s, seat){ return (s.contract && seat===s.dummy) ? s.declarer : seat; }
const callLabel = AUC.callLabel;

/* =======================================================================
   BOT PERSONAS — all bid SAYC and play standard bridge; `skill` only softens
   the weakest persona's non-critical follows (never the human's suggestion).
   ===================================================================== */
const PROFILES = {
  sayer:   {name:"Sayer",   glyph:"♠", color:"var(--sp)",   blurb:"Textbook SAYC. Bids what the points say and plays the percentages.", skill:5},
  rubber:  {name:"Rubber",  glyph:"♥", color:"var(--he)",   blurb:"Old-school rubber player — values tricks, dreads undertricks.",       skill:4},
  gambit:  {name:"Gambit",  glyph:"♦", color:"var(--di)",   blurb:"Aggressive. Stretches for games and competes hard in the auction.",  skill:4},
  finesse: {name:"Finesse", glyph:"♣", color:"var(--cl)",   blurb:"Careful defender. Leads fourth-best and reads the count.",            skill:5},
  novice:  {name:"Novice",  glyph:"☻", color:"var(--cyan)", blurb:"Still learning. A gentle, forgiving opponent to practice against.",   skill:2},
};
const ALL_BRAINS = ["sayer","rubber","gambit","finesse","novice"];
const HUMAN_DISPLAY = { glyph:"☻", color:"var(--cyan)" };
function seatPersona(s,pi){
  return s.brains[pi]==="human"
    ? { name:(pi===0?"You":`Seat ${SEAT_ABBR[pi]}`), glyph:HUMAN_DISPLAY.glyph, color:HUMAN_DISPLAY.color, human:true, skill:5 }
    : PROFILES[s.brains[pi]] || PROFILES.sayer;
}
function who(s,pi){
  const nm=s.names&&s.names[pi];
  if(nm) return nm;
  return s.brains[pi]==="human" ? (pi===0?"You":`Seat ${SEAT_ABBR[pi]}`) : (PROFILES[s.brains[pi]]||PROFILES.sayer).name;
}

/* =======================================================================
   STATE — a rubber (best of three games) played one deal at a time.
   ===================================================================== */
function freshDeal(prev, dealer){
  const deck = ENG.shuffle(ENG.makeDeck());
  const hands = {0:[],1:[],2:[],3:[]};
  for(let i=0;i<52;i++) hands[i%4].push(deck[i]);
  const dealtHands = {0:[...hands[0]],1:[...hands[1]],2:[...hands[2]],3:[...hands[3]]};
  return {
    ...prev,
    phase:"auction",
    hands, dealtHands, dealer,
    calls:[], turn:dealer,
    contract:null, trump:null, declarer:null, dummy:null,
    trick:[], ledSuit:null, tricksPlayed:0,
    tricks:[0,0], seen:[], lastTrick:null, dummyRevealed:false,
    result:null,
    roundStartedAt:Date.now(), roundEndedAt:null,
    log:[`Deal ${prev.dealNo||1}. ${who(prev,dealer)} deals.`],
    dealNo:(prev.dealNo||1),
  };
}
function freshRubber(brains, names, dealer){
  const base = {
    mode:"play", n:4, brains:[...brains], names:(names||["","","",""]).slice(0,4),
    rubberNo:1, dealNo:1,
    games:[0,0], vuln:[false,false], gameBelow:[0,0], total:[0,0],
    rubberDone:false, rubberWinner:null, sheet:[],
  };
  return freshDeal(base, dealer!=null?dealer:0);
}
const SETUP = { mode:"setup", n:4, brains:["human","sayer","gambit","finesse"], names:["","","",""] };

const cloneState=(s)=>{
  const c={...s};
  if(s.hands) c.hands={0:[...s.hands[0]],1:[...s.hands[1]],2:[...s.hands[2]],3:[...s.hands[3]]};
  if(s.dealtHands) c.dealtHands={0:[...s.dealtHands[0]],1:[...s.dealtHands[1]],2:[...s.dealtHands[2]],3:[...s.dealtHands[3]]};
  c.calls=[...(s.calls||[])]; c.trick=[...(s.trick||[])]; c.seen=[...(s.seen||[])];
  c.games=[...s.games]; c.vuln=[...s.vuln]; c.gameBelow=[...s.gameBelow]; c.total=[...s.total];
  c.tricks=[...(s.tricks||[0,0])]; c.brains=[...s.brains];
  c.names=[...(s.names||["","","",""])]; c.sheet=[...(s.sheet||[])]; c.log=[...(s.log||[])];
  return c;
};
const pushLog=(s,l)=>{ s.log=[l,...(s.log||[])].slice(0,40); };

/* ---- auction step ---- */
function applyBid(s, seat, call){
  const c={...call, by:seat};
  s.calls=[...s.calls, c];
  pushLog(s, `${who(s,seat)}: ${callLabel(c)}`);
  const info = AUC.auctionInfo(s.calls, s.dealer);
  if(info.ended){
    if(info.passedOut || !info.contract){
      pushLog(s, "Passed out — redeal.");
      return freshDeal({...s, dealNo:(s.dealNo||1)+1}, nextSeat(s.dealer));
    }
    const ct=info.contract;
    s.contract=ct; s.trump=ct.strain;
    s.declarer=ct.declarer; s.dummy=partnerOf(ct.declarer);
    s.phase="play"; s.turn=nextSeat(ct.declarer);           // opening lead by declarer's LHO
    s.trick=[]; s.ledSuit=null; s.tricksPlayed=0; s.tricks=[0,0]; s.seen=[]; s.dummyRevealed=false;
    const dblTxt = ct.dbl===4?" redoubled":ct.dbl===2?" doubled":"";
    pushLog(s, `Contract: ${ct.level}${STRAIN_GLYPH[ct.strain]}${dblTxt} by ${who(s,ct.declarer)}. ${who(s,s.turn)} leads.`);
    return s;
  }
  s.turn=nextSeat(seat);
  return s;
}

/* ---- play step ---- */
function applyPlay(s, seat, cardId){
  const hand=s.hands[seat];
  const card=hand.find(c=>c.id===cardId) || ENG.legalPlays(hand, s.trick.length?s.ledSuit:null)[0];
  s.hands={...s.hands, [seat]: hand.filter(c=>c.id!==card.id)};
  const firstCardOfDeal = (s.tricksPlayed===0 && s.trick.length===0);
  if(s.trick.length===0) s.ledSuit=card.suit;
  s.trick=[...s.trick, {seat, card}];
  if(firstCardOfDeal) s.dummyRevealed=true;               // dummy exposed after the opening lead
  if(s.trick.length===4){
    const cards=s.trick.map(tc=>({rank:tc.card.rank,suit:tc.card.suit,player:tc.seat}));
    const { winner } = ENG.resolveTrick(cards, s.ledSuit, s.trump);
    s.tricks=[...s.tricks]; s.tricks[sideOf(winner)] += 1;
    s.seen=[...s.seen, ...s.trick.map(tc=>tc.card)];
    s.lastTrick={ trick:s.trick, winner, ledSuit:s.ledSuit };
    pushLog(s, `Trick ${s.tricksPlayed+1}: ${who(s,winner)} wins. ${SIDE_NAME[0]} ${s.tricks[0]} – ${s.tricks[1]} ${SIDE_NAME[1]}.`);
    s.trick=[]; s.ledSuit=null; s.tricksPlayed=s.tricksPlayed+1; s.turn=winner;
    if(s.tricksPlayed===13) return scoreDeal(s);
    return s;
  }
  s.turn=nextSeat(seat);
  return s;
}

/* ---- deal scoring + rubber bookkeeping ---- */
function scoreDeal(s){
  const ct=s.contract;
  const declSide=sideOf(ct.declarer), defSide=1-declSide;
  const target=6+ct.level;
  const declTricks=s.tricks[declSide];
  const vulnerable=s.vuln[declSide];
  const r = SCO.scoreHand(ct, declTricks, vulnerable);
  // honours (held in one hand) — optional standard bonus
  let honDetail=[]; const honSide=[0,0];
  for(let seat=0;seat<4;seat++){
    const h=SCO.honoursForHand(s.dealtHands[seat], ct.strain);
    if(h>0){ honSide[sideOf(seat)]+=h; honDetail.push(`${who(s,seat)} +${h} honours`); }
  }
  s.total=[...s.total]; s.gameBelow=[...s.gameBelow]; s.games=[...s.games]; s.vuln=[...s.vuln];
  if(r.made){ s.gameBelow[declSide]+=r.below; s.total[declSide]+=r.below+r.above; }
  else { s.total[defSide]+=r.above; }
  s.total[0]+=honSide[0]; s.total[1]+=honSide[1];
  let gameWon=false, rubberDone=false, rubberWinner=null, rubberBonus=0;
  if(r.made && s.gameBelow[declSide]>=100){
    s.games[declSide]+=1; gameWon=true;
    s.gameBelow=[0,0];
    s.vuln[declSide]=true;
    if(s.games[declSide]===2){
      rubberDone=true; rubberWinner=declSide;
      rubberBonus = (s.games[defSide]===0)?700:500;
      s.total[declSide]+=rubberBonus;
    }
  }
  s.phase="scored"; s.roundEndedAt=Date.now();
  s.rubberDone=rubberDone; s.rubberWinner=rubberWinner;
  const dblTxt = ct.dbl===4?" XX":ct.dbl===2?" X":"";
  const head = `${ct.level}${STRAIN_GLYPH[ct.strain]}${dblTxt} by ${who(s,ct.declarer)} — ${r.made?"MADE":"DOWN "+r.under} (${declTricks} tricks, needed ${target})`;
  pushLog(s, head);
  s.result={ made:r.made, declSide, defSide, target, declTricks,
    below:r.below, above:r.above, over:r.over, under:r.under,
    detail:r.detail, honours:honDetail, honSide,
    gameWon, rubberDone, rubberWinner, rubberBonus, contract:ct, head };
  s.sheet=[...(s.sheet||[]), { head, made:r.made, declSide, below:r.below, above:r.above, honDetail }];
  return s;
}

/* ---- reducer ---- */
function reducer(state, a){
  if(a.type==="__SYNC__") return a.state;
  switch(a.type){
    case "SET_BRAIN":{ const brains=[...state.brains]; brains[a.seat]=a.key; return {...state, brains}; }
    case "SET_NAME":{ const names=[...(state.names||["","","",""])]; names[a.seat]=a.name||""; return {...state, names}; }
    case "START": return freshRubber(state.brains, state.names, 0);
    case "RESUME":
      return { ...freshRubber(a.brains, a.names, a.dealer!=null?a.dealer:0),
        games:a.games||[0,0], vuln:a.vuln||[false,false], gameBelow:a.gameBelow||[0,0],
        total:a.total||[0,0], rubberNo:a.rubberNo||1 };
    case "SET_BRAIN_LIVE":{
      const brains=state.brains.map((b,i)=> i===a.seat ? a.brain : b);
      const names=(state.names||["","","",""]).slice(); if(a.seat<names.length) names[a.seat]=a.name!=null?a.name:"";
      return {...state, brains, names};
    }
    case "BID":{
      const s=cloneState(state);
      let call=a.call;
      if(!AUC.callLegal(call, s.calls, s.dealer)) call={k:"P"};
      return applyBid(s, a.seat!=null?a.seat:s.turn, call);
    }
    case "PLAY":{ const s=cloneState(state); return applyPlay(s, a.player!=null?a.player:s.turn, a.cardId); }
    case "NEXT_DEAL":{
      if(state.rubberDone) return state;
      const s=cloneState(state);
      return freshDeal({...s, dealNo:(s.dealNo||1)+1}, nextSeat(s.dealer));
    }
    case "NEW_RUBBER": return freshRubber(state.brains, state.names, 0);
    case "TO_SETUP": return {...SETUP, n:4, brains:[...state.brains], names:[...(state.names||["","","",""])]};
    default: return state;
  }
}

/* ---- build the play context for a seat (dummy is public once exposed;
   only the declarer legitimately sees both of the declaring hands) ---- */
function playCtx(s, seat){
  const declaring = s.contract && sideOf(seat)===sideOf(s.declarer);
  const dummyExposed = s.dummyRevealed && s.dummy!=null;
  return {
    hand:s.hands[seat], trick:s.trick.map(tc=>({rank:tc.card.rank,suit:tc.card.suit,player:tc.seat})),
    ledSuit:s.ledSuit, trump:s.trump, seat, declarer:s.declarer, dummy:s.dummy, seen:s.seen.slice(),
    dummyHand: dummyExposed ? s.hands[s.dummy].slice() : undefined,
    mateHand:  (declaring && seat===s.declarer) ? s.hands[s.dummy].slice()
             : (declaring && seat===s.dummy)    ? s.hands[s.declarer].slice() : undefined,
  };
}

/* ---- one bot action for the seat on turn ---- */
function botAction(s){
  const seat=s.turn;
  if(s.phase==="auction"){
    let call;
    try{ call=BID.chooseBid(s.hands[seat], s.calls, s.dealer, seat); }catch(_){ call={k:"P"}; }
    if(!call || !AUC.callLegal(call, s.calls, s.dealer)) call={k:"P"};
    return {type:"BID", seat, call};
  }
  const ctrl=controllerOf(s, seat);
  const persona=seatPersona(s, ctrl);
  const legal=ENG.legalPlays(s.hands[seat], s.trick.length?s.ledSuit:null);
  let card;
  try{ card=PLY.chooseCard(playCtx(s, seat)); }catch(_){ card=legal[0]; }
  if(!card || !legal.find(c=>c.id===card.id)) card=legal[0];
  if(persona.skill<=2 && legal.length>1 && Math.random()<0.25){
    const alt=legal[(Math.random()*legal.length)|0]; if(alt) card=alt;
  }
  return {type:"PLAY", player:seat, cardId:card.id};
}

/* suggestions for the human — full-strength, never softened */
function suggestBid(s, seat){ try{ return BID.chooseBid(s.hands[seat], s.calls, s.dealer, seat); }catch(_){ return {k:"P"}; } }
function suggestPlay(s, seat){
  try{ const c=PLY.chooseCard(playCtx(s, seat)); return c || ENG.legalPlays(s.hands[seat], s.trick.length?s.ledSuit:null)[0]; }
  catch(_){ return ENG.legalPlays(s.hands[seat], s.trick.length?s.ledSuit:null)[0]; }
}

/* =======================================================================
   TEACHING MODE — the "why" of each suggestion.
   The suggestion functions emit a reason CODE + a few params; a template
   table (overridable via window.BRIDGE_TEACHING) turns that into a sentence.
   ===================================================================== */
const SUIT_WORD = { S:"spades", H:"hearts", D:"diamonds", C:"clubs", NT:"no-trump" };

// classify a chosen bid into {code, ...params} using the same facts the bidder used
function explainBid(hand, calls, dealer, seat, call){
  let ev, ctx;
  try{ ev=BID.evalHand(hand); ctx=BID.context(calls, dealer, seat); }
  catch(_){ return { code:"B_GENERIC", hcp:0, call:callLabel(call) }; }
  const hcp=ev.hcp, len=ev.len, S=call.strain;
  const nobodyBidYet = ctx.openerSeat===-1;
  const partnerOpen = ctx.partnerBids && ctx.partnerBids[0];

  if(call.k==="P"){
    if(ctx.iOpened) return { code:"B_PASS_SETTLE", hcp };
    if(nobodyBidYet) return { code: hcp<=11?"B_PASS_OPEN":"B_PASS_NEUTRAL", hcp };
    if(ctx.openerSeat===ctx.partner) return { code: hcp<=7?"B_PASS_RESP":"B_PASS_NEUTRAL", hcp };
    if(ctx.partnerOpened) return { code: hcp<=8?"B_PASS_ADVANCE":"B_PASS_NEUTRAL", hcp };
    return { code: hcp<=12?"B_PASS_COMPETE":"B_PASS_NEUTRAL", hcp };
  }
  if(call.k==="D"){
    const lb=ctx.info.lastBid;
    if(!ctx.partnerOpened && lb && lb.level<=2 && lb.strain!=="NT") return { code:"B_DOUBLE_TO", suit:lb.strain };
    return { code:"B_DOUBLE_PEN" };
  }
  if(call.k==="R") return { code:"B_REDBL" };

  if(nobodyBidYet){
    if(S==="NT") return { code: call.level===1?"B_1NT":call.level===2?"B_2NT":"B_3NT", hcp };
    if(call.level===2 && S==="C") return { code:"B_2C", hcp };
    if(call.level===2) return { code:"B_WEAK2", hcp, suit:S };
    if(call.level===3) return { code:"B_PRE3", hcp, suit:S };
    if(S==="S"||S==="H") return { code:"B_1MAJ", hcp, suit:S, len:len[S] };
    return { code:"B_1MIN", hcp, suit:S };
  }
  if(ctx.partnerOpened && !ctx.iOpened){
    if(S==="NT" && call.level===4) return { code:"B_BLACKWOOD" };
    if(partnerOpen && partnerOpen.strain==="NT" && partnerOpen.level===1){
      if(S==="C" && call.level===2) return { code:"B_STAYMAN" };
      if((S==="D"||S==="H") && call.level===2) return { code:"B_TRANSFER", suit:(S==="D"?"H":"S") };
      if(S==="NT") return { code: call.level===2?"B_2NT_RESP":"B_3NT_RESP", hcp };
    }
    if(partnerOpen && partnerOpen.strain===S && S!=="NT")
      return { code:"B_RAISE", suit:S, level:call.level, sup:len[S], pts:ev.hcp+ev.lp };
    if(S==="NT") return { code: call.level===1?"B_1NT_RESP":call.level===2?"B_2NT_RESP":"B_3NT_RESP", hcp };
    return { code:"B_NEWSUIT", suit:S, len:len[S], hcp };
  }
  if(ctx.iOpened){
    if(S==="NT") return { code:"B_REBID_NT", hcp };
    if(partnerOpen && partnerOpen.strain===S) return { code:"B_RAISE", suit:S, level:call.level, sup:len[S], pts:ev.hcp+ev.lp };
    return { code:"B_REBID_SUIT", suit:S, len:len[S] };
  }
  if(ctx.oppsBid){
    if(S==="NT") return { code:"B_1NT_OVERCALL", hcp };
    return { code:"B_OVERCALL", suit:S, len:len[S], hcp };
  }
  return { code:"B_GENERIC", hcp, call:callLabel(call) };
}

// embedded default templates (overridable by window.BRIDGE_TEACHING)
const TEACH_DEFAULT = {
  bid: {
    B_PASS_OPEN:"With only {hcp} HCP you're below opening strength (about 12+). Pass.",
    B_PASS_RESP:"Partner opened, but {hcp} HCP opposite an opening bid isn't enough to look for game — so pass.",
    B_PASS_ADVANCE:"Partner has competed into the opponents' auction; with {hcp} HCP you've no fit to raise or suit to show, so pass.",
    B_PASS_COMPETE:"The opponents own this auction. With {hcp} HCP and no long suit worth an overcall (nor the shape for a takeout double), it's safer to pass than to act on nothing.",
    B_PASS_SETTLE:"You've already described this hand, and there's no fit or extra strength to chase. Pass and let the contract rest where partner can place it.",
    B_PASS_NEUTRAL:"This is a natural place to stop for your hand — pass rather than push the bidding any higher.",
    B_1NT:"{hcp} HCP and a balanced hand: 1NT pins your strength to a 15–17 range in one bid.",
    B_2NT:"{hcp} HCP, balanced — open 2NT (20–21).",
    B_3NT:"{hcp} HCP, balanced — open 3NT (25–27).",
    B_1MAJ:"{hcp} HCP with a {len}-card {suit} suit — open one of your five-card major so partner can find the fit.",
    B_1MIN:"{hcp} HCP but no five-card major, so open your better minor ({suit}) and await partner's response.",
    B_2C:"About {hcp} HCP — too strong for a one-bid, so open the artificial, game-forcing 2\u2663.",
    B_WEAK2:"A six-card {suit} suit but only {hcp} HCP — a weak two robs the opponents of bidding room.",
    B_PRE3:"A seven-card {suit} suit and only {hcp} HCP — preempt at the three level to crowd the auction.",
    B_RAISE:"{sup}-card support and about {pts} points — raise partner to {level} of {suit} to show the fit and your strength.",
    B_1NT_RESP:"{hcp} HCP with no fit and nothing to show at the one level — respond 1NT.",
    B_2NT_RESP:"{hcp} HCP, balanced — invite game with 2NT.",
    B_3NT_RESP:"{hcp} HCP, balanced with stoppers — bid the game, 3NT.",
    B_NEWSUIT:"Show your {len}-card {suit} suit: {hcp}+ HCP, and a new suit forces partner to bid again.",
    B_STAYMAN:"2\u2663 is Stayman, asking partner whether they hold a four-card major.",
    B_TRANSFER:"A Jacoby transfer: it tells partner to bid {suit}, keeping the strong hand hidden as declarer.",
    B_BLACKWOOD:"Slam is in range — 4NT is Blackwood, asking partner how many aces they hold.",
    B_DOUBLE_TO:"A takeout double: opening values, shortness in {suit}, and support for the other suits — asking partner to choose.",
    B_DOUBLE_PEN:"Double for penalty — you expect to beat this contract.",
    B_REDBL:"Redouble — you're confident this contract is yours.",
    B_REBID_NT:"{hcp} HCP, balanced — rebid no-trump to pin down shape and range.",
    B_REBID_SUIT:"Rebid your {len}-card {suit} to show the extra length and let partner place the contract.",
    B_OVERCALL:"Overcall {suit}: a sound {len}-card suit and about {hcp} HCP — competing, and suggesting a lead.",
    B_1NT_OVERCALL:"{hcp} HCP, balanced, their suit stopped — overcall 1NT.",
    B_GENERIC:"{call} is the standard call with about {hcp} HCP and this shape.",
  },
  play: {
    ONLY:"Only one legal card — you must follow suit.",
    LEAD_SEQ:"Top of a sequence in {suit}: the {top} is a safe lead that promotes your lower cards into winners.",
    LEAD_4TH:"Fourth-best from your longest suit ({suit}) — the classic opening lead to develop length.",
    LEAD_ACE:"Against a suit contract you don't underlead an ace, so lead the ace of {suit} itself.",
    LEAD_LOW:"Lead a low {suit} — a quiet, safe choice with nothing better to attack.",
    DECL_DRAW:"You're declarer with the top trump: play the {card} to draw the defenders' trumps so they can't ruff your winners.",
    DECL_CASH:"The {card} is the highest {suit} still out — cash your sure winner.",
    DECL_FINESSE:"Lead low toward your {honor} of {suit}: if the missing higher honour sits before it, the {honor} scores. That's a finesse — a free shot at an extra trick.",
    DECL_RUFF:"Lead your losing {suit} so the other hand can ruff it — turning a loser into a trick with a trump.",
    DECL_ESTABLISH:"Lead low in your long {suit} to knock out the defenders' stoppers and set up later winners.",
    F_2ND_LOW:"Second hand low: no need to spend an honour before seeing what partner and declarer do.",
    F_3RD_HIGH:"Third hand high — the {card} is the cheapest card that can win, forcing out the defenders' higher cards.",
    F_WIN_CHEAP:"Win the trick as cheaply as you can with the {card}, saving your higher cards.",
    F_DUCK_PARTNER:"Partner is already winning the trick — play low and keep your strength.",
    F_CANT:"You can't beat what's on the table, so play low and hold your honours.",
    RUFF:"You're out of the suit led — ruff with a low trump to win the trick.",
    DISCARD:"Can't follow and don't want to ruff — throw a low {suit}, your safest discard.",
  },
  glossary: {
    "hcp":"High-card points: Ace 4, King 3, Queen 2, Jack 1 — the main measure of strength. The deck holds 40, so an average hand has 10.",
    "balanced":"A hand with no void or singleton and at most one doubleton (4-3-3-3, 4-4-3-2, 5-3-3-2). Ideal for no-trump bids.",
    "major":"The spade and heart suits. Game needs only 10 tricks and scores well, so major fits are prized.",
    "minor":"The club and diamond suits. Game needs 11 tricks, so players often steer to no-trump instead.",
    "no-trump":"A contract with no trump suit; the highest card of the suit led simply wins each trick.",
    "trump":"The suit named by the contract. Any trump beats any card of the other three suits.",
    "fit":"A suit in which the partnership holds eight or more cards together — enough to choose it as trumps.",
    "support":"How many cards you hold in the suit partner bid; three or four is enough to raise.",
    "raise":"Bidding more of the suit partner already named, showing a fit and your strength.",
    "sequence":"Two or more touching honours (e.g. K-Q-J). Leading the top of one is safe and builds tricks.",
    "fourth-best":"Leading the fourth-highest card of your longest suit — a standard opening lead that develops length.",
    "opening lead":"The first card of the play, made by the defender to declarer's left before dummy is exposed.",
    "finesse":"Trying to win a trick with a card that isn't top by playing after an opponent, hoping a missing honour lies favourably.",
    "ruff":"Playing a trump on a suit you cannot follow, to win the trick.",
    "draw trumps":"Leading trumps repeatedly to strip them from the defenders so they can't ruff your winners.",
    "declarer":"The player who plays both their own hand and dummy, trying to make the contract.",
    "dummy":"Declarer's partner, whose hand is laid face-up and played by declarer.",
    "defender":"Either opponent of declarer; the defenders try to defeat the contract.",
    "overcall":"A bid made after an opponent opens — competing for the contract and suggesting a lead.",
    "takeout double":"A double asking partner to choose a suit, showing opening values and support for the unbid suits.",
    "penalty double":"A double made expecting to defeat the opponents' contract for extra points.",
    "redouble":"A call after an opponent's double that raises the stakes when you expect to make the contract.",
    "stayman":"A 2\u2663 response to 1NT asking opener whether they hold a four-card major.",
    "transfer":"A bid telling partner to bid the next suit up, so the stronger hand becomes hidden declarer (a Jacoby transfer).",
    "blackwood":"A 4NT bid asking partner how many aces they hold, used when exploring a slam.",
    "weak two":"An opening 2\u2666/2\u2665/2\u2660 showing a six-card suit and only 5\u201310 HCP, made to steal bidding space.",
    "preempt":"A high opening on a long, weak hand, made to crowd the opponents out of the auction.",
    "stopper":"A holding that halts a suit at no-trump (an Ace, or a guarded King, etc.).",
    "vulnerable":"Having already won a game this rubber; bonuses and penalties are larger when vulnerable.",
    "game":"A contract worth 100+ trick points (3NT, 4\u2665/4\u2660, 5\u2663/5\u2666). Two games win the rubber.",
    "part-score":"A contract below game; several can add up to a game across successive deals.",
    "slam":"A contract for 12 tricks (small slam) or all 13 (grand slam), earning a large bonus.",
    "rubber":"A match won by the first side to complete two games, worth a 500 or 700 bonus.",
    "book":"The first six tricks. A contract's level is how many tricks beyond book you must take.",
    "honour":"An Ace, King, Queen, Jack or Ten; a run of trump honours in one hand can earn a bonus.",
    "second hand low":"A defensive rule of thumb: playing second to a trick, usually play low and wait.",
    "third hand high":"A defensive rule of thumb: playing third to a trick, play high to help win it.",
    "discard":"Playing a card of another suit when you can't follow and choose not to ruff.",
    "contract":"The final bid: how many tricks the declaring side must win, and in which strain.",
    "auction":"The bidding, in which the four players compete to name the contract.",
    "level":"The number in a bid; add six to get the tricks required (4\u2660 = 6 + 4 = 10 tricks).",
  },
};
function teachTable(kind){
  const ext = (typeof window!=="undefined" && window.BRIDGE_TEACHING && window.BRIDGE_TEACHING[kind]) || null;
  return { ext, def:TEACH_DEFAULT[kind] };
}
function fillTpl(tpl, p){ return tpl.replace(/\{(\w+)\}/g, (m,k)=> (p[k]!=null?String(p[k]):m)); }
function whyText(kind, why){
  if(!why || !why.code) return "";
  const { ext, def } = teachTable(kind);
  const tpl = (ext && ext[why.code]) || def[why.code];
  if(!tpl) return "";
  const p = { ...why };
  if(p.suit && SUIT_WORD[p.suit]) p.suit = SUIT_WORD[p.suit];
  return fillTpl(tpl, p);
}
function getGlossary(){
  const ext = (typeof window!=="undefined" && window.BRIDGE_TEACHING && window.BRIDGE_TEACHING.glossary) || null;
  return ext || TEACH_DEFAULT.glossary;
}
// suggestion + explanation bundles for the UI
function suggestBidWhy(s, seat){
  const call = suggestBid(s, seat);
  return { call, text: whyText("bid", explainBid(s.hands[seat], s.calls, s.dealer, seat, call)) };
}
function suggestPlayWhy(s, seat){
  let r;
  try{ r = PLY.chooseCardWhy(playCtx(s, seat)); }catch(_){ r=null; }
  const legal = ENG.legalPlays(s.hands[seat], s.trick.length?s.ledSuit:null);
  const card = (r && r.card) || legal[0];
  return { card, text: r ? whyText("play", r.why) : "" };
}

/* =======================================================================
   UI THEME (felt-and-brass card table)
   ===================================================================== */
const C={ gold:"var(--purple)", brass:"var(--line)", cream:"var(--ink)", dim:"var(--dim)",
  card:"var(--card)", ink:"var(--fillink)", red:"var(--red)" };
const btn=(kind="gold",small)=>{
  const base={borderRadius:0,fontWeight:700,padding:small?"5px 11px":"7px 13px",cursor:"pointer",
    fontSize:small?10.5:11,fontFamily:"var(--mono)",letterSpacing:".09em",textTransform:"uppercase",
    border:"1px solid var(--line)",background:"transparent",color:"var(--ink)"};
  if(kind==="gold") return {...base,background:"var(--green)",color:"var(--playink)",border:"1px solid var(--green)"};
  if(kind==="red")  return {...base,color:"var(--red)",border:"1px solid var(--red)"};
  return {...base,color:"var(--dim)"};
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
  if(faceDown) return <div onClick={onClick} className={"brback"+(small?" sm":"")} style={{cursor:onClick?"pointer":"default"}}/>;
  const g=SUIT_GLYPH[c.suit];
  const cls=["brcard",suitClass(c.suit),small?"sm":"",selected?"sel":"",
    (onClick&&!disabled)?"clk":"",disabled?"dis":""].filter(Boolean).join(" ");
  const idxGlyph=IDXSUIT.has(c.rank)?g:null;
  let center;
  if(c.rank==="A") center=<div className="ctr"><span className="pip ace" style={{left:"50%",top:"50%"}}>{g}</span></div>;
  else if(c.rank==="J"||c.rank==="Q"||c.rank==="K") center=<div className="mid fc">{c.rank}</div>;
  else center=<div className="ctr">{(PIPS[c.rank]||[]).map(([x,y],i)=>(
    <span key={i} className={"pip"+(y>50?" flip":"")} style={{left:x+"%",top:y+"%"}}>{g}</span>))}</div>;
  return <div onClick={disabled?undefined:onClick} className={cls}>
    <Corner rank={c.rank} glyph={idxGlyph} pos="tl"/>
    <Corner rank={c.rank} glyph={idxGlyph} pos="br"/>
    {center}
  </div>;
}
const Empty=({small})=><div className={"brcard"+(small?" sm":"")} style={{background:"transparent",border:"1px dashed var(--line)"}}/>;

const CallChip=({c,big})=>{
  if(c.k==="P") return <span className="chip pass">Pass</span>;
  if(c.k==="D") return <span className="chip dbl">X</span>;
  if(c.k==="R") return <span className="chip dbl">XX</span>;
  const red = c.strain==="H"||c.strain==="D";
  return <span className={"chip bid"+(big?" big":"")+(red?" red":"")}>{c.level}<b>{STRAIN_GLYPH[c.strain]}</b></span>;
};

/* ---------------- seat badges ---------------- */
function SeatBadge({s, seat, focus, active}){
  const p=seatPersona(s,seat);
  const isDummy = s.contract && seat===s.dummy;
  const isDecl  = s.contract && seat===s.declarer;
  const cnt=(s.hands[seat]||[]).length;
  const vul = s.vuln[sideOf(seat)];
  return (
    <div className={"seat"+(active?" act":"")+(seat===focus?" me":"")} style={{"--accent":p.color}}>
      <div className="top">
        <span className="gl">{p.glyph}</span>
        <span className="nm">{who(s,seat)}</span>
      </div>
      <div className="sub">
        <span className="pos">{SEAT_NAME[seat]}{vul?" ·":""}{vul?<span className="vtag"> vul</span>:""}</span>
        {isDecl && <span className="role decl">Declarer</span>}
        {isDummy && <span className="role dummy">Dummy</span>}
        {!isDecl && !isDummy && <span className="cnt num">{cnt} cards</span>}
      </div>
    </div>
  );
}

/* ---------------- auction ladder ---------------- */
function AuctionView({s}){
  const order=[0,1,2,3].map(i=>(s.dealer+i)%4);
  const rows=[]; let row=new Array(4).fill(undefined); let col=0;
  for(const c of s.calls){ row[col]=c; col++; if(col===4){ rows.push(row); row=new Array(4).fill(undefined); col=0; } }
  if(col>0) rows.push(row);
  return (
    <div className="auction">
      <div className="ahead">{order.map((seat,i)=><div key={i} className="ac num">{SEAT_ABBR[seat]}</div>)}</div>
      <div className="agrid">
        {rows.length===0 && <div className="aempty">Auction begins…</div>}
        {rows.map((r,ri)=>(
          <div key={ri} className="arow">
            {[0,1,2,3].map(ci=>(<div key={ci} className="acell">{r[ci]!==undefined && r[ci]!==null ? <CallChip c={r[ci]}/> : ""}</div>))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- bidding box ---------------- */
function BiddingBox({s, seat, dispatch, suggestion}){
  const levels=[1,2,3,4,5,6,7];
  const canDbl = AUC.callLegal({k:"D"}, s.calls, s.dealer);
  const canRdbl= AUC.callLegal({k:"R"}, s.calls, s.dealer);
  const sug = suggestion;
  const sugKey = sug ? (sug.k==="B"?`${sug.level}${sug.strain}`:sug.k) : null;
  const bidLegal=(L,st)=>AUC.callLegal({k:"B",level:L,strain:st}, s.calls, s.dealer);
  return (
    <div className="bidbox">
      <div className="bidgrid">
        {levels.map(L=>(
          <div key={L} className="brow">
            <div className="blv num">{L}</div>
            {STRAIN_ORDER.map(st=>{
              const ok=bidLegal(L,st);
              const isSug = sugKey===`${L}${st}`;
              const red = st==="H"||st==="D";
              return <button key={st} disabled={!ok}
                className={"bcell"+(red?" red":"")+(isSug?" sug":"")}
                onClick={()=>dispatch({type:"BID", seat, call:{k:"B",level:L,strain:st}})}>{STRAIN_GLYPH[st]}</button>;
            })}
          </div>
        ))}
      </div>
      <div className="bidacts">
        <button className={"bx pass"+(sugKey==="P"?" sug":"")} onClick={()=>dispatch({type:"BID", seat, call:{k:"P"}})}>Pass</button>
        <button className="bx dbl" disabled={!canDbl} onClick={()=>dispatch({type:"BID", seat, call:{k:"D"}})}>Double</button>
        <button className="bx dbl" disabled={!canRdbl} onClick={()=>dispatch({type:"BID", seat, call:{k:"R"}})}>Redbl</button>
      </div>
    </div>
  );
}

/* ---------------- the played trick (center of the table) ---------------- */
function TrickTable({s, focus}){
  const bottom=focus, top=partnerOf(focus), left=nextSeat(focus), right=(focus+3)%4;
  const cardBy=(seat)=>{ const t=s.trick.find(tc=>tc.seat===seat); return t?t.card:null; };
  const lastBy=(seat)=>{ if(!s.lastTrick) return null; const t=s.lastTrick.trick.find(tc=>tc.seat===seat); return t?t.card:null; };
  const showLast = s.trick.length===0 && s.lastTrick;
  const declSide = s.contract? sideOf(s.declarer):0;
  const slot=(seat,pos)=>{
    const c=cardBy(seat) || (showLast?lastBy(seat):null);
    const isWinner = showLast && s.lastTrick.winner===seat;
    const isTurn = s.turn===seat && s.phase==="play";
    return (
      <div className={"tslot "+pos+(isTurn?" turn":"")+(isWinner?" win":"")}>
        {c ? <Card c={c} small/> : <div className="tempty">{SEAT_ABBR[seat]}</div>}
        <div className="tname num">{SEAT_ABBR[seat]}{seat===s.declarer?"*":seat===s.dummy?"°":""}</div>
      </div>
    );
  };
  return (
    <div className="tricktable">
      {slot(top,"top")}
      {slot(left,"left")}
      <div className="tcenter">
        <div className="tinfo">
          <div className="big num">{s.tricks[declSide]}<span className="slash">/{s.contract?6+s.contract.level:""}</span></div>
          <div className="lbl2">declarer tricks</div>
          <div className="trk2 num">{SIDE_NAME[0]} {s.tricks[0]} · {s.tricks[1]} {SIDE_NAME[1]}</div>
        </div>
      </div>
      {slot(right,"right")}
      {slot(bottom,"bottom")}
    </div>
  );
}

/* ---------------- a hand row ---------------- */
function HandRow({hand, onPlay, legalIds, selectable, label, faceDown, count}){
  const cards=sortHandDisplay(hand||[]);
  return (
    <div className="handblock">
      {label && <div className="hlabel lbl2">{label}{count!=null?` · ${count}`:""}</div>}
      <div className="hand">
        {faceDown
          ? Array.from({length:count||cards.length}).map((_,i)=><Card key={i} faceDown small/>)
          : cards.map(c=>{
              const ok=!legalIds || legalIds.has(c.id);
              return <Card key={c.id} c={c} small={label!=="You"}
                onClick={selectable&&ok?()=>onPlay(c):undefined} disabled={selectable&&!ok}/>;
            })}
      </div>
    </div>
  );
}

/* ---------------- rubber score sheet ---------------- */
function ScoreSheet({s}){
  const vtag=(side)=> s.vuln[side]?"VUL":"—";
  return (
    <div className="sheet">
      <div className="shead"><div className="scorner"></div><div className="scol">{SIDE_NAME[0]}</div><div className="scol">{SIDE_NAME[1]}</div></div>
      <div className="srow"><div className="slbl">Total</div><div className="sval num big">{s.total[0]}</div><div className="sval num big">{s.total[1]}</div></div>
      <div className="srow"><div className="slbl">Games</div><div className="sval num">{s.games[0]}</div><div className="sval num">{s.games[1]}</div></div>
      <div className="srow"><div className="slbl">Toward game</div><div className="sval num">{s.gameBelow[0]}</div><div className="sval num">{s.gameBelow[1]}</div></div>
      <div className="srow"><div className="slbl">Vulnerable</div><div className={"sval vul"+(s.vuln[0]?" on":"")}>{vtag(0)}</div><div className={"sval vul"+(s.vuln[1]?" on":"")}>{vtag(1)}</div></div>
    </div>
  );
}

/* ---------------- pass-and-play reveal gate ---------------- */
function RevealGate({s, seat, onReveal}){
  const p=seatPersona(s,seat);
  return (
    <div className="revealgate">
      <div className="rg-glyph" style={{color:p.color}}>{p.glyph}</div>
      <div className="rg-who">{who(s,seat)} — {SEAT_NAME[seat]}</div>
      <div className="rg-sub lbl2">Pass the device. Hide the previous player's cards.</div>
      <button style={btn("gold")} onClick={onReveal}>Reveal my hand</button>
    </div>
  );
}

/* ---------------- setup ---------------- */
function Setup({s, dispatch, onShowRules, onShowGloss, campaign, onResume, onDiscard}){
  const setBrain=(seat,key)=>dispatch({type:"SET_BRAIN", seat, key});
  const seatRow=(seat)=>{
    const isHuman=s.brains[seat]==="human";
    const p=seatPersona(s,seat);
    return (
      <div className="setseat" key={seat}>
        <div className="ss-pos">
          <span className="ss-abbr">{SEAT_ABBR[seat]}</span>
          <span className="lbl2">{SEAT_NAME[seat]}{seat===0?" · you":""}</span>
        </div>
        <select value={s.brains[seat]} onChange={e=>setBrain(seat,e.target.value)}>
          <option value="human">Human</option>
          {ALL_BRAINS.map(b=><option key={b} value={b}>{PROFILES[b].name}</option>)}
        </select>
        <div className="ss-blurb lbl2" style={{color:p.color}}>{isHuman?"Plays from this device.":p.blurb}</div>
      </div>
    );
  };
  const humans=s.brains.filter(b=>b==="human").length;
  return (
    <div className="setup">
      <div className="setwrap">
        <div className="setcard">
          <div className="lbl2" style={{marginBottom:6}}>Partnerships</div>
          <div className="partners">
            <div className="pteam"><b>{SIDE_NAME[0]}</b><span>{who(s,0)} &amp; {who(s,2)}</span></div>
            <div className="pvs">vs</div>
            <div className="pteam"><b>{SIDE_NAME[1]}</b><span>{who(s,1)} &amp; {who(s,3)}</span></div>
          </div>
        </div>
        <div className="setcard">
          <div className="lbl2" style={{marginBottom:6}}>Seats</div>
          {[0,1,2,3].map(seatRow)}
          <div className="lbl2" style={{marginTop:6,color:"var(--dim)"}}>
            {humans>1?`${humans} humans — pass the device between turns.`:"Solo vs three bots. You sit South."}
          </div>
        </div>
        {campaign && (
          <div className="setcard resume">
            <div className="lbl2">Rubber in progress</div>
            <div className="rz-line">Games {campaign.games[0]}–{campaign.games[1]} · totals {campaign.total[0]} / {campaign.total[1]}</div>
            <div className="rz-btns">
              <button style={btn("gold",true)} onClick={onResume}>Resume</button>
              <button style={btn("ghost",true)} onClick={onDiscard}>Discard</button>
            </div>
          </div>
        )}
        <div className="setbtns">
          <button className="startbtn" onClick={()=>dispatch({type:"START"})}>Deal the first hand</button>
          <div className="setlinks">
            <button style={btn("ghost")} onClick={onShowRules}>How to play</button>
            <button style={btn("ghost")} onClick={onShowGloss}>Glossary</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- rules (standard contract bridge) ---------------- */
const RULES_SECTIONS = [
  ["The deal", [
    "Four players in two partnerships: North–South against East–West, partners sitting opposite.",
    "A standard 52-card deck is dealt out, 13 cards each. Ranks run A (high) down to 2.",
  ]],
  ["The auction", [
    "Starting with the dealer and moving clockwise, players bid for the contract.",
    "A bid names a level (1–7 = tricks over six) and a strain (♣ < ♦ < ♥ < ♠ < No-Trump). Each bid must be higher than the last.",
    "You may Pass, Double an opponent's bid, or Redouble. Three passes after a bid end the auction; four passes to start redeal the hand.",
    "The final bid is the contract. The side that won it supplies the declarer — the player who first named that strain.",
  ]],
  ["Declarer & dummy", [
    "The player to declarer's left makes the opening lead. Then declarer's partner lays their hand face-up as the dummy.",
    "Declarer plays both their own hand and the dummy; the defenders play their own cards.",
  ]],
  ["Playing the tricks", [
    "Each trick is four cards, one per player, clockwise. You must follow the suit led if you can; otherwise play anything.",
    "Highest card of the led suit wins — unless someone plays a trump, in which case the highest trump wins.",
    "The winner of a trick leads to the next. Thirteen tricks are played in all.",
  ]],
  ["Making the contract", [
    "'Book' is the first six tricks. The contract asks for book + the bid level, so 4♠ needs 6 + 4 = 10 tricks.",
    "Extra tricks are overtricks; falling short means the contract goes down by that many undertricks.",
  ]],
  ["Scoring the rubber", [
    "Made contracts score below the line toward game: minors 20 per level, majors 30, No-Trump 40 then 30.",
    "First side to 100 below the line wins a game and becomes vulnerable; the line resets. Win two games to take the rubber (+700, or +500 if the opponents won a game).",
    "Overtricks, slam bonuses (small 500/750, grand 1000/1500), honours, doubling insults and undertrick penalties all score above the line.",
  ]],
];
function RulesScreen({onClose}){
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheetmodal" onClick={e=>e.stopPropagation()}>
        <div className="smhead"><div className="wordmark sm">BRIDGE</div><button style={btn("ghost",true)} onClick={onClose}>Close</button></div>
        <div className="smbody">
          {RULES_SECTIONS.map(([h,items],i)=>(
            <div key={i} className="rsec">
              <div className="rsh">{h}</div>
              {items.map((t,j)=><div key={j} className="rsl">{t}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* wrap known glossary terms in a string as tappable spans (first occurrence of each) */
function linkifyGlossary(text, gloss, onTap){
  const keys=Object.keys(gloss||{}); if(!keys.length || !text) return [text];
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const ordered=keys.slice().sort((a,b)=>b.length-a.length);
  let re; try{ re=new RegExp("\\b("+ordered.map(esc).join("|")+")(es|s)?\\b","gi"); }catch(_){ return [text]; }
  const out=[]; let last=0,m; const seen=new Set();
  while((m=re.exec(text))){
    const whole=m[0], start=m.index, base=m[1].toLowerCase();
    const key=ordered.find(k=>k.toLowerCase()===base);
    if(!key || seen.has(key)) continue;
    seen.add(key);
    if(start>last) out.push(text.slice(last,start));
    out.push(<span key={start} className="gloss-term" onClick={(e)=>{e.stopPropagation();onTap(key);}}>{whole}</span>);
    last=start+whole.length;
  }
  if(last<text.length) out.push(text.slice(last));
  return out;
}

function GlossaryScreen({onClose, gloss, focusTerm}){
  const terms=Object.keys(gloss).sort();
  const ref=React.useRef(null);
  React.useEffect(()=>{ if(focusTerm && ref.current){ try{ ref.current.scrollIntoView({block:"center"}); }catch(_){} } },[focusTerm]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheetmodal" onClick={e=>e.stopPropagation()}>
        <div className="smhead"><div className="wordmark sm">GLOSSARY</div><button style={btn("ghost",true)} onClick={onClose}>Close</button></div>
        <div className="smbody">
          {terms.map(t=>(
            <div key={t} className={"gterm"+(t===focusTerm?" hot":"")} ref={t===focusTerm?ref:null}>
              <div className="gt-name">{t}</div>
              <div className="gt-def">{gloss[t]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- persistence (wrapped so a sandbox never throws) ---------------- */
const THEME_KEY="bridge.theme.v1", CAMP_KEY="bridge.campaign.v1", STATS_KEY="bridge.stats.v1";
function loadTheme(){ try{ return localStorage.getItem(THEME_KEY)||"casino"; }catch(_){ return "casino"; } }
function saveTheme(t){ try{ localStorage.setItem(THEME_KEY,t); }catch(_){} }
function loadCampaign(){ try{ return JSON.parse(localStorage.getItem(CAMP_KEY))||null; }catch(_){ return null; } }
function saveCampaign(c){ try{ if(c) localStorage.setItem(CAMP_KEY, JSON.stringify(c)); else localStorage.removeItem(CAMP_KEY); }catch(_){} }
function loadStats(){ try{ return JSON.parse(localStorage.getItem(STATS_KEY))||{rubbers:0,rubbersWon:0,dealsPlayed:0,contractsMade:0}; }catch(_){ return {rubbers:0,rubbersWon:0,dealsPlayed:0,contractsMade:0}; } }
function saveStats(v){ try{ localStorage.setItem(STATS_KEY, JSON.stringify(v)); }catch(_){} }

const THEME_CSS=`
.br{
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --k:1.15;
  --bg:#0f3b2b; --ink:#f2e8ce; --dim:#9a8f63; --line:rgba(212,175,55,.42); --line2:rgba(212,175,55,.20);
  --card:#f6efd9; --cardline:#cdc09a; --fill:#f2e8ce; --fillink:#0f3b2b;
  --purple:#e2c068; --pink:#ed7464; --cyan:#67cdbb; --green:#4fc47a;
  --yellow:#f0d27a; --orange:#e0a45a; --red:#ed7464; --comment:#9a8f63; --rule:#e2c068;
  --sp:#1c6fd4; --he:#b3232a; --di:#d6a51b; --cl:#1c7a3f;
  --selbg:#efe2bd; --playink:#0d3322;
  background:var(--bg); color:var(--ink);
}
.br[data-theme="blue"]{ --bg:#112c4f; --fillink:#112c4f; --playink:#0a1830; }
.br[data-theme="red"]{ --bg:#3c1418; --fillink:#3c1418; --playink:#220a0c; }
.br[data-theme="black"]{ --bg:#0d0d10; --fillink:#0d0d10; --playink:#060608; }
.br[data-theme="cream"]{
  --bg:#f3ead4; --ink:#2b2517; --dim:#857852; --line:rgba(150,116,30,.55); --line2:rgba(150,116,30,.26);
  --card:#fdf9f1; --cardline:#d8c8a0; --fill:#fdf9f1; --fillink:#2b2517;
  --purple:#a87e22; --pink:#bb3b2a; --cyan:#157a70; --green:#2e8b50;
  --yellow:#9c7d18; --orange:#b5611f; --red:#c0392b; --comment:#857852; --rule:#a87e22;
  --sp:#1c6fd4; --he:#b3232a; --di:#b8890f; --cl:#1c7a3f;
  --selbg:#f2e7c6; --playink:#f6efda;
}
.br *{font-family:var(--mono)!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
.brcard{position:relative;width:calc(42px*var(--k));height:calc(58px*var(--k));flex:0 0 auto;background:var(--card);border:1px solid var(--cardline);cursor:default;user-select:none;transition:transform .08s;}
.brcard.sm{width:calc(30px*var(--k));height:calc(42px*var(--k));}
.brcard.clk{cursor:pointer;} .brcard.dis{opacity:.32;}
.brcard.s-sp{color:var(--sp);} .brcard.s-he{color:var(--he);} .brcard.s-di{color:var(--di);} .brcard.s-cl{color:var(--cl);}
.brcard .idx,.brcard .ir,.brcard .is,.brcard .mid,.brcard .ctr,.brcard .pip{color:inherit;background:transparent;font-variant-emoji:text;-webkit-text-fill-color:currentColor;-webkit-backface-visibility:hidden;backface-visibility:hidden;}
.brcard .is,.brcard .pip{font-family:"DejaVu Sans","Noto Sans Symbols2","Noto Sans Symbols","Segoe UI Symbol","Apple Symbols","Arial Unicode MS",sans-serif!important;}
.brcard.sel{background:var(--selbg);border-color:var(--purple);transform:translateY(calc(-8px*var(--k)));}
.brcard .idx{position:absolute;display:flex;flex-direction:column;align-items:center;line-height:.9;font-weight:700;}
.brcard .idx.tl{top:calc(3px*var(--k));left:calc(4px*var(--k));} .brcard .idx.br{bottom:calc(3px*var(--k));right:calc(4px*var(--k));transform:rotate(180deg);}
.brcard .ir{font-size:calc(11px*var(--k));} .brcard .is{font-size:calc(8px*var(--k));margin-top:calc(1px*var(--k));}
.brcard.sm .ir{font-size:calc(8px*var(--k));} .brcard.sm .is{font-size:calc(6px*var(--k));}
.brcard .ctr{position:absolute;inset:0;}
.brcard .pip{position:absolute;font-size:calc(9.5px*var(--k));line-height:1;transform:translate(-50%,-50%);}
.brcard .pip.flip{transform:translate(-50%,-50%) rotate(180deg);}
.brcard .pip.ace{font-size:calc(27px*var(--k));}
.brcard.sm .pip.ace{font-size:calc(18px*var(--k));}
.brcard.sm .pip{font-size:calc(7px*var(--k));}
.brcard .mid{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;}
.brcard .mid.fc{font-size:calc(25px*var(--k));} .brcard.sm .mid.fc{font-size:calc(17px*var(--k));}
.brback{position:relative;width:calc(42px*var(--k));height:calc(58px*var(--k));flex:0 0 auto;border:1px solid var(--line);background:repeating-linear-gradient(135deg,var(--bg) 0 4px,var(--line2) 4px 5px);}
.brback.sm{width:calc(30px*var(--k));height:calc(42px*var(--k));}
.br select{background:var(--bg);color:var(--ink);border:1px solid var(--line);font-size:11px;padding:4px 6px;}
.br option{background:var(--card);color:var(--sp);}
.br .app{width:100%;max-width:412px;margin:0 auto;display:flex;flex-direction:column;gap:9px;}
.br .num{font-variant-numeric:tabular-nums;}
.br .lbl2{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);font-weight:700;}
.br header{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--rule);padding-bottom:6px;}
.br .wordmark{font-size:18px;font-weight:700;letter-spacing:.34em;padding-left:.34em;background:linear-gradient(92deg,var(--pink),var(--purple) 50%,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
.br .wordmark.sm{font-size:14px;}
.br .target{font-size:10px;letter-spacing:.10em;color:var(--dim);}
.br .toggle{display:flex;border:1px solid var(--line);}
.br .toggle button{font:inherit;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;background:transparent;color:var(--dim);border:0;padding:4px 6px;cursor:pointer;}
.br .toggle button.on{background:var(--purple);color:var(--fillink);}
.br .toggle button+button{border-left:1px solid var(--line);}
.br .seats{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.br .seat{border:1px solid var(--line2);padding:6px 8px;min-width:0;--accent:var(--purple);}
.br .seat.act{background:var(--line2);border-color:var(--line);}
.br .seat .top{display:flex;align-items:center;gap:5px;}
.br .seat .gl{font-size:13px;color:var(--accent);}
.br .seat .nm{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.br .seat .sub{display:flex;gap:7px;margin-top:3px;align-items:center;flex-wrap:wrap;}
.br .seat .pos{font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);}
.br .seat .vtag{color:var(--red);}
.br .seat .role{font-size:8px;letter-spacing:.08em;text-transform:uppercase;padding:1px 4px;border:1px solid var(--accent);color:var(--accent);}
.br .seat .role.decl{color:var(--green);border-color:var(--green);}
.br .seat .role.dummy{color:var(--cyan);border-color:var(--cyan);}
.br .seat .cnt{font-size:9px;color:var(--dim);}
.br .auction{border:1px solid var(--line);}
.br .ahead,.br .arow{display:grid;grid-template-columns:repeat(4,1fr);}
.br .ahead{border-bottom:1px solid var(--line2);}
.br .ac{padding:3px 0;text-align:center;font-size:9px;color:var(--dim);letter-spacing:.14em;}
.br .acell{padding:4px 0;text-align:center;border-left:1px solid var(--line2);min-height:22px;}
.br .acell:first-child{border-left:0;}
.br .aempty{padding:8px;text-align:center;color:var(--dim);font-size:10px;letter-spacing:.1em;}
.br .chip{font-size:11px;font-weight:700;letter-spacing:.02em;}
.br .chip.pass{color:var(--dim);} .br .chip.dbl{color:var(--pink);}
.br .chip.bid{color:var(--ink);} .br .chip.bid.red{color:var(--red);} .br .chip.bid b{font-weight:800;}
.br .chip.big{font-size:15px;}
.br .bidbox{border:1px solid var(--line);padding:7px;}
.br .bidgrid{display:flex;flex-direction:column;gap:3px;}
.br .brow{display:grid;grid-template-columns:20px repeat(5,1fr);gap:3px;align-items:center;}
.br .blv{font-size:10px;color:var(--dim);text-align:center;}
.br .bcell{font:inherit;font-size:13px;font-weight:700;padding:5px 0;background:transparent;color:var(--ink);border:1px solid var(--line2);cursor:pointer;}
.br .bcell.red{color:var(--red);}
.br .bcell:disabled{opacity:.16;cursor:default;}
.br .bcell.sug{background:var(--purple);color:var(--fillink);border-color:var(--purple);}
.br .bidacts{display:flex;gap:6px;margin-top:7px;}
.br .bx{flex:1;font:inherit;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:7px 0;background:transparent;border:1px solid var(--line);color:var(--ink);cursor:pointer;}
.br .bx.pass{color:var(--dim);} .br .bx.dbl{color:var(--pink);border-color:var(--pink);}
.br .bx:disabled{opacity:.24;cursor:default;}
.br .bx.sug{background:var(--purple);color:var(--fillink);border-color:var(--purple);}
.br .tricktable{position:relative;height:200px;border:1px solid var(--line);display:grid;
  grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;
  grid-template-areas:". top ." "left center right" ". bottom .";align-items:center;justify-items:center;}
.br .tslot{display:flex;flex-direction:column;align-items:center;gap:2px;}
.br .tslot.top{grid-area:top;} .br .tslot.left{grid-area:left;} .br .tslot.right{grid-area:right;} .br .tslot.bottom{grid-area:bottom;}
.br .tslot.turn .tempty{border-color:var(--green);color:var(--green);}
.br .tslot.win .tname{color:var(--green);}
.br .tempty{width:calc(30px*var(--k));height:calc(42px*var(--k));border:1px dashed var(--line2);display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:10px;}
.br .tname{font-size:8.5px;color:var(--dim);letter-spacing:.08em;}
.br .tcenter{grid-area:center;text-align:center;}
.br .tinfo .big{font-size:20px;font-weight:800;color:var(--yellow);}
.br .tinfo .big .slash{font-size:12px;color:var(--dim);font-weight:600;}
.br .tinfo .lbl2{margin-top:1px;}
.br .tinfo .trk2{font-size:9px;color:var(--dim);margin-top:4px;letter-spacing:.06em;}
.br .handblock{border:1px solid var(--line2);padding:5px 4px 6px;}
.br .hlabel{margin:0 0 4px 2px;}
.br .hand{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;min-height:44px;}
.br .youhand .hand{min-height:62px;gap:5px;}
.br .sheet{border:1px solid var(--line);}
.br .shead,.br .srow{display:grid;grid-template-columns:1.3fr 1fr 1fr;}
.br .shead{border-bottom:1px solid var(--line2);}
.br .scol{padding:4px 6px;text-align:center;font-size:9px;letter-spacing:.12em;color:var(--dim);text-transform:uppercase;border-left:1px solid var(--line2);}
.br .srow{border-top:1px solid var(--line2);}
.br .slbl{padding:4px 8px;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);}
.br .sval{padding:4px 6px;text-align:center;border-left:1px solid var(--line2);font-size:12px;color:var(--ink);}
.br .sval.big{font-size:16px;font-weight:700;color:var(--yellow);}
.br .sval.vul{font-size:9px;letter-spacing:.1em;color:var(--dim);}
.br .sval.vul.on{color:var(--red);font-weight:700;}
.br .bar{display:flex;gap:7px;align-items:center;justify-content:center;flex-wrap:wrap;min-height:34px;}
.br .btn{font:inherit;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;background:transparent;color:var(--ink);border:1px solid var(--ink);padding:6px 12px;cursor:pointer;}
.br .btn.primary{background:var(--green);color:var(--playink);border-color:var(--green);min-width:120px;text-align:center;}
.br .btn.ghost{border-color:var(--line);color:var(--dim);}
.br .btn.gold{background:var(--purple);color:var(--fillink);border-color:var(--purple);}
.br .btn:disabled{opacity:.3;cursor:default;color:var(--dim);border-color:var(--line);}
.br .hint{font-size:11px;color:var(--dim);text-align:center;line-height:1.4;min-height:16px;}
.br .hint b{color:var(--ink);}
.br .teachbox{border:1px solid var(--purple);background:var(--line2);padding:9px 11px;display:flex;gap:9px;align-items:flex-start;}
.br .teachbox .tb-tag{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--purple);font-weight:700;padding-top:2px;flex:0 0 auto;}
.br .teachbox .tb-txt{font-size:11px;line-height:1.55;color:var(--ink);}
.br .teachbox .tb-body{flex:1;min-width:0;}
.br .gloss-term{color:var(--purple);border-bottom:1px dotted var(--purple);cursor:pointer;}
.br .tb-def{margin-top:7px;padding-top:7px;border-top:1px solid var(--line2);font-size:10.5px;line-height:1.5;color:var(--dim);}
.br .tb-def b{color:var(--purple);text-transform:capitalize;}
.br .tb-more{color:var(--purple);cursor:pointer;white-space:nowrap;}
.br .gterm{padding:8px 0;border-top:1px solid var(--line2);}
.br .gterm:first-child{border-top:0;}
.br .gterm.hot{background:var(--line2);margin:0 -6px;padding:8px 6px;}
.br .gt-name{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:capitalize;color:var(--purple);margin-bottom:2px;}
.br .gt-def{font-size:11px;line-height:1.5;color:var(--ink);}
.br .btn.ghost.on{border-color:var(--purple);color:var(--purple);}
.br .log{font-size:10px;color:var(--dim);line-height:1.5;text-align:center;}
.br .log b{color:var(--ink);}
.br .setwrap{display:flex;flex-direction:column;gap:9px;}
.br .setcard{border:1px solid var(--line2);padding:9px 10px;}
.br .partners{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.br .pteam{display:flex;flex-direction:column;gap:2px;}
.br .pteam b{font-size:11px;letter-spacing:.1em;color:var(--purple);}
.br .pteam span{font-size:10px;color:var(--ink);}
.br .pvs{font-size:9px;color:var(--dim);letter-spacing:.1em;}
.br .setseat{display:grid;grid-template-columns:76px 116px 1fr;gap:8px;align-items:center;padding:5px 0;border-top:1px solid var(--line2);}
.br .setseat:first-of-type{border-top:0;}
.br .ss-pos{display:flex;flex-direction:column;gap:1px;}
.br .ss-abbr{font-size:13px;font-weight:700;color:var(--purple);}
.br .ss-blurb{line-height:1.3;letter-spacing:.04em;text-transform:none;font-size:9px;}
.br .setcard.resume{border-color:var(--purple);}
.br .rz-line{font-size:11px;color:var(--ink);margin:4px 0 7px;}
.br .rz-btns{display:flex;gap:7px;}
.br .setbtns{display:flex;flex-direction:column;gap:8px;align-items:center;margin-top:2px;}
.br .setlinks{display:flex;gap:8px;}
.br .startbtn{font:inherit;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;background:var(--green);color:var(--playink);border:1px solid var(--green);padding:10px 22px;cursor:pointer;width:100%;}
.br .revealgate{border:1px solid var(--line);padding:26px 16px;display:flex;flex-direction:column;align-items:center;gap:9px;text-align:center;}
.br .rg-glyph{font-size:34px;}
.br .rg-who{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.br .overlay{position:fixed;inset:0;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;padding:16px;z-index:40;}
.br .sheetmodal{background:var(--bg);border:1px solid var(--line);max-width:400px;width:100%;max-height:84vh;overflow:auto;}
.br .smhead{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--rule);position:sticky;top:0;background:var(--bg);}
.br .smbody{padding:12px;}
.br .rsec{margin-bottom:12px;}
.br .rsh{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--purple);margin-bottom:5px;}
.br .rsl{font-size:11px;color:var(--ink);line-height:1.5;margin-bottom:3px;}
.br .result{border:1px solid var(--line);padding:14px;text-align:center;}
.br .result .rhead{font-size:15px;font-weight:700;letter-spacing:.04em;}
.br .result .rhead.made{color:var(--green);} .br .result .rhead.down{color:var(--red);}
.br .result .rdetail{font-size:10.5px;color:var(--dim);line-height:1.6;margin-top:7px;}
.br .result .rbig{font-size:22px;font-weight:800;color:var(--yellow);letter-spacing:.06em;margin-top:8px;}
`;

/* =======================================================================
   APP
   ===================================================================== */
export default function App(){
  const [s,dispatch]=useReducer(reducer,SETUP);
  const [theme,setTheme]=React.useState(()=>loadTheme());
  const [campaign,setCampaign]=React.useState(()=>loadCampaign());
  const [showRules,setShowRules]=React.useState(false);
  const [revealSeat,setRevealSeat]=React.useState(0);
  const [hint,setHint]=React.useState(false);
  const [teach,setTeach]=React.useState(()=>{ try{ return localStorage.getItem("bridge.teach.v1")!=="off"; }catch(_){ return true; } });
  const [teachVer,setTeachVer]=React.useState(0);
  const [showGloss,setShowGloss]=React.useState(false);
  const [glossTerm,setGlossTerm]=React.useState(null);
  const [glossPop,setGlossPop]=React.useState(null);

  // load teaching text + glossary at startup: use a script-provided global if present,
  // otherwise fetch the JSON next to the page; fall back silently to the built-in defaults.
  useEffect(()=>{
    if(typeof window==="undefined") return;
    if(window.BRIDGE_TEACHING){ setTeachVer(v=>v+1); return; }
    const url = window.BRIDGE_TEACHING_URL || "bridge-teaching.json";
    let alive=true;
    try{
      fetch(url).then(r=>r.ok?r.json():null).then(j=>{ if(alive&&j){ window.BRIDGE_TEACHING=j; setTeachVer(v=>v+1); } }).catch(()=>{});
    }catch(_){}
    return ()=>{ alive=false; };
  },[]);
  const timer=useRef(null);
  const focusRef=useRef(0);
  const recordedRef=useRef(null);
  const netRef=useRef(null);

  useEffect(()=>{ saveTheme(theme); },[theme]);
  useEffect(()=>{ try{ localStorage.setItem("bridge.teach.v1", teach?"on":"off"); }catch(_){} },[teach]);

  const apply=React.useCallback((action)=>{
    if(netRef.current && netRef.current.role==="guest"){ netRef.current.send(action); return; }
    dispatch(action);
  },[]);

  const net = useBridgeNet({
    onAction:(a)=>apply(a),
    onResume:(state)=>{ dispatch({type:"__SYNC__", state}); },
    onGoSolo:()=>dispatch({type:"TO_SETUP"}),
    onSeatChange:(seat,brain,name)=>dispatch({type:"SET_BRAIN_LIVE", seat, brain, name:(name!=null?name:"")}),
  });
  netRef.current=net;
  const online = net.role!=="off";
  const mySeat = net.seat;
  useEffect(()=>{ if(net.role==="host" && s.mode==="play") net.broadcastState(s, net.names, 0); },[s, net.names, net.role]); // eslint-disable-line
  useEffect(()=>{ if(net.role==="guest" && net.snap) dispatch({type:"__SYNC__", state:net.snap}); },[net.snapV]); // eslint-disable-line

  // bot auto-play (auction + play); also covers a disconnected human seat when hosting online
  useEffect(()=>{
    if(netRef.current && netRef.current.role==="guest") return;
    if(s.mode!=="play") return;
    if(s.phase!=="auction" && s.phase!=="play") return;
    const controller = s.phase==="auction" ? s.turn : controllerOf(s, s.turn);
    const nrole = netRef.current && netRef.current.role;
    const down = nrole==="host" && netRef.current.isSeatDown && netRef.current.isSeatDown(controller);
    if(s.brains[controller]==="human" && !down) return;
    const bs = (s.brains[controller]==="human")
      ? {...s, brains:s.brains.map((b,i)=> i===controller ? "sayer" : b)} : s;
    const delay = down ? 2200 : (s.phase==="auction"?520:620);
    timer.current=setTimeout(()=>{ apply(botAction(bs)); }, delay);
    return ()=>clearTimeout(timer.current);
  },[s]); // eslint-disable-line

  useEffect(()=>{ setHint(false); setGlossPop(null); },[s.turn,s.phase,s.mode]);
  useEffect(()=>{
    const ctrl = s.phase==="auction"? s.turn : controllerOf(s, s.turn);
    if((s.phase==="auction"||s.phase==="play") && s.brains[ctrl]==="human") focusRef.current=ctrl;
  },[s.turn,s.phase]); // eslint-disable-line

  // persist an in-progress rubber + light stats, once per scored deal
  useEffect(()=>{
    if(!(s.mode==="play" && s.phase==="scored" && s.roundEndedAt)) return;
    if(recordedRef.current===s.roundEndedAt) return;
    recordedRef.current=s.roundEndedAt;
    const st=loadStats(); st.dealsPlayed=(st.dealsPlayed||0)+1;
    if(s.result && s.result.made) st.contractsMade=(st.contractsMade||0)+1;
    if(s.rubberDone){ st.rubbers=(st.rubbers||0)+1; if(s.rubberWinner===0) st.rubbersWon=(st.rubbersWon||0)+1; }
    saveStats(st);
    if(s.rubberDone){ saveCampaign(null); setCampaign(null); }
    else {
      const snap={brains:[...s.brains], names:[...(s.names||["","","",""])], games:[...s.games], vuln:[...s.vuln],
        gameBelow:[...s.gameBelow], total:[...s.total], dealer:s.dealer, rubberNo:s.rubberNo||1, ts:Date.now()};
      saveCampaign(snap); setCampaign(snap);
    }
  },[s.phase, s.roundEndedAt]); // eslint-disable-line

  const resumeCampaign=()=>{
    const c=campaign; if(!c) return;
    recordedRef.current=null;
    apply({type:"RESUME", brains:c.brains, names:c.names, games:c.games, vuln:c.vuln,
      gameBelow:c.gameBelow, total:c.total, dealer:c.dealer, rubberNo:c.rubberNo});
  };
  const discardCampaign=()=>{ saveCampaign(null); setCampaign(null); };
  const goSetup=()=>{ dispatch({type:"TO_SETUP"}); };

  if(net.role==="spectate"){
    return <div className="br" data-theme={theme}><style>{THEME_CSS}</style><SpectatorView net={net}/></div>;
  }
  if(net.role==="lobby" || (net.role!=="off" && s.mode!=="play")){
    return <div className="br" data-theme={theme}><style>{THEME_CSS}</style><OnlineScreens net={net} onStart={()=>{}}/></div>;
  }

  if(s.mode==="setup"){
    return (
      <div className="br" data-theme={theme} style={{minHeight:"100vh",background:"var(--bg)",padding:14}}>
        <style>{THEME_CSS}</style>
        <OnlineBar net={net}/>
        <div className="app">
          <header>
            <div className="wordmark">BRIDGE</div>
            <div className="toggle">
              {[["casino","Casino"],["blue","Blue"],["red","Red"],["black","Black"],["cream","Cream"]].map(([t,lab])=>(
                <button key={t} className={theme===t?"on":""} onClick={()=>setTheme(t)}>{lab}</button>
              ))}
            </div>
          </header>
          <div className="hint">Standard contract bridge — bid for the contract, then take your tricks.</div>
          <Setup s={s} dispatch={apply} onShowRules={()=>setShowRules(true)} onShowGloss={()=>{setGlossTerm(null);setShowGloss(true);}}
            campaign={campaign} onResume={resumeCampaign} onDiscard={discardCampaign}/>
        </div>
        {showRules && <RulesScreen onClose={()=>setShowRules(false)}/>}
        {showGloss && <GlossaryScreen gloss={getGlossary()} focusTerm={glossTerm} onClose={()=>{setShowGloss(false);setGlossTerm(null);}}/>}
      </div>
    );
  }

  const activeController = s.phase==="auction" ? s.turn : (s.phase==="play"? controllerOf(s,s.turn) : null);
  const isHumanActing = activeController!=null && s.brains[activeController]==="human";
  const focus = online ? mySeat : (isHumanActing ? activeController : (focusRef.current<4?focusRef.current:0));
  const multiHuman = s.brains.filter(b=>b==="human").length>1;
  const needReveal = online ? false : (multiHuman && isHumanActing && activeController!==revealSeat);

  const dummySeat = s.dummy;
  const showDummy = s.contract && s.dummyRevealed && dummySeat!=null && dummySeat!==focus;
  const playableSeat = (s.phase==="play" && isHumanActing && !needReveal) ? s.turn : null;
  const legalForPlayable = playableSeat!=null ? new Set(ENG.legalPlays(s.hands[playableSeat], s.trick.length?s.ledSuit:null).map(c=>c.id)) : null;

  const sugBidB  = (s.phase==="auction" && isHumanActing && hint && !needReveal) ? suggestBidWhy(s, s.turn) : null;
  const sugPlayB = (s.phase==="play" && isHumanActing && hint && !needReveal) ? suggestPlayWhy(s, s.turn) : null;
  const sugBid  = sugBidB ? sugBidB.call : null;
  const sugPlay = sugPlayB ? sugPlayB.card : null;
  const sugPlayId = sugPlay ? sugPlay.id : null;
  const sugText = teach ? ((sugBidB && sugBidB.text) || (sugPlayB && sugPlayB.text) || "") : "";

  const ct=s.contract;
  const declSide = ct? sideOf(ct.declarer):0;
  const contractBanner = ct ? (()=>{
    const dbl = ct.dbl===4?" XX":ct.dbl===2?" X":"";
    const role = focus===ct.declarer ? "you declare" : focus===s.dummy ? "you are dummy" : sideOf(focus)===declSide ? "your side declares" : "you defend";
    return `${ct.level}${STRAIN_GLYPH[ct.strain]}${dbl} by ${who(s,ct.declarer)} — ${role}`;
  })() : "";

  const doPlay=(card)=>{ if(playableSeat==null) return; apply({type:"PLAY", player:playableSeat, cardId:card.id}); };
  const rubberWon = s.rubberDone;

  return (
    <div className="br" data-theme={theme} style={{minHeight:"100vh",background:"var(--bg)",padding:"12px 10px 18px"}}>
      <style>{THEME_CSS}</style>
      <OnlineBar net={net}/>
      <div className="app">
        <header>
          <div className="wordmark">BRIDGE</div>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span className="target num">RUBBER {s.rubberNo||1} · {s.games[0]}–{s.games[1]}</span>
            <div className="toggle">
              {[["casino","C"],["blue","B"],["red","R"],["black","K"],["cream","W"]].map(([t,lab])=>(
                <button key={t} className={theme===t?"on":""} onClick={()=>setTheme(t)}>{lab}</button>
              ))}
            </div>
          </div>
        </header>

        <div className="seats">
          {[partnerOf(focus),(focus+3)%4,nextSeat(focus),focus].map(seat=>(
            <SeatBadge key={seat} s={s} seat={seat} focus={focus} active={s.turn===seat && s.phase!=="scored"}/>
          ))}
        </div>

        <ScoreSheet s={s}/>

        {s.phase==="auction" && <AuctionView s={s}/>}
        {s.phase!=="auction" && ct && (<div className="hint"><b>{contractBanner}</b></div>)}

        {needReveal ? (
          <RevealGate s={s} seat={activeController} onReveal={()=>setRevealSeat(activeController)}/>
        ) : (
          <>
            {s.phase==="play" && <TrickTable s={s} focus={focus}/>}
            {s.phase==="play" && showDummy && (
              <HandRow hand={s.hands[dummySeat]} label={`Dummy · ${who(s,dummySeat)}`}
                selectable={playableSeat===dummySeat} legalIds={playableSeat===dummySeat?legalForPlayable:null}
                onPlay={doPlay}/>
            )}

            {s.phase==="scored" && s.result && (
              <div className="result">
                <div className={"rhead "+(s.result.made?"made":"down")}>{s.result.head}</div>
                <div className="rdetail">
                  {s.result.detail.join(" · ")}
                  {s.result.honours.length>0 && <><br/>{s.result.honours.join(" · ")}</>}
                  {s.result.gameWon && <><br/><b style={{color:"var(--green)"}}>{SIDE_NAME[s.result.declSide]} win a game!</b></>}
                </div>
                {rubberWon && <div className="rbig">{SIDE_NAME[s.rubberWinner]} take the rubber +{s.result.rubberBonus}</div>}
                <div className="bar" style={{marginTop:10}}>
                  {!rubberWon
                    ? <button className="btn primary" onClick={()=>apply({type:"NEXT_DEAL"})}>Next deal</button>
                    : <button className="btn primary" onClick={()=>apply({type:"NEW_RUBBER"})}>New rubber</button>}
                  <button className="btn ghost" onClick={goSetup}>Setup</button>
                </div>
              </div>
            )}

            {s.phase!=="scored" && (
              <div className="youhand">
                <HandRow hand={s.hands[focus]} label="You"
                  selectable={playableSeat===focus}
                  legalIds={playableSeat===focus?legalForPlayable:null}
                  onPlay={doPlay}/>
                {sugPlayId && <div className="hint">Suggested: <b>{(()=>{const c=(s.hands[focus]||[]).find(x=>x.id===sugPlayId)||(showDummy&&(s.hands[dummySeat]||[]).find(x=>x.id===sugPlayId)); return c?`${c.rank}${SUIT_GLYPH[c.suit]}`:"—";})()}</b>{playableSeat===dummySeat?" (from dummy)":""}</div>}
              </div>
            )}

            {s.phase==="auction" && isHumanActing && (
              <BiddingBox s={s} seat={s.turn} dispatch={apply} suggestion={sugBid}/>
            )}

            {hint && teach && sugText && (
              <div className="teachbox">
                <div className="tb-tag">Why</div>
                <div className="tb-body">
                  <div className="tb-txt">{linkifyGlossary(sugText, getGlossary(), (term)=>setGlossPop({term, def:getGlossary()[term]}))}</div>
                  {glossPop && <div className="tb-def"><b>{glossPop.term}</b> — {glossPop.def} <span className="tb-more" onClick={()=>{setGlossTerm(glossPop.term);setShowGloss(true);}}>full glossary →</span></div>}
                </div>
              </div>
            )}

            <div className="bar">
              {isHumanActing && s.phase!=="scored" && (
                <button className="btn gold" onClick={()=>setHint(h=>!h)}>{hint?"Hide hint":"Suggest"}</button>
              )}
              {isHumanActing && s.phase!=="scored" && (
                <button className={"btn ghost"+(teach?" on":"")} onClick={()=>setTeach(t=>!t)}>{teach?"Teaching \u2713":"Teaching"}</button>
              )}
              {!isHumanActing && s.phase!=="scored" && (
                <div className="hint">{who(s, activeController)} is {s.phase==="auction"?"bidding":"thinking"}…</div>
              )}
              <button className="btn ghost" onClick={()=>setShowRules(true)}>Rules</button>
              <button className="btn ghost" onClick={()=>{setGlossTerm(null);setShowGloss(true);}}>Glossary</button>
              <button className="btn ghost" onClick={goSetup}>Setup</button>
            </div>
          </>
        )}

        {s.log && s.log[0] && <div className="log" dangerouslySetInnerHTML={{__html:`<b>${(s.log[0]||"").replace(/</g,"&lt;")}</b>`}}/>}
      </div>
      {showRules && <RulesScreen onClose={()=>setShowRules(false)}/>}
        {showGloss && <GlossaryScreen gloss={getGlossary()} focusTerm={glossTerm} onClose={()=>{setShowGloss(false);setGlossTerm(null);}}/>}
    </div>
  );
}

/* =======================================================================
   GAME ADAPTER — the standard contract the multiplayer shell consumes.
   ===================================================================== */
function redactFor(state, seat){
  if(!state || !state.hands) return state;
  const fake=(n)=>{ const a=[]; for(let i=0;i<n;i++) a.push({id:0,rank:"?",suit:"?",back:true}); return a; };
  const dummyVisible = state.contract && state.dummyRevealed ? state.dummy : -1;   // dummy is public once exposed
  const hands={};
  for(let i=0;i<4;i++){
    if(i===seat || i===dummyVisible) hands[i]=state.hands[i];
    else hands[i]=fake((state.hands[i]||[]).length);
  }
  const out={...state, hands};
  if(state.phase!=="scored") out.dealtHands=undefined;                            // never leak concealed hands early
  return out;
}
function publicView(s){
  if(!s || !s.hands) return { status:"", seats:[], pileTop:null, pileCount:0, stockCount:0, log:[] };
  const seats=[];
  for(let i=0;i<4;i++){
    seats.push({
      name: who(s,i),
      handCount: (s.hands[i]||[]).length,
      score: s.total[sideOf(i)],
      turn: i===s.turn && s.phase!=="scored",
      note: i===s.declarer?"declarer":i===s.dummy?"dummy":SEAT_NAME[i],
    });
  }
  const top = s.trick && s.trick.length ? s.trick[s.trick.length-1].card
            : (s.lastTrick? s.lastTrick.trick[s.lastTrick.trick.length-1].card : null);
  const status = s.phase==="auction" ? `${who(s,s.turn)} to bid`
    : s.phase==="play" ? `${who(s,s.turn)} to play`
    : s.phase==="scored" ? (s.result? s.result.head : "hand over") : "";
  return {
    status, seats,
    pileTop: top ? (top.rank+SUIT_GLYPH[top.suit]) : null,
    pileCount: s.trick? s.trick.length : 0,
    stockCount: 0,
    log: s.log||[],
  };
}
if (typeof window !== "undefined") {
  window.GAME = {
    id: "bridge",
    title: "BRIDGE",
    minPlayers: 4,
    maxPlayers: 4,
    App: App,
    redactFor: redactFor,
    publicView: publicView,
    actionTypes: ["BID","PLAY","NEXT_DEAL","NEW_RUBBER"],
    seatOf: (a)=> a.seat!=null ? a.seat : a.player,
  };
}


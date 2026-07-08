import React, { useReducer, useEffect, useRef } from "react";
/* ===== inlined curriculum.js (self-contained; keep bridge.jsx importing only React) ===== */
/* ============================================================================
   SAYC CURRICULUM  —  engine-agnostic lesson data
   ----------------------------------------------------------------------------
   One shared source of truth for both BridgeTeachingLab.jsx and bridge.jsx.
   Mapped chapter-by-chapter to "Standard Bidding with SAYC" (Downey & Pomer),
   with a Hand-Evaluation foundation up front and the Strategies-for-Defence
   material folded into the Leads & Carding module.

   Each lesson:
     id     unique key
     title  display name
     teach  short SAYC note, paraphrased (no copyrighted text reproduced)
     ch     source book chapter (0 = foundation, "D" = defence PDF)
     drill  null  -> teach-only for now
            { pos, note }  -> auto-drillable. `pos` tells the generator what
            auction prefix to synthesize so the decision point is reached, then
            the correct answer is taken from the game's own BID.chooseBid oracle.
            pos values:
              "open"        South is dealer, first call
              "open-3rd"    two passes to South, first call (third seat)
              "open-4th"    three passes to South, first call (fourth seat)
              "resp-maj"    partner opened 1H/1S, South responds
              "resp-min"    partner opened 1C/1D, South responds
              "resp-nt"     partner opened 1NT/2NT, South responds
              "resp-2c"     partner opened strong 2C, South responds
              "resp-weak"   partner opened a weak two/preempt, South responds
              "op-rebid"    South opened, partner responded, South rebids
              "rp-rebid"    South responded, opener rebid, South rebids again
              "compete"     RHO opened/overcalled, South acts (overcall/dbl/etc.)
              "advance"     partner overcalled/doubled, South advances
              "balance"     opening passed around to South in the passout seat
              "lead"        auction over, South picks the opening lead
   ========================================================================== */

const CURRICULUM = [

  /* ---- FOUNDATION (prereq; not a book chapter) ---------------------------- */
  { id: "eval", module: "Hand Evaluation", lessons: [
    { id: "hcp", ch: 0, title: "High-card points",
      teach: "A=4, K=3, Q=2, J=1. The deck holds 40, so 10 HCP is an average hand. HCP is the baseline for balanced hands; distribution matters more as hands get shapelier.", drill: { kind: "eval", q: "hcp" } },
    { id: "dist", ch: 0, title: "Distribution points",
      teach: "Long-suit points: +1 for each card beyond the fourth in a suit. Short-suit points (only once a trump fit is found): void=5, singleton=3, doubleton=1. Total points = HCP plus whichever distributional count applies.", drill: { kind: "eval", q: "tp" } },
    { id: "shape", ch: 0, title: "Balanced shape & the Rule of 20",
      teach: "Balanced = no void, no singleton, at most one doubleton (4-3-3-3, 4-4-3-2, 5-3-3-2). Borderline 12-count? Open if HCP + your two longest suit lengths reach 20.", drill: { kind: "eval", q: "r20" } },
    { id: "requant", ch: 0, title: "Re-evaluating: good vs. bad points",
      teach: "Aces and kings are undervalued by 4-3-2-1; unsupported queens and jacks in short suits are overvalued. Promote for honors working together and for tens/nines; demote for stray jacks and flat 4-3-3-3 shape (deduct a point opposite a notrump opener).", drill: { kind: "eval", q: "qt" } },
  ]},

  /* ---- CH 1: NOTRUMP OPENINGS -------------------------------------------- */
  { id: "ntopen", module: "Notrump Openings", lessons: [
    { id: "o-1nt", ch: 1, title: "Opening 1NT (15\u201317)",
      teach: "Balanced 15\u201317 HCP opens 1NT \u2014 a five-card major or minor inside a balanced hand is fine. It pins your strength in one bid and makes responder captain.",
      drill: { pos: "open", note: "balanced 15-17" } },
    { id: "o-highnt", ch: 1, title: "Higher notrump openings (2NT / 3NT)",
      teach: "Balanced 20\u201321 opens 2NT; balanced 25\u201327 opens the rare 3NT. Below 20 and above 17 you open a suit and show the balanced shape on the rebid instead.",
      drill: { pos: "open", note: "balanced 20-21 or 25-27" } },
  ]},

  /* ---- CH 2: RESPONDING TO 1NT ------------------------------------------- */
  { id: "resp1nt", module: "Responding to 1NT", lessons: [
    { id: "r-stayman", ch: 2, title: "Stayman (non-forcing 2\u2663)",
      teach: "2\u2663 asks opener for a four-card major: opener bids 2\u2666 (none), 2\u2665, or 2\u2660. Usually 8+ points, or a shape that can safely land in a five-card major after a 2\u2666 reply.",
      drill: { pos: "resp-nt", note: "4-card major, invite+" } },
    { id: "r-transfer", ch: 2, title: "Jacoby transfers (2\u2666 / 2\u2665)",
      teach: "2\u2666 = transfer to hearts, 2\u2665 = transfer to spades, showing a 5+ card major. Opener completes the transfer; responder's next call sets the strength and keeps the strong hand hidden as declarer.",
      drill: { pos: "resp-nt", note: "5+ card major" } },
    { id: "r-2sminor", ch: 2, title: "2\u2660 \u2014 long weak minors",
      teach: "With transfers in use, 2\u2660 over 1NT is a puppet: it forces opener to bid 3\u2663. Responder passes with long clubs or corrects to 3\u2666 with long diamonds \u2014 a way to escape a hopeless 1NT into a long, weak minor. (Alertable.)",
      drill: { pos: "resp-nt", note: "6+ weak minor, no game" } },
    { id: "r-ntinvite", ch: 2, title: "Invitational & 3-level responses",
      teach: "2NT invites with a balanced 8\u20139 (deduct a point with 4-3-3-3). Jumps to 3\u2665/3\u2660 are invitational with a six-card major; 3\u2663/3\u2666 show a six-card minor with slam interest, since a weak minor would just transfer.",
      drill: { pos: "resp-nt", note: "invitational balanced/6-card" } },
    { id: "r-gerber", ch: 2, title: "Gerber & quantitative 4NT",
      teach: "4\u2663 over any natural notrump is Gerber, asking for aces (4\u2666=0/4, 4\u2665=1, 4\u2660=2, 4NT=3). A direct raise to 4NT is quantitative, inviting 6NT \u2014 opener passes minimum, bids on maximum.",
      drill: { pos: "resp-nt", note: "slam-zone balanced" } },
    { id: "r-higher-nt", ch: 2, title: "Responding to 2NT / 3NT openings",
      teach: "Stayman and Jacoby transfers still apply over a 2NT opening (3\u2663 Stayman, 3\u2666/3\u2665 transfers) and over 3NT one step higher (4\u2663 Stayman, 4\u2666/4\u2665 transfers). 4\u2663 over 2NT is Gerber.",
      drill: { pos: "resp-nt", note: "opposite 2NT/3NT" } },
    { id: "r-ntinterf", ch: 2, title: "Handling interference over 1NT",
      teach: "If they double, your conventional responses stay on. If they bid a suit, Stayman and transfers are off \u2014 bids become natural, and a cuebid of their suit substitutes for Stayman with game values.",
      drill: { pos: "resp-1nt-interf", note: "systems off over their overcall \u2014 cuebid = Stayman" } },
  ]},

  /* ---- CH 3: ONE-LEVEL OPENING BIDS -------------------------------------- */
  { id: "suitopen", module: "One-Level Opening Bids", lessons: [
    { id: "o-suit", ch: 3, title: "Opening one of a suit",
      teach: "Open your longest suit; with two equal long suits open the higher-ranking (5-5, 6-6). Five-card-majors style: a major opening promises five. Rule of 20 governs the borderline 12-counts.",
      drill: { pos: "open", note: "13-21 unbalanced" } },
    { id: "o-whichminor", ch: 3, title: "1\u2663 or 1\u2666? (the minor question)",
      teach: "With no five-card suit, open the longer minor. Equal minors: open 1\u2666 with 4-4 and 1\u2663 with 3-3. So a 1\u2666 opening tends to show four+, while 1\u2663 is often just a three-card 'convenient minor'.",
      drill: { pos: "open", note: "no 5-card suit" } },
    { id: "o-third", ch: 3, title: "Third-seat openers (open light)",
      teach: "After two passes you may open light (even 10\u201311) for lead direction and to contest the partscore \u2014 but only with a suit you'd be happy to have led. Test: would you overcall this suit? Then it's worth a third-seat open. Be ready to pass any response.",
      drill: { pos: "open-3rd", note: "10-11 with a good suit" } },
    { id: "o-fourth", ch: 3, title: "Fourth-seat openers: the Rule of 15",
      teach: "In the passout seat, add your HCP to your number of spades; open only if the total is 15+ (the Cansino count). Owning spades lets you compete cheaply, so a light fourth-seat open needs spade length, not just points.",
      drill: { pos: "open-4th", note: "borderline; HCP + spades >= 15" } },
  ]},

  /* ---- CH 4: RESPONDING TO ONE OF A MAJOR -------------------------------- */
  { id: "respmaj", module: "Responding to One of a Major", lessons: [
    { id: "rm-min", ch: 4, title: "Minimum responses (6\u20139)",
      teach: "With 6\u20139 and three-card support, raise to two. Lacking support, bid a new suit at the one level if you can, else respond 1NT (semi-forcing, 6\u20139, denies the raise and a biddable one-level suit).",
      drill: { pos: "resp-maj", note: "6-9 support/response" } },
    { id: "rm-inv", ch: 4, title: "Invitational responses (10\u201311)",
      teach: "A limit raise (jump to three of the major) shows 10\u201311 with three+ support and invites game. With no fit, bid a new suit (forcing) and describe the invitational strength on the next round.",
      drill: { pos: "resp-maj", note: "10-11 limit raise" } },
    { id: "rm-gf", ch: 4, title: "Game-forcing values (Jacoby 2NT, jump shifts)",
      teach: "Jacoby 2NT is a game-forcing raise of the major asking opener to show a shortage for slam evaluation. A jump shift shows a strong one-suiter with slam interest. Both promise the values to reach at least game.",
      drill: { pos: "resp-maj", note: "13+ game force" } },
    { id: "rm-rebid", ch: 4, title: "Responder's rebids after a major",
      teach: "Having limited your hand, choose: sign off, invite (2NT or 3 of a bid suit), or force to game. A new suit by responder is still forcing; returning to partner's major shows a delayed fit.",
      drill: { pos: "rp-rebid", note: "responder's 2nd call" } },
  ]},

  /* ---- CH 5: RESPONDING TO ONE OF A MINOR -------------------------------- */
  { id: "respmin", module: "Responding to One of a Minor", lessons: [
    { id: "rn-min", ch: 5, title: "Minimum responses to a minor",
      teach: "6+ points to respond. Show four-card majors up the line at the one level before raising the minor or bidding notrump \u2014 finding a major fit comes first. 1NT is the 6\u201310 catch-all.",
      drill: { pos: "resp-min", note: "6-10, show majors up the line" } },
    { id: "rn-inv", ch: 5, title: "Invitational responses to a minor",
      teach: "With 10\u201312 and no major fit, invite with 2NT (balanced, stoppers) or a jump raise of the minor. A new suit at the two level shows 10+ and is forcing.",
      drill: { pos: "resp-min", note: "10-12 invitational" } },
    { id: "rn-gf", ch: 5, title: "Game-forcing responses to a minor",
      teach: "13+ balanced with stoppers heads for 3NT; otherwise jump-shift or bid game-forcing new suits and hunt for the right strain. Minor-suit game (5m) needs ~29 combined, so 3NT is usually the target.",
      drill: { pos: "resp-min", note: "13+ game force" } },
    { id: "rn-slam", ch: 5, title: "Slam-zone bids by responder",
      teach: "With 18+ opposite an opening minor, set up a forcing auction early (jump shift or a game-force then control-showing) rather than blasting notrump, so the partnership has room to explore the minor-suit or notrump slam.",
      drill: { pos: "resp-min", note: "18+ opposite a minor" } },
  ]},

  /* ---- CH 6: OPENER'S REBID ---------------------------------------------- */
  { id: "oprebid", module: "Opener's Rebid", lessons: [
    { id: "or-min", ch: 6, title: "Minimum rebids (13\u201315)",
      teach: "Rebid cheaply: raise responder with a fit, rebid a six-card suit, bid a new lower-ranking suit, or rebid 1NT (12\u201314 balanced). Don't reverse or jump \u2014 those show extras you don't have.",
      drill: { pos: "op-rebid", note: "opener 13-15" } },
    { id: "or-inv", ch: 6, title: "Invitational rebids (16\u201318)",
      teach: "Show extra values: jump-raise responder, jump-rebid a good six-card suit, or reverse into a higher suit. A jump to 2NT after a one-level response shows 18\u201319 balanced.",
      drill: { pos: "op-rebid", note: "opener 16-18" } },
    { id: "or-gf", ch: 6, title: "Game-forcing rebids (19\u201321)",
      teach: "Make an unmistakably strong noise: jump-shift, double-jump raise, or jump in notrump. Responder cannot pass below game.",
      drill: { pos: "op-rebid", note: "opener 19-21" } },
    { id: "or-limit", ch: 6, title: "Rebidding after a limit raise",
      teach: "When responder makes a limit raise (10\u201311), pass with a dead minimum, bid game with any extra, and probe with a new-suit game-try or a control bid when slam is possible. The captaincy passes back to you.",
      drill: { pos: "op-rebid", note: "rebid after a limit raise" } },
  ]},

  /* ---- CH 7: REVERSES (own module) --------------------------------------- */
  { id: "reverses", module: "Reverses", lessons: [
    { id: "rv-opener", ch: 7, title: "Opener's reverse",
      teach: "A reverse is bidding a new, higher-ranking suit at the two level that forces partner to the three level to return to your first suit. It shows extras (roughly 17+) and is forcing \u2014 you can't reverse on a minimum.",
      drill: { pos: "op-rebid", note: "17+, second suit higher" } },
    { id: "rv-respafter", ch: 7, title: "Responder's rebids after a reverse",
      teach: "The reverse is forcing, so you must bid again. Rebid your first suit, raise opener's second suit with support, bid the fourth suit or notrump with a stopper \u2014 preferring the cheapest sensible description with a bare minimum.",
      drill: { pos: "rp-rebid", note: "responder rebid after a reverse" } },
    { id: "rv-responder", ch: 7, title: "Reverses by responder",
      teach: "Responder reverses too: bidding a second suit higher than the first, at a level that crowds the auction, shows extra values and is forcing. It says 'we're going at least to game \u2014 keep describing.'",
      drill: { pos: "resp-reverse", note: "reverse: higher second suit is game-forcing" } },
  ]},

  /* ---- CH 8: SUBSEQUENT BIDDING BY RESPONDER ----------------------------- */
  { id: "respafter", module: "Subsequent Bidding by Responder", lessons: [
    { id: "ra-weak", ch: 8, title: "Weak & invitational rebids",
      teach: "With 6\u20139 sign off \u2014 pass, give simple preference, or rebid 1NT. With 10\u201311 invite: 2NT, a jump preference to three of opener's suit, or a jump in your own six-carder.",
      drill: { pos: "rp-rebid", note: "responder 6-11" } },
    { id: "ra-forcing", ch: 8, title: "Forcing & game-forcing rebids",
      teach: "A new suit by responder is forcing. After a 1NT rebid by opener, a new suit at the two level is non-forcing \u2014 jump-shift to force game. Fourth suit forcing is the artificial game-force.",
      drill: { pos: "rp-rebid", note: "game-forcing responder rebid" } },
    { id: "ra-2over1", ch: 8, title: "Responder rebids in 2-over-1 auctions",
      teach: "When you respond a new suit at the two level you promise another bid (unless opener jumps to game). Limit the hand next turn with 2NT or a jump preference; a jump raise of opener's first suit to the three level is game-forcing.",
      drill: { pos: "rp-rebid", note: "responder rebid in a 2-over-1" } },
  ]},

  /* ---- CH 9: FOURTH SUIT FORCING ----------------------------------------- */
  { id: "fsf", module: "Fourth Suit Forcing", lessons: [
    { id: "fsf-what", ch: 9, title: "Fourth suit forcing",
      teach: "When three suits have been bid, bidding the fourth at the two level or higher is artificial and forcing for one round (often to game). It says nothing about that suit \u2014 it asks partner for more information, typically a stopper for notrump.",
      drill: { pos: "rp-rebid", note: "responder bids the fourth suit" } },
    { id: "fsf-opener", ch: 9, title: "Opener's rebids after FSF",
      teach: "Answer the question: bid notrump with a stopper in the fourth suit, rebid or raise a real suit to show shape, or raise the fourth suit only with genuine length \u2014 but never carry it past 3NT without a fit.",
      drill: { pos: "op-fsf", note: "opener answers FSF" } },
  ]},

  /* ---- CH 10: PREEMPTION ------------------------------------------------- */
  { id: "preempt", module: "Preemption", lessons: [
    { id: "o-weak2", ch: 10, title: "Weak two-bids",
      teach: "A good six-card D/H/S suit with 5\u201311 HCP and no outside four-card major opens 2\u2666/2\u2665/2\u2660, stealing the opponents' bidding room. There is no weak 2\u2663 (that's the strong opening).",
      drill: { pos: "open", note: "6-card D/H/S, 5-11" } },
    { id: "o-preempt", ch: 10, title: "Preemptive 3- and 4-level openings",
      teach: "A good seven-card suit with fewer than opening values opens at the three level; an eight-card suit opens at the four level. Vulnerability tunes how sound the preempt must be (within 2, 3, or 4 tricks of your bid).",
      drill: { pos: "open", note: "7-8 card suit, weak" } },
    { id: "r-weak", ch: 10, title: "Responding to weak twos & preempts",
      teach: "Raises are preemptive, not invitations \u2014 pass if partner raises you. Over a weak two, 2NT is a forcing feature-ask (opener bids a side ace/king, or 3NT with a max); a new suit is forcing (RONF \u2014 raise is the only non-force).",
      drill: { pos: "resp-weak", note: "opposite a weak two" } },
  ]},

  /* ---- CH 11: THE STRONG 2C OPENING -------------------------------------- */
  { id: "strong2c", module: "The Strong 2\u2663 Opening", lessons: [
    { id: "o-2c", ch: 11, title: "Opening 2\u2663",
      teach: "22+ points (or the playing equivalent in tricks) opens the artificial, game-forcing 2\u2663 \u2014 the one call too strong for a natural one-bid. It says nothing about clubs.",
      drill: { pos: "open", note: "22+" } },
    { id: "r-2c", ch: 11, title: "Responding to 2\u2663",
      teach: "2\u2666 is the waiting/negative response (also any hand not suited to a positive). A natural suit or 3\u2663/3\u2666 shows a real 5+ suit and 8+ points; 2NT shows a balanced 8 HCP. Stay alert \u2014 the auction is forcing to game.",
      drill: { pos: "resp-2c", note: "opposite strong 2C" } },
    { id: "or-2c", ch: 11, title: "Opener's rebids after 2\u2663",
      teach: "Over the 2\u2666 waiting bid, rebid 2NT with 22\u201324 balanced (non-forcing, Stayman/transfers on). Any suit rebid is natural and forcing to game \u2014 keep describing until the strain and level are found.",
      drill: { pos: "op-rebid", note: "opener's rebid after 2C" } },
  ]},

  /* ---- CH 12: OVERCALLS -------------------------------------------------- */
  { id: "overcalls", module: "Overcalls", lessons: [
    { id: "c-over1", ch: 12, title: "One-level overcalls",
      teach: "Overcall on a good five-card+ suit and playing strength, not raw points. Before acting ask: does the hand belong to us, is there a sacrifice, does it crowd their auction, and do I want this suit led? Scattered honors outside the suit argue against a marginal overcall.",
      drill: { pos: "compete", note: "RHO opened, one-level overcall" } },
    { id: "c-over2", ch: 12, title: "Two-level overcalls",
      teach: "A two-level overcall needs a sounder suit and more values \u2014 avoid a weak five-bagger. Three small in the suit opened in front of you is the death holding: three fast losers. Prefer a strong suit you'd welcome partner leading.",
      drill: { pos: "compete", note: "two-level overcall" } },
    { id: "c-respover", ch: 12, title: "Responding to overcalls",
      teach: "Raise with three-card support to the level of the fit (partly preemptive). A cuebid of opener's suit is the one forcing response, asking about the overcall's quality; a new suit shows a good 5+ suit and is not forcing.",
      drill: { pos: "advance", note: "partner overcalled" } },
    { id: "c-jumpover", ch: 12, title: "Preemptive jump overcalls",
      teach: "A jump overcall is weak, not strong \u2014 the same shape as an opening preempt at that level (six good cards for a two-level jump, seven for three). With a genuine strong hand, double first and then bid your suit.",
      drill: { pos: "compete", note: "weak jump overcall" } },
  ]},

  /* ---- CH 13: MICHAELS & UNUSUAL NOTRUMP --------------------------------- */
  { id: "twosuit", module: "Michaels & Unusual Notrump", lessons: [
    { id: "c-michaels", ch: 13, title: "Michaels cuebid",
      teach: "A direct cuebid of their suit shows a 5\u20135 two-suiter. Over a minor it shows both majors; over a major it shows the other major plus an unspecified minor (partner bids 2NT to ask which).",
      drill: { pos: "compete", note: "5-5 two-suiter" } },
    { id: "c-unusual", ch: 13, title: "Unusual notrump",
      teach: "A jump to 2NT over their opening is Unusual \u2014 5\u20135 in the two lowest unbid suits (usually the minors over a major). It lets partner pick the best of your two long suits at once.",
      drill: { pos: "compete", note: "5-5 lowest two suits" } },
    { id: "c-balancetwo", ch: 13, title: "Two-suiters in the balancing seat",
      teach: "In the passout seat these bids can be shaded, since partner's pass may hide values. But a balancing 2NT is not always Unusual \u2014 by common agreement it can be natural (19\u201321), so confirm the meaning with partner.",
      drill: { kind: "concept", concept: "balance2nt" } },
  ]},

  /* ---- CH 14: OVERCALLING THEIR 1NT -------------------------------------- */
  { id: "vs1nt", module: "Overcalling Their 1NT", lessons: [
    { id: "c-capp", ch: 14, title: "Cappelletti",
      teach: "Over their 1NT: double = an equal balanced hand (you were about to open 1NT). 2\u2663 = an unknown one-suiter; 2\u2666 = both majors; 2\u2665 = hearts plus a minor; 2\u2660 = spades plus a minor; 2NT = both minors. Three-level overcalls are natural.",
      drill: { pos: "vs-1nt", note: "defence to their 1NT" } },
  ]},

  /* ---- CH 15: DOUBLES & REDOUBLES ---------------------------------------- */
  { id: "doubles", module: "Doubles & Redoubles", lessons: [
    { id: "d-penalty", ch: 15, title: "The penalty double",
      teach: "A double is for penalty when partner can't read it as takeout \u2014 typically over their game-level contracts, or when your side has clearly bid the hand and they've overreached. You expect to defeat the contract for a bigger score than bidding on.",
      drill: { kind: "concept", concept: "penalty" } },
    { id: "d-takeout", ch: 15, title: "The takeout double",
      teach: "Opening values with shortness in their suit and support for the unbid suits \u2014 it asks partner to pick a suit. 12+ points; the more high cards you have, the less perfect the shape needs to be. Over a partscore, a double is takeout; over a game, it's penalty.",
      drill: { pos: "compete", note: "takeout shape" } },
    { id: "d-resptakeout", ch: 15, title: "Responding to a takeout double",
      teach: "Bid your best suit \u2014 a four-card major beats a slightly longer minor. 0\u20138 bid cheaply; 9\u201311 jump; 12+ cuebid their suit to force game or when unsure of the strain. With their suit stopped, 1NT/2NT show 8\u201312.",
      drill: { pos: "advance", note: "partner doubled for takeout" } },
    { id: "d-jordan", ch: 15, title: "When they double: redouble & Jordan",
      teach: "Over an opponent's takeout double of partner's opening: redouble shows 10+ (and usually no clear fit). Jordan \u2014 a jump to 2NT \u2014 is the limit-raise-or-better in partner's major, freeing the redouble for other hands.",
      drill: { pos: "resp-vs-dbl", note: "Jordan 2NT over their takeout double" } },
    { id: "d-leaddir", ch: 15, title: "Lead-directing doubles",
      teach: "Doubling a conventional bid (a Stayman 2\u2663, a transfer, a cuebid) asks partner to lead that suit rather than promising a set. Against a slam, a Lightner double demands an unusual lead \u2014 typically dummy's first-bid suit, not the obvious one.",
      drill: { pos: "resp-lead-dbl", note: "double their convention to ask for that lead" } },
  ]},

  /* ---- CH 16: NEGATIVE DOUBLE -------------------------------------------- */
  { id: "negdbl", module: "The Negative Double", lessons: [
    { id: "n-what", ch: 16, title: "Negative doubles \u2014 what they promise",
      teach: "After partner opens and RHO overcalls, a double is takeout for your side through 2\u2660. It shows the unbid major(s) with values \u2014 e.g. after 1\u2663\u2013(1\u2660), double promises four+ hearts; after 1\u2666\u2013(1\u2660), typically both majors.",
      drill: { pos: "neg-dbl", note: "partner opened, RHO overcalled" } },
    { id: "n-resp", ch: 16, title: "Responding to a negative double",
      teach: "Opener treats the double as a takeout request: bid the promised major with a fit, rebid naturally otherwise, and jump with extra values. With a strong balanced hand and their suit stopped, notrump is available.",
      drill: { pos: "op-negdbl", note: "opener answers the negative double" } },
  ]},

  /* ---- CH 17: THE REOPENING DOUBLE --------------------------------------- */
  { id: "reopendbl", module: "The Reopening Double", lessons: [
    { id: "ro-dbl", ch: 17, title: "The reopening double",
      teach: "When an overcall is passed back to opener in the passout seat, a double is takeout and can be lighter than a direct double \u2014 it reopens for a partner who was too weak or wrongly shaped to act but may hold a penalty pass. Reopen especially when short in their suit.",
      drill: { pos: "balance", note: "reopen after their overcall" } },
  ]},

  /* ---- CH 18: BALANCING -------------------------------------------------- */
  { id: "balance", module: "Balancing", lessons: [
    { id: "b-what", ch: 18, title: "Balancing \u2014 borrowing a king",
      teach: "In the passout seat after a low-level contract, act on lighter values than you'd need directly \u2014 'borrow a king' from the partner who couldn't act. A balancing double or suit bid competes for a partscore the opponents were about to steal.",
      drill: { pos: "balance", note: "passout seat action" } },
    { id: "b-nt", ch: 18, title: "Balancing notrump ranges",
      teach: "A balancing 1NT shows 12\u201314 (three points lighter than a direct 1NT overcall, because you've borrowed strength). A balancing 2NT shows 19\u201321 and is natural, not Unusual.",
      drill: { pos: "balance", note: "balancing 1NT (12-14)" } },
    { id: "b-resp", ch: 18, title: "Responding to partner's balance",
      teach: "Discount your hand \u2014 partner has borrowed values that may not be there. Don't drive to game as if partner acted directly; invite where you'd normally force, and pass where you'd normally invite.",
      drill: { pos: "resp-balance", note: "responding to partner's balance \u2014 discount your hand" } },
  ]},

  /* ---- CH 19: SLAM BIDDING ----------------------------------------------- */
  { id: "slam", module: "Slam Bidding", lessons: [
    { id: "s-bw", ch: 19, title: "Blackwood 4NT",
      teach: "4NT asks for aces: 5\u2663=0/4, 5\u2666=1, 5\u2665=2, 5\u2660=3. A follow-up 5NT asks for kings and guarantees the partnership holds all four aces. Use it to stay out of a slam missing two aces, not to bid one. (Drill: partner has asked \u2014 show your aces.)",
      drill: { pos: "slam-bwresp", note: "partner bid Blackwood 4NT \u2014 show your aces" } },
    { id: "s-gerber", ch: 19, title: "Gerber & the Grand Slam Force",
      teach: "4\u2663 over a natural notrump is Gerber (ace-asking): 4\u2666=0/4, 4\u2665=1, 4\u2660=2, 4NT=3. A jump to 5NT is the Grand Slam Force, asking partner to bid seven of the agreed suit holding two of the top three trump honors. (Drill: partner has asked \u2014 show your aces.)",
      drill: { pos: "slam-gbresp", note: "partner bid Gerber 4\u2663 \u2014 show your aces" } },
    { id: "s-control", ch: 19, title: "Control bids (cuebidding)",
      teach: "Once a trump fit and slam interest are established, bid your cheapest first-round control (ace or void) up the line; second-round controls (kings, singletons) come on later rounds. Cuebidding pinpoints where your controls lie before committing with Blackwood.",
      drill: { kind: "concept", concept: "controlseq" } },
    { id: "s-choose", ch: 19, title: "Choosing the slam method",
      teach: "Quantitative raises decide notrump slams by points; Blackwood checks for missing aces in suit slams; control bids handle hands where a specific unguarded suit \u2014 not the ace count \u2014 is the worry. Match the tool to the doubt.",
      drill: { kind: "concept", concept: "slamtool" } },
  ]},

  /* ---- CH 20 + DEFENCE PDF: LEADS & CARDING ------------------------------ */
  { id: "defence", module: "Leads, Carding & Defence", lessons: [
    { id: "l-nt", ch: 20, title: "Leading against notrump",
      teach: "Attack: lead fourth-best from your longest, strongest suit to develop length, or top of a sequence. With only one honor in a long suit (especially a minor), leading fourth-best is often wrong \u2014 a passive spot can be better.",
      drill: { pos: "lead", strain: "NT", note: "opening lead vs NT" } },
    { id: "l-suit", ch: 20, title: "Leading against suit contracts",
      teach: "Lead the ace from A-K (not the king), top of a sequence, or top-of-nothing for safety. Don't underlead an ace against a suit. A singleton lead only pays when you have no natural trump trick and an entry to get your ruff.",
      drill: { pos: "lead", strain: "suit", note: "opening lead vs suit" } },
    { id: "l-signals", ch: 20, title: "Signals & carding",
      teach: "Attitude: high card encourages, low discourages. Count: high-low shows an even number, low-high odd. Suit preference: a high spot calls for the higher-ranking side suit, a low spot for the lower. Standard leads are fourth-best and top of touching honors.",
      drill: null },
    { id: "d-strategy", ch: "D", title: "The four defensive strategies",
      teach: "Before the lead, pick a plan. Active: cash tricks fast before declarer pitches losers on a long suit. Passive (the default when unsure): give nothing away. Forcing: keep leading your long suit to make declarer ruff and lose trump control. Attacking trumps: lead trumps to kill dummy's ruffs, or build a trump trick.",
      drill: { kind: "concept", concept: "defplan" } },
  ]},

  /* ---- PART 2 \u2014 DECLARER PLAY (from Bernard Magee, "Basic Techniques of Declarer Play") -- */
  { id: "declplay", module: "Declarer Play: Making a Plan", lessons: [
    { id: "dp-plan", ch: "M", title: "Make a plan (ATTITWDE)",
      teach: "Before playing to trick one, make a plan. Fix your Aim (how many tricks the contract needs), count your Top tricks (sure winners), see how to Increase tricks by establishment, Worry about the defence (stoppers in notrump, losers in a suit), then Execute in the order that keeps your entries. A methodical plan turns a hard hand into a countable one.",
      drill: null },
    { id: "dp-top", ch: "M", title: "Counting top tricks",
      teach: "A top trick is a winner you can cash immediately without giving up the lead. Combine the two hands suit by suit: a suit yields top tricks only for the unbroken run of highest cards you hold between them. Count these first \u2014 every other step in the plan is measured against this number.",
      drill: { kind: "declcount", q: "toptricks" } },
    { id: "dp-need", ch: "M", title: "How many tricks to develop",
      teach: "Subtract your top tricks from the number the contract needs, and the gap is the job establishment has to do. In 3NT with seven top tricks you need two more \u2014 knowing the exact shortfall tells you how hard to work and which suit to attack.",
      drill: { kind: "declcount", q: "needtricks" } },
    { id: "dp-highcard", ch: "M", title: "Establishing with high cards",
      teach: "When you hold a run of honours missing the top one \u2014 K-Q-J against the ace, or Q-J-10 against the ace and king \u2014 lead the suit to force out the defenders' guard. Once their high card is gone your honours are promoted into winners.",
      drill: { kind: "concept", concept: "forceplay" } },
    { id: "dp-length", ch: "M", title: "Establishing by length",
      teach: "Extra winners hide in a long suit. After the defenders' cards in the suit are exhausted, your remaining low cards win by default. A four-card suit usually needs a friendly 3-3 break; a five-card suit is far more reliable. Length is the quiet engine of many notrump contracts.",
      drill: null },
    { id: "dp-finesse", ch: "M", title: "The finesse",
      teach: "A finesse tries to win a trick with a card that isn't the highest, by leading toward a tenace such as A-Q and hoping the missing king lies favourably. It is roughly an even-money chance and it comes up on almost every hand \u2014 the workhorse way to manufacture a trick from cards that surround a defender's honour.",
      drill: { kind: "concept", concept: "finesseplay" } },
    { id: "dp-ruff", ch: "M", title: "Establishing by ruffing",
      teach: "In a suit contract you can turn losers into winners by trumping them. The extra tricks come from ruffing in the SHORT trump hand \u2014 usually dummy \u2014 not the long one, because ruffing in the long hand only spends trumps you were going to make anyway.",
      drill: null },
    { id: "dp-method", ch: "M", title: "Which establishment method?",
      teach: "Given a suit, name the tool: force out a high card (high cards), run the suit once it breaks (length), lead toward a tenace (finesse), or trump losers in the short hand (ruffing). Matching the method to the holding is the heart of the plan's 'increase tricks' step.",
      drill: { kind: "concept", concept: "establishmethod" } },
    { id: "dp-worry", ch: "M", title: "Worrying about the defence",
      teach: "In notrump, count your stoppers \u2014 you need a way to halt the defenders' long suit before they cash it, and a hold-up can buy time. In a suit contract, count your losers instead and plan to ruff or discard them before you lose control. Building tricks is pointless if the defence cashes enough first.",
      drill: null },
    { id: "dp-execute", ch: "M", title: "Executing the plan",
      teach: "Order matters. Keep entries to both hands, unblock high cards from the short holding, and develop your long suits while you still have the transportation to reach them. Many contracts fail not for lack of tricks but because declarer got stranded in the wrong hand.",
      drill: null },
  ]},
];

/* Chapter -> lesson-count coverage, for a progress/provenance view. */
const BOOK_MAP = CURRICULUM.reduce((m, mod) => {
  for (const l of mod.lessons) {
    const k = String(l.ch);
    (m[k] = m[k] || []).push(l.id);
  }
  return m;
}, {});

/* Every lesson flagged auto-drillable, for the generator to enumerate. */
const DRILLABLE = CURRICULUM.flatMap((mod) =>
  mod.lessons.filter((l) => l.drill).map((l) => ({ id: l.id, pos: l.drill.pos, note: l.drill.note }))
);

/* ===== inlined generator.js ===== */
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

/* ============================================================================
   DECLARER-PLAY TECHNIQUE DRILLS  (single-suit double-dummy answer oracle)
   ----------------------------------------------------------------------------
   Inline-ready block for makeGenerator({ENG,AUC,BID,PLY}). Provides:
     - SUIT_SOLVER: an exact single-suit double-dummy solver (the ANSWER ORACLE
       for technique drills, exactly as topTricks() is the oracle for counting).
     - Two curated, solver-VERIFIED banks (finesse, force) whose correct answer
       is what SUIT_SOLVER computes; the Node harness re-derives & asserts them.
     - Two CONCEPT builders (finesseplay, forceplay) that render through the
       existing concept + DeclarerDummy UI path with ZERO UI changes.
   Model (standard suit-combination convention, matches the Official Encyclopedia):
   one suit in isolation; declarer has entries to both hands, chooses the leader
   every trick and always regains the lead; both sides double-dummy; NT-style
   (highest card wins). South = the hand that holds the tenace/sequence; North =
   dummy. This is the same idealisation textbooks use to state suit-combo results.
   ========================================================================== */
function installDeclPlay({ ENG }) {
  const RV = ENG.RANKVAL;                                   // ten is "10", NOT "T"
  const ALLR = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"];
  const vv = (r) => RV[r];
  const desc = (a) => a.slice().sort((x,y) => vv(y)-vv(x));
  const asc  = (a) => a.slice().sort((x,y) => vv(x)-vv(y));
  const lo   = (a) => asc(a)[0];

  // ---------- exact double-dummy for one FIXED layout (memoized) ----------
  const _memo = new Map();
  const key = (S,N,W,E) => S.join("")+"|"+N.join("")+"|"+W.join("")+"|"+E.join("");
  function ddLayout(S,N,W,E){
    if(!S.length && !N.length) return 0;
    const k = key(S,N,W,E); const h=_memo.get(k); if(h!==undefined) return h;
    let best=-1;
    const leaders=[]; if(S.length) leaders.push("S"); if(N.length) leaders.push("N");
    for(const L of leaders){ const hand=(L==="S"?S:N);
      for(const c of hand){ const v=playFixed(L,c,S,N,W,E); if(v>best) best=v; } }
    _memo.set(k,best); return best;
  }
  // one trick from a fixed layout with a chosen (leader,card); defenders minimax, declarer max.
  function playFixed(L,card,S,N,W,E){
    const order = L==="N" ? ["N","E","S","W"] : ["S","W","N","E"];
    const H={S,N,W,E}; const def2=order[1], d3=order[2], def4=order[3];
    const opts2 = H[def2].length? H[def2] : [null];
    let b2=Infinity;
    for(const c2 of opts2){
      const opts3 = H[d3].length? H[d3] : [null];
      let b3=-Infinity;
      for(const c3 of opts3){
        const opts4 = H[def4].length? H[def4] : [null];
        let b4=Infinity;
        for(const c4 of opts4){
          const played={[L]:card,[def2]:c2,[d3]:c3,[def4]:c4};
          let w=null,bv=-1; for(const s of order){ const c=played[s]; if(c==null) continue; if(vv(c)>bv){bv=vv(c);w=s;} }
          const won=(w==="S"||w==="N")?1:0;
          const nS=S.slice(),nN=N.slice(),nW=W.slice(),nE=E.slice(),R={S:nS,N:nN,W:nW,E:nE};
          const drop=(s,c)=>{ if(c!=null){ const i=R[s].indexOf(c); if(i>=0) R[s].splice(i,1); } };
          drop(L,card); drop(def2,c2); drop(d3,c3); drop(def4,c4);
          const val=won+ddLayout(nS,nN,nW,nE);
          if(val<b4) b4=val;
        }
        if(b4>b3) b3=b4;
      }
      if(b3<b2) b2=b3;
    }
    return b2;
  }
  // ---------- a-priori split weights over the missing cards ----------
  function comb(n,k){ if(k<0||k>n) return 0; k=Math.min(k,n-k); let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return Math.round(r); }
  function partitions(missing){
    const m=missing.length, out=[];
    for(let mask=0; mask<(1<<m); mask++){
      const W=[],Ee=[]; for(let i=0;i<m;i++){ (mask&(1<<i))? W.push(missing[i]) : Ee.push(missing[i]); }
      out.push({ W:desc(W), E:desc(Ee), w:comb(26-m, 13-W.length) });   // a-priori vacant-space weight
    }
    return out;
  }
  // ---------- non-clairvoyant first action, exact continuation ----------
  // third-hand rule captures real technique on round 1: "cheapest-win" = partner plays the
  // lowest card that beats the current high (the finesse / rise-with-honour), else lowest.
  function thirdCard(rule, hand, curHigh){
    if(!hand.length) return null; const a=asc(hand);
    if(rule==="low") return a[0];
    const wins=a.filter(c=>vv(c)>curHigh); return wins.length? wins[0] : a[0];
  }
  function actionEV(S,N,action){
    S=desc(S); N=desc(N);
    const held=new Set([...S,...N]); const missing=ALLR.filter(r=>!held.has(r));
    const parts=partitions(missing); let num=0, den=0;
    for(const p of parts){ num += p.w*firstThenDD(S,N,p.W.slice(),p.E.slice(),action); den += p.w; }
    return { ev:num/den };
  }
  function firstThenDD(S,N,W,E,action){
    const L=action.from, card=action.card;
    const order = L==="N" ? ["N","E","S","W"] : ["S","W","N","E"];
    const H={S:S.slice(),N:N.slice(),W:W.slice(),E:E.slice()};
    const def2=order[1], d3=order[2], def4=order[3];
    const opts2 = H[def2].length? H[def2] : [null];
    let b2=Infinity;
    for(const c2 of opts2){
      const curHigh=Math.max(vv(card), c2==null?-1:vv(c2));
      const c3=thirdCard(action.third, H[d3], curHigh);
      const opts4 = H[def4].length? H[def4] : [null];
      let b4=Infinity;
      for(const c4 of opts4){
        const played={[L]:card,[def2]:c2,[d3]:c3,[def4]:c4};
        let w=null,bv=-1; for(const s of order){ const c=played[s]; if(c==null) continue; if(vv(c)>bv){bv=vv(c);w=s;} }
        const won=(w==="S"||w==="N")?1:0;
        const nS=S.slice(),nN=N.slice(),nW=W.slice(),nE=E.slice(),R={S:nS,N:nN,W:nW,E:nE};
        const drop=(s,c)=>{ if(c!=null){ const i=R[s].indexOf(c); if(i>=0) R[s].splice(i,1);} };
        drop(L,card); drop(def2,c2); drop(d3,c3); drop(def4,c4);
        const val=won+ddLayout(nS,nN,nW,nE);
        if(val<b4) b4=val;
      }
      if(b4<b2) b2=b4;
    }
    return b2;
  }
  // Rank the standard first-actions for a South-tenace / North-dummy layout.
  function rankActions(S,N){
    S=desc(S); N=desc(N); const acts=[];
    if(N.length) acts.push({ id:"finN", from:"N", card:lo(N), third:"cheapest-win" }); // lead low from dummy (the finesse)
    if(S.length) acts.push({ id:"finS", from:"S", card:lo(S), third:"cheapest-win" });
    if(S.length) acts.push({ id:"cashS",from:"S", card:desc(S)[0], third:"low" });      // cash top from hand
    if(N.length) acts.push({ id:"cashN",from:"N", card:desc(N)[0], third:"low" });
    return acts.map(a=>({ ...a, ev:actionEV(S,N,a).ev })).sort((x,y)=>y.ev-x.ev);
  }
  const SUIT_SOLVER = { ddLayout, actionEV, rankActions, partitions };

  // ---------- solver-VERIFIED curated banks (ranks; South holds the honours) ----------
  // Every finesse entry: SUIT_SOLVER's best action is "lead low from dummy" (finN) and it
  // beats the best cash line by >= FIN_MARGIN. Every force entry: a solid sequence whose only
  // line is to drive out the missing top honour(s). The harness asserts all of this.
  const FIN_MARGIN = 0.30;
  const FINESSE_BANK = [
    { S:["A","Q"],            N:["6","4","3"] },
    { S:["A","Q"],            N:["8","6","4","3"] },
    { S:["K","J"],            N:["7","4","2"] },
    { S:["A","J","10"],       N:["5","4","3"] },
    { S:["A","J","10"],       N:["6","2"] },
    { S:["A","J","10","9"],   N:["6","4","2"] },
    { S:["A","Q","J"],        N:["6","5","4"] },
  ];
  const FORCE_BANK = [
    { S:["K","Q","J"],        N:["4","3","2"] },
    { S:["K","Q","J","10"],   N:["4","3","2"] },
    { S:["Q","J","10"],       N:["5","4","3"] },
    { S:["Q","J","10","9"],   N:["4","3","2"] },
    { S:["Q","J","10","9"],   N:["6","5"] },
  ];

  // ---------- render helpers ----------
  const GLY = { S:"\u2660", H:"\u2665", D:"\u2666", C:"\u2663" };
  const shuffle = (a) => ENG.shuffle(a);
  // build real card objects for ONE suit from a fresh deck (valid unique ids, ten = "10")
  function suitCards(ranks, suit){
    const deck = ENG.makeDeck();
    return ranks.map(r => deck.find(c => c.suit===suit && c.rank===r));
  }
  const honourList = (ranks) => ranks.filter(r => vv(r) >= 11);          // J,Q,K,A
  const joinHonours = (rs) => rs.join("\u2011");                        // non-breaking hyphen: A-Q
  const andList = (rs, g) => rs.length===1 ? rs[0]+g : rs.slice(0,-1).map(r=>r+g).join(", ")+" and "+rs[rs.length-1]+g;

  const SUITWORD = { S:"spades", H:"hearts", D:"diamonds", C:"clubs" };
  const seqName = (ranks) => desc(ranks).join("\u2011");   // full holding, e.g. A-Q-J, Q-J-10
  function pickSuit(){ return shuffle(["S","H","D","C"])[0]; }

  function buildFinesse(entry){
    const suit = pickSuit(), g = GLY[suit];
    const declHand = suitCards(entry.S, suit);
    const dummyHand = suitCards(entry.N, suit);
    const ten = honourList(entry.S);
    const held = new Set([...entry.S, ...entry.N]);
    const missHon = ALLR.filter(r => vv(r)>=11 && vv(r)>vv(ten[ten.length-1]) && !held.has(r)); // honours above the tenace, out
    const lowDummy = lo(entry.N);
    const top = desc(entry.S)[0];
    const correct = `Lead low from dummy (${lowDummy}${g}) toward your hand and finesse`;
    const dCash   = `Cash your ${top}${g} from hand`;
    const dWrong  = `Lead low from your hand toward dummy`;
    const sit = missHon.length>1 ? "sit" : "sits";
    const why =
      `You hold the ${seqName(entry.S)} tenace in ${SUITWORD[suit]} opposite low cards. `+
      `Lead low from dummy toward your hand: the defender on your right must commit before your honour, so if the missing `+
      `${missHon.length?andList(missHon,g):"honour"} ${sit} in front of the tenace you score a trick you could never take by force \u2014 a finesse. `+
      `Cashing a top honour, or leading from the strong hand, throws that extra trick away.`;
    return {
      declHand, dummyHand, contractLabel: null,
      scenario: `One suit in isolation (you have free entries to both hands). Focus only on ${GLY[suit]}.`,
      prompt: "What is your best play to maximise tricks in this suit?",
      answerLabel: correct,
      why,
      choices: shuffle([
        { label: correct, correct: true },
        { label: dCash,   correct: false },
        { label: dWrong,  correct: false },
      ]),
    };
  }

  function buildForce(entry){
    const suit = pickSuit(), g = GLY[suit];
    const declHand = suitCards(entry.S, suit);
    const dummyHand = suitCards(entry.N, suit);
    const top = desc(entry.S)[0];
    const held = new Set([...entry.S, ...entry.N]);
    const missTop = ALLR.filter(r => vv(r) > vv(top) && !held.has(r));   // top honours to drive out
    const count = ddLayout(desc(entry.S), desc(entry.N),
                           desc(ALLR.filter(r=>!held.has(r))), []);       // established count (all out cards onside is irrelevant for a pure sequence)
    const dropVb  = missTop.length>1 ? "drop" : "drops";
    const correct = `Lead the ${top}${g} to force out the ${andList(missTop,g)}`;
    const dFin    = `Lead low toward the ${top}${g} and finesse`;
    const dHope   = `Cash from the top and hope the ${andList(missTop,g)} ${dropVb}`;
    const why =
      `Your ${seqName(entry.S)} is a solid sequence in ${SUITWORD[suit]} missing only the ${andList(missTop,g)}. `+
      `There is no tenace to finesse and the ${missTop.length>1?"honours":"honour"} won't fall to cashing, so lead the sequence and knock ${missTop.length>1?"them":"it"} out. `+
      `Once ${missTop.length>1?"they are":"it is"} gone your remaining cards are all high \u2014 ${count} trick${count===1?"":"s"}.`;
    return {
      declHand, dummyHand, contractLabel: null,
      scenario: `One suit in isolation (you have free entries to both hands). Focus only on ${g}.`,
      prompt: "How do you develop the tricks you need in this suit?",
      answerLabel: correct,
      why,
      choices: shuffle([
        { label: correct, correct: true },
        { label: dFin,    correct: false },
        { label: dHope,   correct: false },
      ]),
    };
  }

  // CONCEPT builders keyed by concept name (spread into generateConcept's return)
  const CONCEPT_EXTRA = {
    finesseplay: () => buildFinesse(shuffle(FINESSE_BANK.slice())[0]),
    forceplay:   () => buildForce(shuffle(FORCE_BANK.slice())[0]),
  };

  return { SUIT_SOLVER, FINESSE_BANK, FORCE_BANK, buildFinesse, buildForce, CONCEPT_EXTRA, FIN_MARGIN };
}

function makeGenerator({ ENG, AUC, BID, PLY }) {
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
    // partner opened 1NT, RHO overcalled a suit, South's first response (systems off).
    "resp-1nt-interf": { dealer: PARTNER, reach: (p) =>
        p.opener === PARTNER && p.partnerFirstBid &&
        p.partnerFirstBid.level === 1 && p.partnerFirstBid.strain === "NT" &&
        p.southBidCount === 0 && p.rhoLastBid && p.rhoLastBid.strain !== "NT" },
    // partner opened one-of-a-suit, South responded a 1-level suit, opener rebid, South's
    // 2nd bid — the spot for a responder reverse (higher second suit, game-forcing).
    "resp-reverse": { dealer: PARTNER, reach: (p) =>
        p.opener === PARTNER && p.partnerFirstBid &&
        p.partnerFirstBid.level === 1 && p.partnerFirstBid.strain !== "NT" &&
        p.southFirstBid && p.southFirstBid.level === 1 && p.southFirstBid.strain !== "NT" &&
        p.southBidCount === 1 && p.partnerBidCount >= 2 },
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
    "fsf-opener": { clean: true, answerOk: (a) => a.k === "B" },
    // over 1NT interference the teachable answer is the cuebid of the opponents' suit
    "r-ntinterf": { answerOk: (a, ev, p) => a.k === "B" && p.rhoLastBid && a.strain === p.rhoLastBid.strain },
    // responder reverse: partner opened a minor (so majors are unbid); answer is a 2-level
    // bid of a suit ranking higher than South's first response
    "rv-responder": { also: (p) => isMinor(p.partnerFirstBid.strain),
        answerOk: (a, ev, p) => { const RK = { C:0, D:1, H:2, S:3 };
          return a.k === "B" && a.level === 2 && a.strain !== "NT" &&
                 p.southFirstBid && RK[a.strain] > RK[p.southFirstBid.strain]; } } };

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
    // responding to partner's balance: a genuine "act or discount" decision needs some values
    "b-resp": (e) => e.hcp >= 5 && e.hcp <= 15,
    // 1NT-interference drill: a game-forcing hand with a 4-card major (no 5-card major) cuebids
    "r-ntinterf": (e) => e.hcp >= 10 && (e.len.H === 4 || e.len.S === 4) && e.len.H < 5 && e.len.S < 5,
    // responder reverse: a game-forcing 4-4 majors hand responds up the line, then reverses
    "rv-responder": (e) => e.hcp >= 12 && e.hcp <= 15 && e.len.H >= 4 && e.len.S >= 4,
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
    // Reference bid-value for proximity scoring. When the answer is a bid, anchor on it.
    // When the answer is Pass/Double/Redouble there is no bid to anchor on, so anchor on
    // the cheapest realistic action (one step above the last bid) — otherwise every bid
    // scores flat and absurd overbids (7D vs a passed-out auction) slip in as distractors.
    const lastV = AUC.bidVal(AUC.auctionInfo(calls, dealer).lastBid || { k: "B", level: 0, strain: "C" });
    const av = answer.k === "B" ? AUC.bidVal(answer) : lastV + 5; // +5 ≈ one level up
    const scored = legal
      .filter((c) => key(c) !== answerKey)
      .map((c) => {
        let s = 0;
        if (c.k === "P") s = 2;
        else if (c.k === "D" || c.k === "R") s = 6;
        else {
          const d = Math.abs(AUC.bidVal(c) - av);
          s = d <= 5 ? 1 : d <= 10 ? 3 : 8; // within a level / two levels of the anchor
          if (answer.k === "B" && c.strain === answer.strain) s -= 1;
          if (answer.k !== "B") s += 1; // slightly favour Pass/Dbl themselves as distractors
        }
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
    return ENG.shuffle(Array.from(set)).slice(0, 5);   // shuffled — don't sort (that centers the answer)
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
        choices: ENG.shuffle([{ label: "Open", correct: open }, { label: "Pass", correct: !open }]),
      };
    },
    shape: (ev) => {
      const ans = shapeClass(ev);
      return {
        prompt: "Classify this hand's shape.",
        answerLabel: ans,
        why: `Distribution ${ev.shape.join("-")} \u2014 ${ans.toLowerCase()}.`,
        choices: ENG.shuffle(["Balanced", "One-suiter", "Two-suiter", "Three-suiter"]).map((l) => ({ label: l, correct: l === ans })),
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
        choices: ENG.shuffle(Array.from(opts)).slice(0, 5).map((n) => ({ label: fmt(n), correct: n === qt })),
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

  // ---- D2: declarer-play COUNT drills (deterministic; answer computed, not from a heuristic
  // play engine). PLY plays declarer only mechanically, so a "correct card" can't be read off
  // it — but "top tricks" is a pure function of the two hands. Verified against Bernard Magee's
  // six worked examples + invariants (sum == total, per-suit <= longer holding). ----
  const TT_ORDER = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
  // Sure winners in ONE suit given each hand's ranks: the unbroken run of top cards you hold,
  // capped by your longer holding; if that run drops every outstanding card, the whole longer
  // holding runs (the "AJ543 opposite KQ92 = 5" case).
  function topTricksSuit(declRanks, dummyRanks) {
    const held = new Set([...declRanks, ...dummyRanks]);
    const lenD = declRanks.length, lenN = dummyRanks.length;
    const longer = Math.max(lenD, lenN);
    if (longer === 0) return 0;
    const oppCount = 13 - (lenD + lenN);
    let solid = 0;
    for (const r of TT_ORDER) { if (held.has(r)) solid++; else break; }
    if (oppCount <= solid) return longer;   // your run exhausts the defenders -> long cards cash
    return Math.min(solid, longer);
  }
  function topTricks(decl, dummy) {
    const bySuit = (h) => { const b = { S: [], H: [], D: [], C: [] }; for (const c of h) b[c.suit].push(c.rank); return b; };
    const d = bySuit(decl), n = bySuit(dummy);
    let t = 0; const per = {};
    for (const s of ["S", "H", "D", "C"]) { per[s] = topTricksSuit(d[s], n[s]); t += per[s]; }
    return { total: t, per };
  }
  // Deal a realistic declarer+dummy pair (partners, so no overlap) for a counting drill:
  // no freak-long combined suit, a sensible combined count, and a teachable top-trick band.
  function dealDeclDummy() {
    for (let t = 0; t < 5000; t++) {
      const h = deal();
      const decl = h[0], dummy = h[2];
      const cl = { S: 0, H: 0, D: 0, C: 0 };
      for (const c of [...decl, ...dummy]) cl[c.suit]++;
      if (["S", "H", "D", "C"].some((s) => cl[s] > 7)) continue;   // no absurd combined length
      const tt = topTricks(decl, dummy);
      if (tt.total < 3 || tt.total > 12) continue;                 // keep it in a teachable band
      const hcp = BID.evalHand(decl).hcp + BID.evalHand(dummy).hcp;
      if (hcp < 20) continue;                                      // looks like a real contract
      return { decl, dummy, tt, hcp };
    }
    return null;
  }
  function generateDeclCount(lesson) {
    const D = dealDeclDummy();
    if (!D) return { ok: false, reason: "no suitable declarer/dummy deal" };
    const { decl, dummy, tt } = D;
    const breakdown = ["S", "H", "D", "C"].filter((s) => tt.per[s])
      .map((s) => `${tt.per[s]} in ${suitWord(s)}`).join(", ") || "none";
    if (lesson.drill.q === "needtricks") {
      const need = Math.max(0, 9 - tt.total);
      return {
        ok: true, kind: "declcount", lesson: lesson.id, declHand: decl, dummyHand: dummy, contractLabel: "3NT",
        prompt: "You are declarer in 3NT. How many more tricks must you develop?",
        answerLabel: String(need),
        why: `3NT needs nine tricks and you have ${tt.total} on top (${breakdown}), so establishment must find ${need} more${need ? " \u2014 through high cards, length, or a finesse" : ", meaning the contract is already there"}.`,
        choices: numericChoices(need, 2).map((n) => ({ label: String(n), correct: n === need })),
      };
    }
    // default: raw top-trick count
    const ans = tt.total;
    return {
      ok: true, kind: "declcount", lesson: lesson.id, declHand: decl, dummyHand: dummy,
      prompt: "How many top tricks (sure winners) do the two hands hold?",
      answerLabel: String(ans),
      why: `Counting sure winners suit by suit \u2014 ${breakdown} \u2014 gives ${ans} top trick${ans === 1 ? "" : "s"} you can cash without losing the lead.`,
      choices: numericChoices(ans).map((n) => ({ label: String(n), correct: n === ans })),
    };
  }

  // ---- E: concept / judgment drills (rule-keyed multiple choice) ----
  // These lessons have no single "bot bid" as an answer, so instead of forcing an auction
  // drill the answer key is an explicit, inspectable rule. Some are LIVE (built on a real
  // bot auction, e.g. takeout-vs-penalty); others draw from a small curated bank of standard
  // doctrine (paraphrased, original wording). Choices carry {label, correct}, exactly like
  // the eval kind, so the UI renders them the same way.
  const GLY = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663", NT: "NT" };
  const shuffleChoices = (opts, correctLabel) =>
    ENG.shuffle(opts.map((label) => ({ label, correct: label === correctLabel })));

  // Per SAYC: a double of a partscore is takeout; a double of game-or-higher (or their
  // freely-bid 3NT) is penalty. This is the crisp rule the d-penalty lesson teaches.
  function doubleIsTakeout(lastBid) {
    if (!lastBid || lastBid.k !== "B") return null;
    if (lastBid.strain === "NT") return lastBid.level < 3;   // 3NT+ = penalty
    const gameLevel = isMajor(lastBid.strain) ? 4 : (isMinor(lastBid.strain) ? 5 : 4);
    return lastBid.level < gameLevel;                         // below game = takeout
  }

  const CONCEPT = {
    // d-penalty — CONSTRUCTED, balanced 50/50: the opponents settle in a partscore (double
    // = takeout) or reach game / 3NT (double = penalty). The answer is keyed by the same
    // doubleIsTakeout rule so there is a single source of truth. South is always on turn
    // facing the opponents' final bid.
    "penalty": () => {
      const wantPenalty = Math.random() < 0.5;
      const openSuit = ENG.shuffle(["S", "H", "D", "C"])[0];
      let lastBid;
      if (wantPenalty) {
        const useNT = Math.random() < 0.35;
        lastBid = useNT ? { k: "B", level: 3, strain: "NT" }
                        : { k: "B", level: isMajor(openSuit) ? 4 : 5, strain: openSuit };
      } else {
        lastBid = { k: "B", level: (Math.random() < 0.4 ? 3 : 2), strain: openSuit }; // partscore raise
      }
      const calls = [{ k: "B", level: 1, strain: openSuit, by: LHO }, { k: "P", by: PARTNER }, { ...lastBid, by: RHO }];
      const takeout = doubleIsTakeout(lastBid);
      const ans = takeout ? "Takeout" : "Penalty";
      const ct = lastBid.level + GLY[lastBid.strain];
      return {
        calls, dealer: LHO,
        prompt: `The opponents have reached ${ct}. If you double now, is it takeout or penalty?`,
        answerLabel: ans,
        why: takeout
          ? `${ct} is a partscore, so a double here is takeout \u2014 it asks partner to pick a suit, showing values and support for the unbid suits.`
          : `${ct} is ${lastBid.strain === "NT" ? "their 3NT" : "game"}, so a double here is penalty \u2014 partner can't read it as takeout, so it says you expect to defeat the contract.`,
        choices: shuffleChoices(["Takeout", "Penalty"], ans),
      };
    },

    // c-balancetwo — CONSTRUCTED: is a 2NT bid Unusual (direct) or natural (balancing)?
    "balance2nt": () => {
      const unusual = Math.random() < 0.5;
      const openSuit = ENG.shuffle(["H", "S", "D", "C"])[0];
      const ans = unusual ? "Unusual (two-suiter)" : "Natural (19\u201321 balanced)";
      const calls = unusual
        ? [{ k: "B", level: 1, strain: openSuit, by: RHO }, { k: "B", level: 2, strain: "NT", by: SOUTH }]
        : [{ k: "B", level: 1, strain: openSuit, by: LHO }, { k: "P", by: PARTNER }, { k: "P", by: RHO }, { k: "B", level: 2, strain: "NT", by: SOUTH }];
      return {
        calls, dealer: unusual ? RHO : LHO,
        prompt: "Your 2NT here \u2014 Unusual or natural?",
        answerLabel: ans,
        why: unusual
          ? "A jump to 2NT directly over their opening is Unusual: five or more in the two lowest unbid suits (here, the minors), not a strong balanced hand."
          : "In the passout seat the opening was passed to you, so 2NT is not Unusual \u2014 by common agreement it is natural: a strong balanced hand, about 19\u201321. Confirm the meaning with your partner.",
        choices: shuffleChoices(["Unusual (two-suiter)", "Natural (19\u201321 balanced)"], ans),
      };
    },

    // s-choose — curated: match the slam tool to the doubt.
    "slamtool": () => {
      const BANK = [
        { s: "You and partner have found a big spade fit and slam is in the air. Your only worry is whether you're off two aces.", a: "Blackwood 4NT", why: "A suit fit is set and the doubt is ace count, so Blackwood asks partner directly how many aces they hold \u2014 keeping you out of a slam missing two." },
        { s: "You hold a balanced 18 opposite partner's balanced notrump opening. There's no suit fit; the only question is whether the combined count is enough.", a: "Quantitative 4NT", why: "For a notrump slam decided by points with no suit fit, a raise to 4NT is quantitative \u2014 it invites 6NT, and partner passes minimum or accepts with a maximum." },
        { s: "You have a heart fit and slam values, but a small doubleton in clubs worries you \u2014 not the ace count.", a: "Control bids (cuebidding)", why: "When a specific unguarded side suit is the worry rather than the number of aces, cuebid your controls up the line so partner can tell you whether the danger suit is covered." },
        { s: "You've agreed diamonds with slam interest and you're happy about side-suit controls, but you must check you aren't off two aces.", a: "Blackwood 4NT", why: "The trump fit is set and the only doubt is aces, so Blackwood is the right tool." },
        { s: "You have a spade fit and worry specifically that both minors might be wide open \u2014 the ace count isn't the issue.", a: "Control bids (cuebidding)", why: "The worry is unguarded suits, not ace count, so cuebid controls to locate where your side is protected before committing to slam." },
        { s: "Partner opened 1NT and you have a flat 16. You want slam only if partner is at the very top of the range.", a: "Quantitative 4NT", why: "A direct 4NT over a natural notrump is quantitative: it decides a notrump slam by points, inviting 6NT." },
      ];
      const item = ENG.shuffle(BANK.slice())[0];
      return {
        scenario: item.s, prompt: "Which slam tool fits the doubt?",
        answerLabel: item.a, why: item.why,
        choices: shuffleChoices(["Blackwood 4NT", "Quantitative 4NT", "Control bids (cuebidding)"], item.a),
      };
    },

    // d-strategy — curated: pick the defensive plan before the lead.
    "defplan": () => {
      const BANK = [
        { s: "Dummy came down with a long, strong side suit (K\u2011Q\u2011J\u2011x\u2011x) and an outside entry. Declarer can soon pitch losers on it.", a: "Active", why: "When dummy has a ready source of discards, defend actively \u2014 cash or set up your winners fast, before declarer throws losers away on the long suit." },
        { s: "It's a flat notrump contract, no long suit in sight, and every lead from your hand risks handing declarer a trick.", a: "Passive", why: "With no source of tricks for declarer and nothing safe to attack, defend passively \u2014 give nothing away and make declarer do the work." },
        { s: "You hold four trumps to the jack plus a long side suit, and declarer is in a suit game.", a: "Forcing", why: "Lead your long suit to make declarer ruff; shortening declarer's trumps below yours wins trump control \u2014 the forcing defence." },
        { s: "Dummy will come down short in a side suit with small trumps, poised to ruff declarer's losers.", a: "Attack trumps", why: "When dummy's value is ruffing, lead trumps to strip them before declarer can use them, killing the ruffs." },
        { s: "Declarer is in four of a major; dummy has a singleton in your long suit and three small trumps.", a: "Attack trumps", why: "Dummy will ruff your suit, so lead trumps to draw dummy's trumps and stop the ruffs." },
        { s: "You're defending 3NT with a balanced hand and no long suit to run; any new suit you broach could cost a tempo or a trick.", a: "Passive", why: "Nothing to establish and every switch is risky \u2014 stay passive and let declarer break the suits open." },
      ];
      const item = ENG.shuffle(BANK.slice())[0];
      return {
        scenario: item.s, prompt: "Which defensive plan?",
        answerLabel: item.a, why: item.why,
        choices: shuffleChoices(["Active", "Passive", "Forcing", "Attack trumps"], item.a),
      };
    },

    // s-control — curated: the up-the-line cuebidding mechanic (cheapest first-round control).
    "controlseq": () => {
      const BANK = [
        { s: "Spades are agreed and slam is live. You hold the \u2663A and the \u2665A, nothing in diamonds. Which control do you show first?",
          a: "4\u2663", opts: ["4\u2663", "4\u2666", "4\u2665", "4NT"],
          why: "Cuebid your cheapest first-round control up the line. Holding the club and heart aces, clubs is cheaper, so 4\u2663 comes first \u2014 the heart ace can wait for the next round." },
        { s: "Spades are agreed with slam interest. You hold the \u2666A but no first-round club control. What's your cuebid?",
          a: "4\u2666", opts: ["4\u2663", "4\u2666", "4\u2665", "4NT"],
          why: "You cue only controls you actually hold. Bypassing 4\u2663 to bid 4\u2666 shows the diamond control and denies a first-round club control \u2014 the skip itself carries information." },
        { s: "Spades are agreed and slam beckons. Your only first-round side control is the \u2665A \u2014 no control in clubs or diamonds. What do you cue?",
          a: "4\u2665", opts: ["4\u2663", "4\u2666", "4\u2665", "4NT"],
          why: "Cue the cheapest control you hold. With nothing in clubs or diamonds, you skip straight to 4\u2665 \u2014 partner reads the bypass as denying first-round club and diamond controls." },
        { s: "Spades are agreed, slam values. You are void in clubs and hold the \u2665A. Cheapest first-round control?",
          a: "4\u2663", opts: ["4\u2663", "4\u2665", "4NT", "4\u2660"],
          why: "A void is a first-round control, exactly like an ace. Clubs is cheapest, so 4\u2663 shows the club void up the line before you reveal the heart ace." },
        { s: "Hearts are agreed with slam interest. You hold the \u2666A but no first-round club control. Your cuebid?",
          a: "4\u2666", opts: ["4\u2663", "4\u2666", "4\u2660", "4NT"],
          why: "Up the line below game in hearts, clubs is cheapest \u2014 but with no club control you bid 4\u2666, showing the diamond control and denying the club one. (4\u2660 would be past game and isn't a cue.)" },
        { s: "Spades are agreed, slam values. Your clubs are headed by the \u2663K (second-round control) and you hold the \u2665A (first-round). What do you cue first?",
          a: "4\u2665", opts: ["4\u2663", "4\u2665", "4NT", "4\u2660"],
          why: "First-round controls \u2014 aces and voids \u2014 come first; the club king is only a second-round control, so don't cue 4\u2663. Bid 4\u2665 to show the heart ace; the club king can come on a later round." },
      ];
      const item = ENG.shuffle(BANK.slice())[0];
      return {
        scenario: item.s, prompt: "Which control do you bid first?",
        answerLabel: item.a, why: item.why,
        choices: shuffleChoices(item.opts, item.a),
      };
    },

    // dp-method — curated: name the establishment method for a single suit (declarer play).
    "establishmethod": () => {
      const BANK = [
        { s: "You hold \u2665K Q J 10 opposite \u2665 8 7 6.", a: "High cards",
          why: "You hold a solid sequence but not the ace. Lead the suit to knock out the defenders' ace, promoting your K-Q-J into winners \u2014 establishment by high cards." },
        { s: "You hold \u2663Q J 10 9 opposite \u2663 4 3 2.", a: "High cards",
          why: "Force out the ace and king; once those are gone your Q-J-10 are winners. Driving out the defenders' high cards is establishment by high cards." },
        { s: "You hold \u2660A K 7 6 5 opposite \u2660 9 4 3 2 \u2014 nothing missing at the top.", a: "Length",
          why: "You already hold the top cards; the extra trick comes from the fifth card once the defenders' spades are gone. If the suit splits 3-2 your last card wins \u2014 establishment by length." },
        { s: "You hold \u2666A K Q 6 5 opposite \u2666 7 3.", a: "Length",
          why: "The top honours are already tricks; the chance for MORE comes from the long 6 and 5 after the outstanding diamonds fall. A 3-3 break sets up an extra winner \u2014 establishment by length." },
        { s: "You hold \u2666A Q opposite \u2666 4 3.", a: "Finesse",
          why: "Lead low toward the A-Q and, if the king lies with your left-hand opponent, play the queen to win a trick you don't own outright \u2014 a finesse." },
        { s: "You hold \u2660A Q J 10 opposite \u2660 3 2.", a: "Finesse",
          why: "With a tenace missing the king, lead toward the A-Q-J-10 and finesse; each successful finesse wins a trick around the defender's king \u2014 establishment by finessing." },
        { s: "Hearts are trumps. You hold \u2666A 4 opposite a diamond void in dummy, and dummy has small trumps.", a: "Ruffing",
          why: "Cash the ace, then ruff your low diamond in the short (dummy) hand. Trumping losers in the hand with fewer trumps turns them into tricks \u2014 establishment by ruffing." },
        { s: "Spades are trumps. You hold \u2663 6 5 4 3 opposite a singleton \u2663 2 in dummy.", a: "Ruffing",
          why: "Give up a club or two, then ruff your remaining low clubs in dummy. The short trump hand ruffing your losers is establishment by ruffing." },
      ];
      const item = ENG.shuffle(BANK.slice())[0];
      return {
        scenario: item.s, prompt: "How do you develop extra tricks in this suit?",
        answerLabel: item.a, why: item.why,
        choices: shuffleChoices(["High cards", "Length", "Finesse", "Ruffing"], item.a),
      };
    },
  };
  // ---- declarer-play technique drills: single-suit double-dummy oracle ----
  const DECLPLAY = installDeclPlay({ ENG });
  CONCEPT.finesseplay = DECLPLAY.CONCEPT_EXTRA.finesseplay;
  CONCEPT.forceplay   = DECLPLAY.CONCEPT_EXTRA.forceplay;
  function generateConcept(lesson) {
    const q = CONCEPT[lesson.drill.concept];
    if (!q) return { ok: false, reason: "unknown concept: " + lesson.drill.concept };
    const built = q();
    if (!built) return { ok: false, reason: "concept did not converge" };
    return { ok: true, kind: "concept", lesson: lesson.id, ...built };
  }

  // ---- C: opening-lead drills (answer from the game's own PLY oracle) ----
  const cardKey = (c) => c.rank + c.suit;
  const RVL = ENG.RANKVAL;
  const LEAD_WHY = {
    LEAD_SEQ: (p) => `Top of a sequence in ${suitWord(p.suit)}: the ${p.top} is a safe lead that can't cost a trick and promotes your lower cards into winners.`,
    LEAD_4TH: (p) => `Fourth-best from your longest suit (${suitWord(p.suit)}): the classic attacking lead to develop length \u2014 and it lets partner use the Rule of 11 to place the missing cards.`,
    LEAD_ACE: (p) => `Against a suit contract you don't underlead an ace \u2014 you might never score it \u2014 so lead the ace of ${suitWord(p.suit)} itself.`,
    LEAD_LOW: (p) => `Lead a low ${suitWord(p.suit)} \u2014 a quiet, constructive choice when you have no sequence or clear suit to attack.`,
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
  // ---- constructed slam-ask RESPONSE drills (guaranteed 100% convergence) ----
  // The only faithfulness requirement is that South's ANSWER come from BID.chooseBid.
  // The bot returns the ace-showing response for ANY legal auction ending in partner's
  // 4NT (Blackwood) / 4C (Gerber), so instead of waiting for the rare event of partner
  // organically reaching the ask (which no finite retry budget can guarantee), we build a
  // clean, textbook fit-then-ask prefix and read South's reply off chooseBid. This yields a
  // tidier auction than a random ramble AND converges every time. Verified 100% correct
  // across all ace counts 0-4. (Gerber needs South to have bid notrump for the bot to read
  // partner's 4C as Gerber, so the skeleton has South respond 1NT.)
  const slamSuitLen = (hand) => { const l = { S: 0, H: 0, D: 0, C: 0 }; for (const c of hand) l[c.suit]++; return l; };
  function slamTrump(hand) {
    const l = slamSuitLen(hand);
    const majors = ["H", "S"].filter((s) => l[s] >= 4).sort((a, b) => l[b] - l[a]);
    if (majors.length) return majors[0];                       // prefer a real major fit
    return ["S", "H", "D", "C"].sort((a, b) => l[b] - l[a])[0]; // else South's longest (always >= 4)
  }
  // ---- constructed lead-directing double drill (guaranteed convergence) ----
  // A lead-directing double shows a good 5+ suit but only modest overall values — the bot makes
  // it only when it would otherwise pass (a strong hand overcalls instead). So we deal a strong
  // suit AND keep dealing until BID.chooseBid actually returns the double, guaranteeing both
  // convergence and bot-faithfulness. The auction: LHO 1NT, partner passes, RHO bids the
  // conventional 2-level call in that suit; South doubles to demand the lead.
  function generateLeadDirect(lesson) {
    const dealer = LHO;
    for (let t = 0; t < 8000; t++) {
      const h = deal()[0];
      const e = BID.evalHand(h);
      const cand = ["C", "D", "H"].filter((s) => e.len[s] >= 5 && e.top3(s) >= 2);
      if (!cand.length) continue;
      const suit = cand[(Math.random() * cand.length) | 0];
      const calls = [{ k: "B", level: 1, strain: "NT", by: LHO }, { k: "P", by: PARTNER },
                     { k: "B", level: 2, strain: suit, by: RHO }];
      const answer = BID.chooseBid(h, calls, dealer, SOUTH);
      if (answer.k !== "D") continue;   // strong hands overcall instead — keep looking
      return {
        ok: true, lesson: lesson.id, dealer,
        southHand: h, calls, answer, ev: e, choices: buildChoices(answer, calls, dealer),
      };
    }
    return { ok: false, reason: "no lead-directing-double hand found" };
  }

  function generateSlamResponse(lesson, kind) {
    const south = deal()[0];
    const dealer = PARTNER;                                    // partner (North) opens and asks
    let calls, okFn;
    if (kind === "BW") {
      const t = slamTrump(south);
      calls = [{ k: "B", level: 1, strain: t, by: PARTNER }, { k: "P", by: RHO },
               { k: "B", level: 3, strain: t, by: SOUTH },   { k: "P", by: LHO },
               { k: "B", level: 4, strain: "NT", by: PARTNER }, { k: "P", by: RHO }];
      okFn = (a) => a.k === "B" && a.level === 5;              // 5-level ace-show
    } else { // GB (Gerber): South must have bid NT for the bot to read 4C as Gerber
      calls = [{ k: "B", level: 1, strain: "D", by: PARTNER }, { k: "P", by: RHO },
               { k: "B", level: 1, strain: "NT", by: SOUTH },  { k: "P", by: LHO },
               { k: "B", level: 4, strain: "C", by: PARTNER }, { k: "P", by: RHO }];
      okFn = (a) => a.k === "B" && a.level === 4 && ["D", "H", "S", "NT"].includes(a.strain);
    }
    const answer = BID.chooseBid(south, calls, dealer, SOUTH);
    if (!okFn(answer)) return { ok: false, reason: "slam-ask answer was not an ace-show (unexpected)" };
    // Distractors ARE the sibling ace-showing responses, so every wrong answer is a
    // plausible "miscounted your aces" — the exact skill the drill tests. (0 and 4 aces
    // share a response, so there are four distinct rungs for five ace counts.)
    const ladder = (kind === "BW")
      ? [{ k: "B", level: 5, strain: "C" }, { k: "B", level: 5, strain: "D" }, { k: "B", level: 5, strain: "H" }, { k: "B", level: 5, strain: "S" }]
      : [{ k: "B", level: 4, strain: "D" }, { k: "B", level: 4, strain: "H" }, { k: "B", level: 4, strain: "S" }, { k: "B", level: 4, strain: "NT" }];
    return {
      ok: true, lesson: lesson.id, dealer,
      southHand: south, calls: calls.slice(),
      answer, ev: BID.evalHand(south), choices: ENG.shuffle(ladder),
    };
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
    if (lesson.drill && lesson.drill.kind === "declcount") return generateDeclCount(lesson);
    if (lesson.drill && lesson.drill.kind === "concept") return generateConcept(lesson);
    if (lesson.drill && lesson.drill.pos === "lead") return generateLead(lesson);
    if (lesson.drill && lesson.drill.pos === "slam-bwresp") return generateSlamResponse(lesson, "BW");
    if (lesson.drill && lesson.drill.pos === "slam-gbresp") return generateSlamResponse(lesson, "GB");
    if (lesson.drill && lesson.drill.pos === "resp-lead-dbl") return generateLeadDirect(lesson);
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
      if (l.drill.kind === "declcount") { out[l.id] = { generatable: true, reason: "declcount", rate: 1 }; continue; }
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

  return { generate, audit, parse, POS, TARGET, CFG, topTricks, SUIT_SOLVER: DECLPLAY.SUIT_SOLVER };
}


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
    // if I made a Michaels/Unusual/Cappelletti bid, handle my own continuation first
    if(iHaveBid){
      const cc = cappellettiContinue(ev, ctx); if(cc) return cc;
      const mc = twoSuiterContinue(ev, ctx); if(mc) return mc;
    }
    // partner already acted (overcalled/doubled) → I advance
    if(ctx.partnerBids.some(c=>c.k==="B")) return advancerBid(ev, ctx);
    // I already overcalled → competitive continuation (treat my overcall as "opener")
    if(iHaveBid) return openerRebid(ev, ctx);
    // first chance to act over their opening
    const oc = overcallBid(ev, ctx);
    // a lead-directing double replaces a pass only — never a values-showing overcall
    if(oc.k==="P"){ const ldd = leadDirectingDouble(ev, ctx); if(ldd) return ldd; }
    return oc;
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
  
  /* ---- Negative double (responder): partner opened 1-of-a-suit, RHO overcalled
     a suit through 2S, and we hold the unbid major(s) but can't show them cheaply.
     Conservative by design: only fires on textbook shapes, never in an uncontested
     auction (guarded by ctx.rhoLast), so ordinary responses are untouched. ---- */
  function negativeDouble(ev, ctx, op){
    const rho = ctx.rhoLast;
    if(!rho || rho.k!=="B" || rho.strain==="NT") return null;   // RHO must have overcalled a suit
    if(bidVal(rho) > bidVal(B(2,"S"))) return null;              // negative doubles apply through 2S
    if(rho.strain===op.strain) return null;
    const h=ev.hcp, len=ev.len;
    const need = rho.level>=2 ? 8 : 6;                           // more values needed at the 2 level
    if(h<need) return null;
    if(isMajor(op.strain) && len[op.strain]>=3) return null;     // 3+ support → raise partner instead
    const bidSuits = new Set([op.strain, rho.strain]);
    const unbidMajors = ["H","S"].filter(m=> !bidSuits.has(m));
    if(!unbidMajors.length) return null;
    // both majors unbid and held 4+ each → the flagship negative double
    if(unbidMajors.length===2 && len.H>=4 && len.S>=4) return DBL;
    // a single unbid four-card major that cannot be bid at the one level over the overcall
    for(const m of unbidMajors){
      if(len[m]===4){
        const oneAvailable = rho.level===1 && higher(m, rho.strain);
        if(!oneAvailable) return DBL;
      }
    }
    return null;
  }
  function cheapestLevel(strain, ctx){
    const last=ctx.info.lastBid;
    for(let L=1;L<=7;L++){ if(!last || bidVal(B(L,strain))>bidVal(last)) return L; }
    return 7;
  }
  /* ---- Opener answering partner's negative double: bid the promised unbid major,
     jumping with extras; otherwise rebid naturally. ---- */
  function respondToNegDouble(ev, ctx, myOpen){
    const over = ctx.lhoLast;                                    // the overcall (opener's LHO)
    if(!over || over.k!=="B") return null;
    const bidSuits = new Set([myOpen.strain, over.strain]);
    const unbidMajors = ["H","S"].filter(m=> !bidSuits.has(m));
    let pick=null, best=-1;
    for(const m of unbidMajors){ if(ev.len[m]>best){ best=ev.len[m]; pick=m; } }
    const tp=ev.tp;
    if(pick && ev.len[pick]>=3){
      const lvl = cheapestLevel(pick, ctx);
      if(tp>=19) return B(Math.max(4,lvl), pick);                // extras → jump toward game
      if(tp>=16 && lvl===1) return B(2, pick);                   // invitational jump
      return B(lvl, pick);
    }
    if(ev.len[myOpen.strain]>=6) return B(cheapestLevel(myOpen.strain,ctx), myOpen.strain);
    if(ev.balanced && ev.stopper(over.strain)) return B(cheapestLevel("NT",ctx), "NT");
    const second = secondSuit(ev, myOpen.strain, 2);
    if(second) return second;
    return P;
  }

  /* Jordan: over an opponent's takeout double of partner's 1-of-a-major opening,
     2NT shows a limit-raise-or-better (10+ dummy points, 3+ support). Redouble
     shows 10+ with no clear fit. */
  function jordanBid(ev, ctx, op){
    const s=op.strain, h=ev.hcp, rv=raiseValue(ev), len=ev.len;
    if(isMajor(s) && len[s]>=3 && rv>=10) return B(2,"NT");        // Jordan limit-raise+
    if(h>=10 && len[s]<3){
      // SAYC prefers a descriptive bid; redouble only when there isn't one
      const canBidSuitAtOne = ORDER.some(x=> x!==s && len[x]>=4 && higher(x,s));
      const cleanNT = ev.balanced && allStopped(ev,s);
      if(!canBidSuitAtOne && !cleanNT) return RDBL;                // 10+, nothing better to say
    }
    return null;
  }

  /* ---------------- RESPONDING TO PARTNER'S OPENING ---------------- */
  function responderBid(ev, ctx){
    const op = ctx.partnerBids.find(c=>c.k==="B"); // partner's first bid = the opening
    // if I've already responded once, this is my rebid → use the continuation driver
    if(ctx.myBids.some(c=>c.k==="B")) return responderContinue(ev, ctx, op);
    // negative double: partner opened 1-of-a-suit and RHO overcalled a suit
    if(op.level===1 && op.strain!=="NT" && ctx.rhoLast){
      const nd = negativeDouble(ev, ctx, op);
      if(nd) return nd;
    }
    // Jordan 2NT / redouble: partner opened 1-of-a-suit and RHO made a takeout double
    if(op.level===1 && op.strain!=="NT"){
      const rhoLastCall = ctx.rhoBids[ctx.rhoBids.length-1];
      if(rhoLastCall && rhoLastCall.k==="D"){
        const jr = jordanBid(ev, ctx, op);
        if(jr) return jr;
      }
    }
    // route by opening type
    if(op.strain==="NT"){
      if(op.level===1){
        // partner's 1NT OPENING with a suit overcall by RHO → systems off (cuebid = Stayman)
        const rl = ctx.rhoLast;
        if(rl && rl.k==="B" && rl.strain!=="NT" && ctx.openerSeat===ctx.partner)
          return respTo1NTInterf(ev, ctx, rl);
        return respTo1NT(ev, ctx);
      }
      if(op.level===2) return respTo2NT(ev, ctx);
      if(op.level===3) return P;
    }
    if(op.level===2 && op.strain==="C") return respTo2C(ev, ctx);
    if(op.level===2 && op.strain!=="C") return respToWeak2(ev, ctx, op);
    if(op.level===3) return respToPreempt(ev, ctx, op);
    if(op.level===1) return respTo1Suit(ev, ctx, op);
    return P;
  }
  
  /* Responding to partner's 1NT OPENING after RHO overcalls a suit (interference).
     Systems are OFF: Stayman and transfers do not apply. A cuebid of the opponent's
     suit is Stayman with game-forcing values (asks partner for a 4-card major); new-suit
     bids are natural. (Over a double, by contrast, systems stay on — handled by respTo1NT.) */
  function respTo1NTInterf(ev, ctx, over){
    const h=ev.hcp, len=ev.len, theirs=over.strain;
    const stopTheirs = ev.stopper(theirs);
    const NTgame = Math.max(3, cheapestLevel("NT",ctx));   // 3NT (or higher if forced)
    // 1) a natural 5-card major (other than their suit) with invitational+ values: bid it
    for(const m of (len.S>=len.H ? ["S","H"] : ["H","S"])){
      if(len[m]>=5 && m!==theirs && h>=8) return B(cheapestLevel(m,ctx), m);
    }
    // 2) cuebid their suit = game-forcing Stayman: 10+ with a 4-card UNBID major (a major
    //    other than the one they overcalled, so a 4-4 fit is still findable)
    if(h>=10 && ((len.H===4 && theirs!=="H") || (len.S===4 && theirs!=="S")))
      return B(cheapestLevel(theirs,ctx), theirs);
    // 3) natural 3NT to play: game values with their suit stopped
    if(h>=10 && stopTheirs) return B(NTgame, "NT");
    // 4) natural, forcing 5-card minor (jump to 3-level): game values, long minor, no NT stopper
    for(const m of (len.D>=len.C ? ["D","C"] : ["C","D"])){
      if(h>=10 && len[m]>=5 && m!==theirs) return B(Math.max(3, cheapestLevel(m,ctx)), m);
    }
    // 5) competitive 2NT: a balanced invitational hand (8-9) with a stopper, if 2NT is free
    if(h>=8 && h<=9 && ev.balanced && stopTheirs && bidVal(B(2,"NT"))>bidVal(ctx.info.lastBid))
      return B(2,"NT");
    // otherwise nothing constructive to say over the interference
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
    // 2S puppet: a weak hand (0-7) with a long (6+) minor and no 5-card major —
    // forces opener to 3C so we can sign off in the right minor.
    if(h<=7 && (len.C>=6 || len.D>=6) && len.H<5 && len.S<5) return B(2,"S");
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
  /* ---- Fourth Suit Forcing (FSF) ---- */
  // Responder bids the only unbid suit at the 2 level (artificial, game-forcing) to
  // ask opener for more, when holding game values but no stopper in the 4th and no fit.
  function fsfBid(ev, ctx, op){
    const myB = ctx.myBids.filter(c=>c.k==="B"&&c.strain!=="NT");
    const opB = ctx.partnerBids.filter(c=>c.k==="B"&&c.strain!=="NT");
    if(myB.length!==1 || opB.length<2) return null;
    const bidSuits = new Set([...myB.map(c=>c.strain), ...opB.map(c=>c.strain)]);
    if(bidSuits.size!==3) return null;                       // exactly three suits bid
    const fourth = ORDER.find(s=> !bidSuits.has(s));
    if(!fourth) return null;
    if(ev.hcp<12) return null;                               // game-forcing values
    if(ev.stopper(fourth)) return null;                      // stopper → bid NT naturally
    const openerSuits=[...new Set(opB.map(c=>c.strain))];
    if(openerSuits.some(s=> ev.len[s]>=4)) return null;      // clear fit → raise instead
    const L=cheapestLevel(fourth, ctx);
    if(L<2) return null;                                     // FSF is 2-level or higher
    return B(L, fourth);
  }
  // Opener answers FSF: notrump with a stopper, else raise responder, rebid, or show shape.
  function answerFSF(ev, ctx, myOpen){
    const opB = ctx.myBids.filter(c=>c.k==="B"&&c.strain!=="NT");
    const rpB = ctx.partnerBids.filter(c=>c.k==="B"&&c.strain!=="NT");
    const pl = ctx.partnerLast;
    if(!pl || pl.strain==="NT" || pl.level<2) return null;
    if(opB.length!==2 || rpB.length!==2) return null;
    const before = new Set([...opB.map(c=>c.strain), ...rpB.slice(0,-1).map(c=>c.strain)]);
    if(before.size!==3 || before.has(pl.strain)) return null; // partner's last bid is the 4th suit
    const fourth = pl.strain, respFirst = rpB[0].strain;
    if(ev.stopper(fourth)) return B(cheapestLevel("NT",ctx),"NT");
    if(ev.len[respFirst]>=3) return B(cheapestLevel(respFirst,ctx), respFirst);
    if(ev.len[myOpen.strain]>=6) return B(cheapestLevel(myOpen.strain,ctx), myOpen.strain);
    if(ev.len[fourth]>=4) return B(cheapestLevel(fourth,ctx), fourth);
    return B(cheapestLevel(opB[1].strain,ctx), opB[1].strain);
  }

  /* Responder's reverse: after a 1-level suit response and opener's rebid, bidding a NEW
     suit that ranks HIGHER than the first response — at the 2 level, which forces opener to
     the 3 level to give preference — shows a game-forcing hand with a second suit and extra
     values ("we're going at least to game; keep describing"). Only offered when responder
     has no fit with opener to show instead. */
  function responderReverse(ev, ctx, op){
    if(ev.hcp < 12) return null;                        // a reverse promises game-forcing extras
    const myReal = ctx.myBids.filter(c=>c.k==="B");
    if(myReal.length !== 1) return null;                // this is responder's SECOND bid
    const first = myReal[0];
    if(first.strain==="NT" || first.level !== 1) return null;  // first response was a 1-level suit
    const ourSuits = new Set([...ctx.myBids, ...ctx.partnerBids]
      .filter(c=>c.k==="B" && c.strain!=="NT").map(c=>c.strain));
    // lowest NEW 4+ suit ranking above the first suit that bids as a genuine 2-level reverse
    for(const s of ORDER){
      if(s==="NT") continue;
      if(ev.len[s]>=4 && higher(s, first.strain) && !ourSuits.has(s) && cheapestLevel(s,ctx)===2)
        return B(2, s);
    }
    return null;
  }

  function responderContinue(ev, ctx, op){
    const bwr=handleBlackwoodResult(ev,ctx); if(bwr) return bwr;
    // 2S puppet follow-up: I bid 2S over partner's 1NT and opener bid the forced 3C.
    // Pass to play 3C (long clubs) or correct to 3D (long diamonds). Signoff.
    const myFirst = ctx.myBids.find(c=>c.k==="B");
    if(op && op.strain==="NT" && op.level===1 && myFirst && myFirst.strain==="S" && myFirst.level===2){
      return (ev.len.D > ev.len.C) ? B(3,"D") : P;
    }
    // Fourth suit forcing: three suits bid, game-forcing values, no stopper in the
    // fourth suit and no clear fit — bid the fourth suit artificially to force & ask.
    const fsf = fsfBid(ev, ctx, op);
    if(fsf) return fsf;
    const est=estimatePartner(ctx);
    const combinedMin = ev.hcp + est.min;
    const combinedMax = ev.hcp + est.max;
    // if partner just asked Blackwood/Gerber, answer
    const bw=blackwoodResponse(ev,ctx); if(bw) return bw;
    const gb=gerberResponse(ev,ctx); if(gb) return gb;
    // did I show/find a fit? look for a suit where partner bid it and I have 3+, or I bid it and partner raised
    const fit = findFit(ev, ctx);
    // game-forcing two-suiter with no fit: reverse into the higher suit to keep describing
    if(!fit){ const rev = responderReverse(ev, ctx, op); if(rev) return rev; }
    let call = placeContract(ev, ctx, combinedMin, combinedMax, fit);
    // 2-over-1 obligation: after a 2-level new-suit response, responder must bid
    // again below game (SAYC). Never pass opener's non-game rebid — describe instead.
    const myReal = ctx.myBids.filter(c=>c.k==="B");
    const twoOverOne = op && op.level===1 && op.strain!=="NT" &&
                       myFirst && myFirst.level===2 && myFirst.strain!=="NT" && myReal.length===1;
    if(call.k==="P" && twoOverOne && !isGameBid(ctx.partnerLast)){
      call = forcedRebid(ev, ctx, fit);
    }
    return call;
  }
  function isGameBid(b){
    if(!b || b.k!=="B") return false;
    if(b.strain==="NT") return b.level>=3;
    return isMajor(b.strain) ? b.level>=4 : b.level>=5;
  }
  // a descriptive, always-legal rebid to honour the 2-over-1 obligation (never passes)
  function forcedRebid(ev, ctx, fit){
    const legalB=(b)=> bidVal(b)>bidVal(ctx.info.lastBid);
    const pB = ctx.partnerBids.filter(c=>c.k==="B");
    const openerFirst = pB[0], openerLast = pB[pB.length-1];
    if(fit && fit.suit){ const b=B(cheapestLevel(fit.suit,ctx),fit.suit); if(legalB(b)) return b; }
    const mySuit = ctx.myBids.filter(c=>c.k==="B"&&c.strain!=="NT").map(c=>c.strain)[0];
    if(mySuit && ev.len[mySuit]>=6){ const b=B(cheapestLevel(mySuit,ctx),mySuit); if(legalB(b)) return b; }
    if(ev.balanced){ const b=B(cheapestLevel("NT",ctx),"NT"); if(legalB(b)) return b; }
    if(openerLast && openerLast.strain!=="NT" && ev.len[openerLast.strain]>=3){ const b=B(cheapestLevel(openerLast.strain,ctx),openerLast.strain); if(legalB(b)) return b; }
    if(openerFirst && openerFirst.strain!=="NT" && ev.len[openerFirst.strain]>=2){ const b=B(cheapestLevel(openerFirst.strain,ctx),openerFirst.strain); if(legalB(b)) return b; }
    const nt=B(cheapestLevel("NT",ctx),"NT"); return legalB(nt)?nt:P;
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
    // partner made a negative double (I opened 1-suit, LHO overcalled, partner doubled)
    const pLastCall = ctx.partnerBids[ctx.partnerBids.length-1];
    if(myOpen && myOpen.level===1 && myOpen.strain!=="NT" && pLastCall && pLastCall.k==="D" &&
       ctx.lhoLast && ctx.lhoLast.k==="B" && ctx.lhoLast.strain!=="NT" &&
       !ctx.myBids.slice(1).some(c=>c.k==="B")){
      const r = respondToNegDouble(ev, ctx, myOpen);
      if(r) return r;
    }
    // partner used fourth suit forcing → answer it (NT with a stopper, raise, or show shape)
    if(myOpen){ const fa = answerFSF(ev, ctx, myOpen); if(fa) return fa; }
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
    // 2S puppet (long weak minor over 1NT): opener is forced to 3C
    if(myOpen.level===1 && pl.strain==="S" && pl.level===2) return B(3,"C");
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
  /* ---- Michaels cuebid & Unusual 2NT: direct-seat 5-5 two-suiters ----
     Michaels: cuebid of opener's suit. Over a minor = both majors; over a major
     = the other major + an unspecified minor. Unusual 2NT: jump to 2NT = 5-5 in
     the two lowest UNBID suits. Only in the direct seat over a 1-level suit
     opening, and only on genuine 5-5 shape, so natural overcalls are untouched. */
  function michaelsOrUnusual(ev, ctx){
    const opp = ctx.info.lastBid;
    if(!opp || opp.level!==1 || opp.strain==="NT") return null;   // their opening: 1 of a suit
    if(ctx.openerSeat!==ctx.rho) return null;                     // direct seat only
    const len=ev.len, h=ev.hcp, their=opp.strain;
    const unbid = ["C","D","H","S"].filter(x=>x!==their);
    const lowTwo = unbid.slice(0,2);                              // two lowest unbid suits
    // Unusual 2NT first (shapes are mutually exclusive with Michaels)
    if(len[lowTwo[0]]>=5 && len[lowTwo[1]]>=5 && h>=8) return B(2,"NT");
    if(isMinor(their)){
      if(len.H>=5 && len.S>=5 && h>=8) return B(2, their);        // both majors
    } else {
      const otherMajor = their==="H" ? "S" : "H";
      const bestMinor = len.C>=len.D ? "C" : "D";
      if(len[otherMajor]>=5 && len[bestMinor]>=5 && h>=10) return B(2, their); // major + minor
    }
    return null;
  }
  /* ---- Cappelletti: defence to an opponent's 1NT opening (direct seat) ----
     Dbl = an equal balanced hand (15+); 2C = a one-suiter (relay 2D to find it);
     2D = both majors; 2H = hearts + a minor; 2S = spades + a minor; 2NT = both
     minors. Only over a 1-level 1NT opening we're sitting directly over. */
  function cappelletti(ev, ctx){
    const opening = openingBidOf(ctx);
    if(!opening || opening.strain!=="NT" || opening.level!==1) return null;
    if(!ctx.info.lastBid || bidVal(ctx.info.lastBid)!==bidVal(opening)) return null; // directly over their 1NT
    const len=ev.len, h=ev.hcp, minor=Math.max(len.C,len.D);
    if(ev.balanced && h>=15) return DBL;                                   // equal hand
    if(len.H>=5 && len.S>=5 && h>=9) return B(2,"D");                      // both majors
    if(len.H>=5 && minor>=5 && h>=9) return B(2,"H");                      // hearts + a minor
    if(len.S>=5 && minor>=5 && h>=9) return B(2,"S");                      // spades + a minor
    if(len.C>=5 && len.D>=5 && h>=9) return B(2,"NT");                     // both minors
    if(len[ev.longest]>=6 && ev.top5(ev.longest)>=2 && h>=8) return B(2,"C"); // one-suiter
    return null;
  }
  function advanceCappelletti(ev, ctx){
    const pFirst = ctx.partnerBids.find(c=>c.k==="B");
    const pLastCall = ctx.partnerBids[ctx.partnerBids.length-1];
    if(pLastCall && pLastCall.k==="D") return P;                          // penalty double → defend
    if(!pFirst || pFirst.level!==2) return null;
    if(pFirst.strain==="C") return B(cheapestLevel("D",ctx),"D");         // relay to find the one-suiter
    if(pFirst.strain==="D"){ const m=ev.len.S>=ev.len.H?"S":"H"; return B(cheapestLevel(m,ctx),m); } // majors → longer
    if(pFirst.strain==="NT"){ const m=ev.len.D>=ev.len.C?"D":"C"; return B(cheapestLevel(m,ctx),m); } // minors → longer
    return P;                                                             // 2H/2S show a known major → pass, playable
  }
  function cappellettiContinue(ev, ctx){
    const opening = openingBidOf(ctx);
    const myFirst = ctx.myBids.find(c=>c.k==="B");
    if(!opening || opening.strain!=="NT" || !myFirst) return null;
    if(myFirst.level===2 && myFirst.strain==="C"){                         // I bid the one-suiter 2C
      const pl=ctx.partnerLast;
      if(pl && pl.level===2 && pl.strain==="D"){ const s=ev.longest; return B(cheapestLevel(s,ctx), s); }
    }
    return null;
  }

  function advanceTwoSuiter(ev, ctx, oppOpen, isUnusual){
    const their = oppOpen.strain;
    // Michaels over a major: partner has the OTHER major + an unknown minor
    if(!isUnusual && isMajor(their)){
      const om = their==="H" ? "S" : "H";
      if(ev.len[om]>=3){ const L=cheapestLevel(om,ctx); return B(ev.hcp>=11?Math.min(4,L+1):L, om); }
      return B(2,"NT");                         // ask partner which minor
    }
    let suits;
    if(isUnusual){ suits = ["C","D","H","S"].filter(x=>x!==their).slice(0,2); }
    else { suits = ["H","S"]; }                 // Michaels over a minor = both majors
    let pick=suits[0], best=-1;
    for(const s of suits){ if(ev.len[s]>best){ best=ev.len[s]; pick=s; } }
    const L=cheapestLevel(pick, ctx);
    const lvl = (ev.hcp>=11 && best>=4) ? Math.min(4, L+1) : L;
    return B(lvl, pick);
  }
  /* the two-suiter bidder's own continuation: answer partner's 2NT minor-ask,
     otherwise let partner place the contract. */
  function twoSuiterContinue(ev, ctx){
    const myFirst = ctx.myBids.find(c=>c.k==="B");
    const oppOpen = openingBidOf(ctx);
    if(!myFirst || !oppOpen || oppOpen.level!==1 || oppOpen.strain==="NT") return null;
    const wasMichaels = myFirst.strain===oppOpen.strain && myFirst.level===2;
    const wasUnusual  = myFirst.strain==="NT" && myFirst.level===2;
    if(!wasMichaels && !wasUnusual) return null;
    const pl = ctx.partnerLast;
    if(wasMichaels && isMajor(oppOpen.strain) && pl && pl.strain==="NT"){
      const m = ev.len.C>=ev.len.D ? "C" : "D";        // reveal my minor
      return B(cheapestLevel(m,ctx), m);
    }
    return P;                                            // partner has placed the contract
  }

  /* Lead-directing double of the opponents' conventional response to a 1NT opening.
     Position: our LHO opened 1NT, partner passed, RHO made a conventional 2-level bid
     (Stayman 2C / red-suit transfer 2D or 2H) and it's our first turn. With a strong holding
     in the doubled suit we double to ask partner to lead that suit. Gated very tightly (LHO
     opener, 1NT, partner silent, RHO's conventional bid is the last call, and we hold 5+ with
     two of the top three honours) so it cannot fire in ordinary competitive auctions. */
  function leadDirectingDouble(ev, ctx){
    if(ctx.openerSeat !== ctx.lho) return null;                 // LHO opened
    const openBid = ctx.lhoBids.find(c=>c.k==="B");
    if(!openBid || openBid.level!==1 || openBid.strain!=="NT") return null;   // ...a 1NT opening
    if(ctx.partnerBids.some(c=>c.k==="B")) return null;         // partner stayed out
    if(ctx.info.lastBidder !== ctx.rho) return null;            // RHO made the last bid...
    const conv = ctx.info.lastBid;
    if(!conv || conv.level!==2 || !(conv.strain==="C"||conv.strain==="D"||conv.strain==="H")) return null; // ...a conventional 2C/2D/2H
    const s = conv.strain;
    if(ev.len[s]>=5 && ev.top3(s)>=2) return DBL;               // strong suit → direct its lead
    return null;
  }

  function overcallBid(ev, ctx){
    const oppBid = ctx.info.lastBid;
    const oppOpen = firstOppBid(ctx);
    const h=ev.hcp;
    // Cappelletti over their 1NT opening
    const cp = cappelletti(ev, ctx);
    if(cp) return cp;
    // two-suited conventions take priority over a natural one-suit overcall
    const mu = michaelsOrUnusual(ev, ctx);
    if(mu) return mu;
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
  // the genuine opening bid: the first bid of the auction (by openerSeat)
  function openingBidOf(ctx){
    const ob = ctx.by[ctx.openerSeat];
    if(!ob) return null;
    return ob.find(c=>c.k==="B") || null;
  }
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
    // partner made a Michaels cuebid or Unusual 2NT → pick the right long suit
    const oppOpen = openingBidOf(ctx);
    // partner made a Cappelletti bid over the opponents' 1NT
    if(oppOpen && oppOpen.strain==="NT" && oppOpen.level===1){
      const ac = advanceCappelletti(ev, ctx);
      if(ac) return ac;
    }
    const pFirst = ctx.partnerBids.find(c=>c.k==="B");
    if(pOver.k==="B" && oppOpen && oppOpen.level===1 && oppOpen.strain!=="NT" && pFirst){
      const isMichaels = pFirst.strain===oppOpen.strain && pFirst.level===2;
      const isUnusual  = pFirst.strain==="NT" && pFirst.level===2;
      if(isMichaels || isUnusual) return advanceTwoSuiter(ev, ctx, oppOpen, isUnusual);
    }
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
  const { resolveTrick, legalPlays, RANKVAL, makeDeck } = ENG;
  
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
  /* Unblock: when the hand on lead is the SHORT hand in a suit (singleton/doubleton) and holds a
     top honour that outranks the mate's longer holding, cash that honour NOW so it doesn't strand the
     mate's length behind it. This is the "play the high card from the short hand first" discipline. */
  function unblockCash(ctx, hereB, mateB, known, seen){
    const { trump } = ctx;
    for(const s of SUITS){
      if(s===trump) continue;
      const here=byDesc(hereB[s]||[]), mate=byDesc(mateB[s]||[]);
      if(here.length===0 || here.length>2) continue;              // short hand only
      if(mate.length<4) continue;                                 // mate must be a real long suit
      const topOutV=topOut(s, known, seen);
      if(!(RANKVAL[here[0].rank] > topOutV && RANKVAL[here[0].rank] > RANKVAL[mate[0].rank])) continue;
      // only when the mate is a genuinely RUNNING suit (top two touching honours) — otherwise
      // cashing early just wastes an entry rather than unblocking a run
      if(RANKVAL[mate[0].rank]>=11 && RANKVAL[mate[0].rank]-RANKVAL[mate[1].rank]===1) return here[0];
    }
    return null;
  }

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
  
    // 0) ruff a loser in the short (mate) hand BEFORE drawing trumps, if drawing would strip
    //    the trumps the mate needs to ruff
    const rbd = ruffBeforeDraw(ctx, hereB, mateB, known, seen);
    if(rbd) return W(rbd,"DECL_RUFF_FIRST",{suit:rbd.suit});
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
    // 2) if a finessable tenace sits in THIS hand, cross to the other hand to lead toward it
    const cross = crossToFinesse(ctx, hereB, mateB, known, seen);
    if(cross) return W(cross,"DECL_CROSS",{suit:cross.suit});
    // 2b) unblock: cash a short-hand top honour that would otherwise strand the mate's longer suit
    const unb = unblockCash(ctx, hereB, mateB, known, seen);
    if(unb) return W(unb,"DECL_UNBLOCK",{suit:unb.suit,card:unb.rank});
    // 3) cash a side winner this hand holds
    for(const s of SUITS){
      if(s===trump) continue;
      const here=byDesc(hereB[s]||[]); if(!here.length) continue;
      if(RANKVAL[here[0].rank] > topOut(s, known, seen)) return W(here[0],"DECL_CASH",{suit:s,card:here[0].rank});
    }
    // 4) finesse: lead low toward a broken honour in the other hand
    const fin = finesseLead(ctx, hereB, mateB, known);
    if(fin) return W(fin.card,"DECL_FINESSE",{suit:fin.card.suit,honor:fin.honor});
    // 5) ruff a loser: short side suit here, trumps opposite
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

  /* Is `mineDesc` (my cards in suit s, byDesc) a finessable tenace — a broken honour holding
     whose missing higher honour is still outstanding, so the trick is won by leading TOWARD it
     rather than cashing? Handles the common A-Q (K out) and A-J-10 (K,Q out) shapes. */
  function isFinessableTenace(mineDesc, s, known, seen){
    const r = mineDesc.map(c=>c.rank);
    const out = outstanding(s, known, seen);
    const has = x=>r.includes(x);
    if(has("A") && has("Q") && !has("K") && out.includes("K")) return { honor:"Q" };
    if(has("A") && has("J") && has("10") && !has("K") && !has("Q") && out.includes("K")) return { honor:"J" };
    return null;
  }

  /* Find a card in my hand whose suit lets the OTHER hand win the trick — an entry to cross
     over (never via the trump suit). Returns my lowest card in that suit. */
  function findEntryToMate(ctx, hereB, mateB, known, seen){
    const { trump } = ctx;
    for(const s of SUITS){
      if(s===trump) continue;
      const mine=byAsc(hereB[s]||[]); const mate=byDesc(mateB[s]||[]);
      if(!mine.length || !mate.length) continue;
      const topV = topOut(s, known, seen);
      if(RANKVAL[mate[0].rank] > topV && RANKVAL[mate[0].rank] > RANKVAL[mine[0].rank]) return mine[0];
    }
    return null;
  }

  /* If a finessable tenace sits in the hand ON LEAD, we're in the WRONG hand to finesse it.
     Cross to the other hand (lead an entry) so we can lead toward the tenace next time. */
  function crossToFinesse(ctx, hereB, mateB, known, seen){
    const { trump } = ctx;
    for(const s of SUITS){
      if(s===trump) continue;
      const mine=byDesc(hereB[s]||[]);
      if(!isFinessableTenace(mine, s, known, seen)) continue;
      const entry=findEntryToMate(ctx, hereB, mateB, known, seen);
      if(entry && entry.suit!==s) return entry;
    }
    return null;
  }

  /* Ruff a loser in the SHORT trump hand (the mate) BEFORE drawing trumps, when drawing would
     strip the trumps the mate needs to ruff. Returns the side-suit loser to lead now. */
  function ruffBeforeDraw(ctx, hereB, mateB, known, seen){
    const { trump } = ctx;
    if(trump==="NT") return null;
    const myTr=hereB[trump]||[], mateTr=mateB[trump]||[];
    if(!mateTr.length || mateTr.length>myTr.length) return null;   // mate must be short (ruffing) hand
    // Only ruff-first when drawing would WASTE the mate's trumps: every mate trump is lower than
    // my lowest trump, so pulling trumps forces the mate to follow helplessly instead of ruffing.
    if(RANKVAL[byDesc(mateTr)[0].rank] >= RANKVAL[byAsc(myTr)[0].rank]) return null;
    for(const s of SUITS){
      if(s===trump) continue;
      const mine=hereB[s]||[], mate=mateB[s]||[];
      if(mine.length <= mate.length) continue;           // need a shortage in mate to ruff into
      const losers=byAsc(mine.filter(c=>RANKVAL[c.rank] < topOut(s, known, seen)));
      if(losers.length) return losers[0];
    }
    return null;
  }
  
  function topOfSequence(cards){
    // top of a 2+ touching-honour sequence WITHIN a suit (top >= J); best across suits
    const b=buckets(cards); let best=null;
    for(const s of SUITS){
      const d=byDesc(b[s]);
      for(let i=0;i+1<d.length;i++){
        if(RANKVAL[d[i].rank]-RANKVAL[d[i+1].rank]===1 && RANKVAL[d[i].rank]>=11){
          if(!best || RANKVAL[d[i].rank]>RANKVAL[best.rank]) best=d[i];
          break;
        }
      }
    }
    return best;
  }
  /* Reading layer: reconstruct what partner has asked for from the seat-tagged play history.
     - partner led a suit  -> that's partner's suit, worth returning
     - I led a suit and partner followed with a high spot (>=7) -> encourage; a low spot (<=5) -> discourage
     - partner discarded a high spot -> come-on for that suit
     Later signals override earlier ones. Defenders only. */
  function readDefense(ctx){
    const { seat, trump, history } = ctx;
    const partner = partnerOf(seat);
    const prefer = new Set(), discourage = new Set();
    const reason = {};   // suit -> "return" (partner's suit) | "encourage" (partner's signal)
    if(!history || !history.length) return { prefer, discourage, reason };
    const like = (s,why)=>{ prefer.add(s); discourage.delete(s); reason[s]=why; };
    const dislike = s=>{ discourage.add(s); prefer.delete(s); delete reason[s]; };
    for(const tr of history){
      const cards = tr.cards||[]; if(!cards.length) continue;
      const leaderSeat = cards[0].player;
      const led = tr.ledSuit;
      const pc = cards.find(c=>c.player===partner);
      if(leaderSeat===partner){ like(led,"return"); continue; }      // partner's suit
      if(leaderSeat===seat && pc && pc.suit===led){                 // partner's attitude to my lead
        const rv=RANKVAL[pc.rank];
        if(tr.winner!==partner && rv<=9){ if(rv>=7) like(led,"encourage"); else if(rv<=5) dislike(led); }
        continue;
      }
      if(pc && pc.suit!==led && pc.suit!==trump && RANKVAL[pc.rank]>=7) like(pc.suit,"encourage"); // come-on discard
    }
    return { prefer, discourage, reason };
  }

  /* Hand-reading: if I lead into dummy (dummy plays right after me), avoid feeding a suit where
     dummy holds a tenace (A-Q, K-J, A-J) — that hands declarer a free finesse. Lead up to weakness. */
  function leadIntoDummyTenace(ctx){
    const { seat, dummy, dummyHand } = ctx;
    const avoid=new Set();
    if(!dummyHand || dummy!==(seat+1)%4) return avoid;
    for(const s of SUITS){
      const ds=dummyHand.filter(c=>c.suit===s).map(c=>c.rank);
      const has=r=>ds.includes(r);
      if((has("A")&&has("Q")&&!has("K")) || (has("K")&&has("J")&&!has("Q")) || (has("A")&&has("J")&&!has("K")&&!has("Q"))) avoid.add(s);
    }
    return avoid;
  }

  /* ---------- live defensive-lead rollout (scoped mini-oracle) ----------
     Mining showed the defensive "which suit to switch to" leak is single-strategy-robust (not a
     strategy-fusion artifact): a correct per-deal switch exists but no cheap fixed rule captures it.
     So at a DEFENSIVE LEAD (dummy already visible), we sample worlds consistent with what we see and
     roll each candidate lead out under the base heuristic, picking the suit that holds declarer to the
     fewest tricks. Fires only when ROLLOUT_K>0 (off by default → identical to v16). Deterministic:
     the world sample is seeded from the visible state, so the harness stays reproducible. A reentrancy
     guard makes the rollout's own defenders use the fast policy (no infinite recursion). */
  // Live-rollout depth for the defensive-lead mini-oracle. 0 disables it (engine == v16). ~16 is a
  // good phone-affordable default (one lead decision ≈ K×suits×40 fast plays). Env-overridable so the
  // offline harness can A/B it; in the browser there is no process, so the constant governs.
  let LIVE_ROLLOUT_K = 16;
  if(typeof process!=='undefined' && process.env && process.env.ROLLOUT_K!==undefined) LIVE_ROLLOUT_K = +process.env.ROLLOUT_K;
  let _inRollout=false;
  function _mulb(a){ a=a>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
  function _stateSeed(ctx){ let h=2166136261>>>0; const p=[ctx.seat,(ctx.history||[]).length]; for(const c of (ctx.hand||[])) p.push(c.id); for(const c of (ctx.seen||[])) p.push(c.rank+c.suit); const s=p.join(","); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function _sampleWorld(ctx, rng){
    const { seat, dummy, hand, dummyHand, seen, history } = ctx;
    const hiddenSeats=[0,1,2,3].filter(s=> s!==seat && s!==dummy);   // partner + declarer
    const key=c=>c.rank+c.suit; const known=new Set();
    for(const c of hand) known.add(key(c));
    for(const c of (dummyHand||[])) known.add(key(c));
    for(const c of (seen||[])) known.add(key(c));
    const unseen=makeDeck().filter(c=> !known.has(key(c)));
    const nplayed=(history||[]).length; const need={}; const voids={};
    for(const s of hiddenSeats){ need[s]=13-nplayed; voids[s]=new Set(); }
    for(const tr of (history||[])){ const led=tr.ledSuit; for(const c of (tr.cards||[])){ if(hiddenSeats.includes(c.player) && c.suit!==led) voids[c.player].add(led); } }
    for(let attempt=0; attempt<40; attempt++){
      const pool=unseen.slice();
      for(let i=pool.length-1;i>0;i--){ const j=(rng()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
      const out={}; for(const s of hiddenSeats) out[s]=[]; let ok=true;
      for(const c of pool){ const elig=hiddenSeats.filter(s=> out[s].length<need[s] && !voids[s].has(c.suit)); if(!elig.length){ ok=false; break; } elig.sort((a,b)=>(need[a]-out[a].length)-(need[b]-out[b].length)); out[elig[0]].push(c); }
      if(ok && hiddenSeats.every(s=>out[s].length===need[s])) return out;
    }
    return null;
  }
  function _playoutAfterLead(ctx, h, leadCard){
    const { trump, declarer, dummy, seat, seen, history } = ctx;
    const seen2=(seen||[]).map(c=>({rank:c.rank,suit:c.suit}));
    const hist2=(history||[]).map(t=>({ledSuit:t.ledSuit,winner:t.winner,cards:t.cards.map(c=>({rank:c.rank,suit:c.suit,player:c.player}))}));
    let declTricks=hist2.reduce((a,tr)=> a+(sideOf(tr.winner)===sideOf(declarer)?1:0),0);
    { const i=h[seat].findIndex(x=>x.id===leadCard.id); if(i>=0) h[seat].splice(i,1); }
    let leader=seat; const startTrick=hist2.length;
    for(let t=startTrick;t<13;t++){
      const trick=[]; let led=null;
      for(let k=0;k<4;k++){ const s=(leader+k)%4;
        let card;
        if(t===startTrick && k===0){ card=leadCard; }
        else { const dg=sideOf(s)===sideOf(declarer);
          const c2={ hand:h[s], trick:trick.slice(), ledSuit:led, trump, seat:s, declarer, dummy,
            seen:seen2.slice(), history:hist2.slice(), dummyHand:h[dummy].slice(),
            mateHand:(dg&&s===declarer)?h[dummy].slice():(dg&&s===dummy)?h[declarer].slice():undefined };
          try{ card=chooseCard(c2); }catch(_){ card=null; }
          const legal=legalPlays(h[s], trick.length?led:null); if(!card||!legal.find(x=>x.id===card.id)) card=legal[0];
          const i=h[s].findIndex(x=>x.id===card.id); h[s].splice(i,1); }
        if(k===0) led=card.suit; trick.push({rank:card.rank,suit:card.suit,player:s,id:card.id});
      }
      const win=resolveTrick(trick,led,trump).winner; if(sideOf(win)===sideOf(declarer))declTricks++;
      for(const tc of trick) seen2.push({rank:tc.rank,suit:tc.suit});
      hist2.push({ledSuit:led,winner:win,cards:trick.map(x=>({rank:x.rank,suit:x.suit,player:x.player}))}); leader=win;
    }
    return declTricks;
  }
  // Exact double-dummy solver over a small endgame: perfect play by BOTH sides from `leader` on lead
  // (leadCard forced). Returns declarer-side tricks TO GO. Memoised on remaining cards + leader.
  function _ddAfterLead(hands, trump, declarer, leader, leadCard){
    const memo=new Map();
    function key(hs, ld){ let s=""; for(let i=0;i<4;i++) s+=hs[i].map(c=>c.suit+c.rank).sort().join(",")+"|"; return s+"#"+ld; }
    function fromLead(hs, ld){
      if(!hs[0].length && !hs[1].length && !hs[2].length && !hs[3].length) return 0;
      const k=key(hs,ld); const m=memo.get(k); if(m!==undefined) return m;
      const r=trickSearch(hs, ld, null, []); memo.set(k,r); return r;
    }
    function trickSearch(hs, toPlay, ledSuit, played){
      if(played.length===4){
        const win=resolveTrick(played, ledSuit, trump).winner;
        return ((win%2)===(declarer%2)?1:0) + fromLead(hs, win);
      }
      const hand=hs[toPlay];
      const follow=ledSuit? hand.filter(c=>c.suit===ledSuit):[];
      const legal=(ledSuit && follow.length)? follow : hand;
      const decl=((toPlay%2)===(declarer%2));
      let best=decl?-1:999;
      for(const c of legal){
        const nh=hs.slice(); nh[toPlay]=hand.filter(x=>x!==c);
        const nled=played.length===0?c.suit:ledSuit;
        const v=trickSearch(nh, (toPlay+1)%4, nled, played.concat([{rank:c.rank,suit:c.suit,player:toPlay}]));
        if(decl){ if(v>best)best=v; } else { if(v<best)best=v; }
      }
      return best;
    }
    const hs=hands.slice(); hs[leader]=hands[leader].filter(x=>x.id!==leadCard.id);
    return trickSearch(hs, (leader+1)%4, leadCard.suit, [{rank:leadCard.rank,suit:leadCard.suit,player:leader}]);
  }
  const DD_MAX = 0;   // 0 = ship heuristic rollout (metric-optimal); set 4 for exact "sound endgame" mode (see report)   // when each hand has <= DD_MAX cards, evaluate worlds EXACTLY (double-dummy) not by heuristic playout

  function defensiveLeadRollout(ctx, legal){
    const K = LIVE_ROLLOUT_K;
    if(!K || _inRollout || !ctx.dummyHand || (ctx.trick && ctx.trick.length)) return null;
    _inRollout=true;
    try{
      const rng=_mulb(_stateSeed(ctx));
      const worlds=[]; for(let n=0;n<K;n++){ const w=_sampleWorld(ctx,rng); if(w) worlds.push(w); }
      if(!worlds.length) return null;
      // one lead per SUIT is enough (the cascade decides the spot); evaluate the cheapest card per suit
      const bySuit={}; for(const c of legal){ if(!bySuit[c.suit] || RANKVAL[c.rank]<RANKVAL[bySuit[c.suit].rank]) bySuit[c.suit]=c; }
      const cands=Object.values(bySuit);
      if(cands.length<2) return null;
      // GRANULARITY DISPATCH: exact double-dummy in the endgame, sampled heuristic rollout earlier.
      const useDD = DD_MAX>0 && ctx.hand.length<=DD_MAX;
      const histDecl = useDD ? (ctx.history||[]).reduce((a,tr)=> a+(sideOf(tr.winner)===sideOf(ctx.declarer)?1:0),0) : 0;
      let best=null, bestVal=Infinity;
      for(const cand of cands){
        let sum=0;
        for(const w of worlds){ const h=[null,null,null,null];
          h[ctx.seat]=ctx.hand.slice(); h[ctx.dummy]=ctx.dummyHand.slice();
          for(const s of Object.keys(w)) h[+s]=w[s].slice();
          sum += useDD ? (histDecl + _ddAfterLead(h, ctx.trump, ctx.declarer, ctx.seat, cand))
                       : _playoutAfterLead(ctx, h, cand); }
        const val=sum/worlds.length;
        if(val<bestVal-1e-9){ bestVal=val; best=cand; }
      }
      return best;
    } finally { _inRollout=false; }
  }

  function defenderLead(ctx, legal){
    const { hand, trump } = ctx;
    const b=buckets(hand);
    const read=readDefense(ctx);
    // live rollout picks the switch SUIT when enabled; then fall to the cascade to pick the spot card.
    const rlead=defensiveLeadRollout(ctx, legal);
    if(rlead){ const cand=byDesc(b[rlead.suit]);
      if(trump!=="NT" && cand.length && cand[0].rank==="A") return W(cand[0],"D_ROLLOUT",{suit:rlead.suit});
      if(cand.length>=4) return W(cand[3],"D_ROLLOUT",{suit:rlead.suit});
      if(cand.length) return W(byAsc(cand)[0],"D_ROLLOUT",{suit:rlead.suit});
    }
    // 1) return / continue a suit partner asked for (their own suit, or one they encouraged) —
    //    but NOT into a ruff: in a suit contract, returning a suit dummy is void in just gives
    //    declarer a ruff, so skip it and switch instead (mined from rollout-oracle disagreements).
    const dvoid = s => ctx.trump!=="NT" && ctx.dummyHand && ctx.dummyHand.filter(c=>c.suit===s).length===0;
    const pref=[...read.prefer].filter(s=>s!==trump && (b[s]||[]).length && !dvoid(s));
    if(pref.length){
      pref.sort((a,c)=>(b[c].length-b[a].length));
      const s=pref[0]; const cand=byDesc(b[s]);
      const code = read.reason[s]==="return" ? "D_RETURN" : "D_CONTINUE";
      if(ctx.trump!=="NT" && cand.length && cand[0].rank==="A") return W(cand[0],code,{suit:s}); // don't underlead the ace vs a suit contract
      if(cand.length>=4) return W(cand[3],code,{suit:s});
      if(cand.length===2) return W(cand[0],code,{suit:s});   // high from a doubleton (return)
      return W(byAsc(cand)[0],code,{suit:s});
    }
    // 2) top of a sequence — a safe attacking lead
    const seq=topOfSequence(hand);
    if(seq) return W(seq,"LEAD_SEQ",{suit:seq.suit,top:seq.rank});
    // 3) longest non-trump suit, avoiding one partner discouraged, one that feeds dummy's tenace,
    //    or (mined) one dummy is void in — leading it into a suit contract just gives a ruff.
    const avoid=new Set([...read.discourage, ...leadIntoDummyTenace(ctx)]);
    for(const s of SUITS) if(dvoid(s)) avoid.add(s);
    let best=null,len=-1;
    for(const s of SUITS){ if(s===trump||avoid.has(s)) continue; if((b[s]||[]).length>len){ len=(b[s]||[]).length; best=s; } }
    if(best==null){ for(const s of SUITS){ if(s===trump) continue; if((b[s]||[]).length>len){ len=(b[s]||[]).length; best=s; } } }
    const cand = best!=null ? byDesc(b[best]) : byDesc(legal);
    if(trump!=="NT" && cand.length && cand[0].rank==="A") return W(cand[0],"LEAD_ACE",{suit:cand[0].suit});
    if(cand.length>=4) return W(cand[3],"LEAD_4TH",{suit:cand[3].suit});
    if(cand.length) return W(byAsc(cand)[0],"LEAD_LOW",{suit:cand[0].suit});
    return W(byAsc(legal)[0],"LEAD_LOW",{suit:byAsc(legal)[0].suit});
  }
  
  /* ---------- following ---------- */
  /* Cover an honour with an honour (2nd hand). Cover a led J/Q/K when we hold exactly ONE
     honour above it (the classic Kx-covers-Q that promotes lower cards); if we hold two+
     honours above, we dominate and keep them (play low). Never squander the bare ace on a
     lower honour as 2nd hand. */
  function coverHonour(ctx, suitCards){
    const led = ctx.trick[0];
    if(!led) return null;
    const lv = RANKVAL[led.rank];
    if(lv < 11 || lv >= 14) return null;                 // only cover J/Q/K
    const above = byAsc(suitCards).filter(c=>RANKVAL[c.rank] > lv);
    const honoursAbove = above.filter(c=>RANKVAL[c.rank] >= 11);
    if(honoursAbove.length !== 1) return null;           // 2+ honours above -> dominate, don't cover
    const cov = honoursAbove[0];
    if(cov.rank === "A") return null;                    // keep the ace as 2nd hand
    return cov;                                          // cheapest single honour that covers
  }

  /* Second-hand exception — SPLIT HONOURS. When a low card is led and I (a defender in second
     seat) hold two or more TOUCHING honours but not the ace, play the LOWER honour. This forces
     declarer to spend a top card now and promotes my remaining honour, rather than letting declarer
     steal a cheap trick with a middling card. Never split when I hold the ace (I control the suit). */
  function splitHonors(ctx, suitCards){
    const { trick, seat, declarer } = ctx;
    if(sideOf(seat)===sideOf(declarer)) return null;              // defenders only
    const led = trick[0];
    if(!led || RANKVAL[led.rank] >= 10) return null;              // only when a LOW card is led
    if(suitCards.some(c=>c.rank==="A")) return null;              // holding the ace = control, play low
    const desc = byDesc(suitCards);
    for(let i=0;i<desc.length;i++){
      if(RANKVAL[desc[i].rank] < 10) break;                       // honours only (10,J,Q,K)
      let j=i;
      while(j+1<desc.length && RANKVAL[desc[j].rank]-RANKVAL[desc[j+1].rank]===1 && RANKVAL[desc[j+1].rank]>=10) j++;
      if(j>i) return desc[j];                                     // lower card of the touching honour run
    }
    return null;
  }


  function thirdHandCard(suitCards, curHighVal){
    const canWin = byDesc(suitCards).filter(c=>RANKVAL[c.rank] > curHighVal);
    if(!canWin.length) return null;
    if(RANKVAL[canWin[0].rank] < 11) return canWin[0];   // no honour available -> highest spot
    let i=0;
    while(i+1<canWin.length && RANKVAL[canWin[i].rank]-RANKVAL[canWin[i+1].rank]===1 && RANKVAL[canWin[i+1].rank]>=10) i++;
    return canWin[i];                                    // cheapest of the top touching-honour run
  }

  /* Declarer hold-up in notrump: with a SOLE ace stopper in a short combined holding, duck
     early rounds (Rule of 7: duck 7 - combinedLen times) to sever the defenders' link. */
  function holdUp(ctx, suitCards){
    const { trump, ledSuit, seat, declarer, seen, trick } = ctx;
    if(trump !== "NT") return null;
    if(sideOf(seat) !== sideOf(declarer)) return null;   // declaring side only
    const leaderSeat = (seat - trick.length + 4) % 4;    // hold up only when an OPPONENT is attacking
    if(sideOf(leaderSeat) === sideOf(declarer)) return null;
    if(!suitCards.some(c=>c.rank==="A")) return null;     // must hold the ace
    // (mined) a hold-up only gains with a SINGLE stopper. If the two declaring hands together hold the
    // ace AND king, that's a double stopper — just win; ducking only loses tempo. (Was checking the
    // acting hand alone, which missed an A/K split across declarer and dummy.)
    const mateInSuit = (ctx.mateHand || ctx.dummyHand || []).filter(c=>c.suit===ledSuit);
    const combined = new Set(suitCards.concat(mateInSuit).map(c=>c.rank));
    if(combined.has("A") && combined.has("K")) return null;
    const nonAce = suitCards.filter(c=>c.rank!=="A");
    if(!nonAce.length) return null;                        // only the bare ace -> must win
    const cur = currentWinner(trick, ledSuit, trump);
    if(cur.winner!==-1 && sideOf(cur.winner)===sideOf(seat)) return null; // our side already winning
    const mate = ctx.mateHand || ctx.dummyHand || [];
    const combinedLen = suitCards.length + mate.filter(c=>c.suit===ledSuit).length;
    const ducks = 7 - combinedLen;
    if(ducks <= 0) return null;
    const roundsBefore = Math.floor((seen||[]).filter(c=>c.suit===ledSuit).length / 3);
    if(roundsBefore >= ducks) return null;                 // held up enough -> take it now
    return byAsc(nonAce)[0];                               // duck low, keep the ace
  }

  /* Defensive carding: choose WHICH low card to play so it carries a signal.
     Attitude on partner's lead (high = encourage, low = discourage). Count on an opponent's lead,
     but only when it is USEFUL — when the opponents are establishing this suit and partner must
     read its length (dummy long here, or a later round of the same suit). On a random suit, honest
     count mostly helps declarer (who sees both defenders), so we just play a neutral low card. The
     signal card never wins the trick, so it's trick-neutral. Declarer's side never signals. */
  function signalPlay(ctx, suitCards, plainCode){
    const { seat, declarer, trump, ledSuit, trick, dummyHand, history } = ctx;
    const lowest = byAsc(suitCards)[0];
    if(sideOf(seat) === sideOf(declarer)) return W(lowest, plainCode || "F_2ND_LOW", {suit:ledSuit});
    const pos = trick.length;
    const leaderSeat = (seat - pos + 4) % 4;
    const partnerLed = leaderSeat === partnerOf(seat);
    const spots = suitCards.filter(c => RANKVAL[c.rank] < 10);   // 2..9 — never signal with the 10+
    // (mined) if the holding is ALL honours/tens there is no spot to signal with — don't spend an
    // honour on a signal, just play the lowest card and keep the higher honour as a potential trick.
    if(!spots.length) return W(lowest, plainCode || "F_2ND_LOW", {suit:ledSuit});
    const pool = spots;
    const hi = byDesc(pool)[0], lo = byAsc(pool)[0];
    if(partnerLed){
      const topRank = RANKVAL[byDesc(suitCards)[0].rank];
      const ruffValue = trump !== "NT" && suitCards.length <= 2 && ledSuit !== trump;
      const encourage = topRank >= 12 || ruffValue;             // Q+ in the suit, or a doubleton to ruff
      return encourage ? W(hi, "F_ATT_HI", { card: hi.rank, suit: ledSuit })
                       : W(lo, "F_ATT_LO", { card: lo.rank, suit: ledSuit });
    }
    // opponent led: give count only when the suit is being established and partner needs it
    const dummyLen = (dummyHand||[]).filter(c=>c.suit===ledSuit).length;
    const roundsPlayed = (history||[]).filter(t=>t.ledSuit===ledSuit).length;
    const countUseful = dummyLen>=4 || roundsPlayed>=1;
    if(!countUseful) return W(lowest, plainCode || "F_2ND_LOW", {suit:ledSuit});
    const even = (suitCards.length % 2) === 0;
    return even ? W(hi, "F_CNT_HI", { card: hi.rank, suit: ledSuit })
                : W(lo, "F_CNT_LO", { card: lo.rank, suit: ledSuit });
  }

  /* Count how many cards of `suit` a given player has already shown (history + current trick). */
  function playedInSuit(ctx, player, suit){
    let n=0;
    for(const tr of ctx.history||[]) for(const c of (tr.cards||[])) if(c.player===player && c.suit===suit) n++;
    for(const c of (ctx.trick||[])) if(c.player===player && c.suit===suit) n++;
    return n;
  }
  /* READ partner's count signal: infer partner's ORIGINAL length in `suit` from the first spot they
     played to it (high spot = even, low spot = odd), resolved to the parity-correct length closest to
     an even split of `outstanding` (= declarer + partner cards). Returns null if no clear read. */
  function partnerOrigLen(ctx, suit, outstanding){
    const partner=partnerOf(ctx.seat);
    let first=null;
    for(const tr of ctx.history||[]){ if(tr.ledSuit!==suit) continue; const pc=(tr.cards||[]).find(c=>c.player===partner && c.suit===suit); if(pc){ first=pc; break; } }
    if(!first) for(const c of (ctx.trick||[])) if(c.player===partner && c.suit===suit){ first=c; break; }
    if(!first) return null;
    const rv=RANKVAL[first.rank];
    const even = rv>=7 ? true : (rv<=5 ? false : null);   // a lone 6 is ambiguous
    if(even===null) return null;
    let best=null, bd=99;
    for(let L=1;L<=outstanding;L++){ if((L%2===0)!==even) continue; const d=Math.abs(L-outstanding/2); if(d<bd){ bd=d; best=L; } }
    return best;
  }

  /* Defensive hold-up: as a defender, duck the sole ace stopper to strand a long, running dummy suit.
     Count-aware: read partner's count to learn declarer's length and WIN the ace on the round that
     exhausts declarer (never later than the Rule-of-7-style third-round fallback). Returns {card,code}
     — either a low duck or the ace to win-and-strand — or null when the hold-up doesn't apply. NT only. */
  function defHoldUp(ctx, suitCards){
    const { trump, ledSuit, seat, declarer, dummy, dummyHand, history, trick } = ctx;
    if(trump!=="NT") return null;
    if(sideOf(seat)===sideOf(declarer)) return null;                 // defenders only
    const leaderSeat=(seat - trick.length + 4)%4;
    if(sideOf(leaderSeat)===sideOf(seat)) return null;               // an opponent must have led it
    if(!dummyHand) return null;
    const ace=suitCards.find(c=>c.rank==="A");
    if(!ace || suitCards.length<3) return null;                      // sole ace stopper, Axx+
    const dummySuit=dummyHand.filter(c=>c.suit===ledSuit);
    if(dummySuit.length<4 || RANKVAL[byDesc(dummySuit)[0].rank]<12) return null; // long, honour-headed
    const roundsPlayed=(history||[]).filter(t=>t.ledSuit===ledSuit).length;
    const thisRound=roundsPlayed+1;
    // read count -> declarer's original length in the suit; take the ace once declarer is exhausted
    const myOrig    = suitCards.length + playedInSuit(ctx, seat, ledSuit);
    const dummyOrig = dummySuit.length + playedInSuit(ctx, dummy, ledSuit);
    const outstanding = 13 - myOrig - dummyOrig;                     // declarer + partner, originally
    const pOrig = partnerOrigLen(ctx, ledSuit, outstanding);
    const declOrig = (pOrig!=null) ? Math.max(1, outstanding - pOrig) : null;
    const takeByCount = declOrig!=null && thisRound >= declOrig;     // count says declarer's last card
    const takeByRule  = roundsPlayed >= 2;                           // fallback: no later than 3rd round
    if(takeByCount || takeByRule) return { card: ace, code:"F_HOLDUP_WIN" };
    const spare=byAsc(suitCards.filter(c=>c.rank!=="A"));
    return spare.length ? { card: spare[0], code:"F_DUCK_HOLDUP" } : { card: ace, code:"F_HOLDUP_WIN" };
  }

  function chooseFollow(ctx, legal){
    const { trick, ledSuit, trump, seat } = ctx;
    const pos=trick.length;
    const partner=partnerOf(seat);
    const cur=currentWinner(trick, ledSuit, trump);
    const partnerWinning = cur.winner===partner;
    const canFollow = legal.some(c=>c.suit===ledSuit);
  
    if(canFollow){
      const suitCards = legal.filter(c=>c.suit===ledSuit);
      // declarer hold-up (sole ace stopper, NT) — applies at any seat before the win/duck logic
      const hu = holdUp(ctx, suitCards);
      if(hu) return W(hu,"F_HOLDUP",{suit:ledSuit});
      // defensive hold-up: duck (or, once count says declarer is exhausted, win) the ace to strand a long dummy suit
      const dhu = defHoldUp(ctx, suitCards);
      if(dhu) return W(dhu.card, dhu.code, {suit:ledSuit});
      // 2nd hand: cover an honour, split touching honours on a low lead, else low (with count for a defender)
      if(pos===1){
        const cov = coverHonour(ctx, suitCards);
        if(cov) return W(cov,"F_COVER",{card:cov.rank});
        const sp = splitHonors(ctx, suitCards);
        if(sp) return W(sp,"F_SPLIT",{card:sp.rank,suit:ledSuit});
        return signalPlay(ctx, suitCards, "F_2ND_LOW");
      }
      // 3rd hand: third-hand high, unless partner's led honour is already winning
      if(pos===2){
        const ledCard = trick[0];
        // (mined) partner is SECURE if already winning and either led an honour (J+) OR the only hand
        // still to play is the dummy and it cannot beat partner's card — then don't waste a winner.
        const fourthIsDummy = ((seat+1)%4)===ctx.dummy && ctx.dummyHand;
        const dummyCantBeat = fourthIsDummy && !ctx.dummyHand.some(c=>c.suit===ledSuit && RANKVAL[c.rank] > RANKVAL[cur.card.rank]);
        const partnerSecure = partnerWinning && (RANKVAL[ledCard.rank] >= 11 || dummyCantBeat);
        if(!partnerSecure){
          const declaring = sideOf(seat)===sideOf(ctx.declarer);
          const known = (ctx.hand||[]).concat(ctx.mateHand||[]);
          // declarer with a genuine tenace finesses the low honour (Q from AQ); otherwise both
          // declarer and defender secure the trick with proper third-hand-high (the A from A84).
          const isFin = declaring && isFinessableTenace(byDesc(suitCards), ledSuit, known, ctx.seen);
          const th = isFin ? cheapestWinner(ctx, suitCards)
                           : thirdHandCard(suitCards, RANKVAL[cur.card.rank]);
          if(th) return W(th, isFin?"F_FINESSE_WIN":"F_3RD_HIGH", {card:th.rank, suit:ledSuit});
        }
        return signalPlay(ctx, suitCards, "F_DUCK_PARTNER");   // duck -> attitude for a defender
      }
      // 4th hand: win as cheaply as possible; never overtake partner
      if(!partnerWinning){
        const w=cheapestWinner(ctx, suitCards); if(w) return W(w,"F_WIN_CHEAP",{card:w.rank});
      }
      return signalPlay(ctx, suitCards, partnerWinning?"F_DUCK_PARTNER":"F_CANT");
    }
    if(trump!=="NT"){
      const myTr=legal.filter(c=>c.suit===trump);
      if(myTr.length && !partnerWinning){ const w=cheapestWinner(ctx, myTr); if(w) return W(w,"RUFF",{suit:ledSuit}); }
    }
    const d=discard(ctx, legal);
    return W(d,"DISCARD",{suit:d.suit});
  }
  /* Discard from length: shed the lowest card of your longest suit — the card you can most afford,
     keeping guards and honours in the shorter suits. (Deliberate attitude discards were tried and
     removed: for the bot they spend more than they return, the same trap as costly signalling.) */
  function discard(ctx, legal){
    const { trump, seat, declarer, dummyHand } = ctx;
    const pool = legal.filter(c=>c.suit!==trump).length ? legal.filter(c=>c.suit!==trump) : legal;
    const b=buckets(pool);
    const defender = sideOf(seat)!==sideOf(declarer);
    if(defender && dummyHand){
      // Keep length that guards dummy's long suits; pitch from a suit with no guarding duty.
      // Guard duty = dummy has a real long suit (4+) AND is LONGER than me: the danger is the cards
      // dummy holds beyond my length, so if I'm as long as dummy I already outlast it and can pitch
      // freely. (Guarding 4-card suits I already match ties up length for nothing — measured worse.)
      const scored = SUITS.filter(s=>(b[s]||[]).length).map(s=>{
        const myLen=(b[s]||[]).length;
        const dlen=dummyHand.filter(c=>c.suit===s).length;
        return { s, myLen, guardDuty: dlen>=4 && dlen>myLen };
      });
      const free = scored.filter(x=>!x.guardDuty);
      // longest first (economy); (mined) break LENGTH TIES by pitching from the most worthless suit —
      // the one whose highest card is lowest — so equal-length honour/sequence holdings stay intact.
      const topVal = s => (b[s]||[]).reduce((m,c)=>Math.max(m,RANKVAL[c.rank]),0);
      const pickFrom = (free.length ? free : scored).sort((a,c)=> (c.myLen-a.myLen) || (topVal(a.s)-topVal(c.s)));
      if(pickFrom.length) return byAsc(b[pickFrom[0].s])[0];
    }
    // declarer, or no dummy view yet: economy — pitch the lowest card of the longest suit
    let best=null,len=-1;
    for(const s of SUITS){ if((b[s]||[]).length>len){ len=(b[s]||[]).length; best=s; } }
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
    return RVAL[a.rank]-RVAL[b.rank];   // ascending within a suit (low → high, left → right)
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
    trick:[], ledSuit:null, tricksPlayed:0, trickHistory:[],
    tricks:[0,0], seen:[], lastTrick:null, dummyRevealed:false,
    result:null,
    roundStartedAt:Date.now(), roundEndedAt:null,
    log:[`Deal ${prev.dealNo||1}. ${who(prev,dealer)} deals.`],
    dealNo:(prev.dealNo||1),
    gradeQueue:[], grades:{}, gradeOn:(prev.gradeOn!==false),
  };
}
function freshRubber(brains, names, dealer){
  const base = {
    mode:"play", n:4, brains:[...brains], names:(names||["","","",""]).slice(0,4),
    rubberNo:1, dealNo:1,
    games:[0,0], vuln:[false,false], gameBelow:[0,0], total:[0,0],
    rubberDone:false, rubberWinner:null, sheet:[],
    gradeOn:true,
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
  c.gradeQueue=[...(s.gradeQueue||[])]; c.grades={...(s.grades||{})};
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

/* ---- live declarer-play grading (additive; a snapshot is queued, graded off-thread by the worker,
   and the result is attached as a Table Talk log line — it NEVER touches game state) ---- */
function gradeVoidsPlayed(s){
  const voids=[new Set(),new Set(),new Set(),new Set()];
  const played=[[],[],[],[]];
  for(const t of (s.trickHistory||[])){
    for(const tc of t.trick){
      played[tc.seat].push({rank:tc.card.rank, suit:tc.card.suit});
      if(tc.card.suit!==t.ledSuit) voids[tc.seat].add(tc.card.suit);   // show-out void
    }
  }
  return {voids, played};
}
function gradeHash(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function maybeEnqueueGrade(s, seat, card){
  if(!s.gradeOn || !s.contract) return;
  if(s.trick.length!==0) return;                                    // grade only the LEAD to a trick
  const declSide=sideOf(s.contract.declarer);
  const isDeclLead = sideOf(seat)===declSide;
  // Defender leads are graded from the defender's info-set (own hand + dummy). The opening lead happens
  // BEFORE dummy is exposed (3 hidden hands — outside the 2-hidden sampler), so skip just that one.
  if(!isDeclLead && !s.dummyRevealed) return;
  const defs=[0,1,2,3].filter(x=>sideOf(x)!==declSide);
  const {voids, played}=gradeVoidsPlayed(s);
  const strip=(h)=>h.map(c=>({rank:c.rank, suit:c.suit}));
  const played_key=`${card.rank}.${card.suit}`;
  const moveId=`${s.rubberNo||1}.${s.dealNo||1}.${s.tricksPlayed}`;
  const pos={
    hands:[strip(s.hands[0]),strip(s.hands[1]),strip(s.hands[2]),strip(s.hands[3])],
    voids:voids.map(v=>[...v]), played,
    trump:s.trump, declarer:s.contract.declarer, leader:seat, defs,
    won_decl:s.tricks[declSide], completed:s.tricksPlayed,
    need:6+s.contract.level, level:s.contract.level,
    played_key, seed:gradeHash(moveId+"|"+played_key), N:16,
    payoff:"make", vul:!!s.vuln[declSide], moveId, tricksPlayed:s.tricksPlayed, leaderSeat:seat,
  };
  s.gradeQueue=[...(s.gradeQueue||[]), pos];
}

/* ---- play step ---- */
function applyPlay(s, seat, cardId){
  const hand=s.hands[seat];
  const card=hand.find(c=>c.id===cardId) || ENG.legalPlays(hand, s.trick.length?s.ledSuit:null)[0];
  try{ maybeEnqueueGrade(s, seat, card); }catch(_){}   // snapshot BEFORE the card leaves the hand
  // Capture the engine's reasoning for this card (for the Table Talk play-by-play). The read is
  // taken from the position BEFORE the card leaves the hand; it applies when the played card is the
  // one the engine would choose (always true for the bots; true for a human playing "by the book").
  let why=null;
  try{ const rec=PLY.chooseCardWhy(playCtx(s, seat)); if(rec && rec.card && rec.card.id===card.id) why=rec.why; }catch(_){ why=null; }
  s.hands={...s.hands, [seat]: hand.filter(c=>c.id!==card.id)};
  const firstCardOfDeal = (s.tricksPlayed===0 && s.trick.length===0);
  if(s.trick.length===0) s.ledSuit=card.suit;
  s.trick=[...s.trick, {seat, card, why}];
  if(firstCardOfDeal) s.dummyRevealed=true;               // dummy exposed after the opening lead
  if(s.trick.length===4){
    const cards=s.trick.map(tc=>({rank:tc.card.rank,suit:tc.card.suit,player:tc.seat}));
    const { winner } = ENG.resolveTrick(cards, s.ledSuit, s.trump);
    s.tricks=[...s.tricks]; s.tricks[sideOf(winner)] += 1;
    s.seen=[...s.seen, ...s.trick.map(tc=>tc.card)];
    s.lastTrick={ trick:s.trick, winner, ledSuit:s.ledSuit };
    s.trickHistory=[...(s.trickHistory||[]), { num:s.tricksPlayed+1, trick:s.trick, winner, ledSuit:s.ledSuit, trump:s.trump }];
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
    case "PLAY_GRADE":{
      const g=a.grade;
      const s=cloneState(state);
      s.gradeQueue=(s.gradeQueue||[]).filter(p=>p.moveId!==a.moveId);
      if(g && !g.skipped){
        s.grades={...(s.grades||{}), [a.moveId]: g};
        const glyph=(k)=>{ const i=k.lastIndexOf("."); return k.slice(0,i)+(STRAIN_GLYPH[k.slice(i+1)]||k.slice(i+1)); };
        const bestKey = g.best_named || g.best;   // A5: pedagogically-named representative
        const role = g.role==="defender" ? "Defence" : "Declarer play";
        const tag = g.played_in_equiv ? "\u2713 sound" : `best ${glyph(bestKey)}`;
        pushLog(s, `${role}: ${g.points}/100 \u2014 ${tag}${g.needs_clairvoyance?" (DD-only)":""}`);
      }
      return s;
    }
    case "TOGGLE_GRADE": return {...state, gradeOn: !state.gradeOn};
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
    history: (s.trickHistory||[]).map(t=>({ ledSuit:t.ledSuit, winner:t.winner,
      cards:t.trick.map(tc=>({ rank:tc.card.rank, suit:tc.card.suit, player:tc.seat })) })),
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
    LEAD_4TH:"Fourth-best from your longest suit ({suit}): the classic lead to develop length — and it lets partner use the Rule of 11 to place the missing cards.",
    LEAD_ACE:"Against a suit contract you don't underlead an ace, so lead the ace of {suit} itself.",
    LEAD_LOW:"Lead a low {suit} — a quiet, constructive choice when you have no sequence or clear suit to attack.",
    D_CONTINUE:"Partner encouraged {suit} with an earlier signal — lead it again to develop the suit they like.",
    D_RETURN:"Return partner's suit: they opened {suit}, so leading it back helps set up their long cards and honours.",
    D_ROLLOUT:"Switch to {suit}: testing each suit against the hands partner and declarer could hold, leading {suit} gives declarer the fewest tricks on average.",
    DECL_DRAW:"You're declarer with the top trump: play the {card} to draw the defenders' trumps so they can't ruff your winners.",
    DECL_CASH:"The {card} is the highest {suit} still out — cash your sure winner.",
    DECL_FINESSE:"Lead low toward your {honor} of {suit}: if the missing higher honour sits before it, the {honor} scores. That's a finesse — a free shot at an extra trick.",
    DECL_RUFF:"Lead your losing {suit} so the other hand can ruff it — turning a loser into a trick with a trump.",
    DECL_RUFF_FIRST:"Ruff before drawing trumps: lead your losing {suit} now so the short hand can trump it while it still holds trumps.",
    DECL_CROSS:"Cross to the other hand in {suit} so you can lead toward your tenace and take the finesse from the correct side.",
    DECL_ESTABLISH:"Lead low in your long {suit} to knock out the defenders' stoppers and set up later winners.",
    F_2ND_LOW:"Second hand low in {suit}: no need to spend an honour before seeing what partner and declarer do.",
    F_SPLIT:"Split your honours: with touching honours in {suit} and a low card led, play the lower one to force out a top card and promote the other.",
    DECL_UNBLOCK:"Unblock: cash the high {suit} from the short hand first so it does not trap the long suit behind it.",
    F_3RD_HIGH:"Third hand high — the {card} is the cheapest card that can win, forcing out the defenders' higher cards.",
    F_FINESSE_WIN:"Finish the finesse: play the {card}, not the ace. If the missing honour is trapped, the {card} wins and you score an extra {suit} trick.",
    F_WIN_CHEAP:"Win the trick as cheaply as you can with the {card}, saving your higher cards.",
    F_DUCK_PARTNER:"Partner is already winning the trick — play low in {suit} and keep your strength for later.",
    F_CANT:"You can't beat what's on the table in {suit}, so play low and hold your honours.",
    F_COVER:"Cover an honour with an honour: play the {card} so your side's lower cards are promoted into winners.",
    F_HOLDUP:"Hold up: duck this round of {suit} and keep your ace, cutting the defenders' link to their long suit.",
    F_DUCK_HOLDUP:"Defensive hold-up: duck your ace of {suit} to cut declarer off from dummy's long suit — win it once declarer is out.",
    F_HOLDUP_WIN:"Take the ace of {suit} now: partner's count shows declarer has run out, so winning here strands dummy's long suit.",
    F_ATT_HI:"Attitude signal: the high {card} of {suit} encourages partner to keep leading the suit.",
    F_ATT_LO:"Attitude signal: the low {card} of {suit} discourages the suit — partner should look elsewhere.",
    F_CNT_HI:"Count signal: the high {card} starts a high-low to show an even number of {suit}.",
    F_CNT_LO:"Count signal: the low {card} shows an odd number of {suit} (low-high).",
    RUFF:"You're out of {suit} — ruff with a low trump to win the trick and save your higher trumps.",
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
    "stayman":"A 2♣ response to 1NT asking opener whether they hold a four-card major.",
    "transfer":"A bid telling partner to bid the next suit up, so the stronger hand becomes hidden declarer (a Jacoby transfer).",
    "blackwood":"A 4NT bid asking partner how many aces they hold, used when exploring a slam.",
    "weak two":"An opening 2♦/2♥/2♠ showing a six-card suit and only 5–10 HCP, made to steal bidding space.",
    "preempt":"A high opening on a long, weak hand, made to crowd the opponents out of the auction.",
    "stopper":"A holding that halts a suit at no-trump (an Ace, or a guarded King, etc.).",
    "vulnerable":"Having already won a game this rubber; bonuses and penalties are larger when vulnerable.",
    "game":"A contract worth 100+ trick points (3NT, 4♥/4♠, 5♣/5♦). Two games win the rubber.",
    "part-score":"A contract below game; several can add up to a game across successive deals.",
    "slam":"A contract for 12 tricks (small slam) or all 13 (grand slam), earning a large bonus.",
    "rubber":"A match won by the first side to complete two games, worth a 500 or 700 bonus.",
    "book":"The first six tricks. A contract's level is how many tricks beyond book you must take.",
    "honour":"An Ace, King, Queen, Jack or Ten; a run of trump honours in one hand can earn a bonus.",
    "second hand low":"A defensive rule of thumb: playing second to a trick, usually play low and wait.",
    "third hand high":"A defensive rule of thumb: playing third to a trick, play high to help win it.",
    "discard":"Playing a card of another suit when you can't follow and choose not to ruff.",
    "attitude signal":"A defender's spot card that shows liking for the suit partner led: a high card encourages continuing, a low card discourages it.",
    "suit-preference":"A discard or spot card whose height points partner toward a suit: a high card likes the suit discarded (or asks for the higher side suit), a low card discourages it.",
    "lead up to weakness":"Leading a suit toward the weak hand rather than into a tenace — avoid feeding declarer a free finesse by leading into dummy's A-Q.",
    "count signal":"A defender's spot card that shows the parity of their length: high-then-low shows an even number, low-then-high shows odd. Given mainly on declarer's leads.",
    "hold-up":"Declarer refusing to win an early round of a suit at no-trump, keeping a stopper to cut the defenders' link to their long suit.",
    "defensive hold-up":"A defender ducking their sole stopper (the ace) for a round or two so that when declarer runs out of the suit, dummy's long cards are stranded without an entry.",
    "cover an honour":"Playing a higher honour on an honour led by an opponent, to promote your side's lower cards into winners.",
    "tenace":"Two non-touching honours such as A-Q or K-J, worth an extra trick if led toward so the missing honour is trapped.",
    "entry":"A card that wins a trick in a particular hand, letting declarer reach that hand to lead from it — often needed to take a finesse from the right side.",
    "contract":"The final bid: how many tricks the declaring side must win, and in which strain.",
    "auction":"The bidding, in which the four players compete to name the contract.",
    "level":"The number in a bid; add six to get the tricks required (4♠ = 6 + 4 = 10 tricks).",
    "opening bid":"The first bid that names a suit or no-trump. It shows about 12 or more points (or a good long suit) and begins describing the hand to partner.",
    "negative double":"A double by responder after partner opens and the next opponent overcalls. It is for takeout — showing the unbid major(s) with enough values to compete — not for penalty.",
    "Jacoby transfer":"A response to 1NT that names the suit just below your real major (2♦ shows hearts, 2♥ shows spades). Opener bids your suit, so the strong hand becomes declarer and stays hidden.",
    "reverse":"Opener's rebid of a new, higher-ranking suit at the two level (e.g. 1♦ then 2♥). It forces partner to the three level to give preference, so it promises extra strength — about 17+ points.",
    "limit raise":"A jump raise of partner's suit (e.g. 1♥–3♥) showing roughly 10–11 points with a fit. It is invitational to game, not forcing.",
    "single raise":"Raising partner's suit by one level (e.g. 1♥–2♥), showing a fit and about 6–10 points.",
    "Michaels":"A cuebid of the opponent's opening suit that shows a two-suiter — both majors over a minor, or the other major plus a minor over a major (at least 5-5).",
    "unusual notrump":"A jump to 2NT over an opponent's opening showing at least 5-5 in the two lowest unbid suits — usually the two minors.",
    "Cappelletti":"A set of overcalls for competing against an opponent's 1NT opening: double shows a strong balanced hand, and the two-level bids show one- or two-suited hands.",
    "Jordan":"A 2NT response over an opponent's takeout double of partner's major, showing a limit raise or better (10+ points with support). It lets a direct raise be merely competitive.",
    "fourth suit forcing":"When three suits have been bid, bidding the fourth is artificial and forcing. It doesn't promise that suit — it asks partner for more, often a stopper for no-trump.",
    "forcing":"A bid partner is not allowed to pass. The partnership must keep bidding until the message is complete.",
    "game-forcing":"A bid that commits the partnership to reach at least game — the auction cannot stop in a part-score.",
    "Gerber":"A 4♣ bid that asks partner how many aces they hold, used mainly after a no-trump bid to explore slam.",
    "cuebid":"A bid of a suit an opponent has bid. It is artificial and forcing — used to show a big hand, a two-suiter (see Michaels), or a fit plus a control.",
    "Jacoby 2NT":"A 2NT response to partner's 1-of-a-major opening showing a game-forcing raise with four-card support, asking opener to describe shape.",
    "control bid":"Bidding a suit where you hold first- or second-round control (an ace or void, a king or singleton) on the way to slam, to show partner where your strength lies.",
    "trick":"One card played by each of the four players in turn. Thirteen tricks are contested each deal; the highest trump — or the highest card of the led suit — wins.",
    "follow suit":"Playing a card of the suit that was led. You must follow suit if you can; only when void may you discard or ruff.",
    "led suit":"The suit of the first card played to a trick. Everyone must follow it if able.",
    "artificial":"A bid whose meaning is conventional rather than natural — it doesn't promise the suit named (e.g. Stayman, a transfer, or fourth suit forcing).",
    "invitational":"A bid inviting partner to bid game with a little extra, but allowing them to pass with a minimum. Not forcing.",
    "shortage":"A short holding — a void (none), singleton (one) or doubleton (two) — which adds ruffing value when partner has a fit.",
    "tenace":"Two high cards with a gap, such as A-Q or K-J. Led toward, a tenace can trap a missing honour and win an extra trick by finesse.",
    "top trick":"A sure winner you can cash at once without giving up the lead. Counting these is the first step of the plan.",
    "establish":"To develop extra winners in a suit — by knocking out the defenders' higher cards or exhausting the suit — until your remaining cards are good.",
    "establishment":"Developing a suit until your lower cards become winners, by forcing out higher cards or running the suit once it breaks.",
    "ruffing":"Trumping a loser to win a trick; the extra tricks come from ruffing in the hand with fewer trumps, usually dummy.",
    "hold-up":"Refusing to win an early trick — typically declining to take an ace — to cut the defenders' link in that suit.",
    "unblock":"Playing or overtaking the high cards from the short hand first so a long suit does not get stuck with its winners out of reach.",
    "promote":"To turn a lower card into a winner by driving out the higher cards that beat it.",
    "promotion":"Turning a lower card into a winner by forcing out the cards that outrank it.",
    "length":"Extra tricks from a long suit: once the other players are void in it, your remaining low cards win by default.",
    "long card":"A low card that becomes a winner once every other player is out of the suit.",
    "entry":"A card that wins a trick in a particular hand, giving you access to that hand's winners.",
    "entries":"Cards that let you reach a particular hand to cash its winners; managing entries is central to any plan.",
    "loser":"A card that will lose a trick because the defenders still hold higher ones.",
    "winner":"A card that will win its trick — either a top card or one you have established.",
    "cover":"Playing a higher honour on an opponent's honour, to promote your side's lower cards — \"cover an honour with an honour.\"",
    "duck":"Deliberately playing low and letting the opponents win a trick you could take, for timing or to preserve communication.",
    "overtake":"Playing a higher card on your side's own winner to gain the lead in the hand you need next, often to unblock or reach length.",
    "drop":"Felling a missing honour by cashing top cards so it falls under them — the alternative to taking a finesse.",
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
function Card({c,faceDown,onClick,disabled,selected,suggested,small}){
  if(faceDown) return <div onClick={onClick} className={"brback"+(small?" sm":"")} style={{cursor:onClick?"pointer":"default"}}/>;
  const g=SUIT_GLYPH[c.suit];
  const cls=["brcard",suitClass(c.suit),small?"sm":"",selected?"sel":"",suggested?"sug":"",
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
  return <span className={"chip bid"+(big?" big":"")}>{c.level}<b className={suitColorClass(c.strain)}>{STRAIN_GLYPH[c.strain]}</b></span>;
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
  const sug = suggestion;
  const sugKey = sug ? (sug.k==="B"?`${sug.level}${sug.strain}`:sug.k) : null;
  const sugLevel = sug && sug.k==="B" ? sug.level : null;
  const bidLegal=(L,st)=>AUC.callLegal({k:"B",level:L,strain:st}, s.calls, s.dealer);
  const legalLevels=[1,2,3,4,5,6,7].filter(L=>STRAIN_ORDER.some(st=>bidLegal(L,st)));
  const [lvl,setLvl]=React.useState(null);
  const curLvl = (lvl!=null && legalLevels.includes(lvl)) ? lvl
    : (sugLevel && legalLevels.includes(sugLevel)) ? sugLevel : legalLevels[0];
  const canDbl = AUC.callLegal({k:"D"}, s.calls, s.dealer);
  const canRdbl= AUC.callLegal({k:"R"}, s.calls, s.dealer);
  return (
    <div className="bidbox2">
      <div className="bb-levels">
        {[1,2,3,4,5,6,7].map(L=>(
          <button key={L} disabled={!legalLevels.includes(L)}
            className={"bb-lv"+(L===curLvl?" on":"")+(sugLevel===L?" sug":"")}
            onClick={()=>setLvl(L)}>{L}</button>
        ))}
      </div>
      <div className="bb-strains">
        {STRAIN_ORDER.map(st=>{
          const ok=curLvl!=null && bidLegal(curLvl,st);
          return <button key={st} disabled={!ok}
            className={"bb-st "+(suitColorClass(st)||"nt")+(sugKey===`${curLvl}${st}`?" sug":"")}
            onClick={()=>dispatch({type:"BID", seat, call:{k:"B",level:curLvl,strain:st}})}>{STRAIN_GLYPH[st]}</button>;
        })}
      </div>
      <div className="bb-acts">
        <button className={"bb-act"+(sugKey==="P"?" sug":"")} onClick={()=>dispatch({type:"BID", seat, call:{k:"P"}})}>Pass</button>
        <button className={"bb-act"+(sugKey==="D"?" sug":"")} disabled={!canDbl} onClick={()=>dispatch({type:"BID", seat, call:{k:"D"}})}>Double</button>
        <button className={"bb-act"+(sugKey==="R"?" sug":"")} disabled={!canRdbl} onClick={()=>dispatch({type:"BID", seat, call:{k:"R"}})}>Redbl</button>
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
function HandRow({hand, onPlay, legalIds, selectable, label, faceDown, count, sugId}){
  const cards=sortHandDisplay(hand||[]);
  return (
    <div className="handblock">
      {label && <div className="hlabel lbl2">{label}{count!=null?` · ${count}`:""}</div>}
      <div className="hand">
        {faceDown
          ? Array.from({length:count||cards.length}).map((_,i)=><Card key={i} faceDown small/>)
          : cards.map(c=>{
              const ok=!legalIds || legalIds.has(c.id);
              return <Card key={c.id} c={c} small={label!=="You"} suggested={sugId===c.id}
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
/* Colorize bare suit glyphs in running text to match the four-colour deck: spades blue,
   hearts red, diamonds gold, clubs green. Returns an array of strings and colored spans. */
function suitColorClass(suit){ return suit==="S"?"gsp":suit==="H"?"ghe":suit==="D"?"gdi":suit==="C"?"gcl":""; }
function colorizeSuits(str, kp){
  if(!str || typeof str!=="string") return [str];
  if(!/[\u2660\u2665\u2666\u2663]/.test(str)) return [str];
  const out=[]; let last=0, m; const re=/[\u2660\u2665\u2666\u2663]\uFE0E?/g;
  const clsOf={"\u2660":"gsp","\u2665":"ghe","\u2666":"gdi","\u2663":"gcl"};
  while((m=re.exec(str))){
    if(m.index>last) out.push(str.slice(last,m.index));
    out.push(<span key={(kp||"s")+m.index} className={clsOf[m[0][0]]}>{m[0]}</span>);
    last=m.index+m[0].length;
  }
  if(last<str.length) out.push(str.slice(last));
  return out;
}
function linkifyGlossary(text, gloss, onTap){
  const keys=Object.keys(gloss||{}); if(!keys.length || !text) return colorizeSuits(text,"c");
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const ordered=keys.slice().sort((a,b)=>b.length-a.length);
  let re; try{ re=new RegExp("\\b("+ordered.map(esc).join("|")+")(es|s)?\\b","gi"); }catch(_){ return colorizeSuits(text,"c"); }
  const out=[]; let last=0,m; const seen=new Set();
  while((m=re.exec(text))){
    const whole=m[0], start=m.index, base=m[1].toLowerCase();
    const key=ordered.find(k=>k.toLowerCase()===base);
    if(!key || seen.has(key)) continue;
    seen.add(key);
    if(start>last) out.push(...colorizeSuits(text.slice(last,start),"a"+start));
    out.push(<span key={start} className="gloss-term" onClick={(e)=>{e.stopPropagation();onTap(key);}}>{colorizeSuits(whole,"g"+start)}</span>);
    last=start+whole.length;
  }
  if(last<text.length) out.push(...colorizeSuits(text.slice(last),"z"+last));
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
.brcard.sug{border-color:var(--green);box-shadow:0 0 0 2px var(--green),0 0 12px color-mix(in srgb,var(--green) 55%,transparent);transform:translateY(calc(-9px*var(--k)));}
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
.br .bidbox2{border:1px solid var(--line);padding:7px;display:flex;flex-direction:column;gap:5px;}
.br .bb-levels{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.br .bb-lv{font:inherit;font-size:14px;font-weight:800;padding:8px 0;background:transparent;color:var(--ink);border:1px solid var(--line);cursor:pointer;transition:background .08s;}
.br .bb-lv.on{background:var(--ink);color:var(--bg);border-color:var(--ink);}
.br .bb-lv.sug{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green);}
.br .bb-lv:disabled{opacity:.2;cursor:default;}
.br .bb-strains{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;}
.br .bb-st{font:inherit;font-size:21px;font-weight:700;line-height:1;padding:9px 0;background:transparent;color:var(--ink);border:1px solid var(--line);cursor:pointer;}
.br .bb-st.gsp{color:var(--sp);} .br .bb-st.ghe{color:var(--he);} .br .bb-st.gdi{color:var(--di);} .br .bb-st.gcl{color:var(--cl);}
.br .bb-st:disabled{opacity:.2;cursor:default;}
.br .bb-st.sug{border-color:var(--green);box-shadow:0 0 0 2px var(--green);}
.br .bb-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:1px;}
.br .bb-act{font:inherit;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:8px 0;background:transparent;color:var(--ink);border:1px solid var(--line);cursor:pointer;}
.br .bb-act:disabled{opacity:.24;cursor:default;}
.br .bb-act.sug{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green);}
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
.br .hand{display:flex;flex-wrap:nowrap;justify-content:center;align-items:flex-start;min-height:44px;padding-top:calc(11px*var(--k));}
.br .hand .brcard{margin-left:calc(-27px*var(--k));transition:transform .1s;}
.br .hand .brcard.sm{margin-left:calc(-18px*var(--k));}
.br .hand .brcard:first-child{margin-left:0;}
.br .hand .brcard.clk:hover{transform:translateY(calc(-11px*var(--k)));z-index:20;}
.br .hand .brcard.sel,.br .hand .brcard.sug{z-index:18;}
.br .youhand .hand{min-height:74px;}
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
.br .gsp{color:var(--sp);} .br .ghe{color:var(--he);} .br .gdi{color:var(--di);} .br .gcl{color:var(--cl);}
.br .lrn-l-mod{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:3px;}
.br .lrn-l-body{margin:8px 0 4px;}
.br .lrn-l-para{font-size:12px;line-height:1.62;color:var(--ink);margin:0 0 10px;}
.br .lrn-xref{color:var(--rule);border-bottom:1px dotted var(--rule);cursor:pointer;font-style:italic;}
.br .lrn-nav{display:flex;gap:8px;margin-top:16px;border-top:1px solid var(--line2);padding-top:10px;}
.br .lrn-nav-b{flex:1;font:inherit;font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--ink);background:transparent;border:1px solid var(--line);padding:8px 10px;cursor:pointer;text-align:left;line-height:1.3;}
.br .lrn-nav-b.right{text-align:right;}
.br .lrn-nav-b:disabled{opacity:0;cursor:default;}
.br .lrn-hist{display:flex;gap:2px;margin-right:8px;}
.br .lrn-hb{font:inherit;font-size:16px;line-height:1;font-weight:700;width:26px;height:24px;padding:0;color:var(--ink);background:transparent;border:1px solid var(--line);cursor:pointer;}
.br .lrn-hb:disabled{opacity:.3;cursor:default;}
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

/* ---- help drawer (table talk) ---- */
.br .dl-tab{position:fixed;top:50%;right:0;transform:translateY(-50%);z-index:40;display:flex;align-items:center;gap:5px;
  writing-mode:vertical-rl;font:inherit;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;
  background:linear-gradient(180deg,var(--pink),var(--purple));color:#1a1205;border:0;border-radius:8px 0 0 8px;
  padding:12px 5px;cursor:pointer;box-shadow:-2px 0 10px rgba(0,0,0,.35);}
.br .dl-tab.open{right:min(360px,86vw);}
.br .dl-tab .dl-tab-l{writing-mode:vertical-rl;}
.br .help-drawer{position:fixed;top:0;right:0;height:100vh;width:min(360px,86vw);z-index:39;display:flex;flex-direction:column;
  background:color-mix(in srgb,var(--bg) 82%,#000);border-left:1px solid var(--line);box-shadow:-8px 0 26px rgba(0,0,0,.45);
  transform:translateX(101%);transition:transform .28s cubic-bezier(.4,.0,.2,1);}
.br .help-drawer.open{transform:translateX(0);}
.br .dl-top{display:flex;align-items:center;justify-content:space-between;padding:12px 13px;border-bottom:1px solid var(--line);flex:0 0 auto;}
.br .dl-title{font-size:11px;font-weight:800;letter-spacing:.24em;background:linear-gradient(92deg,var(--pink),var(--purple) 55%,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
.br .dl-x{font:inherit;font-size:20px;line-height:1;background:transparent;border:0;color:var(--dim);cursor:pointer;padding:0 4px;}
.br .dl-scroll{flex:1 1 auto;overflow-y:auto;padding:10px 12px 26px;-webkit-overflow-scrolling:touch;}
.br .dl-head{font-size:9px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:12px 0 7px;padding-bottom:4px;border-bottom:1px solid var(--line2);}
.br .dl-head:first-child{margin-top:0;}
/* a bidding line: seat badge (side-coloured), the call (suit-coloured), the meaning */
.br .dl-call{display:grid;grid-template-columns:22px 34px 1fr;gap:7px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.045);line-height:1.4;}
.br .dl-seat{font-size:9px;font-weight:800;letter-spacing:.05em;text-align:center;border-radius:4px;padding:2px 0;}
.br .dl-call.us .dl-seat{color:var(--cyan);background:color-mix(in srgb,var(--cyan) 15%,transparent);}
.br .dl-call.them .dl-seat{color:var(--pink);background:color-mix(in srgb,var(--pink) 15%,transparent);}
.br .dl-bid{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap;}
.br .dl-bid.red{color:var(--pink);}
.br .dl-txt{font-size:11.5px;color:var(--ink);opacity:.92;}
.br .tagpill{display:inline-block;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:1px 5px;border-radius:9px;margin-left:5px;vertical-align:1px;}
.br .tagpill.conv{color:var(--purple);border:1px solid color-mix(in srgb,var(--purple) 55%,transparent);}
.br .tagpill.force{color:var(--cyan);border:1px solid color-mix(in srgb,var(--cyan) 45%,transparent);}
.br .tagpill.infer{color:var(--dim);border:1px solid var(--line2);}
.br .dl-call.inf .dl-txt{font-style:italic;opacity:.7;}
.br .dl-call.inf .dl-bid{opacity:.6;}
/* partner snapshot */
.br .dl-snap{margin:11px 0 4px;padding:10px 11px;border:1px solid var(--line2);border-radius:10px;background:color-mix(in srgb,var(--cyan) 7%,transparent);}
.br .dl-snap-h{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);margin-bottom:6px;}
.br .dl-snap-row{display:flex;justify-content:space-between;align-items:baseline;padding:2px 0;font-size:12px;}
.br .dl-snap-row span{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);}
.br .dl-snap-row b{color:var(--ink);letter-spacing:.04em;}
/* play log */
.br .dl-trick{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);align-items:start;}
.br .dl-trick.live{grid-template-columns:1fr;}
.br .dl-trick-body{min-width:0;}
.br .dl-play{font-size:11px;color:var(--ink);opacity:.9;padding:1.5px 0;display:flex;gap:6px;align-items:baseline;}
.br .dl-play .dl-seat.sm{width:18px;font-size:8.5px;padding:1px 0;flex:0 0 auto;}
.br .dl-play.us{}
.br .dl-play.win{color:var(--green);font-weight:600;opacity:1;}
.br .dl-trick-sum{font-size:10.5px;color:var(--purple);font-weight:700;margin-top:4px;letter-spacing:.02em;}
.br .dl-live-h,.br .dl-hint-h{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:4px;}
/* mini trick diagram — diamond layout, small white cards */
.br .minitrick{display:grid;grid-template-columns:repeat(3,20px);grid-template-rows:repeat(3,26px);gap:1px;
  grid-template-areas:". top ." "left num right" ". bottom .";align-items:center;justify-items:center;}
.br .mt-slot{display:flex;flex-direction:column;align-items:center;gap:1px;}
.br .mt-slot.top{grid-area:top;} .br .mt-slot.left{grid-area:left;} .br .mt-slot.right{grid-area:right;} .br .mt-slot.bottom{grid-area:bottom;}
.br .mt-num{grid-area:num;font-size:8px;color:var(--dim);font-weight:700;}
.br .mcard{width:19px;height:23px;border-radius:3px;background:#f7f4ea;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,.4);}
.br .mcard.empty{background:transparent;box-shadow:none;border:1px dashed var(--line2);}
.br .mcard.win{outline:2px solid var(--green);outline-offset:1px;}
.br .mcard .mr{font-size:9px;font-weight:800;color:inherit;}
.br .mcard .ms{font-size:8px;color:inherit;margin-top:.5px;}
.br .mcard{color:#1a1a1a;}
.br .mcard.gsp{color:#1c6fd4;} .br .mcard.ghe{color:#b3232a;} .br .mcard.gdi{color:#b8860b;} .br .mcard.gcl{color:#1c7a3f;}
.br .mt-seat{font-size:7.5px;letter-spacing:.04em;color:var(--dim);font-weight:700;}
.br .mt-seat.win{color:var(--green);}
/* your-turn hint */
.br .dl-hint{margin:12px 0 4px;padding:10px 11px;border:1px solid color-mix(in srgb,var(--green) 40%,transparent);border-radius:10px;background:color-mix(in srgb,var(--green) 8%,transparent);}
.br .dl-hint-h{color:var(--green);}
.br .dl-hint-b{font-size:11.5px;color:var(--ink);line-height:1.45;}
.br .dl-empty{font-size:11.5px;color:var(--dim);line-height:1.5;padding:20px 4px;}
.br .dl-scroll .gloss-term{color:var(--yellow);border-bottom:1px dotted color-mix(in srgb,var(--yellow) 60%,transparent);cursor:pointer;}

/* ---- learn: lesson browser + drills ---- */
.br .lrn-open-btn{display:block;width:100%;margin-top:12px;font:inherit;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  padding:13px;border-radius:11px;border:0;cursor:pointer;color:#1a1205;background:linear-gradient(92deg,var(--pink),var(--purple) 55%,var(--cyan));}
.br .lrn-mini{font:inherit;font-size:8.5px;font-weight:800;letter-spacing:.1em;background:transparent;border:1px solid var(--line);color:var(--purple);border-radius:6px;padding:4px 7px;cursor:pointer;}
.br .lrn-overlay{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:var(--bg);}
.br .lrn-top{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;border-bottom:1px solid var(--line);flex:0 0 auto;}
.br .lrn-title{font-size:13px;font-weight:800;letter-spacing:.22em;background:linear-gradient(92deg,var(--pink),var(--purple) 55%,var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
.br .lrn-scroll{flex:1 1 auto;overflow-y:auto;padding:14px 15px 40px;max-width:640px;width:100%;margin:0 auto;-webkit-overflow-scrolling:touch;}
.br .lrn-intro{font-size:12px;color:var(--dim);line-height:1.55;margin-bottom:16px;}
.br .lrn-module{margin-bottom:16px;}
.br .lrn-mod-h{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--purple);margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--line2);}
.br .lrn-lrow{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;font:inherit;text-align:left;
  background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,.05);padding:9px 2px;cursor:pointer;color:var(--ink);}
.br .lrn-lrow-t{font-size:13px;}
.br .lrn-badge{font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:9px;flex:0 0 auto;}
.br .lrn-badge.drill{color:var(--cyan);border:1px solid color-mix(in srgb,var(--cyan) 45%,transparent);}
.br .lrn-badge.read{color:var(--dim);border:1px solid var(--line2);}
.br .lrn-back{font:inherit;font-size:11px;font-weight:700;letter-spacing:.05em;background:transparent;border:0;color:var(--purple);cursor:pointer;padding:0 0 10px;}
.br .lrn-l-title{font-size:19px;font-weight:800;color:var(--ink);margin:2px 0 4px;letter-spacing:.01em;}
.br .lrn-l-ref{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:12px;}
.br .lrn-l-teach{font-size:14px;line-height:1.62;color:var(--ink);opacity:.95;}
.br .lrn-l-teach .gloss-term{color:var(--yellow);border-bottom:1px dotted color-mix(in srgb,var(--yellow) 60%,transparent);cursor:pointer;}
.br .lrn-teachonly{margin-top:16px;font-size:12px;color:var(--dim);font-style:italic;line-height:1.5;}
.br .lrn-btn{font:inherit;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:11px 16px;border-radius:10px;border:0;cursor:pointer;color:#1a1205;background:linear-gradient(92deg,var(--purple),var(--cyan));margin-top:14px;}
.br .lrn-btn.big{display:block;width:100%;margin-top:22px;padding:14px;}
.br .lrn-btn.ghost{background:transparent;color:var(--dim);border:1px solid var(--line);margin-left:8px;}
/* drill */
.br .lrn-drill-top{display:flex;align-items:center;justify-content:space-between;}
.br .lrn-score{font-size:12px;color:var(--dim);letter-spacing:.05em;}
.br .lrn-contract{font-size:12.5px;color:var(--ink);margin:8px 0 4px;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:color-mix(in srgb,var(--purple) 7%,transparent);}
.br .lrn-auction{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0;}
.br .lrn-acall{display:inline-flex;gap:4px;align-items:baseline;font-size:11px;border:1px solid var(--line2);border-radius:6px;padding:3px 7px;}
.br .lrn-acall .s{font-size:8px;font-weight:800;letter-spacing:.05em;color:var(--dim);}
.br .lrn-acall.us .s{color:var(--cyan);} .br .lrn-acall.them .s{color:var(--pink);}
.br .lrn-acall .b{font-weight:800;color:var(--ink);} .br .lrn-acall .b.red{color:var(--pink);}
.br .lrn-yourhand-l,.br .lrn-prompt{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:14px 0 6px;}
.br .lrn-prompt{color:var(--ink);font-size:14px;letter-spacing:0;text-transform:none;font-weight:700;margin:16px 0 10px;}
.br .lrn-scenario{color:var(--ink);font-size:13px;line-height:1.5;background:var(--panel,rgba(255,255,255,.04));border-left:2px solid var(--line);padding:10px 12px;border-radius:6px;margin:12px 0 4px;}
.br .lrn-hand{padding:8px 6px;border:1px solid var(--line2);border-radius:10px;background:rgba(0,0,0,.14);}
.br .lrn-decldummy{display:flex;flex-direction:column;gap:2px;}
.br .lrn-decldummy .lrn-yourhand-l:first-of-type{margin-top:4px;}
.br .lrn-suit{display:flex;gap:3px;flex-wrap:wrap;}
.br .lrn-choices{display:flex;flex-wrap:wrap;gap:8px;}
.br .lrn-choice{font:inherit;font-size:15px;font-weight:800;min-width:52px;padding:11px 12px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--ink);cursor:pointer;}
.br .lrn-choice.red{color:var(--pink);}
.br .lrn-choice:disabled{cursor:default;}
.br .lrn-choice.correct{border-color:var(--green);background:color-mix(in srgb,var(--green) 18%,transparent);color:var(--green);}
.br .lrn-choice.wrong{border-color:var(--pink);background:color-mix(in srgb,var(--pink) 16%,transparent);}
.br .lrn-reveal{margin-top:16px;padding:13px;border-radius:11px;border:1px solid var(--line2);}
.br .lrn-reveal.ok{border-color:color-mix(in srgb,var(--green) 45%,transparent);background:color-mix(in srgb,var(--green) 8%,transparent);}
.br .lrn-reveal.no{border-color:color-mix(in srgb,var(--pink) 40%,transparent);background:color-mix(in srgb,var(--pink) 7%,transparent);}
.br .lrn-verdict{font-size:13px;font-weight:800;color:var(--ink);margin-bottom:6px;}
.br .lrn-reveal.ok .lrn-verdict{color:var(--green);} .br .lrn-reveal.no .lrn-verdict{color:var(--pink);}
.br .lrn-why{font-size:13px;line-height:1.55;color:var(--ink);opacity:.94;}
.br .lrn-why .gloss-term{color:var(--yellow);border-bottom:1px dotted color-mix(in srgb,var(--yellow) 60%,transparent);cursor:pointer;}
.br .lrn-fail{font-size:13px;color:var(--dim);margin-bottom:10px;}
`;



/* =======================================================================
   APP
   ===================================================================== */
/* ======================================================================
   HELP DRAWER — a live, linkified, colourful explanation of the whole game.
   ====================================================================== */
const DW_SUIT={S:"spades",H:"hearts",D:"diamonds",C:"clubs",NT:"notrump"};
const dwMajor=(s)=>s==="H"||s==="S", dwMinor=(s)=>s==="C"||s==="D";
const DW_RANK={C:0,D:1,H:2,S:3};
const DW_TERMS=["opening bid","overcall","takeout double","penalty double","negative double","Stayman",
  "Jacoby transfer","transfer","weak two","preempt","reverse","limit raise","single raise","Blackwood","Gerber",
  "Michaels","unusual notrump","Cappelletti","Jordan","fourth suit forcing","balanced","stopper","support","fit",
  "forcing","game-forcing","slam","redouble"];
const dwTag=(t)=>DW_TERMS.filter(x=>t.toLowerCase().includes(x.toLowerCase()));
const dwD=(meaning,o={})=>({meaning,points:o.points||null,lengths:o.lengths||null,artificial:!!o.artificial,forcing:!!o.forcing,inferred:!!o.inferred,terms:dwTag(meaning)});
function dwOpeningOf(ctx){ return ctx.openerSeat>=0 ? (ctx.by[ctx.openerSeat]||[]).find(c=>c.k==="B")||null : null; }
function describeCall(priorCalls, dealer, seat, call){
  let ctx; try{ ctx=BID.context(priorCalls,dealer,seat); }catch(_){ return dwD(callLabel(call)+"."); }
  const S=call.strain, L=call.level;
  const nobody=ctx.openerSeat===-1;
  const partnerOpen=ctx.partnerBids && ctx.partnerBids.find(c=>c.k==="B");
  const opening=dwOpeningOf(ctx);
  if(call.k==="P"){
    // a pass has no agreed meaning — these are honest inferences, not known facts.
    // (the point bounds are kept only to inform the partner snapshot, never shown as
    //  a number for an opponent.)
    if(nobody) return dwD("No opening bid \u2014 suggests fewer than opening values.",{points:[0,11],inferred:true});
    if(ctx.openerSeat===ctx.partner) return dwD("Doesn't respond \u2014 suggests too few points to look for game.",{points:[0,5],inferred:true});
    if(ctx.openerSeat===seat) return dwD("Nothing more to add.");
    return dwD("No suit or values worth competing here.",{inferred:true});
  }
  if(call.k==="D"){
    const lb=ctx.info.lastBid;
    if(opening && opening.strain==="NT") return dwD("A balanced 15+ hand \u2014 equal to their notrump (Cappelletti double).",{points:[15,40]});
    if(ctx.partnerOpened && ctx.rhoBids && ctx.rhoBids.some(c=>c.k==="B")) return dwD("Negative double \u2014 shows the unbid major(s) with values.",{forcing:true,points:[6,40]});
    if(!ctx.partnerOpened && lb && lb.level<=2 && lb.strain!=="NT") return dwD("Takeout double \u2014 opening values, short in "+DW_SUIT[lb.strain]+", and support for the unbid suits.",{points:[12,40]});
    return dwD("Penalty double \u2014 expects to defeat this contract.");
  }
  if(call.k==="R"){ return ctx.partnerOpened ? dwD("Redouble \u2014 10+ points; this hand belongs to our side.",{points:[10,40]}) : dwD("Redouble \u2014 confident of making the doubled contract."); }
  if(nobody){
    if(S==="NT") return L===1?dwD("Opening bid: balanced, 15\u201317.",{points:[15,17]}):L===2?dwD("Opening bid: balanced, 20\u201321.",{points:[20,21]}):dwD("Opening bid: balanced, 25\u201327.",{points:[25,27]});
    if(L===2&&S==="C") return dwD("Opening bid: 22+ points \u2014 artificial and game-forcing.",{points:[22,40],artificial:true,forcing:true});
    if(L===2) return dwD("Weak two: a six-card "+DW_SUIT[S]+" suit, 5\u201311 points.",{points:[5,11],lengths:{[S]:6}});
    if(L>=3) return dwD("Preempt: a "+(L+4)+"-card "+DW_SUIT[S]+" suit, weak.",{points:[0,10],lengths:{[S]:L+4}});
    if(dwMajor(S)) return dwD("Opening bid: five or more "+DW_SUIT[S]+", about 12\u201321 points.",{points:[12,21],lengths:{[S]:5}});
    return dwD("Opening bid: "+(S==="D"?"four or more diamonds (sometimes three)":"three or more clubs")+", 12\u201321 points.",{points:[12,21],lengths:{[S]:3}});
  }
  if(ctx.openerSeat===seat){
    const myOpen=(ctx.by[seat]||[]).find(c=>c.k==="B");
    if(myOpen && S!=="NT" && S!==myOpen.strain && L===2 && DW_RANK[S]>DW_RANK[myOpen.strain]) return dwD("A reverse \u2014 a higher new suit showing extra values (about 17+), forcing.",{points:[17,40],forcing:true,lengths:{[S]:4}});
    if(S==="NT") return L===1?dwD("Rebid: balanced 12\u201314.",{points:[12,14]}):L===2?dwD("Rebid: balanced 18\u201319.",{points:[18,19]}):dwD("Rebid: balanced, extra strength.");
    if(myOpen && S===myOpen.strain) return dwD("Rebids "+DW_SUIT[S]+" \u2014 usually a six-card suit.",{lengths:{[S]:6}});
    if(S!=="NT") return dwD("A second suit in "+DW_SUIT[S]+" \u2014 13\u201318 points.",{points:[13,18],lengths:{[S]:4}});
  }
  if(ctx.openerSeat===ctx.partner){
    const ourSuits=new Set([...(ctx.myBids||[]),...(ctx.partnerBids||[])].filter(c=>c.k==="B"&&c.strain!=="NT").map(c=>c.strain));
    if(S!=="NT" && L>=2 && ourSuits.size===3 && !ourSuits.has(S)) return dwD("Fourth suit forcing \u2014 artificial and game-forcing, asking opener for more (often a stopper for notrump).",{artificial:true,forcing:true});
    if(partnerOpen && partnerOpen.strain==="NT" && partnerOpen.level===1){
      if(S==="C"&&L===2) return dwD("Stayman \u2014 asks whether opener holds a four-card major (usually 8+).",{artificial:true,points:[8,40]});
      if((S==="D"||S==="H")&&L===2) return dwD("Jacoby transfer \u2014 shows five or more "+DW_SUIT[S==="D"?"H":"S"]+".",{artificial:true,lengths:{[S==="D"?"H":"S"]:5}});
      if(S==="S"&&L===2) return dwD("A weak hand with a long minor \u2014 a puppet to 3\u2663 (pass or correct to 3\u2666).",{artificial:true,points:[0,7]});
      if(S==="NT"&&L===2) return dwD("Invitational \u2014 a balanced 8\u20139.",{points:[8,9]});
      if(S==="NT"&&L===3) return dwD("To play game \u2014 a balanced 10\u201315.",{points:[10,15]});
      if(S==="C"&&L===4) return dwD("Gerber \u2014 asks for aces.",{artificial:true});
    }
    if(S==="NT"&&L===4) return dwD("Blackwood \u2014 asks how many aces partner holds.",{artificial:true});
    if(partnerOpen && partnerOpen.strain===S && S!=="NT"){
      if(L===partnerOpen.level+1) return dwD("Single raise \u2014 "+(dwMajor(S)?"three or more":"four or more")+" "+DW_SUIT[S]+", 6\u201310 points.",{points:[6,10],lengths:{[S]:dwMajor(S)?3:4}});
      if(L===partnerOpen.level+2) return dwD("Limit raise \u2014 10\u201311 points with "+(dwMajor(S)?"three or more":"five or more")+" "+DW_SUIT[S]+".",{points:[10,11],lengths:{[S]:dwMajor(S)?3:5}});
      return dwD("Raise to game in "+DW_SUIT[S]+" \u2014 a fit with shape, usually under 10 high-card points.",{lengths:{[S]:dwMajor(S)?4:5}});
    }
    if(S==="NT"&&L===2 && partnerOpen && dwMajor(partnerOpen.strain)) return dwD("Jacoby 2NT \u2014 a game-forcing raise asking opener to show a shortage.",{artificial:true,forcing:true,points:[13,40],lengths:{[partnerOpen.strain]:4}});
    if(S==="NT") return L===1?dwD("6\u20139 points, no fit and no suit to show at the one level.",{points:[6,9]}):L===2?dwD("Invitational \u2014 balanced 13\u201315 with stoppers.",{points:[13,15]}):dwD("To play \u2014 balanced 16\u201318 with stoppers.",{points:[16,18]});
    if(L===1) return dwD("A new suit: four or more "+DW_SUIT[S]+", 6+ points, forcing.",{forcing:true,points:[6,40],lengths:{[S]:4}});
    if(L===2) return dwD("A new suit at the two level: five or more "+DW_SUIT[S]+" (or four+ if a minor), 10+ points, forcing.",{forcing:true,points:[10,40],lengths:{[S]:dwMinor(S)?4:5}});
    return dwD("A new suit in "+DW_SUIT[S]+", forcing.",{forcing:true});
  }
  if(opening){
    if(opening.strain!=="NT" && S===opening.strain && L===2) return dwMinor(opening.strain)?dwD("Michaels cuebid \u2014 five or more in each major.",{lengths:{H:5,S:5}}):dwD("Michaels cuebid \u2014 the other major (5+) and a five-card minor.",{lengths:{[opening.strain==="H"?"S":"H"]:5}});
    if(S==="NT" && L===2 && opening.strain!=="NT"){ const low=["C","D","H","S"].filter(x=>x!==opening.strain).slice(0,2); return dwD("Unusual notrump \u2014 five or more in "+DW_SUIT[low[0]]+" and "+DW_SUIT[low[1]]+".",{lengths:{[low[0]]:5,[low[1]]:5}}); }
    if(opening.strain==="NT"){
      if(S==="D"&&L===2) return dwD("Cappelletti \u2014 five or more in each major.",{lengths:{H:5,S:5}});
      if(S==="H"&&L===2) return dwD("Cappelletti \u2014 hearts and an unspecified minor (5-5).",{lengths:{H:5}});
      if(S==="S"&&L===2) return dwD("Cappelletti \u2014 spades and an unspecified minor (5-5).",{lengths:{S:5}});
      if(S==="NT"&&L===2) return dwD("Cappelletti \u2014 five or more in each minor.",{lengths:{C:5,D:5}});
      if(S==="C"&&L===2) return dwD("Cappelletti \u2014 a one-suited hand (relay 2\u2666 to find the suit).",{artificial:true});
    }
    if(S==="NT"&&L===1) return dwD("Notrump overcall \u2014 15\u201318, balanced, with their suit stopped.",{points:[15,18]});
    const jump=ctx.info.lastBid && AUC.bidVal(call)>AUC.bidVal(ctx.info.lastBid)+5;
    if(jump && S!=="NT") return dwD("Weak jump overcall \u2014 a good "+(L>=3?"seven":"six")+"-card "+DW_SUIT[S]+" suit, preemptive.",{points:[5,10],lengths:{[S]:L>=3?7:6}});
    if(S!=="NT") return dwD("Overcall: a good five-card "+DW_SUIT[S]+" suit, roughly 8\u201316, suggesting the lead.",{points:[8,16],lengths:{[S]:5}});
  }
  return dwD(callLabel(call)+".");
}
function partnerProfile(calls, dealer, seat){
  const partner=(seat+2)%4;
  const prof={pointsMin:0,pointsMax:40,lengths:{},notes:[],acted:false};
  for(let i=0;i<calls.length;i++){ if(calls[i].by!==partner) continue;
    const d=describeCall(calls.slice(0,i),dealer,partner,calls[i]);
    if(calls[i].k!=="P") prof.acted=true;
    if(d.points){ prof.pointsMin=Math.max(prof.pointsMin,d.points[0]); prof.pointsMax=Math.min(prof.pointsMax,d.points[1]); }
    if(d.lengths) for(const su in d.lengths) prof.lengths[su]=Math.max(prof.lengths[su]||0,d.lengths[su]);
  }
  if(prof.pointsMin>prof.pointsMax) prof.pointsMin=Math.max(0,prof.pointsMax-3);
  return prof;
}
const PLAY_TAG = {
  F_ATT_HI:"attitude signal (encouraging)", F_ATT_LO:"attitude signal (discouraging)",
  F_CNT_HI:"count signal (even)", F_CNT_LO:"count signal (odd)",
  F_COVER:"cover an honour", F_HOLDUP:"hold-up", F_DUCK_HOLDUP:"defensive hold-up", F_HOLDUP_WIN:"win to strand", F_3RD_HIGH:"third hand high", F_FINESSE_WIN:"finesse",
  DECL_UNBLOCK:"unblock",   F_SPLIT:"split honours",   F_WIN_CHEAP:"wins cheaply", F_DUCK_PARTNER:"low \u2014 partner is winning", F_2ND_LOW:"second hand low",
  F_CANT:"low", DECL_DRAW:"drawing trumps", DECL_CASH:"cashing a winner", DECL_FINESSE:"finesse",
  DECL_RUFF:"setting up a ruff", DECL_RUFF_FIRST:"ruff before drawing", DECL_CROSS:"crossing to finesse",
  DECL_ESTABLISH:"establishing a suit", RUFF:"ruff", DISCARD:"discard",
  LEAD_SEQ:"top of a sequence", LEAD_4TH:"fourth best", LEAD_ACE:"ace lead", LEAD_LOW:"low lead", D_CONTINUE:"reading partner — continue their suit", D_RETURN:"return partner's suit", D_ROLLOUT:"rollout-chosen switch", ONLY:"forced",
};
function drawerCardRead(before, card, seat, ledSuit, trump, why){
  const nm=card.rank+SUIT_GLYPH[card.suit];
  const tag = why && PLAY_TAG[why.code] ? " \u2014 "+PLAY_TAG[why.code] : "";
  if(before.length===0) return {who:seat, text:"leads "+nm+tag, win:true, kind:"lead"};
  const cards=[...before.map(t=>({rank:t.card.rank,suit:t.card.suit,player:t.seat})),{rank:card.rank,suit:card.suit,player:seat}];
  const rr=ENG.resolveTrick(cards, ledSuit, trump); const win=rr.winner===seat;
  if(card.suit===ledSuit) return {who:seat, text:"follows with "+nm+(win?" \u2014 winning":"")+tag, win, kind:"follow"};
  if(trump!=="NT" && card.suit===trump) return {who:seat, text:"ruffs with "+nm+(win?" \u2014 winning":"")+tag, win, kind:"ruff"};
  return {who:seat, text:"discards "+nm+tag, win:false, kind:"discard"};
}
function MiniCard({card, win}){
  if(!card) return <div className="mcard empty"/>;
  return <div className={"mcard "+suitColorClass(card.suit)+(win?" win":"")}><span className="mr">{card.rank}</span><span className="ms">{SUIT_GLYPH[card.suit]}</span></div>;
}
function MiniTrick({t, focus}){
  const bottom=focus, top=partnerOf(focus), left=nextSeat(focus), right=(focus+3)%4;
  const cardBy=(seat)=>{ const x=t.trick.find(tc=>tc.seat===seat); return x?x.card:null; };
  const cell=(seat,pos)=>(
    <div className={"mt-slot "+pos} key={pos}>
      <MiniCard card={cardBy(seat)} win={t.winner===seat}/>
      <span className={"mt-seat"+(t.winner===seat?" win":"")}>{SEAT_ABBR[seat]}</span>
    </div>
  );
  return (
    <div className="minitrick">
      {cell(top,"top")}{cell(left,"left")}
      <div className="mt-num num">#{t.num}</div>
      {cell(right,"right")}{cell(bottom,"bottom")}
    </div>
  );
}
function HelpDrawer({s, focus, open, onToggle, onTapTerm, sug}){
  const gloss=getGlossary();
  const link=(text)=>linkifyGlossary(text, gloss, onTapTerm);
  const sideCls=(seat)=> sideOf(seat)===sideOf(focus) ? "us" : "them";
  const rows=[];
  const calls=s.calls||[];
  if(calls.length){
    rows.push(<div key="bh" className="dl-head">The auction</div>);
    for(let i=0;i<calls.length;i++){
      const c=calls[i]; const d=describeCall(calls.slice(0,i), s.dealer, c.by, c);
      const suit=c.k==="B"?c.strain:null;
      rows.push(
        <div key={"c"+i} className={"dl-call "+sideCls(c.by)+(d.inferred?" inf":"")}>
          <span className="dl-seat">{SEAT_ABBR[c.by]}</span>
          <span className={"dl-bid"+(suit&&(suit==="H"||suit==="D")?" red":"")}>{callLabel(c)}</span>
          <span className="dl-txt">{link(d.meaning)}{d.inferred?<span className="tagpill infer">inferred</span>:null}{d.artificial?<span className="tagpill conv">artificial</span>:null}{d.forcing?<span className="tagpill force">forcing</span>:null}</span>
        </div>
      );
    }
    const prof=partnerProfile(calls, s.dealer, focus);
    if(prof.acted){
      const lenTxt=Object.keys(prof.lengths).length?Object.entries(prof.lengths).sort((a,b)=>DW_RANK[b[0]]-DW_RANK[a[0]]).map(([su,n])=>n+"+ "+SUIT_GLYPH[su]).join("   "):"\u2014";
      rows.push(
        <div key="psnap" className="dl-snap">
          <div className="dl-snap-h">What we know about partner</div>
          <div className="dl-snap-row"><span>points</span><b className="num">{prof.pointsMin}–{prof.pointsMax}</b></div>
          <div className="dl-snap-row"><span>length</span><b>{lenTxt}</b></div>
        </div>
      );
    }
  }
  const th=s.trickHistory||[];
  if(th.length || (s.trick&&s.trick.length)){
    rows.push(<div key="ph" className="dl-head">The play</div>);
    for(const t of th){
      let before=[]; const lines=[];
      for(const tc of t.trick){ const r=drawerCardRead(before,tc.card,tc.seat,t.ledSuit,t.trump,tc.why); lines.push(r); before=[...before,tc]; }
      rows.push(
        <div key={"t"+t.num} className="dl-trick">
          <MiniTrick t={t} focus={focus}/>
          <div className="dl-trick-body">
            {lines.map((r,j)=><div key={j} className={"dl-play "+sideCls(r.who)+(r.win?" win":"")}><span className="dl-seat sm">{SEAT_ABBR[r.who]}</span>{link(r.text)}</div>)}
            <div className="dl-trick-sum">{SEAT_NAME[t.winner]} wins trick {t.num}.</div>
          </div>
        </div>
      );
    }
    if(s.trick && s.trick.length){
      let before=[]; const lines=[];
      const ledSuit=s.ledSuit||(s.trick[0]&&s.trick[0].card.suit);
      for(const tc of s.trick){ const r=drawerCardRead(before,tc.card,tc.seat,ledSuit,s.trump,tc.why); lines.push(r); before=[...before,tc]; }
      rows.push(
        <div key="curtrick" className="dl-trick live">
          <div className="dl-trick-body">
            <div className="dl-live-h">In progress</div>
            {lines.map((r,j)=><div key={j} className={"dl-play "+sideCls(r.who)+(r.win?" win":"")}><span className="dl-seat sm">{SEAT_ABBR[r.who]}</span>{link(r.text)}</div>)}
          </div>
        </div>
      );
    }
  }
  if(sug && sug.text){
    rows.push(
      <div key="hint" className="dl-hint">
        <div className="dl-hint-h">Your turn{sug.label?" \u2014 "+sug.label:""}</div>
        <div className="dl-hint-b">{link(sug.text)}</div>
      </div>
    );
  }
  const grades=s.grades||{};
  const gkeys=Object.keys(grades).sort((a,b)=>(+a.split(".").pop())-(+b.split(".").pop()));
  if(gkeys.length){
    const gl=(k)=>{ if(!k) return ""; const i=k.lastIndexOf("."); return k.slice(0,i)+(SUIT_GLYPH[k.slice(i+1)]||k.slice(i+1)); };
    rows.push(<div key="gh" className="dl-head">Card-play grades</div>);
    for(const mk of gkeys){
      const g=grades[mk]; if(!g) continue;
      const trickNo=(+mk.split(".").pop())+1;
      const role=g.role==="defender"?"Defence":"Declarer";
      const accent=g.points>=95?"#3aa657":(g.points>=70?"#c79a2e":"#c0503f");
      const runners=(g.ranked||[]).slice(0,4);
      rows.push(
        <div key={"g"+mk} style={{margin:"6px 0",padding:"7px 9px",borderRadius:8,background:"rgba(127,127,127,0.08)",borderLeft:"3px solid "+accent}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,opacity:0.8}}>
            <span>{role} · trick {trickNo}{g.best_tag?<span style={{marginLeft:6,padding:"1px 6px",borderRadius:10,background:"rgba(127,127,127,0.20)",fontSize:10}}>{g.best_tag}</span>:null}</span><b style={{color:accent}}>{g.points}/100</b>
          </div>
          <div style={{fontSize:12,marginTop:3,lineHeight:1.45}}>
            {g.played_in_equiv
              ? <span>Led {gl(g.played)} — <b>sound</b>.</span>
              : <span>Led {gl(g.played)}; best {gl(g.best_named||g.best)}.</span>}
            {g.best_why ? <div style={{opacity:0.78,marginTop:2}}>{link(g.best_why)}</div> : null}
            {runners.length>1 ? <div style={{opacity:0.6,marginTop:2}}>Equal options: {runners.map(gl).join("  ")}</div> : null}
            {g.needs_clairvoyance ? <div style={{opacity:0.55,marginTop:2,fontStyle:"italic"}}>double-dummy best needs clairvoyance</div> : null}
          </div>
        </div>
      );
    }
  }
  if(!rows.length) rows.push(<div key="empty" className="dl-empty">The running commentary appears here as the deal unfolds — every call and card, what it shows, and what we can deduce about partner's hand.</div>);
  return (
    <>
      <button className={"dl-tab"+(open?" open":"")} onClick={()=>onToggle(!open)} aria-label="Table talk">{open?"\u203a":"\u2039"}<span className="dl-tab-l">TABLE&nbsp;TALK</span></button>
      <aside className={"help-drawer"+(open?" open":"")}>
        <div className="dl-top"><span className="dl-title">TABLE&nbsp;TALK</span><button className="dl-x" onClick={()=>onToggle(false)}>×</button></div>
        <div className="dl-scroll">{rows}</div>
      </aside>
    </>
  );
}


class UIErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(err){ return {err}; }
  render(){
    if(this.state.err) return (
      <div className="lrn-overlay">
        <div className="lrn-top"><span className="lrn-title">LEARN</span><button className="dl-x" onClick={this.props.onClose}>×</button></div>
        <div className="lrn-scroll"><div className="lrn-fail">Something went wrong opening this screen.</div>
          <div className="lrn-why" style={{marginTop:10}}>{String((this.state.err&&this.state.err.message)||this.state.err)}</div>
          <button className="lrn-btn" onClick={this.props.onClose}>Close</button></div>
      </div>
    );
    return this.props.children;
  }
}

/* ======================================================================
   LEARN — a browseable curriculum of lessons with live practice drills.
   Reads the shared CURRICULUM; runs drills through the same generator the
   engine was verified against. Every teach text and explanation is linkified.
   ====================================================================== */
function dwCallKey(c){ return c.k==="B" ? "B"+c.level+c.strain : c.k; }
function LearnHand({hand}){
  const cards=sortHandDisplay(hand||[]);
  return <div className="lrn-hand"><div className="hand">{cards.map(c=><Card key={c.id} c={c} small/>)}</div></div>;
}
function AuctionStrip({calls, dealer}){
  if(!calls || !calls.length) return null;
  return (
    <div className="lrn-auction">
      {calls.map((c,i)=>(
        <span key={i} className={"lrn-acall "+(c.by%2===0?"us":"them")}>
          <span className="s">{SEAT_ABBR[c.by]}</span><span className={"b"+((c.k==="B"&&(c.strain==="H"||c.strain==="D"))?" red":"")}>{callLabel(c)}</span>
        </span>
      ))}
    </div>
  );
}
function DeclarerDummy({declHand, dummyHand, contractLabel}){
  return (
    <div className="lrn-decldummy">
      {contractLabel && <div className="lrn-contract">Contract: <b>{contractLabel}</b> — you are declarer (South)</div>}
      <div className="lrn-yourhand-l">Dummy (North)</div>
      <LearnHand hand={dummyHand}/>
      <div className="lrn-yourhand-l">Your hand (South, declarer)</div>
      <LearnHand hand={declHand}/>
    </div>
  );
}
function DrillRunner({lesson, onBack, onTapTerm}){
  const gen=React.useMemo(()=>makeGenerator({ENG,AUC,BID,PLY}),[]);
  const [drill,setDrill]=React.useState(()=>gen.generate(lesson));
  const [pick,setPick]=React.useState(null);
  const [score,setScore]=React.useState({c:0,n:0});
  const gloss=getGlossary();
  const link=(t)=>linkifyGlossary(t, gloss, onTapTerm);
  const next=()=>{ setPick(null); setDrill(gen.generate(lesson)); };
  if(!drill || !drill.ok){
    return <div className="lrn-drill"><div className="lrn-fail">This drill couldn't be generated just now.</div><button className="lrn-btn" onClick={next}>Try again</button><button className="lrn-btn ghost" onClick={onBack}>Back</button></div>;
  }
  const isEval=drill.kind==="eval", isLead=drill.kind==="lead", isConcept=drill.kind==="concept", isDecl=drill.kind==="declcount";
  const isMC=isEval||isConcept||isDecl;   // multiple-choice kinds share {label,correct} choices
  // correctness + reveal data per kind
  let choices, isCorrect, correctLabel, whyText, prompt;
  if(isMC){
    choices=drill.choices; prompt=drill.prompt; correctLabel=drill.answerLabel; whyText=drill.why;
    isCorrect=(ch)=>!!ch.correct;
  } else if(isLead){
    choices=drill.choices; prompt="What do you lead?"; correctLabel=drill.answerLabel; whyText=drill.why;
    isCorrect=(ch)=>ch.rank===drill.answer.rank && ch.suit===drill.answer.suit;
  } else {
    choices=drill.choices; prompt="What's your call?"; correctLabel=callLabel(drill.answer);
    whyText=describeCall(drill.calls, drill.dealer, 0, drill.answer).meaning;
    isCorrect=(ch)=>dwCallKey(ch)===dwCallKey(drill.answer);
  }
  const choose=(ch)=>{ if(pick) return; setPick(ch); setScore(s=>({c:s.c+(isCorrect(ch)?1:0),n:s.n+1})); };
  const chLabel=(ch)=> isMC?ch.label : isLead?(ch.rank+SUIT_GLYPH[ch.suit]) : callLabel(ch);
  const chKey=(ch,i)=> isMC?("e"+i) : isLead?(ch.rank+ch.suit) : dwCallKey(ch);
  const picked = pick!=null;
  const gotIt = picked && isCorrect(pick);
  return (
    <div className="lrn-drill">
      <div className="lrn-drill-top">
        <button className="lrn-back" onClick={onBack}>‹ lesson</button>
        <span className="lrn-score num">{score.c}/{score.n}</span>
      </div>
      {isLead && drill.contract && <div className="lrn-contract">Contract: <b>{drill.contract.level}{STRAIN_GLYPH[drill.contract.strain]}</b> by {SEAT_NAME[drill.contract.declarer]} — you're on lead</div>}
      {drill.calls && <AuctionStrip calls={drill.calls} dealer={drill.dealer}/>}
      {drill.southHand && <><div className="lrn-yourhand-l">Your hand (South)</div><LearnHand hand={drill.southHand}/></>}
      {drill.declHand && <DeclarerDummy declHand={drill.declHand} dummyHand={drill.dummyHand} contractLabel={drill.contractLabel}/>}
      {drill.scenario && <div className="lrn-scenario">{link(drill.scenario)}</div>}
      <div className="lrn-prompt">{link(prompt)}</div>
      <div className={"lrn-choices"+(isLead?" cards":"")}>
        {choices.map((ch,i)=>{
          const mine=picked && chKey(pick)===chKey(ch,i);
          const correct=picked && isCorrect(ch);
          const cls="lrn-choice"+(correct?" correct":"")+(mine&&!correct?" wrong":"")+((ch.k==="B"&&(ch.strain==="H"||ch.strain==="D"))||(isLead&&(ch.suit==="H"||ch.suit==="D"))?" red":"");
          return <button key={chKey(ch,i)} className={cls} disabled={picked} onClick={()=>choose(ch)}>{chLabel(ch)}</button>;
        })}
      </div>
      {picked && (
        <div className={"lrn-reveal "+(gotIt?"ok":"no")}>
          <div className="lrn-verdict">{gotIt?"Correct":"Not quite"} — answer: <b>{correctLabel}</b></div>
          <div className="lrn-why">{link(whyText)}</div>
          <button className="lrn-btn" onClick={next}>Next hand ›</button>
        </div>
      )}
    </div>
  );
}
/* Long-form lesson text ("the textbook") is fetched at runtime from bridge-teaching.json
   under the "lessons" key, keyed by lesson id. Until it loads (or in the artifact preview, where
   there is no JSON to fetch), LessonPage falls back to the short `teach` note. Keeping the prose
   out of this file keeps the app lean; the JSON is the source of truth for lesson content. */
function getLessonText(id){
  return (typeof window!=="undefined" && window.BRIDGE_TEACHING && window.BRIDGE_TEACHING.lessons
    && window.BRIDGE_TEACHING.lessons[id]) || null;
}

/* Flat, ordered index across all modules — for prev/next navigation and cross-refs. */
const LESSON_FLAT = CURRICULUM.flatMap(m => m.lessons.map(l => ({ ...l, module: m.module })));
const LESSON_BY_ID = Object.fromEntries(LESSON_FLAT.map(l => [l.id, l]));

/* Render lesson body: paragraphs, [[id]] cross-reference links, glossary + suit colour. */
function renderLessonBody(text, gloss, onTapTerm, onNavId){
  return String(text).split(/\n\n+/).map((para, pi) => {
    const parts=[]; let last=0, m, i=0; const re=/\[\[([a-z0-9-]+)\]\]/gi;
    while((m=re.exec(para))){
      if(m.index>last) parts.push(...linkifyGlossary(para.slice(last,m.index), gloss, onTapTerm));
      const id=m[1], les=LESSON_BY_ID[id];
      parts.push(<span key={"x"+pi+"-"+(i++)} className="lrn-xref" onClick={(e)=>{e.stopPropagation(); onNavId && onNavId(id);}}>{les?les.title:id}</span>);
      last=m.index+m[0].length;
    }
    if(last<para.length) parts.push(...linkifyGlossary(para.slice(last), gloss, onTapTerm));
    return <p key={pi} className="lrn-l-para">{parts}</p>;
  });
}

function LessonPage({lesson, onBack, onTapTerm, onNav, onNavId}){
  const [drilling,setDrilling]=React.useState(false);
  const gloss=getGlossary();
  const bookRef = lesson.ch ? ("Standard Bidding with SAYC — ch. "+lesson.ch) : null;
  const idx = LESSON_FLAT.findIndex(l=>l.id===lesson.id);
  const prev = idx>0 ? LESSON_FLAT[idx-1] : null;
  const next = idx>=0 && idx<LESSON_FLAT.length-1 ? LESSON_FLAT[idx+1] : null;
  const body = getLessonText(lesson.id);
  if(drilling) return <DrillRunner lesson={lesson} onBack={()=>setDrilling(false)} onTapTerm={onTapTerm}/>;
  return (
    <div className="lrn-lesson">
      <button className="lrn-back" onClick={onBack}>‹ all lessons</button>
      <div className="lrn-l-mod">{lesson.module} &nbsp;·&nbsp; {idx+1} / {LESSON_FLAT.length}</div>
      <h3 className="lrn-l-title">{lesson.title}</h3>
      {bookRef && <div className="lrn-l-ref">{bookRef}</div>}
      {body
        ? <div className="lrn-l-body">{renderLessonBody(body, gloss, onTapTerm, onNavId)}</div>
        : <p className="lrn-l-teach">{linkifyGlossary(lesson.teach, gloss, onTapTerm)}</p>}
      {lesson.drill
        ? <button className="lrn-btn big" onClick={()=>setDrilling(true)}>Practice this ›</button>
        : <div className="lrn-teachonly">A concept lesson — read and absorb; there's no single-answer drill for it.</div>}
      <div className="lrn-nav">
        <button className="lrn-nav-b" disabled={!prev} onClick={()=>prev&&onNav(-1)}>{prev? "‹ "+prev.title : ""}</button>
        <button className="lrn-nav-b right" disabled={!next} onClick={()=>next&&onNav(1)}>{next? next.title+" ›" : ""}</button>
      </div>
    </div>
  );
}
function LearnScreen({onClose}){
  const [nav,setNav]=React.useState({stack:[], pos:-1});   // browser-style visit history
  const [glossTerm,setGlossTerm]=React.useState(null);
  const [showGloss,setShowGloss]=React.useState(false);
  const onTapTerm=(t)=>{ setGlossTerm(t); setShowGloss(true); };
  const sel = nav.pos>=0 ? LESSON_BY_ID[nav.stack[nav.pos]] : null;
  const canBack = nav.pos>0, canFwd = nav.pos < nav.stack.length-1;
  const go   = (id)=>{ if(!LESSON_BY_ID[id]) return; setNav(n=>{ const stack=n.stack.slice(0,n.pos+1); stack.push(id); return {stack, pos:stack.length-1}; }); };
  const back = ()=> setNav(n=> n.pos>0 ? {...n, pos:n.pos-1} : n);
  const fwd  = ()=> setNav(n=> n.pos<n.stack.length-1 ? {...n, pos:n.pos+1} : n);
  const toList = ()=> setNav({stack:[], pos:-1});
  const drillableCount=CURRICULUM.reduce((n,m)=>n+m.lessons.filter(l=>l.drill).length,0);
  const total=CURRICULUM.reduce((n,m)=>n+m.lessons.length,0);
  return (
    <div className="lrn-overlay">
      <div className="lrn-top">
        {sel && <div className="lrn-hist">
          <button className="lrn-hb" disabled={!canBack} onClick={back} title="Back">‹</button>
          <button className="lrn-hb" disabled={!canFwd} onClick={fwd} title="Forward">›</button>
        </div>}
        <span className="lrn-title">LEARN&nbsp;·&nbsp;SAYC</span>
        <button className="dl-x" onClick={onClose}>×</button>
      </div>
      <div className="lrn-scroll">
        {sel ? (
          <LessonPage lesson={sel} onBack={toList} onTapTerm={onTapTerm}
            onNav={(d)=>{ const i=LESSON_FLAT.findIndex(l=>l.id===sel.id); const j=i+d; if(j>=0&&j<LESSON_FLAT.length) go(LESSON_FLAT[j].id); }}
            onNavId={(id)=>go(id)}/>
        ) : (
          <>
            <div className="lrn-intro">{total} lessons across {CURRICULUM.length} modules · {drillableCount} with live practice drills. Tap a lesson to read it; drillable lessons let you practice against the bidding engine.</div>
            {CURRICULUM.map((m,mi)=>(
              <div key={mi} className="lrn-module">
                <div className="lrn-mod-h">{m.module}</div>
                {m.lessons.map(l=>(
                  <button key={l.id} className="lrn-lrow" onClick={()=>go(l.id)}>
                    <span className="lrn-lrow-t">{l.title}</span>
                    {l.drill ? <span className="lrn-badge drill">drill</span> : <span className="lrn-badge read">read</span>}
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
      {showGloss && <GlossaryScreen gloss={getGlossary()} focusTerm={glossTerm} onClose={()=>{setShowGloss(false);setGlossTerm(null);}}/>}
    </div>
  );
}


/* ===== inlined grader.worker.js (self-contained module worker; instantiated via a Blob URL below) =====
 * GENERATED from the parity-verified grader core (grader.worker.js). It loads bridge-dds from
 * https://esm.sh/bridge-dds@1.4.0 on first use; if that fails (offline / CSP) it silently falls back to
 * the pure-JS endgame solver inlined inside it. Grading is a pure guarded side-effect and never touches
 * game state or card legality. Do not hand-edit; regenerate from the grader package if the core changes. */
const GRADER_WORKER_SRC = "/* grader.worker.js \u2014 off-main-thread declarer-play grader (SELF-CONTAINED; deploy next to index.html).\n * Loads bridge-dds (full-hand double-dummy) from a CDN; if that fails (offline) falls back to the inlined\n * pure-JS solver for the endgame regime. Purely additive: only ever returns display annotations.\n * GENERATED by build_grd_inline.js from the parity-verified grader core \u2014 do not edit by hand. */\nconst GRD = (function(){\n  const SAMP = (function(){\n/* sampler.js \u2014 inference-aware (belief-weighted) sampling of the hidden defender hands (port of belief.py).\n *\n * Splits the unseen cards between two defenders under a belief model constrained by (a) the AUCTION\n * (per-seat HCP window + suit-length floors) and (b) the PLAY (showout voids + cards already played).\n *\n * DESIGN PRINCIPLE (inherited from belief.py / auction.js): constraints may only ever HELP or NO-OP,\n * never hang and never corrupt. Voids are enforced structurally; auction constraints by\n * rejection-with-a-retry-cap that falls back to an unconstrained split if the budget is exhausted.\n *\n * PORTABILITY: belief.py shuffles with Python's Mersenne RNG, which cannot run on-phone. This port takes\n * an injected `rng` (a () -> float in [0,1), e.g. mulberry32 \u2014 the same family used for deal generation)\n * and shuffles with the identical Fisher-Yates used by playlib.seededDeck. Driving belief.py with the\n * SAME mulberry32 + Fisher-Yates makes the two bit-identical (see sampler_parity.js). This is the whole\n * point of the port: same sampling POLICY, a portable RNG.\n *\n * Card shape: { rank, suit, ... } with rank in \"2\"..\"10\",\"J\",\"Q\",\"K\",\"A\"; suit in \"S\",\"H\",\"D\",\"C\".\n */\n\nconst HCPV = { A: 4, K: 3, Q: 2, J: 1 };\nconst SUITS = [\"S\", \"H\", \"D\", \"C\"];\n\n/* seeded RNG (mulberry32) \u2014 bit-identical to playlib.js / ddpar.mulberry32 for the same seed. */\nfunction mulberry32(seed) {\n  let a = seed >>> 0;\n  return function () {\n    a |= 0; a = (a + 0x6D2B79F5) | 0;\n    let t = Math.imul(a ^ (a >>> 15), 1 | a);\n    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;\n    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;\n  };\n}\n\n/* Fisher-Yates identical to playlib.seededDeck: for i=len-1..1, j=(rng()*(i+1))|0, swap. In place. */\nfunction fyShuffle(list, rng) {\n  for (let i = list.length - 1; i > 0; i--) {\n    const j = (rng() * (i + 1)) | 0;\n    const tmp = list[i]; list[i] = list[j]; list[j] = tmp;\n  }\n  return list;\n}\n\nfunction hcp(cards) {\n  let h = 0;\n  for (const c of cards) h += HCPV[c.rank] || 0;\n  return h;\n}\nfunction suitLen(cards, s) {\n  let n = 0;\n  for (const c of cards) if (c.suit === s) n += 1;\n  return n;\n}\n\n/* Does a candidate ORIGINAL holding satisfy an auction constraint {hcpMin,hcpMax,suitMin,suitMax?}. */\nfunction handOk(originalCards, con) {\n  if (con === null || con === undefined) return true;\n  const h = hcp(originalCards);\n  if (h < (con.hcpMin ?? 0) || h > (con.hcpMax ?? 37)) return false;\n  const smin = con.suitMin || {};\n  for (const s of SUITS) {\n    if (suitLen(originalCards, s) < (smin[s] || 0)) return false;\n  }\n  const smax = con.suitMax; // optional; deriveConstraints doesn't emit it yet\n  if (smax) {\n    for (const s of SUITS) {\n      if (suitLen(originalCards, s) > (smax[s] ?? 13)) return false;\n    }\n  }\n  return true;\n}\n\nfunction _unconstrained(pool, n0, rng) {\n  const p = pool.slice();\n  fyShuffle(p, rng);\n  return [p.slice(0, n0), p.slice(n0)];\n}\n\n/* Deal `pool` between two defenders under a belief model. Faithful port of belief.sample_split.\n *\n * pool   : array of unseen cards to distribute\n * n0     : number of cards the FIRST defender still holds (second gets pool.length - n0)\n * cons   : [con_def0, con_def1] auction constraints on each defender's ORIGINAL hand, or [null,null]\n * rng    : () -> float in [0,1)\n * opts.voids  : [set_def0, set_def1] suits each defender is known void in; optional\n * opts.played : [list_def0, list_def1] cards each defender has ALREADY played; optional\n * opts.tries  : rejection budget before falling back (default 200)\n *\n * Returns [cardsDef0, cardsDef1] \u2014 always a legal split of `pool` of sizes (n0, n1).\n */\nfunction sampleSplit(pool, n0, cons, rng, opts = {}) {\n  const voids = opts.voids || [new Set(), new Set()];\n  const played = opts.played || [[], []];\n  const tries = opts.tries ?? 200;\n  const n1 = pool.length - n0;\n\n  const forced0 = [], forced1 = [], free = [];\n  for (const c of pool) {\n    const s = c.suit;\n    const v0 = voids[0].has(s), v1 = voids[1].has(s);\n    if (v0 && v1) return _unconstrained(pool, n0, rng); // contradictory info -> fallback\n    if (v0) forced1.push(c);\n    else if (v1) forced0.push(c);\n    else free.push(c);\n  }\n\n  if (forced0.length > n0 || forced1.length > n1) return _unconstrained(pool, n0, rng);\n\n  const need0 = n0 - forced0.length;\n  for (let t = 0; t < tries; t++) {\n    const f = free.slice();\n    fyShuffle(f, rng);\n    const d0 = forced0.concat(f.slice(0, need0));\n    const d1 = forced1.concat(f.slice(need0));\n    const orig0 = d0.concat(played[0]);\n    const orig1 = d1.concat(played[1]);\n    if (handOk(orig0, cons[0]) && handOk(orig1, cons[1])) return [d0, d1];\n  }\n  return _unconstrained(pool, n0, rng); // budget exhausted: never hang, never corrupt\n}\n\nreturn { mulberry32, fyShuffle, hcp, suitLen, handOk, sampleSplit, HCPV, SUITS };\n\n  })();\n  const DDS = (function(){\n/* dds.js \u2014 a pure-JS EXACT double-dummy solver for on-device endgame evaluation (A2, portable half).\n *\n * Portable stand-in for the ONE non-portable grader piece. A WASM DDS (Bo Haglund lineage) can later\n * replace it for full-hand speed; this JS solver is exact and near-instant for the ENDGAME-exact regime\n * the architecture calls out (few cards left -> one exact solve, no sampling), and doubles as the\n * reference oracle any WASM drop-in is validated against.\n *\n * solveLead(hands, trump, leader) reproduces endplay solve_board EXACTLY: for every legal card the\n * `leader` can play from an ON-LEAD position (trick empty), the tricks the LEADER'S SIDE takes with\n * double-dummy play by both sides.\n *\n * Exactness-preserving speedups: (1) EQUIVALENT-CARD COLLAPSING \u2014 cards in a run with no opponent card\n * between them are double-dummy identical, so only one representative is searched (its value is copied to\n * the whole class); (2) a bound-aware TRANSPOSITION TABLE at trick boundaries (alpha-beta with memory).\n * Both are exact; the parity gate (dds_parity.js vs endplay) proves it.\n *\n * hands  : [seat0..seat3], each [{rank,suit}]  (seats 0=S,1=W,2=N,3=E; sideOf = seat%2)\n * trump  : \"S\"|\"H\"|\"D\"|\"C\"|\"NT\" ; leader : seat on lead\n */\nconst RANKS = [\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"J\",\"Q\",\"K\",\"A\"];\nconst SUITS = [\"S\",\"H\",\"D\",\"C\"];\nconst R_IDX = Object.fromEntries(RANKS.map((r,i)=>[r,i]));\nconst S_IDX = { S:0, H:1, D:2, C:3 };\nconst sideOf = (seat)=> seat & 1;\n\nfunction toMasks(hands){\n  const m=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];\n  for(let s=0;s<4;s++) for(const c of hands[s]) m[s][S_IDX[c.suit]] |= (1<<R_IDX[c.rank]);\n  return m;\n}\n\nfunction trickWinner(plays, ledSuitIdx, trumpIdx){\n  let win=plays[0], winTrump=(S_IDX[win.suit]===trumpIdx);\n  for(let i=1;i<4;i++){\n    const p=plays[i], si=S_IDX[p.suit], isT=(si===trumpIdx);\n    if(isT && !winTrump){ win=p; winTrump=true; }\n    else if(isT && winTrump){ if(R_IDX[p.rank]>R_IDX[win.rank]) win=p; }\n    else if(!isT && !winTrump && si===ledSuitIdx){ if(R_IDX[p.rank]>R_IDX[win.rank]) win=p; }\n  }\n  return win.seat;\n}\n\n// Equivalence classes for a suit: ranks with no OTHER remaining card strictly between them collapse.\n// mineS, unionS: 13-bit masks. Returns [{rep, members:[rankIdx desc]}], classes ordered rank-desc.\nfunction suitClasses(mineS, unionS){\n  const ranks=[]; let m=mineS; while(m){ const b=m&-m; ranks.push(31-Math.clz32(b)); m^=b; }\n  ranks.sort((a,b)=>b-a);\n  const classes=[];\n  for(const r of ranks){\n    if(classes.length){\n      const prev=classes[classes.length-1];\n      const low=prev.members[prev.members.length-1];  // lowest rank so far in this class\n      let between=0;\n      for(let t=r+1;t<low;t++){ if((unionS>>t)&1){ between=1; break; } }\n      if(!between){ prev.members.push(r); continue; }\n    }\n    classes.push({ members:[r] });\n  }\n  for(const c of classes) c.rep=c.members[0];\n  return classes;\n}\n\n// Representative legal plays [suitIdx, rankIdx] for `toPlay` (collapsed). ledSuit=-1 => any.\n// `trick` = cards already on the CURRENT incomplete trick; their ranks must count in the between-test,\n// because a played intermediate card can split two of a hand's cards (one beats it, one doesn't).\nfunction repPlays(masks, toPlay, ledSuit, trick){\n  const union=[\n    masks[0][0]|masks[1][0]|masks[2][0]|masks[3][0],\n    masks[0][1]|masks[1][1]|masks[2][1]|masks[3][1],\n    masks[0][2]|masks[1][2]|masks[2][2]|masks[3][2],\n    masks[0][3]|masks[1][3]|masks[2][3]|masks[3][3],\n  ];\n  if(trick) for(const p of trick) union[S_IDX[p.suit]] |= (1<<R_IDX[p.rank]);\n  const mine=masks[toPlay];\n  const suits = (ledSuit>=0 && mine[ledSuit]) ? [ledSuit] : [0,1,2,3];\n  const out=[];\n  for(const s of suits){\n    if(!mine[s]) continue;\n    for(const c of suitClasses(mine[s], union[s])) out.push([s, c.rep]);\n  }\n  return out;\n}\n\n// bound-aware transposition table entry: {lo, hi}\nfunction solveNode(masks, toPlay, trick, ledSuit, trumpIdx, maxSide, alpha, beta, tt){\n  let empty=true;\n  for(let s=0;s<4 && empty;s++) for(let su=0;su<4;su++) if(masks[s][su]){ empty=false; break; }\n  if(empty && trick.length===0) return 0;\n\n  // TT only at trick boundaries (trick empty): key on masks + toPlay\n  let memoKey=null;\n  if(trick.length===0 && !global.__DDS_NOTT){\n    memoKey = toPlay+\"|\"+masks[0].join(\",\")+\"|\"+masks[1].join(\",\")+\"|\"+masks[2].join(\",\")+\"|\"+masks[3].join(\",\");\n    const e=tt.get(memoKey);\n    if(e){\n      if(e.lo>=beta) return e.lo;\n      if(e.hi<=alpha) return e.hi;\n      if(e.lo===e.hi) return e.lo;\n      if(e.lo>alpha) alpha=e.lo;\n      if(e.hi<beta)  beta=e.hi;\n    }\n  }\n  const a0=alpha, b0=beta;\n\n  const isMax=(sideOf(toPlay)===maxSide);\n  const legal=repPlays(masks, toPlay, trick.length? ledSuit : -1, trick);\n  let best= isMax? -1 : 99;\n\n  for(const [su,ri] of legal){\n    masks[toPlay][su] ^= (1<<ri);\n    trick.push({ seat:toPlay, suit:SUITS[su], rank:RANKS[ri] });\n    let val;\n    if(trick.length===4){\n      const winner=trickWinner(trick, (trick.length>1? ledSuit : su), trumpIdx);\n      const credit=(sideOf(winner)===maxSide)?1:0;\n      val = credit + solveNode(masks, winner, [], -1, trumpIdx, maxSide, alpha-credit, beta-credit, tt);\n    } else {\n      const nextLed=(trick.length>1? ledSuit : su);\n      val = solveNode(masks, (toPlay+1)%4, trick, nextLed, trumpIdx, maxSide, alpha, beta, tt);\n    }\n    trick.pop();\n    masks[toPlay][su] ^= (1<<ri);\n\n    if(isMax){ if(val>best) best=val; if(best>alpha) alpha=best; }\n    else     { if(val<best) best=val; if(best<beta)  beta=best; }\n    if(alpha>=beta) break;\n  }\n\n  if(memoKey!==null){\n    // store bound with flag semantics\n    let lo=-1, hi=99;\n    if(best<=a0) hi=best;          // fail-low -> upper bound\n    else if(best>=b0) lo=best;     // fail-high -> lower bound\n    else { lo=best; hi=best; }     // exact\n    const prev=tt.get(memoKey);\n    if(prev){ lo=Math.max(lo,prev.lo); hi=Math.min(hi,prev.hi); }\n    tt.set(memoKey, {lo,hi});\n  }\n  return best;\n}\n\nfunction solveLead(hands, trump, leader){\n  const trumpIdx=(trump===\"NT\")?-1:S_IDX[trump];\n  const maxSide=sideOf(leader);\n  const masks=toMasks(hands);\n  const tt=new Map();\n  const union=[\n    masks[0][0]|masks[1][0]|masks[2][0]|masks[3][0],\n    masks[0][1]|masks[1][1]|masks[2][1]|masks[3][1],\n    masks[0][2]|masks[1][2]|masks[2][2]|masks[3][2],\n    masks[0][3]|masks[1][3]|masks[2][3]|masks[3][3],\n  ];\n  const out={};\n  const mine=masks[leader];\n  for(let s=0;s<4;s++){\n    if(!mine[s]) continue;\n    for(const cls of suitClasses(mine[s], union[s])){\n      const ri=cls.rep;\n      masks[leader][s] ^= (1<<ri);\n      const trick=[{ seat:leader, suit:SUITS[s], rank:RANKS[ri] }];\n      const val=solveNode(masks,(leader+1)%4,trick,s,trumpIdx,maxSide,-1,99,tt);\n      masks[leader][s] ^= (1<<ri);\n      for(const mr of cls.members) out[`${RANKS[mr]}.${SUITS[s]}`]=val;  // copy to equivalents\n    }\n  }\n  return out;\n}\n\nfunction bestTricks(hands, trump, leader){\n  let m=-1; for(const v of Object.values(solveLead(hands,trump,leader))) if(v>m) m=v; return m;\n}\n\nreturn { RANKS, SUITS, R_IDX, S_IDX, sideOf, toMasks, trickWinner, suitClasses, repPlays, solveNode, solveLead, bestTricks };\n\n  })();\n  const GR = (function(){\n/* grader.js \u2014 the PORTABLE EV-band scoring core for the teaching layer (JS port of grader.py).\n *\n * Verbatim port of grader.py's pure scoring: payoffs (tricks / make / imp), the SD-equivalent band,\n * per-card points (full marks inside the band, decaying with EV lost), and SD-vs-DD divergence. These\n * functions are dependency-free BY DESIGN so they run identically offline (Python) and on-phone (JS).\n *\n * The ONE piece NOT ported here is `eval_card_evs` \u2014 the DDS-backed per-card sampler. On-phone that is\n * supplied by a WASM DDS module (A2); this file consumes its output (`per`, `truth`) as pure data.\n *\n * `per`   : { cardKey: [finalDeclarerTricks per sampled world] }  (>=1 world)\n * `truth` : { cardKey: finalDeclarerTricks on the TRUE layout }   (clairvoyant, for divergence)\n * cardKey : any stable string, e.g. \"A.S\" / \"10.D\" (rank '.' suit). Grader never parses it.\n *\n * PARITY NOTE: grade() reproduces CPython semantics exactly \u2014\n *   - argmax (`best`) returns the FIRST key achieving the max in `per` insertion order (strict >),\n *   - the equivalence band is a STABLE sort by descending EV (ties keep insertion order),\n *   - all float ops use IEEE-754 binary64 in the same order, so results are bit-identical to Python\n *     up to the final decimal rounding (see pyRound1, which mirrors Python's round-half-even).\n */\n\n// ---- IMP table (difference in points -> IMPs), standard ----\nconst _IMP = [20, 50, 90, 130, 170, 220, 270, 320, 370, 430, 500, 600, 750, 900, 1100, 1300, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000];\nfunction _imps(diff) {\n  const a = Math.abs(diff);\n  let i = 0;\n  for (const th of _IMP) {\n    if (a < th) break;\n    i += 1;\n  }\n  return diff >= 0 ? i : -i;\n}\n\n// Duplicate score from declarer's side for making `tricks` in a `level`-`trump` contract.\nfunction _contractScore(tricks, need, level, trump, vul) {\n  const over = tricks - need;\n  if (over < 0) return (vul ? -200 : -100) * (-over); // undertricks (undoubled)\n  const per = (trump === \"C\" || trump === \"D\") ? 20 : 30;\n  const base = per * level + (trump === \"NT\" ? 10 : 0);\n  const game = base >= 100;\n  let bonus = game ? (vul ? 500 : 300) : 50;\n  if (level === 6) bonus += vul ? 750 : 500;\n  if (level === 7) bonus += vul ? 1500 : 1000;\n  return base + bonus + per * over;\n}\n\n// ---- PAYOFFS: final declarer trick count -> value (pure, portable) ----\nfunction payoffTricks(finals /*, need, level, trump, vul */) {\n  let s = 0;\n  for (const t of finals) s += t;\n  return s / finals.length;\n}\nfunction payoffMake(finals, need /*, level, trump, vul */) {\n  let s = 0;\n  for (const t of finals) if (t >= need) s += 1;\n  return s / finals.length;\n}\nfunction payoffImp(finals, need, level, trump, vul) {\n  const datum = _contractScore(need, need, level, trump, vul);\n  let s = 0;\n  for (const t of finals) s += _imps(_contractScore(t, need, level, trump, vul) - datum);\n  return s / finals.length;\n}\n\nconst PAYOFFS = { tricks: payoffTricks, make: payoffMake, imp: payoffImp };\nconst DEFAULT_EPS = { tricks: 0.10, make: 0.02, imp: 0.30 };  // \"equivalent\" band per payoff\nconst _SCALE = { tricks: 1.0, make: 0.20, imp: 3.0 };          // EV units per full 100->0 points swing\n\n// Canonical card order for BACKEND-INDEPENDENT tie-breaks (mirror of grader.py _canon): suit S,H,D,C then\n// rank high->low. Keys are \"rank.suit\" strings (e.g. \"10.D\",\"A.S\"). Without this, best/dd_best/equiv order\n// (hence needs_clairvoyance) would depend on the DDS card-ENUMERATION order, which differs between endplay\n// (offline) and a WASM DDS (on-phone). Ties are true EV ties; this only fixes which equal card is named.\nconst _RANKI = { \"2\":0,\"3\":1,\"4\":2,\"5\":3,\"6\":4,\"7\":5,\"8\":6,\"9\":7,\"10\":8,\"J\":9,\"Q\":10,\"K\":11,\"A\":12 };\nconst _SUITI = { S:0, H:1, D:2, C:3 };\nfunction _canonKey(k) { const i = k.lastIndexOf(\".\"); return _SUITI[k.slice(i + 1)] * 13 + (12 - _RANKI[k.slice(0, i)]); }\nfunction _canonLess(a, b) { return _canonKey(a) < _canonKey(b); }\n\n// Python round(x, 1): correctly-rounded round-HALF-TO-EVEN on the TRUE value of the double.\n// We take the EXACT decimal expansion of the double (toFixed(80): for |x| in [0,100] the expansion is\n// <= ~56 digits, so there is no cutoff rounding \u2014 the string is exact), then round the tenths digit with\n// half-to-even. This reproduces CPython's dtoa-based rounding, including traps like round(0.05,1)==0.1\n// (0.05's double is slightly ABOVE 0.05) and round(0.25,1)==0.2 (exact half -> to even).\nfunction pyRound1(x) {\n  if (!isFinite(x)) return x;\n  const neg = x < 0;\n  const a = Math.abs(x);\n  const str = a.toFixed(80);                  // exact decimal expansion for our magnitudes\n  const dot = str.indexOf(\".\");\n  const intPart = str.slice(0, dot);\n  const frac = str.slice(dot + 1);\n  const d1 = frac.charCodeAt(0) - 48;         // tenths digit\n  const firstRest = frac.length > 1 ? frac.charCodeAt(1) - 48 : 0;  // hundredths\n  const nonZeroBeyond = /[1-9]/.test(frac.slice(2));                // anything past hundredths\n  let roundUp;\n  if (firstRest > 5 || (firstRest === 5 && nonZeroBeyond)) roundUp = true;\n  else if (firstRest < 5) roundUp = false;\n  else roundUp = (d1 % 2) === 1;              // exact .?5 with nothing beyond -> half to even\n  let tenths = d1 + (roundUp ? 1 : 0);\n  let carry = 0;\n  if (tenths === 10) { tenths = 0; carry = 1; }\n  const newInt = (BigInt(intPart) + BigInt(carry)).toString();\n  const val = Number(`${newInt}.${tenths}`);\n  return neg ? -val : val;\n}\n\n/* pure scoring (portable). Mirrors grader.grade() exactly.\n * per, truth : plain objects (insertion order == the order the DDS sampler produced the cards).\n * returns the same fields as the Python grade() dict. */\nfunction grade(per, truth, playedKey, need, level, trump, vul, payoff = \"make\", eps = null, maximize = true) {\n  const fn = PAYOFFS[payoff];\n  if (eps === null || eps === undefined) eps = DEFAULT_EPS[payoff];\n\n  const keys = Object.keys(per);              // insertion order (matches Python dict order)\n  const ev = Object.create(null);\n  for (const k of keys) ev[k] = fn(per[k], need, level, trump, vul);\n\n  // best_ev = optimal value for the side being graded: MAX declarer payoff (declarer) or MIN (defender).\n  let bestEv = ev[keys[0]];\n  for (const k of keys) if (maximize ? ev[k] > bestEv : ev[k] < bestEv) bestEv = ev[k];\n  let best = null;\n  for (const k of keys) if (ev[k] === bestEv && (best === null || _canonLess(k, best))) best = k;\n\n  // equiv = every key within eps on the WORSE side of best, sorted by (toward-best EV, canonical order).\n  const equiv = keys.filter(k => maximize ? (bestEv - ev[k] <= eps) : (ev[k] - bestEv <= eps));\n  equiv.sort((a, b) => (maximize ? (ev[b] - ev[a]) : (ev[a] - ev[b])) || (_canonKey(a) - _canonKey(b)));\n\n  // played_ev: value of the played card, else the worst EV for the graded side (Python's dict.get fallback)\n  let fallbackEv = ev[keys[0]];\n  for (const k of keys) if (maximize ? ev[k] < fallbackEv : ev[k] > fallbackEv) fallbackEv = ev[k];\n  const playedEv = (playedKey in ev) ? ev[playedKey] : fallbackEv;\n\n  const gap = maximize ? (bestEv - playedEv) : (playedEv - bestEv);\n  const scale = _SCALE[payoff];\n  const pointsRaw = gap <= eps ? 100.0 : Math.max(0.0, 100.0 * (1 - (gap - eps) / scale));\n  const points = pyRound1(pointsRaw);\n\n  // SD-vs-DD divergence: DD-best card on the TRUE layout vs the SD-sound best (canonical tie-break).\n  const tkeys = Object.keys(truth);\n  let ddVal = truth[tkeys[0]];\n  for (const k of tkeys) if (maximize ? truth[k] > ddVal : truth[k] < ddVal) ddVal = truth[k];\n  let ddBest = null;\n  for (const k of tkeys) if (truth[k] === ddVal && (ddBest === null || _canonLess(k, ddBest))) ddBest = k;\n\n  const equivSet = new Set(equiv);\n  return {\n    payoff, best, best_ev: bestEv, equiv, n_equiv: equiv.length,\n    played: playedKey, played_ev: playedEv, gap, points, points_raw: pointsRaw,\n    dd_best: ddBest, sd_is_dd: best === ddBest,\n    played_in_equiv: equivSet.has(playedKey),\n    needs_clairvoyance: !equivSet.has(ddBest),  // DD-best isn't even SD-sound -> luck only\n  };\n}\n\nreturn {\n  _IMP, _imps, _contractScore, payoffTricks, payoffMake, payoffImp,\n  PAYOFFS, DEFAULT_EPS, pyRound1, grade,\n};\n\n  })();\n  const EC = (function(){\n/* evalcards.js \u2014 the DDS-backed per-card EV sampler (JS port of grader.eval_card_evs).\n *\n * This is the seam A2 fills: it belief-samples the hidden defender hands (sampler.js), double-dummy-solves\n * each sampled world (dds.js \u2014 swap for a WASM DDS for full-hand speed), and returns, for every candidate\n * card the leader can play, the list of FINAL DECLARER trick counts across sampled worlds (`per`) plus the\n * true-layout finals (`truth`). grader.js then reduces `per`/`truth` to scores. Together:\n *\n *     sampler.js  +  dds.js  +  grader.js   ==   belief.py + endplay + grader.py\n *\n * proven bit-for-bit for the endgame regime by evalcards_parity.js (shared mulberry32 RNG).\n *\n * Signature mirrors grader.eval_card_evs:\n *   hands    : [seat0..3] remaining cards per seat ([{rank,suit}])\n *   trump    : \"S\"|\"H\"|\"D\"|\"C\"|\"NT\"\n *   declarer : seat ; leader : seat on lead ; defs : [defSeat0, defSeat1]\n *   voids    : [set per seat x4] showout voids ; played : [list per seat x4] cards already played\n *   won_decl : tricks the declaring side has already won ; completed : tricks played so far\n *   N        : number of belief samples ; rng : () -> float in [0,1)\n *\n * NOTE: like grader.eval_card_evs, the belief sampler is called with NO auction constraints (cons=[null,\n * null]) \u2014 only voids bind here. (Auction constraints live in the Tier-1 offline path.)\n *\n * The double-dummy solver is INJECTED (opts.solveLead) so the same code runs against either backend:\n *   - pure-JS dds.js (default): exact, synchronous, near-instant for the endgame regime + offline oracle;\n *   - bridge-dds WASM (solveLeadWasm): the full C++ DDS, needed for full-hand (trick 1-5) speed.\n * Both satisfy the same contract (solveLead(hands,trump,leader) -> {cardKey: tricks for leader's side}),\n * proven equivalent to endplay, so evalCardEvs is identical whichever is supplied.\n */\nconst { sampleSplit } = SAMP;\nconst ddsDefault = DDS.solveLead;\nfunction evalCardEvs(hands, trump, declarer, leader, defs, voids, played, won_decl, completed, N, rng, opts) {\n  opts = opts || {};\n  const solveLead = opts.solveLead || ddsDefault;\n  const dummy = (declarer + 2) % 4;\n  const declSide = (leader === declarer || leader === dummy);\n  const totalRemaining = 13 - completed;\n  // Perspective = which two seats are KNOWN (fixed) vs HIDDEN (sampled). Default: declarer perspective\n  // (known = declarer+dummy, hidden = the defenders). Defender perspective passes known=[leader,dummy],\n  // hidden=[declarer, partner]. `one()` normalizes to DECLARER tricks regardless, so orientation is fixed.\n  const hidden = opts.hidden || defs;\n  const known = opts.known || [declarer, dummy];\n  const pool = hands[hidden[0]].concat(hands[hidden[1]]);\n  const n0 = hands[hidden[0]].length;\n\n  // _one(rem): DD-solve the on-lead position, normalize each candidate to FINAL DECLARER tricks.\n  const one = (rem) => {\n    const raw = solveLead(rem, trump, leader);   // {cardKey: tricks for leader's SIDE}\n    const out = {};\n    for (const k of Object.keys(raw)) {\n      const sideTricks = declSide ? raw[k] : (totalRemaining - raw[k]);\n      out[k] = won_decl + sideTricks;\n    }\n    return out;\n  };\n\n  const per = {};\n  for (let i = 0; i < N; i++) {\n    const [d0, d1] = sampleSplit(pool, n0, [null, null], rng, {\n      voids: [voids[hidden[0]], voids[hidden[1]]],\n      played: [played[hidden[0]], played[hidden[1]]],\n    });\n    const rem = [null, null, null, null];\n    rem[known[0]] = hands[known[0]];\n    rem[known[1]] = hands[known[1]];\n    rem[hidden[0]] = d0;\n    rem[hidden[1]] = d1;\n    const finals = one(rem);\n    for (const k of Object.keys(finals)) {\n      (per[k] || (per[k] = [])).push(finals[k]);\n    }\n  }\n  const truth = one(hands);   // clairvoyant true-layout finals\n  return { per, truth };\n}\n\nreturn { evalCardEvs };\n\n  })();\n  const TB = (function(){\n/* tiebreak.js  (A5) \u2014 name the expert pick among EV-equal cards, with role-aware phrasing.\n *\n * grade().equiv is the set of cards that share the top EV under the chosen payoff \u2014 every one of them is,\n * by the double-dummy oracle, equally good. Which one a strong player actually leads is decided by\n * card-play PRINCIPLES the payoff can't see: lead the top of a sequence, keep your high cards, don't break\n * a tenace. This module applies those principles to pick a representative and say WHY, reusing the app's\n * play vocabulary (LEAD_SEQ / LEAD_LOW / \u2026). It is pure, dependency-free, and never changes any EV or the\n * equivalence set \u2014 it only chooses and explains a representative, with a deterministic canonical fallback.\n *\n * The PICK is role-independent (the principle is the same whoever leads); only the WHY is phrased for the\n * role \u2014 declarer conserves winners/entries and avoids broaching a tenace; a defender keeps honours back to\n * capture declarer's, doesn't lead away from a tenace, and makes declarer break suits.\n *\n * nameBest(equiv, ctx) -> { pick, code, why, ranked }\n *   equiv : array of card keys \"rank.suit\" (e.g. [\"Q.S\",\"J.S\",\"4.H\"]) \u2014 the EV-equal set from grade().\n *   ctx   : { hand:[{rank,suit}], trump, role:\"declarer\"|\"defender\", onlyLegal?:bool }\n *           hand is the LEADER's remaining cards; role defaults to \"declarer\".\n *   pick  : the chosen key.  code: a PLAY_TAG-compatible code.  why: one-line teaching reason.\n *   ranked: equiv re-ordered best-first (deterministic), so callers can show runners-up.\n */\n\nconst RANKS = [\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"J\",\"Q\",\"K\",\"A\"];\nconst RIDX = Object.fromEntries(RANKS.map((r, i) => [r, i]));\nconst SUITS = [\"S\",\"H\",\"D\",\"C\"];\nconst SIDX = { S:0, H:1, D:2, C:3 };\nconst GLYPH = { S:\"\\u2660\", H:\"\\u2665\", D:\"\\u2666\", C:\"\\u2663\" };\n\nfunction parseKey(k){ const i = k.lastIndexOf(\".\"); return { rank:k.slice(0,i), suit:k.slice(i+1), key:k }; }\nconst label = (c) => `${c.rank}${GLYPH[c.suit]}`;\n\n// canonical order (matches the grader's _canon): suit S,H,D,C ; rank descending. Deterministic fallback.\nfunction canonCmp(a, b){\n  if (SIDX[a.suit] !== SIDX[b.suit]) return SIDX[a.suit] - SIDX[b.suit];\n  return RIDX[b.rank] - RIDX[a.rank];\n}\n\n// contiguous run detection: are these ranks (within one suit) mutually touching, using the LEADER'S holding\n// so that e.g. Q,J with 10 also in hand still reads as part of the QJ10 sequence.\nfunction isTouchingRun(cardsInSuit, handRanksInSuit){\n  if (cardsInSuit.length < 2) return false;\n  const idx = cardsInSuit.map(c => RIDX[c.rank]).sort((x,y)=>x-y);\n  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i-1] + 1) return false;\n  return true;\n}\n\n// does the leader's holding in `suit` contain a tenace (broken high cards that a lead would broach)?\nfunction hasTenace(handRanksInSuit){\n  const has = (r) => handRanksInSuit.includes(r);\n  return (has(\"A\") && has(\"Q\") && !has(\"K\"))          // AQ\n      || (has(\"K\") && has(\"J\") && !has(\"Q\"))          // KJ\n      || (has(\"A\") && has(\"J\") && has(\"10\") && !has(\"K\") && !has(\"Q\")); // AJ10\n}\n\n/* Role-aware phrasing. Each entry is { declarer, defender }; when a role lacks its own line it falls back to\n * declarer. `p` carries the pieces a line needs (pick label already resolved, plus rule-specific extras). */\nconst PHRASE = {\n  ONLY: {\n    declarer: (p) => `Forced \u2014 ${p.pick} is the only legal card.`,\n    defender: (p) => `Forced \u2014 ${p.pick} is the only legal card.`,\n  },\n  GENERIC: {\n    declarer: (p) => `${p.pick} is the standout play here.`,\n    defender: (p) => `${p.pick} is the clear defensive card here.`,\n  },\n  LEAD_SEQ: {\n    declarer: (p) => `These tie, but ${p.pick} leads the top of a sequence \u2014 the standard card from touching honours.`,\n    defender: (p) => `Lead the top of your sequence: ${p.pick} is the standard defensive card from touching honours and can't cost a trick.`,\n  },\n  LEAD_LOW: {\n    declarer: (p) => `Equally good, so lead low: ${p.pick} keeps your ${p.keep} for later.`,\n    defender: (p) => `Equally good, so lead low and keep your ${p.keep} back \u2014 save the honour to capture one of declarer's or take a trick later.`,\n  },\n  KEEP_TENACE: {\n    declarer: (p) => `All equal in EV; lead ${p.pick} rather than broaching your tenace in ${p.suits}.`,\n    defender: (p) => `All equal; lead ${p.pick} and don't lead away from your tenace in ${p.suits} \u2014 make declarer break that suit so your honours score.`,\n  },\n  SAFE: {\n    declarer: (p) => `${p.count} cards are equally good here (${p.list}); by convention take ${p.pick}.`,\n    defender: (p) => `${p.count} cards are equally good on defence (${p.list}); by convention take ${p.pick}.`,\n  },\n};\nfunction phrase(code, role, p){\n  const e = PHRASE[code] || PHRASE.SAFE;\n  return (e[role] || e.declarer)(p);\n}\n\nfunction nameBest(equiv, ctx){\n  ctx = ctx || {};\n  const role = ctx.role === \"defender\" ? \"defender\" : \"declarer\";\n  const hand = ctx.hand || [];\n  const cards = equiv.map(parseKey);\n  const handBySuit = {}; for (const c of hand) (handBySuit[c.suit] = handBySuit[c.suit] || []).push(c.rank);\n\n  const ranked = cards.slice().sort(canonCmp);        // deterministic baseline ordering\n  const bySuit = {}; for (const c of cards) (bySuit[c.suit] = bySuit[c.suit] || []).push(c);\n\n  // pick + code chosen role-independently; why is phrased for the role.\n  const result = (pick, code, params) => ({\n    pick: pick.key, code,\n    why: phrase(code, role, Object.assign({ pick: label(pick) }, params || {})),\n    ranked: [pick.key, ...ranked.filter(c => c.key !== pick.key).map(c => c.key)],\n  });\n\n  // R1 \u2014 nothing to choose.\n  if (cards.length === 1){\n    const c = cards[0];\n    return result(c, ctx.onlyLegal ? \"ONLY\" : \"GENERIC\");\n  }\n\n  // R2 \u2014 TOP OF A SEQUENCE. If two-or-more equal cards in a suit are mutually touching, lead the highest:\n  // the textbook card from touching honours. Pick the highest such run-top across suits (canonical tiebreak).\n  let seqPick = null;\n  for (const suit of SUITS){\n    const inSuit = bySuit[suit]; if (!inSuit || inSuit.length < 2) continue;\n    if (!isTouchingRun(inSuit, handBySuit[suit] || [])) continue;\n    const top = inSuit.slice().sort((a,b)=>RIDX[b.rank]-RIDX[a.rank])[0];\n    if (!seqPick || canonCmp(top, seqPick) < 0) seqPick = top;\n  }\n  if (seqPick) return result(seqPick, \"LEAD_SEQ\");\n\n  // R3 \u2014 CONSERVE THE HIGH CARD. If a suit holds two-or-more equal cards that are NOT a run (a gap between\n  // them), lead the LOWEST: keep the higher card as a later winner / entry. Choose the suit whose retained\n  // card is highest (most worth keeping); canonical tiebreak.\n  let lowPick = null, keepRank = -1, keepHigh = null;\n  for (const suit of SUITS){\n    const inSuit = bySuit[suit]; if (!inSuit || inSuit.length < 2) continue;\n    if (isTouchingRun(inSuit, handBySuit[suit] || [])) continue;   // runs handled by R2\n    const sorted = inSuit.slice().sort((a,b)=>RIDX[a.rank]-RIDX[b.rank]);\n    const low = sorted[0], high = sorted[sorted.length-1];\n    if (RIDX[high.rank] > keepRank || (RIDX[high.rank] === keepRank && lowPick && canonCmp(low, lowPick) < 0)){\n      keepRank = RIDX[high.rank]; lowPick = low; keepHigh = high;\n    }\n  }\n  if (lowPick) return result(lowPick, \"LEAD_LOW\", { keep: label(keepHigh) });\n\n  // R4 \u2014 DON'T BREAK A TENACE. One equal card per suit (a suit CHOICE). Prefer a suit where the leader holds\n  // no tenace, so an AQ/KJ isn't broached; among the safe suits, canonical order.\n  const oneEach = Object.values(bySuit).every(a => a.length === 1);\n  if (oneEach){\n    const safe = ranked.filter(c => !hasTenace(handBySuit[c.suit] || []));\n    const broached = ranked.filter(c => hasTenace(handBySuit[c.suit] || []));\n    if (safe.length && broached.length){\n      return result(safe[0], \"KEEP_TENACE\", { suits: broached.map(c => GLYPH[c.suit]).join(\"/\") });\n    }\n  }\n\n  // R5 \u2014 canonical fallback: defined, deterministic, honest.\n  const pick = ranked[0];\n  return result(pick, \"SAFE\", { count: cards.length, list: ranked.map(label).join(\", \") });\n}\n\n// PLAY_TAG-compatible labels for any new codes this module introduces (the LEAD_*/etc. codes already exist\n// in bridge.jsx's PLAY_TAG; these fill the gaps so a caller can render a short tag). Role-aware where useful.\nconst TIEBREAK_TAG = {\n  ONLY: \"forced\", GENERIC: \"clear best\", LEAD_SEQ: \"top of a sequence\",\n  LEAD_LOW: \"conserve the high card\", KEEP_TENACE: \"keep the tenace\", SAFE: \"conventional pick\",\n};\nconst TIEBREAK_TAG_DEF = {\n  ONLY: \"forced\", GENERIC: \"clear defence\", LEAD_SEQ: \"top of a sequence\",\n  LEAD_LOW: \"keep the honour back\", KEEP_TENACE: \"don't lead from a tenace\", SAFE: \"conventional pick\",\n};\n\nreturn { nameBest, TIEBREAK_TAG, TIEBREAK_TAG_DEF, canonCmp, parseKey, isTouchingRun, hasTenace };\n\n  })();\n  return Object.assign({}, SAMP, DDS, GR, EC, TB);\n})();\n\n/* PBN adapter for bridge-dds SolveBoardPBN (seat 0=S,1=W,2=N,3=E -> DDS dir N0,E1,S2,W3). */\nconst _T = { S:0, H:1, D:2, C:3, NT:4 };\nconst _SEAT2DIR = {0:2,1:3,2:0,3:1};\nconst _DIR2SEAT = {0:2,1:3,2:0,3:1};\nconst _LETTER = ['N','E','S','W'];\nconst _RO = {\"2\":0,\"3\":1,\"4\":2,\"5\":3,\"6\":4,\"7\":5,\"8\":6,\"9\":7,\"10\":8,\"J\":9,\"Q\":10,\"K\":11,\"A\":12};\nconst _N2R = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'};\nconst _SL = ['S','H','D','C'];\nfunction _handStr(cards){\n  const by={S:[],H:[],D:[],C:[]}; for(const c of cards) by[c.suit].push(c.rank);\n  return ['S','H','D','C'].map(s=> by[s].sort((a,b)=>_RO[b]-_RO[a]).map(r=> r==='10'?'T':r).join('')).join('.');\n}\nfunction _toPBN(hands, leaderDir){\n  const order=[0,1,2,3].map(i=>(leaderDir+i)%4);\n  return _LETTER[leaderDir]+':'+order.map(d=>_handStr(hands[_DIR2SEAT[d]])).join(' ');\n}\n// Build a solveLead(hands,trump,leader) backed by a loaded bridge-dds Dds instance.\nfunction makeWasmSolver(dds){\n  return function(hands, trump, leader){\n    const deal={ trump:_T[trump], first:_SEAT2DIR[leader], currentTrickSuit:[], currentTrickRank:[], remainCards:_toPBN(hands,_SEAT2DIR[leader]) };\n    const ft=dds.SolveBoardPBN(deal, -1, 3, 0);\n    const out={};\n    for(let i=0;i<ft.cards;i++){ const s=_SL[ft.suit[i]], v=ft.score[i];\n      out[_N2R[ft.rank[i]]+'.'+s]=v;\n      let eq=ft.equals[i]; while(eq){ const b=eq&-eq; const r=31-Math.clz32(b); out[_N2R[r]+'.'+s]=v; eq^=b; } }\n    return out;\n  };\n}\n\n/* Pure grade computation. pos carries a full on-lead snapshot (see graderClient for the schema).\n * solveLead is injected (wasm or GRD.solveLead). Returns a compact, display-ready grade or {skipped}. */\nfunction computeGrade(pos, solveLead){\n  const cardsPerHand = 13 - pos.completed;\n  if(!solveLead){\n    if(cardsPerHand > 7) return { skipped:'no-wasm-hand-too-large' };  // pure-JS too slow past ~7\n    solveLead = GRD.solveLead;\n  }\n  const hands  = pos.hands.map(h=>h.map(c=>({rank:c.rank,suit:c.suit})));\n  const voids  = pos.voids.map(v=>new Set(v));\n  const played = pos.played.map(p=>p.map(c=>({rank:c.rank,suit:c.suit})));\n  const rng    = GRD.mulberry32(pos.seed >>> 0);\n  // Perspective from who's on lead: declaring side (declarer/dummy) knows declarer+dummy and MAXimises;\n  // a defender knows own hand + dummy and MINimises the declarer's payoff.\n  const dummy    = (pos.declarer + 2) % 4;\n  const declSide = (pos.leader === pos.declarer || pos.leader === dummy);\n  const defenders= [0,1,2,3].filter(x => x !== pos.declarer && x !== dummy);\n  const known    = declSide ? [pos.declarer, dummy] : [pos.leader, dummy];\n  const hidden   = declSide ? defenders : [pos.declarer, (pos.leader + 2) % 4];\n  const { per, truth } = GRD.evalCardEvs(hands, pos.trump, pos.declarer, pos.leader, pos.defs,\n                          voids, played, pos.won_decl, pos.completed, pos.N||16, rng, { solveLead, known, hidden });\n  const g = GRD.grade(per, truth, pos.played_key, pos.need, pos.level, pos.trump, !!pos.vul,\n                      pos.payoff||'make', null, declSide /* maximize: declarer max, defender min */);\n  // A5: name the expert pick among the EV-equal set, from the leader's holding. Additive.\n  let named = null;\n  try{ named = GRD.nameBest(g.equiv, { hand: hands[pos.leader], trump: pos.trump, role: declSide ? 'declarer' : 'defender' }); }catch(_){ named = null; }\n  const _tagMap = declSide ? GRD.TIEBREAK_TAG : GRD.TIEBREAK_TAG_DEF;\n  const best_tag = (named && _tagMap) ? (_tagMap[named.code] || null) : null;\n  // ranked runner-ups (best-first) with a per-card tag, for a richer read-out\n  let ranked = null;\n  try{ ranked = (named ? named.ranked : g.equiv).slice(0, 5); }catch(_){ ranked = null; }\n  return {\n    role: declSide ? 'declarer' : 'defender',\n    payoff:g.payoff, best:g.best, best_ev:g.best_ev, equiv:g.equiv, n_equiv:g.n_equiv,\n    played:g.played, played_ev:g.played_ev, gap:g.gap, points:g.points,\n    dd_best:g.dd_best, sd_is_dd:g.sd_is_dd, played_in_equiv:g.played_in_equiv,\n    needs_clairvoyance:g.needs_clairvoyance,\n    best_named: named ? named.pick : g.best,\n    best_code:  named ? named.code : null,\n    best_why:   named ? named.why  : null,\n    best_tag,\n    ranked,\n  };\n}\n\n\nlet _solve = null, _ready = false;\nasync function ensureDds(){\n  if(_ready) return; _ready = true;\n  try{\n    const mod = await import('https://esm.sh/bridge-dds@1.4.0');\n    const m = await mod.loadDds();\n    _solve = makeWasmSolver(new mod.Dds(m));\n  }catch(e){ _solve = null; }   // no CDN/WASM -> pure-JS endgame fallback inside computeGrade\n}\nself.onmessage = async (ev) => {\n  const { id, pos } = ev.data || {};\n  try{ await ensureDds(); self.postMessage({ id, grade: computeGrade(pos, _solve) }); }\n  catch(err){ self.postMessage({ id, error: String(err && err.message || err) }); }\n};\n";

export default function App(){
  const [s,dispatch]=useReducer(reducer,SETUP);
  const [theme,setTheme]=React.useState(()=>loadTheme());
  const [campaign,setCampaign]=React.useState(()=>loadCampaign());
  const [showRules,setShowRules]=React.useState(false);
  const [revealSeat,setRevealSeat]=React.useState(0);
  const [hint,setHint]=React.useState(false);
  const [alwaysOn,setAlwaysOn]=React.useState(()=>{ try{ return localStorage.getItem("bridge.suggest.always")==="on"; }catch(_){ return false; } });
  React.useEffect(()=>{ try{ localStorage.setItem("bridge.suggest.always", alwaysOn?"on":"off"); }catch(_){} },[alwaysOn]);
  const showHint = hint || alwaysOn;
  const [teach,setTeach]=React.useState(()=>{ try{ return localStorage.getItem("bridge.teach.v1")!=="off"; }catch(_){ return true; } });
  const [teachVer,setTeachVer]=React.useState(0);
  const [showGloss,setShowGloss]=React.useState(false);
  const [glossTerm,setGlossTerm]=React.useState(null);
  const [drawerOpen,setDrawerOpen]=React.useState(false);
  const [showLearn,setShowLearn]=React.useState(false);
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

  // Off-thread declarer-play grader (bridge-dds WASM in a worker; endgame pure-JS fallback inside it).
  // Purely additive: results arrive as PLAY_GRADE and only annotate the Table Talk log.
  const gradeWorkerRef=useRef(null);
  const gradeReqRef=useRef(null);
  if(gradeReqRef.current===null) gradeReqRef.current=new Set();
  useEffect(()=>{
    if(typeof window==="undefined"||typeof Worker==="undefined") return;
    let w=null;
    try{
      const _blob=new Blob([GRADER_WORKER_SRC],{type:"text/javascript"});
      const _url=URL.createObjectURL(_blob);
      w=new Worker(_url,{type:"module"});
    }catch(_){ w=null; }
    gradeWorkerRef.current=w;
    if(w) w.onmessage=(ev)=>{ const d=ev.data||{}; if(d && d.id!=null) dispatch({type:"PLAY_GRADE", moveId:d.id, grade:d.grade}); };
    return ()=>{ try{ if(w) w.terminate(); }catch(_){} gradeWorkerRef.current=null; };
  },[]);
  useEffect(()=>{
    const w=gradeWorkerRef.current; if(!w) return;
    for(const pos of (s.gradeQueue||[])){
      if(gradeReqRef.current.has(pos.moveId)) continue;
      gradeReqRef.current.add(pos.moveId);
      try{ w.postMessage({id:pos.moveId, pos}); }catch(_){}
    }
  },[s.gradeQueue]);

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
          <button className="lrn-open-btn" onClick={()=>setShowLearn(true)}>Learn — lessons &amp; practice drills ›</button>
          <Setup s={s} dispatch={apply} onShowRules={()=>setShowRules(true)} onShowGloss={()=>{setGlossTerm(null);setShowGloss(true);}}
            campaign={campaign} onResume={resumeCampaign} onDiscard={discardCampaign}/>
        </div>
        {showRules && <RulesScreen onClose={()=>setShowRules(false)}/>}
        {showGloss && <GlossaryScreen gloss={getGlossary()} focusTerm={glossTerm} onClose={()=>{setShowGloss(false);setGlossTerm(null);}}/>}
        {showLearn && <UIErrorBoundary onClose={()=>setShowLearn(false)}><LearnScreen onClose={()=>setShowLearn(false)}/></UIErrorBoundary>}
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

  const sugBidB  = (s.phase==="auction" && isHumanActing && showHint && !needReveal) ? suggestBidWhy(s, s.turn) : null;
  const sugPlayB = (s.phase==="play" && isHumanActing && showHint && !needReveal) ? suggestPlayWhy(s, s.turn) : null;
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

  const doPlay=(card)=>{ if(playableSeat==null) return; setHint(false); apply({type:"PLAY", player:playableSeat, cardId:card.id}); };
  const rubberWon = s.rubberDone;

  return (
    <div className="br" data-theme={theme} style={{minHeight:"100vh",background:"var(--bg)",padding:"12px 10px 18px"}}>
      <style>{THEME_CSS}</style>
      <HelpDrawer s={s} focus={focus} open={drawerOpen} onToggle={setDrawerOpen}
        onTapTerm={(t)=>{setGlossTerm(t);setShowGloss(true);}}
        sug={{ text:sugText, label: sugBid?("consider "+callLabel(sugBid)) : (sugPlay?("consider "+sugPlay.rank+SUIT_GLYPH[sugPlay.suit]):"") }}/>
      <OnlineBar net={net}/>
      <div className="app">
        <header>
          <div className="wordmark">BRIDGE</div>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <button className="lrn-mini" onClick={()=>setShowLearn(true)}>LEARN</button>
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
                sugId={playableSeat===dummySeat?sugPlayId:null}
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
                  sugId={playableSeat===focus?sugPlayId:null}
                  onPlay={doPlay}/>
                {sugPlayId && <div className="hint">Suggested: <b>{(()=>{const c=(s.hands[focus]||[]).find(x=>x.id===sugPlayId)||(showDummy&&(s.hands[dummySeat]||[]).find(x=>x.id===sugPlayId)); return c?<span className={suitColorClass(c.suit)}>{c.rank}{SUIT_GLYPH[c.suit]}</span>:"—";})()}</b>{playableSeat===dummySeat?" (from dummy)":""}</div>}
              </div>
            )}

            {s.phase==="auction" && isHumanActing && (
              <BiddingBox s={s} seat={s.turn} dispatch={apply} suggestion={sugBid}/>
            )}

            {showHint && teach && sugText && (
              <div className="teachbox">
                <div className="tb-tag">Why</div>
                <div className="tb-body">
                  <div className="tb-txt">{linkifyGlossary(sugText, getGlossary(), (term)=>setGlossPop({term, def:getGlossary()[term]}))}</div>
                  {glossPop && <div className="tb-def"><b>{glossPop.term}</b> — {glossPop.def} <span className="tb-more" onClick={()=>{setGlossTerm(glossPop.term);setShowGloss(true);}}>full glossary →</span></div>}
                </div>
              </div>
            )}

            <div className="bar">
              {isHumanActing && s.phase!=="scored" && !alwaysOn && (
                <button className="btn gold" onClick={()=>setHint(h=>!h)}>{hint?"Hide hint":"Suggest"}</button>
              )}
              {isHumanActing && s.phase!=="scored" && (
                <button className={"btn ghost"+(alwaysOn?" on":"")} onClick={()=>setAlwaysOn(a=>!a)}>{alwaysOn?"Auto-hint \u2713":"Auto-hint"}</button>
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
        {showLearn && <UIErrorBoundary onClose={()=>setShowLearn(false)}><LearnScreen onClose={()=>setShowLearn(false)}/></UIErrorBoundary>}
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


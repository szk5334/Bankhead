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

export const CURRICULUM = [

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
      drill: null },
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
      drill: null },
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
      drill: null },
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
      drill: null },
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
      drill: null },
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
      drill: null },
  ]},

  /* ---- CH 19: SLAM BIDDING ----------------------------------------------- */
  { id: "slam", module: "Slam Bidding", lessons: [
    { id: "s-bw", ch: 19, title: "Blackwood 4NT",
      teach: "4NT asks for aces: 5\u2663=0/4, 5\u2666=1, 5\u2665=2, 5\u2660=3. A follow-up 5NT asks for kings and guarantees the partnership holds all four aces. Use it to stay out of a slam missing two aces, not to bid one.",
      drill: null },
    { id: "s-gerber", ch: 19, title: "Gerber & the Grand Slam Force",
      teach: "4\u2663 over a natural notrump is Gerber (ace-asking). A jump to 5NT is the Grand Slam Force, asking partner to bid seven of the agreed suit holding two of the top three trump honors.",
      drill: null },
    { id: "s-control", ch: 19, title: "Control bids (cuebidding)",
      teach: "Once a trump fit and slam interest are established, bid your cheapest first-round control (ace or void) up the line; second-round controls (kings, singletons) come on later rounds. Cuebidding pinpoints where your controls lie before committing with Blackwood.",
      drill: null },
    { id: "s-choose", ch: 19, title: "Choosing the slam method",
      teach: "Quantitative raises decide notrump slams by points; Blackwood checks for missing aces in suit slams; control bids handle hands where a specific unguarded suit \u2014 not the ace count \u2014 is the worry. Match the tool to the doubt.",
      drill: null },
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
      drill: null },
  ]},
];

/* Chapter -> lesson-count coverage, for a progress/provenance view. */
export const BOOK_MAP = CURRICULUM.reduce((m, mod) => {
  for (const l of mod.lessons) {
    const k = String(l.ch);
    (m[k] = m[k] || []).push(l.id);
  }
  return m;
}, {});

/* Every lesson flagged auto-drillable, for the generator to enumerate. */
export const DRILLABLE = CURRICULUM.flatMap((mod) =>
  mod.lessons.filter((l) => l.drill).map((l) => ({ id: l.id, pos: l.drill.pos, note: l.drill.note }))
);

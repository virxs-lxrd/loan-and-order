/* =====================================================================
   LOAN & ORDER  -  data.js
   EVERYTHING you may want to change lives in THIS file:
   settings, every piece of text, the lender cards, the add-ons,
   the piggy banks, the questions, and the image / sound file names.

   HOW TO EDIT SAFELY (read once)
   1. Change only the words INSIDE the "double quotes".
   2. Do not delete a quote mark, a comma, a { } or a [ ].
   3. Do not type a double quote (") inside your text. Use ’ or ‘ instead.
   4. Words in {curly brackets} are filled in by the game. Keep them as they are.
   5. In the TEXT section you may use <b>bold</b>. Write & as &amp;
   6. Names in the CARDS, UPSELLS, BANKS, FACTORS and EXIT lists are
      also what lands in the Google Sheet. Write them as plain text.
   7. If you change a lender, add-on, bank or question, the game keeps working,
      but old rows in the Sheet will still show the old words.

   After you edit on GitHub: Commit changes, wait about one minute,
   then hard refresh the page (see SETUP.md).
   ===================================================================== */

window.GAME_DATA = {

/* ------------------------------------------------------------------
   1. SETTINGS
   ------------------------------------------------------------------ */
SETTINGS: {
  /* The long web address you copy from Apps Script after Deploy. It ends in /exec.
     Leave it empty to play in practice mode (nothing is saved). */
  EXEC_URL: "https://script.google.com/macros/s/AKfycbwEPu_YaIvlsq20ZZSXXY2x57lQYH81OJAckD-NZanrIu6o8Rn1pHPg2ySLQfKDzQlamA/exec",

  /* How many digits a player's number may have. Numbers only. */
  TOKEN_MIN: 3,
  TOKEN_MAX: 8,

  /* The money model */
  PRINCIPAL: 2500000,   /* loan paid out on day one, in rupees */
  TERM_MONTHS: 60,      /* interest is counted up to the end of year 5 */
  ADDON_POINTS: 1,      /* every add-on taken adds this many percentage points */
  COINS: 7,             /* coins each player gets for the piggy banks */

  /* Saving behaviour */
  ALLOW_PLAY_OFFLINE: true,  /* true: if the sheet cannot be reached at the start, the game still begins and the number is checked later */
  START_TIMEOUT_MS: 7000,    /* how long the number check may take before the game goes on without it */
  SEND_TIMEOUT_MS: 25000,    /* how long one save may take before it is tried again */
  SEND_DELAY_MS: 400,        /* small wait so quick taps are sent together */
  RETRY_FIRST_MS: 2000,      /* first wait after a failed save. It doubles each time */
  RETRY_MAX_MS: 30000,       /* longest wait between tries */

  /* Feel */
  SWIPE_DISTANCE: 90,        /* how far to drag a card before it counts as a swipe */
  EXIT_TEXT_MAX: 80          /* longest typed answer on the exit screen, in letters */
},

/* ------------------------------------------------------------------
   2. FILES (the names of images and sounds in the repo)
   ------------------------------------------------------------------ */
MEDIA: {
  sevenImage: "images/seven.jpg",
  jackpotSound: "audio/jackpot.mp3"
},

/* ------------------------------------------------------------------
   3. TEXT  (what players read)
   ------------------------------------------------------------------ */
TEXT: {
  pageTitle: "Loan and Order",
  logo: "LOAN &amp; ORDER",
  back: "← Back",
  roundAria: "Game {n} of 3",
  kickGame: "GAME {n} OF 3",
  letsGo: "LET'S GO",
  registrar: "THE REGISTRAR",
  fixer: "THE FIXER",

  /* the small line under the logo */
  sync: {
    practice: "practice mode · not saved",
    token: "No. {token}",
    saving: "saving…",
    saved: "saved",
    offline: "offline · will retry",
    blocked: "not saving · tell a volunteer"
  },

  /* error and notice messages, by code. The sheet's own wording is used if a code is missing here */
  messages: {
    TOKEN_BAD: "Type {min} to {max} digits. Numbers only.",
    TOKEN_EXISTS: "That number is already taken. Ask the volunteer for a new one.",
    DEVICE_MISMATCH: "That number is already taken. Ask the volunteer for a new one.",
    CHECKING: "Checking your number…",
    CANNOT_REACH: "Cannot reach the internet to check your number. Try again in a moment.",
    SETUP_PROBLEM: "The sheet is not set up right. Tell a volunteer.",
    GENERIC: "Something went wrong. Tell a volunteer."
  },

  splash: {
    kicker: "ILLUMINA PRESENTS · MDI GURGAON",
    t1: "LOAN",
    t2: "&amp;",
    t3: "ORDER",
    line: "Welcome to the batch. Your fee is ₹25 lakh. The deadline is not flexible.",
    tokenLabel: "YOUR NUMBER",
    tokenHelp: "Type the number the volunteer gave you.",
    tokenPlaceholder: "e.g. 482",
    play: "PLAY",
    fine: "This is a research game.",
    noUrl: "Practice mode. The game is not connected to the sheet yet."
  },

  conflict: {
    title: "THAT NUMBER IS TAKEN",
    line: "Another phone already used this number. Ask the volunteer for a new number and start a new game.",
    button: "START A NEW GAME"
  },

  /* GAME 1 */
  g1: {
    introTitle: "SWIPE RIGHT",
    introLine: "Your admit letter is in and the fee is ₹25 lakh. Eight lenders have pitched, one at a time. Some rates are fixed for the whole loan and some float with the market. Swipe right to shortlist a deal and left to pass. Then you pick one lender from your shortlist and sign with them.",
    deal: "DEAL {i} / {n}",
    shortlisted: "SHORTLISTED {n}",
    pass: "← PASS",
    shortlist: "SHORTLIST →",
    stampTake: "SHORTLIST",
    stampPass: "PASS",
    swipeHint: "Swipe the card or tap a button.",
    fixed: "FIXED RATE",
    floating: "FLOATING RATE",
    lblSecurity: "Security",
    lblSanction: "Sanction in",
    lblApplication: "Application",
    lblRepay: "Repayment timeline",
    lblEmi: "EMI style",
    repayValue: "{yrs} years, starting 6 months after the course",
    factorKick: "BEFORE YOUR SHORTLIST",
    factorTitle: "WHAT DECIDED IT?",
    factorQ: "Which factor affected your decision the most?",
    factorBtn: "SHOW MY SHORTLIST",
    shortTitle: "YOUR SHORTLIST",
    shortTitleNone: "NOTHING MADE THE CUT",
    shortMsgNone: "You passed on all eight, but you still need a lender. Pick the one you would sign if you had to.",
    shortMsgOne: "Only one deal made it. Lock it in.",
    shortMsgMany: "{n} deals made it. Pick the one you would actually sign.",
    pickDeal: "PICK A DEAL",
    lockIn: "LOCK IN {name} AT {rate}%"
  },

  /* GAME 2 */
  g2: {
    introTitle: "THE UPSELL",
    introLine: "You signed with {name} at {rate}%. Now their sales team has add-ons. Every add-on you take adds {pts} point to your interest rate for the life of the loan. {count} offers. Take what you want and skip the rest.",
    numberWords: { "5": "Five", "6": "Six" },
    offerOf: "OFFER {i} / {n}",
    from: "FROM {name}",
    priceMain: "+{pts}%",
    priceSub: "on your interest rate, for the whole loan",
    no: "NO THANKS",
    yes: "TAKE IT",
    added: "ADDED",
    skipped: "SKIPPED",
    fixerFirst: ["Psst. Over here.", "One more thing before you sign.", "Everything is negotiable. Even this.", "I have another one for you.", "This might interest you."],
    fixerAfterYes: ["Pleasure doing business.", "Added to your deal. Next one.", "Noted. I have another."],
    fixerAfterNo: ["Fine. Fine. Try this one.", "Your call. Another one.", "Tough crowd. How about this?"],
    sumKick: "YOUR LOAN WITH {name}",
    sumTitle: "PERKS YOU ADDED",
    sumTitleNone: "NO EXTRAS ADDED",
    sumNone: "You kept the standard {name} deal, with no extras.",
    sumBtn: "ON TO PLACEMENT"
  },

  /* GAME 3 */
  g3: {
    introTitle: "PLACEMENT PACKAGE REVEAL",
    introLine: "Click to reveal your placement.",
    introBtn: "REVEAL MY PLACEMENT",
    revealKick: "PLACEMENT PACKAGE REVEAL",
    opening: "OPENING YOUR PLACEMENT PACKAGE",
    jackpot: "JACKPOT",
    imageAlt: "A man in glasses with his arms raised, shouting: 7 crore",
    afterLine: "Jokes aside, you have <b>{n} coins</b> to place.",
    soundAgain: "🔊 Play the sound again",
    soundTap: "🔊 Tap for sound",
    placeBtn: "PLACE MY {n} COINS",
    coinsLeft: "COINS LEFT",
    howTo: "Tap a piggy bank to drop a coin in. Tap − to take one back. You can stack coins. Use all {n}.",
    toGoOne: "1 COIN TO GO",
    toGoMany: "{n} COINS TO GO",
    done: "DONE, THESE ARE MY PICKS",
    dropAria: "Drop a coin in {name}",
    liftAria: "Take a coin out of {name}"
  },

  /* THE RATE GUESS + REVEAL */
  rate: {
    guessKick: "PLACEMENT IS DONE",
    guessTitle: "WHAT IS YOUR RATE?",
    guessQ: "Think back to your loan and every add-on you took. What do you think your interest rate is now?",
    guessAria: "Your interest rate in percent",
    lock: "LOCK MY GUESS",
    noIdea: "I have no idea",
    revealKick: "THE REVEAL",
    isLabel: "YOUR INTEREST RATE IS",
    startedAt: "{name} started at {rate}%",
    plusPoints: "+{n} point{s}",
    yourGuess: "YOUR GUESS",
    actualRate: "ACTUAL RATE",
    noIdeaShort: "No idea",
    noGuessLine: "No guess logged. Here is the real number.",
    spotOn: "Spot on.",
    close: "Very close. Within half a point.",
    tooLow: "You guessed {n} points too low.",
    tooHigh: "You guessed {n} points too high.",
    tailFixed: "That is what you pay on {amount}, fixed for the whole loan.",
    tailFloating: "That is what you pay on {amount}, floating with the market.",
    nailedKick: "YOU GUESSED IT EXACTLY",
    nailedTitle: "NAILED IT",
    nailedLine: "Spot on. Not one point off. {tail}",
    next: "NEXT"
  },

  /* THE LAST QUESTION + THE BILL */
  guess: {
    explainKick: "LAST ONE",
    explainTitle: "READY?",
    explainLine: "One quick guess. No calculator. The question shows up when you tap START.",
    explainBtn: "START",
    title: "ONE LAST QUESTION",
    intro: "Your loan is <b>{amount}</b>, paid out on day one, at <b>{rate}%</b> ({type}).",
    typeFixed: "fixed",
    typeFloating: "floating",
    q: "No calculator. If you pay nothing for 5 years, how much interest has built up by the end of year 5? The closest guess in your session wins a prize.",
    unit: "lakh",
    lock: "LOCK MY GUESS",
    noIdea: "I have no idea"
  },

  bill: {
    kick: "THE BILL",
    title: "TIME TO REVEAL",
    cardKick: "INTEREST BUILT UP BY YEAR 5 ON {amount}",
    yourGuess: "YOUR GUESS",
    noIdea: "No idea",
    tapToReveal: "TAP TO REVEAL",
    actual: "ACTUAL INTEREST",
    offBy: "YOU WERE OFF BY",
    vNoIdea: "No idea is a fair answer. Almost nobody does until the first statement arrives.",
    vWayOff: "Off by a lot. That is the usual mistake.",
    vLow: "Too low. Most people guess low.",
    vClose: "Very close. Impressive.",
    vHigh: "You guessed high. The bank would prefer your number.",
    breakKick: "TOTAL COST BREAKDOWN · 5 YEARS",
    atQuoted: "AT {name}'S QUOTED RATE",
    quotedSub: "{rate}% for 5 years",
    addedBy: "ADDED BY YOUR {n} ADD-ON{s}",
    addedSub: "+{pts}% for 5 years",
    addedNone: "ADDED BY ADD-ONS",
    addedNoneVal: "None",
    addedNoneSub: "You took no add-ons.",
    total: "TOTAL INTEREST OVER 5 YEARS",
    totalSub: "{amount} × {rate}% × 5 years",
    next: "EXIT INTERVIEW"
  },

  exit: {
    kick: "LAST STOP",
    title: "EXIT INTERVIEW",
    line: "Five quick questions on your way out.",
    otherPh: "Please type your answer",
    submit: "SUBMIT"
  },

  thanks: {
    kick: "THANKS FOR PLAYING",
    title: "SEE YOU AT THE CONCERT",
    reset: "RESET"
  },

  /* words used when the answers are written to the sheet */
  sheet: {
    rateTypes: { flt: "Floating rate", fix: "Fixed rate" },
    shortlistNone: "None (passed on all)",
    noIdea: "No idea",
    cleared: "(cleared)",
    lblRate: "Rate",
    lblRateType: "Rate type",
    lblSecurity: "Security",
    lblSanction: "Sanction time",
    lblApplication: "Application",
    lblRepayment: "Repayment",
    years: "{n} years",
    noChange: "No changes",
    typed: "{answer}: {text}"
  }
},

/* ------------------------------------------------------------------
   4. THE EIGHT LENDER CARDS
   n = name, rate = starting interest rate (%), rt = "flt" floating or "fix" fixed,
   yrs = repayment years, lender = lender type, sec = security, time = sanction time,
   app = application process, pay = "std" or "step", payL = EMI style (shown only if step),
   sc = the add-ons this lender offers (keys from UPSELLS below)
   ------------------------------------------------------------------ */
CARDS: [
  { n: "Orchid",  rate: 7.00,  rt: "flt", yrs: 15, lender: "Government-owned bank",    sec: "Parent co-borrower + property pledged", time: "21 days",  app: "Branch-led paperwork",                 pay: "std",  payL: "Standard EMI", sc: ["nocol", "nocosign", "fast", "fixed", "topup", "bundle"] },
  { n: "Granite", rate: 7.50,  rt: "flt", yrs: 15, lender: "Government-owned bank",    sec: "Parent co-borrower, no collateral",     time: "14 days",  app: "App + one branch visit",               pay: "std",  payL: "Standard EMI", sc: ["nocosign", "nobranch", "fixed", "moratorium", "topup", "bundle"] },
  { n: "Harbor",  rate: 8.50,  rt: "fix", yrs: 12, lender: "Government-owned bank",    sec: "Parent co-borrower, no collateral",     time: "7 days",   app: "App + one branch visit",               pay: "std",  payL: "Standard EMI", sc: ["nocosign", "nobranch", "fast", "tenure", "topup", "bundle"] },
  { n: "Cedar",   rate: 8.75,  rt: "flt", yrs: 12, lender: "Large private bank",       sec: "Parent co-borrower, no collateral",     time: "7 days",   app: "100% in-app, video KYC",               pay: "std",  payL: "Standard EMI", sc: ["nocosign", "fast", "fixed", "tenure", "topup", "bundle"] },
  { n: "Falcon",  rate: 9.75,  rt: "fix", yrs: 10, lender: "Large private bank",       sec: "No collateral, no co-borrower",         time: "7 days",   app: "100% in-app, video KYC",               pay: "std",  payL: "Standard EMI", sc: ["fast", "moratorium", "tenure", "rm", "topup", "bundle"] },
  { n: "Saffron", rate: 10.25, rt: "fix", yrs: 10, lender: "Education-loan specialist", sec: "No collateral, no co-borrower",        time: "3 days",   app: "App + documents picked up on campus",  pay: "std",  payL: "Standard EMI", sc: ["moratorium", "tenure", "rm", "topup", "bundle"] },
  { n: "Lotus",   rate: 11.00, rt: "flt", yrs: 8,  lender: "Fintech app",              sec: "No collateral, no co-borrower",         time: "48 hours", app: "100% in-app, video KYC",               pay: "step", payL: "Step-up EMI: starts low, rises yearly", sc: ["fixed", "moratorium", "tenure", "rm", "topup", "bundle"] },
  { n: "Ember",   rate: 11.75, rt: "fix", yrs: 7,  lender: "Fintech app",              sec: "No collateral, no co-borrower",         time: "48 hours", app: "100% in-app, video KYC",               pay: "std",  payL: "Standard EMI", sc: ["moratorium", "tenure", "rm", "topup", "bundle"] }
],

/* ------------------------------------------------------------------
   5. THE ADD-ONS (the upsell)
   t = name (this exact text goes in the sheet), d = the story line shown to the player.
   In d, {time} is the lender's sanction time, {yrs} the repayment years, {yrs5} years plus five.
   effect = what the add-on changes on the deal, used to fill the "final" columns in the sheet:
     sec / time / app = new text, rt = new rate type ("fix"), addYears = extra years.
   perk = true means it adds a perk (listed in the "Other perks added" column).
   The order here is the order the effects are applied.
   ------------------------------------------------------------------ */
UPSELLS: {
  nocol:      { t: "Drop the property pledge",         d: "No security and no collateral. Straight money in the bank.",                                                                   effect: { sec: "Parent co-borrower, no collateral" } },
  nocosign:   { t: "No co-borrower",                   d: "The loan is in your name alone, and your parents sign nothing.",                                                                  effect: { sec: "No collateral, no co-borrower" } },
  fast:       { t: "Sanction letter in 3 days",        d: "Instead of {time}. The money lands long before the fee deadline does, no hassle.",                                                effect: { time: "3 days" } },
  nobranch:   { t: "Zero branch visits",               d: "Someone collects your documents on campus.",                                                                                      effect: { app: "App + documents picked up on campus" } },
  fixed:      { t: "Lock the rate",                    d: "Your floating rate is now fixed for the whole loan.",                                                                             effect: { rt: "fix" } },
  tenure:     { t: "Five extra years to repay",        d: "Repay over {yrs5} years instead of {yrs}. A smaller EMI each month, but you pay interest for 5 more years.",                     effect: { addYears: 5 } },
  moratorium: { t: "+1 year moratorium",               d: "Repayment starts a full year later than usual, so you have more time after college to settle in.",                               perk: true },
  topup:      { t: "₹3 lakh top-up, pre-approved",     d: "A pre-approved extra line for an exchange semester, a laptop or a trip to Mussoorie.",                                           perk: true },
  bundle:     { t: "Salary account + premium card",    d: "A salary account with perks and a lifetime-free credit card, waiting for you at placement.",                                     perk: true },
  rm:         { t: "A relationship manager on WhatsApp", d: "One named person who answers your messages and chases the paperwork.",                                                         perk: true }
},

/* ------------------------------------------------------------------
   6. THE SIX FACTORS (shown after the swiping)
   ------------------------------------------------------------------ */
FACTORS: [
  { k: "rate",  t: "Interest rate" },
  { k: "rtype", t: "Fixed or floating" },
  { k: "sec",   t: "Security" },
  { k: "time",  t: "Sanction time" },
  { k: "app",   t: "Application process" },
  { k: "repay", t: "Repayment timeline" }
],

/* ------------------------------------------------------------------
   7. THE PIGGY BANKS
   ------------------------------------------------------------------ */
BANKS: [
  { k: "prepay", t: "Prepay the loan" },
  { k: "sip",    t: "SIPs and investing" },
  { k: "trip",   t: "Trips and holidays" },
  { k: "house",  t: "A flat of my own" },
  { k: "car",    t: "A car of my own" },
  { k: "emerg",  t: "Emergency fund" },
  { k: "home",   t: "Family back home" },
  { k: "insure", t: "Insurance" },
  { k: "shop",   t: "Gadgets and shopping" },
  { k: "fun",    t: "Weekends and eating out" }
],

/* the funny numbers that spin past before the placement reveal */
CRAZY: ["69", "420", "5RS", "0", "404", "666", "₹1", "1337", "3.14", "42", "100RS", "NaN", "007", "₹5", "911", "2RS", "69420", "0.01", "9999", "13", "1RS", "8"],

/* ------------------------------------------------------------------
   8. THE EXIT INTERVIEW QUESTIONS
   k = the column it fills in the sheet (fund, work, loanBank, problem or channel). Do not rename k.
   q = the question shown, label = short name used in the Swipe log,
   opts = [ ["id", "Answer shown and saved"], ... ]
   type: "text" = a box to type in (no opts), ph = the grey hint inside the box.
   other: "id" = when that answer is tapped, a box opens to type it. It is saved as "Other: what they typed".
   ------------------------------------------------------------------ */
EXIT: [
  { k: "fund",    label: "How the MBA is paid for", q: "How is your MBA actually being paid for?", other: "other",
    opts: [["loan", "An education loan"], ["family", "Family pays"], ["savings", "My own savings"], ["sch", "Scholarship or employer"], ["other", "Other"]] },
  { k: "work",    label: "Work experience", q: "Work experience before the MBA?",
    opts: [["fresh", "Fresher"], ["lt2", "Under 2 years"], ["ge2", "2 years or more"]] },
  { k: "loanBank", label: "Bank the loan is from", q: "Which bank did you take your education loan from?", type: "text", ph: "Type the bank's name, or None" },
  { k: "problem", label: "Biggest problem in the loan process", q: "What was the biggest problem you faced in the loan process?", other: "other",
    opts: [["paper", "Too much paperwork"], ["online", "Too much online hassle"], ["slow", "Slow sanction"], ["secure", "Needing collateral or a co-borrower"], ["rate", "High interest rate"], ["fees", "Hidden charges"], ["reach", "Hard to reach anyone for help"], ["none", "No problem at all"], ["notyet", "I have not applied yet"], ["other", "Other"]] },
  { k: "channel", label: "Preferred way to set up a loan", q: "Which would you prefer for setting up a loan like this?", other: "other",
    opts: [["app", "Apply through an app / website"], ["branch", "Go to the loan office or branch"], ["home", "An agent visits my house"], ["campus", "A loan desk on campus"], ["call", "A video KYC, then e-sign"], ["other", "Other"]] }
]

};

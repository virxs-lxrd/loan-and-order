# Loan and Order: setup guide

This guide is for a beginner. Each step is short. Do them in order. Do not skip.

**What you are building**

- A game that runs in a phone browser. It is hosted free on GitHub.
- Every answer is saved to a Google Sheet.
- Each player types a number (a "token") at the start. Two players cannot use the same number.

**What is in the folder**

| File or folder | What it is |
|---|---|
| `index.html` | The page. You never edit it. |
| `style.css` | Colours, fonts, layout. |
| `app.js` | The game. You never edit it. |
| `data.js` | **All the words, settings, questions and file names.** You edit this one. |
| `apps-script/Code.gs` | The code that goes into Google Apps Script. |
| `images/`, `audio/`, `fonts/` | The 7 crore picture, the sound, the fonts. Nothing loads from the internet. |
| `tests/` | Checks I ran. You can ignore this folder. |

**Two safety rules**

1. Nothing in this project ever deletes your data. To clear test rows, you **rename** the tabs (Step 6).
2. Never change the header row (row 1) of the Players or Swipe log tab. The game checks it.

---

## Step 1. GitHub: make the repository and the website

### 1a. Make an account
1. Open https://github.com in your browser.
2. Click **Sign up**. Follow the screens. Pick a simple username. Confirm your email.

### 1b. Make the repository
1. Click the **+** at the top right. Click **New repository**.
2. In **Repository name** type `loan-and-order`.
3. Choose **Public**. (Free GitHub sites need a public repository.)
4. Do not tick any other box.
5. Click **Create repository**.

### 1c. Upload the files
1. On your computer, unzip `loan-and-order.zip`. You get a folder.
2. On the new repository page, click **uploading an existing file**.
3. Open the unzipped folder. Select **everything inside it**: `index.html`, `style.css`, `app.js`, `data.js`, `README.md`, `SETUP.md`, and the folders `apps-script`, `images`, `audio`, `fonts`, `tests`.
4. Drag them all into the GitHub page. Wait until every file shows in the list.
5. Scroll down. Click **Commit changes**.
6. Check: your repository page should show the files and the 5 folders. If you see only a folder called `loan-and-order`, you dragged the wrong level. Ask me.

### 1d. Turn on the website
1. In the repository, click **Settings** (top row of tabs).
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, find **Source**. Choose **Deploy from a branch**.
4. Under **Branch**, choose `main`. Next to it choose `/ (root)`. Click **Save**.
5. Wait 1 to 2 minutes. Refresh the page.
6. A box appears: "Your site is live at `https://YOURNAME.github.io/loan-and-order/`".
7. Open that link on your phone. You should see the game. It will say "Practice mode". That is correct for now.
8. Write the link down. This is your game link.

---

## Step 2. Google Sheet and Apps Script: paste the code

1. Open https://sheets.google.com. Click **Blank spreadsheet**.
2. Click the title (top left, "Untitled spreadsheet"). Type `Loan and Order`. Press Enter.
3. Click **Extensions**, then **Apps Script**. A new tab opens.
4. Click the project name at the top ("Untitled project"). Type `Loan and Order`. Click **Rename**.
5. On the left you see `Code.gs`. Click it. You see a few lines of sample code.
6. Click inside the code. Press **Ctrl+A** (on Mac: **Cmd+A**). Press **Delete**. The box is empty now.
7. On your computer open `apps-script/Code.gs` (any text editor). Select all. Copy.
8. Paste into the Apps Script box.
9. Click the **disk icon** (Save project). Or press Ctrl+S.

There is no PIN to change. This version has no volunteer panel.

---

## Step 3. Run `setup()` once

1. At the top of the Apps Script page there is a drop-down of function names. Choose **setup**.
2. Click **Run**.
3. A box says "Authorization required". Click **Review permissions**.
4. Choose your Google account.
5. You see "Google hasn't verified this app". This is normal. You wrote it yourself, in your own account. Click **Advanced**. Then click **Go to Loan and Order (unsafe)**.
6. Click **Allow**.
7. Wait. At the bottom, the **Execution log** shows lines like `Players: created.` and `Swipe log: created.`
8. Go back to the Google Sheet tab. At the bottom you now see tabs **Players** and **Swipe log**. The Players tab has a yellow header row.
9. The tab called **Sheet1** is empty and harmless. Leave it. (Delete it yourself later if you want.)

If you run `setup()` again by mistake, it says "already set up. Nothing changed". It is safe.

---

## Step 4. Deploy as a web app

1. In Apps Script, click the blue **Deploy** button (top right). Click **New deployment**.
2. Click the **gear icon** next to "Select type". Click **Web app**.
3. In **Description** type `v1`.
4. **Execute as**: choose **Me (your email)**.
5. **Who has access**: choose **Anyone**. (Not "Anyone with Google account". It must be **Anyone**.)
6. Click **Deploy**.
7. Click **Copy** under **Web app URL**. It starts with `https://script.google.com/macros/s/` and ends with `/exec`.
8. Paste it into a note so you do not lose it.
9. Test it. Open that URL in a new browser tab. You should see: `{"ok":true,"code":"ALIVE", ...}`.
10. If you see a Google sign-in page instead, **Who has access** is wrong. Go to Step 7 and fix the deployment.

---

## Step 5. Put the web app URL into the game

1. Go to your GitHub repository. Click the file `data.js`.
2. Click the **pencil icon** (Edit this file), top right of the file.
3. Find this line near the top:
   `EXEC_URL: "",`
4. Put your URL between the two quote marks. It looks like this:
   `EXEC_URL: "https://script.google.com/macros/s/AKfy.../exec",`
5. Click **Commit changes** (green button, top right). Click **Commit changes** again in the box.
6. Wait about 1 minute.
7. Open your game link on a computer. Press **Ctrl+Shift+R** (Mac: **Cmd+Shift+R**) to refresh hard.
8. The "Practice mode" warning is gone. 

---

## Step 6. Test on the real phone

1. Open your game link on a phone that will be used at the event.
2. Type the number `9001`. Tap **PLAY**.
3. It should go to the first game. The small line under the logo says `No. 9001 · saved`.
4. Play to the end. Try the Back button once. Try one "I have no idea".
5. Open the Google Sheet. Check the **Players** tab: one row for `9001`, with `Finished` in the Status column.
6. Check the **Swipe log** tab: many rows, one for every tap.
7. On a second phone, type `9001` too. It must say "That number is already taken". 
8. Turn on Airplane mode. Play a few cards. Turn it off. The rows arrive on their own within a minute.

**Clear the test rows before the event (rename, never delete)**

1. In the Google Sheet, right-click the **Players** tab at the bottom. Click **Rename**. Type `Players (test)`. Press Enter.
2. Do the same for **Swipe log**. Rename it to `Swipe log (test)`.
3. Go back to Apps Script. Choose **setup** in the drop-down. Click **Run**.
4. You now have fresh, empty **Players** and **Swipe log** tabs. Your test data is kept in the renamed tabs.
5. Test numbers like `9001` can be used again.

---

## Step 7. Updating the script later

Only do this if I give you a new `Code.gs`.

1. Open the Google Sheet. Click **Extensions**, then **Apps Script**.
2. Click `Code.gs`. Press Ctrl+A. Delete. Paste the new code. Click the **disk icon**.
3. Click **Deploy**, then **Manage deployments**.
4. Click the **pencil icon** on your web app.
5. Under **Version**, choose **New version**.
6. Click **Deploy**.
7. The URL **stays the same**. You do not touch `data.js`.

**Important:** saving the code is not enough. If you skip "New version", the live web app keeps running the old code.

**Do I run `setup()` again?** Only if I tell you the columns changed. If they did, run it. It renames the old Players tab to `Players (old layout)` and makes a new one. Nothing is deleted. If nothing changed, running it is harmless.

If the columns do not match, the game does not lose anything. It keeps the answers in the phone and retries. Run `setup()` and they flow in.

---

## Step 8. Edit the words on GitHub

All text is in `data.js`. See the table at the bottom for where each thing is.

1. Open your repository. Click `data.js`.
2. Click the **pencil icon**.
3. Change only the words **inside the quote marks**. Keep the quotes and commas.
4. Do not type a straight double quote (") inside your words.
5. Words in `{curly brackets}` are filled in by the game. Keep them.
6. Click **Commit changes**. Click **Commit changes** again.
7. Wait about 1 minute.
8. On a computer, press Ctrl+Shift+R. On a phone, open the link in a new private tab.
9. Phones can keep an old copy for up to 10 minutes. Make your edits well before the event.

If you make a typing mistake, the game shows a blank page. Open `data.js` again, click **History** (top right), and look at the last edit. Or ask me.

---

## Step 9. Event-day checklist

Before the doors open:

- [ ] Open the game link on the volunteers' phones. Press play with a test number to be sure it works. Use a number you have not used before.
- [ ] You did the "rename test tabs and run `setup()`" step, so the sheet is empty.
- [ ] Open the `/exec` link once in a browser. It shows `ALIVE`.
- [ ] Wi-Fi or mobile data works at the stall.
- [ ] One spare phone is charged and has the game link open.
- [ ] A written list of numbers (001, 002, 003 ...) and a pen. Tick each number when you hand it out.
- [ ] The Google Sheet is open on a laptop. Do not edit rows during the game.

During the event:

- Give each player one number. Never give the same number twice.
- The small line under the logo tells you the state: `saved`, `saving…`, or `offline · will retry`. `offline` is not a problem. The game keeps going and sends the answers later.
- If a player's game is incomplete, do not fix it. **New game, new number.**
- If a phone dies: use the spare phone and give the player a **new number**. The old row stays in the sheet with status `Playing`. That is fine.
- **Never clear the browser's site data or cookies on a game phone.** The phone then forgets its own unfinished number, and it is locked out of it. Clearing only "cached images and files" is fine.
- Tap **RESET** on the last screen to get the next player's start screen.

After the event:

- Wait a minute so all phones can send their last answers.
- Do not delete anything. Download a copy: **File**, **Download**, **Microsoft Excel (.xlsx)**.

---

## Finding the winner

**Rule:** the closest guess to the real 5-year interest wins. If two guesses are equally close, the faster one wins.

**Option A. In the sheet**

1. Open the **Players** tab.
2. Click a cell in the data. Click **Data**, then **Sort range**, then **Advanced range sorting options**.
3. Tick **Data has header row**.
4. Sort by **Off by (Rs)**, A to Z. Click **Add another sort column**. Sort by **Interest guess time (sec)**, A to Z.
5. Click **Sort**. The winner is the top row.
6. Sorting is safe while the game is running. The game finds each row by its token, not by its position.
7. Players who chose "I have no idea" have an empty "Off by". They go to the bottom.

**Option B. One click in Apps Script**

1. Open Apps Script. Choose **topGuesses** in the drop-down. Click **Run**.
2. Read the top 10 in the **Execution log**. It only reads. It changes nothing.

---

## If something looks wrong

| What you see | What it means | What to do |
|---|---|---|
| The line says `offline · will retry` for a long time | The phone cannot reach the sheet. | Check the phone's internet. Open the `/exec` link on that phone. It should say `ALIVE`. The answers are safe in the phone. |
| `/exec` link shows a Google sign-in page | Access is not set to **Anyone**. | Step 7. Pick **New version** and set **Who has access** to **Anyone**. |
| `/exec` link says "Script function not found" or "Sorry, unable to open the file" | The web app was not deployed. | Do Step 4 again. |
| `offline` and the Players tab shows a different header than the code expects | Someone edited row 1. | Run `setup()`. It renames the odd tab and makes a clean one. Answers arrive after that. |
| "That number is already taken" | That token is in the sheet already. | Give the player a new number. |
| Screen "THAT NUMBER IS TAKEN" in the middle of a game | The phone started offline, and another phone had the same number. | Tap **START A NEW GAME**. Give a new number. The first phone's data is not touched. |
| Blank white page after editing `data.js` | A quote mark or comma was removed. | Open `data.js` on GitHub, click **History**, and check the last change. |
| Old words still show | The phone kept an old copy. | Wait 10 minutes or open in a private tab. |
| "not saving · tell a volunteer" | The sheet refused something in a way a retry cannot fix. | Tell me. The answers are kept in the phone. |

---

## Where does each piece of text live?

Everything is in `data.js`, unless the last column says otherwise.

| What you want to change | Section in `data.js` | Notes |
|---|---|---|
| The web app address | `SETTINGS`, `EXEC_URL` | Ends in `/exec` |
| How many digits a number can have | `SETTINGS`, `TOKEN_MIN`, `TOKEN_MAX` | |
| Loan amount, years, points per add-on, coins | `SETTINGS`: `PRINCIPAL`, `TERM_MONTHS`, `ADDON_POINTS`, `COINS` | |
| Play the game with no internet at the start | `SETTINGS`, `ALLOW_PLAY_OFFLINE` | `true` or `false` |
| Retry speed | `SETTINGS`: `RETRY_FIRST_MS`, `RETRY_MAX_MS` | |
| Picture and sound file names | `MEDIA` | The files themselves are in `images/` and `audio/` |
| Page title, logo text, Back button | `TEXT`: `pageTitle`, `logo`, `back` | |
| "THE REGISTRAR" and "THE FIXER" labels | `TEXT`: `registrar`, `fixer` | |
| First screen: title, welcome line, number box, PLAY | `TEXT.splash` | |
| Error messages on the first screen | `TEXT.messages` | |
| The "number is taken" screen | `TEXT.conflict` | |
| The small save line under the logo | `TEXT.sync` | |
| Game 1: swipe screens, factor question, shortlist | `TEXT.g1` | |
| Game 2: the intro, fixer lines, add-on buttons | `TEXT.g2` | |
| Game 3: placement reveal, coins, piggy bank instructions | `TEXT.g3` | |
| Rate guess and the rate reveal | `TEXT.rate` | |
| "One last question" screen | `TEXT.guess` | |
| The bill and the verdict lines | `TEXT.bill` | |
| Exit interview heading and SUBMIT | `TEXT.exit` | |
| Thank-you screen and RESET | `TEXT.thanks` | |
| Words written into the sheet (Fixed rate, None, No idea ...) | `TEXT.sheet` | |
| The eight lender cards | `CARDS` | Name, rate, fixed or floating, years, security, time, application |
| The add-ons and their story lines | `UPSELLS` | `t` is the name. `d` is the story. |
| The five "what decided it" options | `FACTORS` | |
| The ten piggy banks | `BANKS` | |
| The funny numbers that spin | `CRAZY` | |
| Exit interview questions and answers | `EXIT` | `k` must stay `fund`, `work` or `channel` |
| Colours, fonts, spacing | `style.css` | The only look-and-feel file |
| Sheet column names | `apps-script/Code.gs`, `COLUMNS` | Changing these means running `setup()` again |

**A note on names:** the lender names, add-on names, bank names, factor names and exit answers are also what is written into the sheet. If you change one after players have played, the old rows keep the old words.

---

## The Players tab, column by column

One row per number. The columns are in play order.

| Column | What is in it |
|---|---|
| Token, Attempt | The player's number. Attempt is always 1 (a new game uses a new token). |
| Status, Last screen | `Playing` or `Finished`, and where they are or stopped. |
| Started at, Last update, Finished at | Times from the Google server. |
| Lenders shortlisted | In the order swiped right, each with rate and fixed or floating. |
| Factor that mattered most | The factor they picked. |
| Lender locked in, Quoted rate, Quoted rate type, Lender type, Quoted security, Quoted sanction time, Quoted application process, Quoted repayment | The rate card of the lender they chose. |
| Add-ons taken, Add-ons skipped | The names. |
| Final rate, Final rate type, Final security, Final sanction time, Final application process, Final repayment | The deal after the add-ons. This shows changes such as floating to fixed, or co-borrower removed. |
| Other perks added | Moratorium, top-up, salary account, relationship manager. |
| What changed in the upsell | One readable line, for example `Rate: 8.50% → 10.50%; Rate type: Floating rate → Fixed rate`. |
| Coins in each piggy bank | One cell, for example `Prepay the loan x2; SIPs and investing x3`. This replaces ten separate columns. |
| Rate guess, Rate guess time | Their guess of their own rate, and how many seconds it took. |
| Interest guess, Interest guess time | The 5-year interest guess in lakh, and the seconds. |
| Actual interest, Off by | The real number and the gap in rupees. |
| How the MBA is paid for, Work experience, Preferred way to set up a loan | The three exit answers. |
| Device | A random id for the phone. |

The **Swipe log** tab has one row per tap: Time, Token, Attempt, Item, Answer, Note, Device, Request ID. Back-button taps are in it. It is only ever added to.

# Loan and Order

A phone game about MBA education-loan decisions, built for a market-research event.
It is a static website (GitHub Pages) that saves every answer to a Google Sheet through a Google Apps Script web app.

**New here? Open [SETUP.md](SETUP.md).** It has every click, in order.

## How it fits together

```
phone browser  --(POST text/plain, JSON)-->  Apps Script web app (/exec)  -->  Google Sheet
GitHub Pages                                  apps-script/Code.gs               Players + Swipe log
index.html, style.css, app.js, data.js
```

- No framework. No build step. No CDN. Fonts, images and the sound are in the repo.
- `data.js` holds every word, setting, question, item and file name. `app.js` is the engine.
- The phone saves each answer in its own storage first, then sends it. It retries with a growing wait until the sheet says OK. The game never waits for the network.
- Every request has a unique id. The script remembers recent ids, so a repeat after a lost reply is never written twice.
- A token (the player's number) can only be used once. A second phone gets `TOKEN_EXISTS`.
- Every sheet write happens inside a script lock.
- The script never deletes. If an old tab has a different layout, `setup()` renames it.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page shell |
| `style.css` | Look and feel, with local `@font-face` |
| `app.js` | Screens, state, save queue |
| `data.js` | All text and settings (the one file to edit) |
| `apps-script/Code.gs` | `setup()`, `doPost()`, `doGet()`, `topGuesses()` |
| `images/`, `audio/`, `fonts/` | Media |
| `tests/` | Automated checks |
| `SETUP.md` | Beginner setup, updating, event-day checklist, where text lives |

## Browser storage keys

| Key | What |
|---|---|
| `sg_state_v1` | The game in progress (so a reload resumes). Bump the `v1` if the saved shape changes. |
| `sg_queue_v1` | Answers not yet confirmed by the sheet |
| `sg_device_v1` | A random id for this phone |
| `sg_blocked_v1` | Answers the sheet refused for good (for example a taken number), kept aside |

## Request and reply

Request body (JSON, sent as `text/plain` so the browser does no preflight):

```json
{ "rid": "unique", "action": "start | save", "token": "482", "device": "d...", "fields": { "lender": "Harbor" }, "logs": [ { "t": "ISO time", "item": "...", "answer": "...", "note": "..." } ], "v": 1 }
```

Reply: `{ "ok": true|false, "code": "...", "message": "..." }`

| code | meaning | the game does |
|---|---|---|
| `STARTED`, `RESUMED`, `SAVED` | done | removes it from the queue |
| `TOKEN_EXISTS`, `DEVICE_MISMATCH` | the number belongs to another phone | shows the "number is taken" screen, keeps answers aside |
| `NO_PLAYER_ROW` | the row was removed | recreates it, then retries |
| `NO_PLAYERS_TAB`, `PLAYERS_LAYOUT`, `LOG_LAYOUT`, `BUSY`, `SERVER_ERROR` | fixable or temporary | keeps the answers, retries later |
| `BAD_JSON`, `BAD_REQUEST`, `BAD_TOKEN`, `BAD_FIELD`, `BAD_RID`, `UNKNOWN_ACTION` | a bug, never fixes itself | sets it aside, shows "tell a volunteer" |

## Tests

```
node tests/run-all.js          # Apps Script and game logic. Needs nothing installed.
npm i playwright && node tests/run-all.js --e2e   # also plays the whole game in a real browser
```

The tests run the real `Code.gs` against a pretend Google Sheet that is strict like the real one
(writes outside the grid fail, "+1" turns into a number unless the cell is text, writes outside the lock fail).

# Board

A desktop planning view over the notes you already plan from. Today is the
target; everything else is a source you drag lines out of.

It is a second PWA in this repo, deliberately not a second app: same
origin, same `inbox.cfg` in localStorage, so the backend URL and token you
entered in the capture app are already here. Its service worker scopes to
`/dashboard/`, so the two shells never evict each other.

## Install

1. Copy `dashboard/` into the repo that serves the capture PWA, beside
   `index.html`. It is served at `<your pages url>/dashboard/`.
2. Copy `board.py` next to `main.py` in the Cloud Run service and apply
   `main.py.patch.md`. No new dependency; `COPY . .` already picks it up.
3. Open the board. If the capture app has been used on this browser, there
   is nothing to configure.

`ALLOWED_ORIGIN` needs no change — same origin as before.

## Environment

The board reads three notes the service didn't know about. Defaults match
the vault as it stands; override if you move them.

| Variable | Default |
| --- | --- |
| `APPEND_REVIEW_PATH` | `02 Append and Review Note.md` |
| `STALLED_PATH` | `Stalled, New Project List.md` |
| `AAR_OPEN_CATEGORIES` | `India things to do,Restaurants,To Watch` |
| `FUTURE_HORIZON_DAYS` | `14` |

Everything else — the priorities note, the inbox, Future Days, the month
files, the block schedule — comes from the variables already set.

## One note needs a small edit

`Stalled, New Project List.md` has no labels, so the board can't tell a
project from a loose idea. Add two:

```markdown
Projects:
- [[Health]]
	- [ ] Abhinav setup dermatology referral through Galileo health
- [ ] Setup Privacy Trees
Ideas:
- Skydiving
```

A top-level `- [ ]` with no wikilink is treated as a project that has no
page yet, so it can carry subtasks and be dragged into Top Priorities.
Ideas are plain bullets with no checkbox, so nothing tries to schedule
them. `## Stalled List` works as an `Ideas:` label too.

## What a drag does

A drag is always a move: the line leaves the source and lands at the
target, so there is still exactly one live copy. The destination is
written first and the source cleared second — a failure in between leaves
a duplicate, which the next load flags, never a lost task.

| Dropped on | What is written |
| --- | --- |
| a block in Today | `### Today Tasks`, stamped `\| Morning` |
| Today, from a project | under that project's bullet in `### Project Tasks` |
| a Future Days date | under that date, nested under its project bullet if it has one |
| a project | a subtask of that project |
| an append-and-review category | a plain bullet at the position you dropped it |
| the trash strip | back to the inbox — nothing is ever destroyed |

Order matters in two places, so reordering is a real edit: a project's
first open subtask is its next action, and the top of an
append-and-review category is what stays in view.

## The rest of it

- **Date picker in the header** plans any day. Past days render as the
  record they are.
- **`defer view`** shades every unfinished task with where `/defer` would
  send it tomorrow: `stays`, `→ project`, `→ future`.
- **Block capacity** (`50 / 168 min`) is computed with the same helpers
  `/daily` budgets with, so "over" here means what the scheduler means by
  full. It turns amber past the line.
- **Type into a block** to add a task straight to the day.
- **`✎`** renames in place, **`◷`** schedules for a date.
- **Undo** on every move, for five seconds. It is the same call with the
  ends swapped.
- **Keys**: `←` `→` change day, `r` refreshes, `Esc` closes a sheet.
- A warning bar appears when two open tasks normalize to the same text,
  because `/check` cannot tell them apart.

## Endpoints

`GET /board?date=` — every pane in one round trip, six notes read in
parallel plus the calendar.

`POST /move` — `{text, new_text?, from, to, position?}`, where an address
is `{pane, date?, block?, project?, category?}` and `pane` is one of
`day`, `future`, `inbox`, `priorities`, `stalled`, `aar`.

## Tests

`test_board.py` (parsers and mutations against the real note samples),
`test_roundtrip.py` (a project task through Future Days and home again),
`test_e2e.py` (real drags in a real browser against `fakevault.py`, which
runs the actual service over an in-memory vault).

```
python3 test_board.py && python3 test_roundtrip.py
python3 fakevault.py &                  # port 8099
(cd dashboard && python3 -m http.server 8098) &
python3 test_e2e.py
```

## Bumping the shell

`sw.js` serves the shell cache-first. Change `index.html` and you must
bump `CACHE` in `sw.js`, or the browser keeps running the old board.

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
| `DROPPED_PATH` | `30-Tasks/Dropped.md` |
| `DROPPED_SHOW_DAYS` | `7` |

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
| the strip at the bottom | dropped — logged in `Dropped.md`, not destroyed |

Order matters in two places, so reordering is a real edit: a project's
first open subtask is its next action, and the top of an
append-and-review category is what stays in view.

## Dropping

There is no delete. `×` on a row, the strip at the bottom, or `Backspace`
on a focused row all do the same thing: move the line to
`30-Tasks/Dropped.md` under today's date, carrying where it came from.

```markdown
## 2026-09-19
- [ ] Faceless youtube channel %%from: stalled%%
- [ ] Soccer cleats PHANTOM VENOM %%from: aar · To buy%%
```

The `%%…%%` mark is an Obsidian comment, so it is invisible in reading
view, and it is the same provenance convention `%%ai%%` already uses. It
never becomes part of a task's identity.

Two reasons this is a move rather than an erasure. A stray drag should
never destroy anything — so there is no confirmation dialog, just a
five-second undo and a file you can open. And the system had no way to say
no to a task: `Dropped.md` is the only record of what you chose not to do,
which makes "what do I keep abandoning, and how long did it survive first"
answerable for the first time.

The graveyard card shows the last seven days, collapsed, newest first. It
is a drag source like any other pane, so restoring is just dragging a line
back out — or `◷` to schedule it for a date. A completed task in a month
file has no `×`: that is the record.

## Reloading is manual

The board never reloads itself. A drag writes to the vault and leaves the
row where you dropped it — it does not re-fetch, because rebuilding the
whole board after every move threw away your scroll position and the
groups you had open, and moved the lanes out from under the next drag.

`↻` reloads. So does changing day, and so does an undo. When something is
unsaved or stale the status line says so (`edited · ↻`, `4m old · ↻`)
rather than acting on it. A failed move reloads on its own, because at
that point the screen and the vault disagree.

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
- **Keys**: `←` `→` change day, `r` reloads, `Esc` closes a sheet,
  `Backspace` drops the focused row.
- **While dragging**, every lane shows its edge, the one that will catch
  the drop is highlighted, and its name floats beside the pointer.
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

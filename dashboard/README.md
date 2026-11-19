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
| `GROOMING_PATH` | `30-Tasks/Grooming.md` |
| `AAR_OPEN_CATEGORIES` | `India things to do,Restaurants,To Watch` |
| `DROPPED_PATH` | `30-Tasks/Dropped.md` |
| `DROPPED_SHOW_DAYS` | `7` |

Everything else — the priorities note, the inbox, Future Days, the month
files — comes from the variables already set.

## How the stalled note is read

`Stalled, New Project List.md` does NOT need labels. The board scans the
whole note and groups by the nearest heading, so a scratchpad like this
works as-is:

```markdown
##### Need to Start Right away
- [[Office Trip Return to USA Oct 2026]]
- [ ] Loft sofa - new project to find a recliner use meta muse
##### Need to Start in future
- [ ] Autonomus Trading Bot
	- [ ] https://github.com/TraderAlice/OpenAlice
- [[AI Testing]]
	- [ ] Use Venice AI and sample prompt ideas?
- Skydiving
```

A top-level `- [ ]` (or `[[wikilink]]`) bullet is a project; a plain bullet
is an idea; indented bullets are that project's next actions. Labels such
as `Projects:` and `Ideas:` are still accepted when present. Projects keep
their source heading in the Projects view.

## What a drag does

A drag is always a move: the line leaves the source and lands at the
target, so there is still exactly one live copy. The destination is
written first and the source cleared second — a failure in between leaves
a duplicate, which the next load flags, never a lost task.

| Dropped on | What is written |
| --- | --- |
| Today | under `### Today Tasks` (or `### Project Tasks`, nested under that project's bullet, when it came from one) |
| a Future Days date | under that date, nested under its project bullet if it has one |
| a project | a subtask of that project |
| Grooming | an unchecked bullet under `## To groom`, nested under its project when it has one |
| an append-and-review category | a plain bullet at the position you dropped it |
| the strip at the bottom | dropped — logged in `Dropped.md`, not destroyed |

Order matters in two places, so reordering is a real edit: a project's
first open subtask is its next action, and the top of an
append-and-review category is what stays in view.

## Grooming

`30-Tasks/Grooming.md` (override with `GROOMING_PATH`) is a dedicated
note, not a tag. Location is the state:

```markdown
## To groom
- [ ] Read the zoning packet
- [[Kitchen remodel]]
	- [ ] Pick a cabinet finish
## Someday
- [ ] Learn to sail
```

Only `## To groom` counts in the sidebar and is the queue. `## Someday`
is parked: visible in the view, deliberately not in the number, and
`/daily` never reads either section. Park something with the add line on
the Grooming view, `⋯ → grooming` on any row, or by dragging a row there.
Moving a task out (to Today, a project, priorities) is what makes it
ready. Entry is manual only; `/triage` behaviour is unchanged.

## Projects

The Projects view merges the active `Top Projects:` bullets with the
stalled list. Each project shows its source (active/stalled), its open
next-action count, the first unchecked subtask, and how many dated tasks
are parked for it in Future Days. Two endpoints back the inline add
lines:

- `POST /projects/add` `{name}` — append `- [[name]]` to Top Projects.
- `POST /stalled/projects/add` `{name}` — park a project in the stalled note.
- `POST /project/task` `{project, text}` — file a next action at the top
  of that project's subtasks (Top Priorities first, then the stalled
  list).
- `POST /project/move` `{name, from, to}` — move a whole project and its
  next actions between `priorities` and `stalled`.

Both creation endpoints are idempotent; rerunning either never duplicates
a line. Each project card has a `→ priorities` / `→ stalled` button that
uses `/project/move`.

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
- **Type into the day** to add a task straight to it.
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

`GET /board?date=` — every pane in one round trip, all notes read in
parallel plus the calendar.

`POST /move` — `{text, new_text?, from, to, position?}`, where an address
is `{pane, date?, project?, category?}` and `pane` is one of
`day`, `future`, `inbox`, `priorities`, `stalled`, `aar`, `grooming`. A
`block` key is still accepted in `to` for compatibility with older clients
but is ignored — the day is one flat list now.

`POST /projects/add` — `{name}`; `POST /project/task` — `{project, text}`.

## The cap

Future Days entries dated today or earlier are commitments. `/daily`
charges them against the cap first and lets all of them land, then fills
the rest with priorities, project next actions, recurring duties, and
inbox captures. If the dated work already meets the cap, none of those
auto-sources pull. Both the day summary and the dashed cap line say how
many tasks are over, because an over-cap day you planned yourself is a
fact to show, not a load to hide. `/more` pulls every remaining dated
commitment first, then tops up to `MORE_TAKE`.

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

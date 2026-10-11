# STEP 2: introductions and discovery

The existing STEP 1 HOME, tab IDs 0–7, default CALENDAR, URLs, authentication,
favorites, search and notifications remain. No schema, workflow or user data changed.

## Introduction sources

`start-here.json` is the minimal editorial input file. The operator supplied the
NamuWiki text, revision 2026-10-02 11:59:54. Intro and thirteen terms are paraphrased;
source, contributor credit, CC BY-NC-SA 2.0 KR and adaptation notice are available
in a collapsed “출처 및 이용조건” disclosure. The verbose footer, displayed revision
and redundant official-channel explanation were removed; source metadata remains.
The source was not independently fetched. Introductory music/series are editorial
selections from that text, resolved by exact MUSIC/CONTENT IDs. Display titles,
dates, summaries and links come from the existing DB. These are not popularity
rankings. Official channel URLs reuse the existing site's quick menu.

CALENDAR is date-based schedules/broadcast information; SCHEDULE is the existing
monthly Google Sheet. SONGBOOK is the catalog; MUSIC is published music/series.
LIVE RECORD is performed-song history; CONTENT is the planned-content archive.

## Connections and limitations

- calendar.html?date=YYYY-MM-DD opens that date after the selected month loads.
- HOME schedule links reuse the existing calendar iframe for date details.
- Date songs use live_songs.performed_date; the UI says they are date-based and
  does not claim they belong to a particular schedule on that day.
- songbook.html?view=live&date=YYYY-MM-DD filters the existing archive, with a
  visible clear button. Parent-frame links reuse LIVE RECORD.
- Clip → SONGBOOK requires the same SOOP/YouTube media ID. Song detail reuses
  loaded rows and ensureLiveAllForSongDetail(); MUSIC matches clip/MR media IDs,
  live records match the clip ID, and CONTENT matches a replay marked 정상.
- Shared video means shared media, not equivalence of song versions. No similar
  title, same-date guess, or channel URL creates a song relationship.
- CONTENT detail links its stored broadcast date to CALENDAR; old ?content=UUID
  detail links and editor behavior remain.

Distinct broadcast versions and most performances/collabs lack trustworthy
relation IDs. They show an empty state. For later expansion, the minimum proposal
is an editorial relation file with songId, liveRecordIds, contentIds, scheduleIds,
and an evidence URL per mapping, validated against registered rows. Do not fill
it by title similarity or migrate the DB automatically.

## UP policy

Previously CALENDAR checked once per document after 700ms and automatically
opened active show_on_startup events, unless beadyoUpAutoPopupHideUntil hid them
for today or a week. STEP 2 opens no automatic UP popup, including standalone
CALENDAR. Notifications and existing manual UP buttons retain detail,
ranking, original post and participation links. Browser hide values and DB flags
are retained. Old startup controls are disabled and explain the current manual UP
policy. The HOME UP card was removed on the user’s follow-up request. Event management/order and other calendar notice policies are unchanged.

## Mobile, loading and rollback

At <=640px HOME/CALENDAR/SONGBOOK/CONTENT/MORE replace the horizontal primary
menu. MORE exposes every original tab with descriptions. MUSIC submenus retain
their routes, labeled GEMBOX/TRACTOR SERVICE in English. Bottom navigation uses
flex layout and does not cover frames; native dialogs restore focus and Escape.

Reads use 6s request timeout and independent 12s area deadlines, pagination and
five-minute in-memory cache of completed reads only. Empty results and errors
are distinct. A failed song catalog retains already-read date records/clips and
allows retry. Guide data areas fail independently from the static introduction.
Related song details reuse the existing live archive reader and completed caches.
An incomplete archive year is tracked in memory and retried with strict error
reporting for the detail panel; the existing archive list fallback stays intact.
JSON body parsing is bounded as well as the initial network response.

Preview: http://localhost:3000/ and /#home. Run existing Node/Python suites plus
scripts/test-explore.cjs. Browser-check 320/375/desktop, paths, date/song links,
UP/manual detail and ignored tmp/step2-* failure harnesses. Never ship harnesses.

For STEP 2 rollback, restore the before-file snapshot and remove only STEP 2 new
files, preserving STEP 1. Do not reset the whole repo or discard other edits.
Publishing still requires user authorization and the patch-note preflight.

SCHEDULE is accessible from the small calendar spreadsheet link (above SAT on desktop; below month controls on mobile). Its original #schedule/?tab=schedule routes and monthly sheet selection remain, while the top tabs, quick menu and MORE omit it. Tab indices remain stable.

2026-10-11 review: concurrent identical reads share one paginated request; failures release it for retry, and partial rows remain uncached. GUIDE reads only the configured UUID selections (one MUSIC and three CONTENT records), with empty selections skipping network reads. Existing selection order and independent failure handling remain.

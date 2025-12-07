# Manual Testing Plan - Mobile App

This testing plan focuses on the playback sync refactor (Phases 3-5). For the full refactor specification, see `/SYNC_REFACTOR_SPEC.md`.

---

## Prerequisites

Before testing, ensure:
- [ ] Server is running (`cd ambry && iex -S mix phx.server`)
- [ ] App is built and running on device/simulator
- [ ] At least 2-3 audiobooks available in library
- [ ] (For multi-device tests) Second device or simulator available

### Useful Debug Queries

**Check server playthroughs:**
```sql
SELECT p.id, p.status, p.started_at, p.finished_at, m.book_id
FROM playthroughs p
JOIN media m ON m.id = p.media_id
WHERE p.user_id = '<user_id>'
ORDER BY p.updated_at DESC;
```

**Check server events:**
```sql
SELECT pe.type, pe.timestamp, pe.position, pe.playback_rate
FROM playback_events pe
WHERE pe.playthrough_id = '<playthrough_id>'
ORDER BY pe.timestamp DESC
LIMIT 20;
```

---

## 1. Playthrough Creation

### 1.1 First Play - New Playthrough
**Scenario:** User plays a book they've never listened to before.

**Steps:**
1. Open a book you've never played
2. Tap Play button
3. Audio should start from the beginning

**Expected:**
- [ ] New playthrough created with status `in_progress`
- [ ] `start` lifecycle event recorded
- [ ] `play` event recorded with position 0
- [ ] State cache created with position 0
- [ ] Playthrough appears in "In Progress" shelf section

### 1.2 First Play - After Server Migration
**Scenario:** User had a PlayerState before the refactor, now migrated to playthrough.

**Steps:**
1. Use an account that had PlayerState data before migration
2. Open that book in the app
3. Tap Play

**Expected:**
- [ ] Playthrough should exist (migrated from PlayerState)
- [ ] Position should match the old PlayerState position
- [ ] Playback resumes from that position

---

## 2. Playthrough Resumption

### 2.1 Resume In-Progress Playthrough
**Scenario:** User has an in-progress playthrough and taps play.

**Steps:**
1. Play a book, pause partway through (e.g., 5 minutes in)
2. Close the player / navigate away
3. Return to the book and tap Play

**Expected:**
- [ ] Playback resumes from paused position (not from beginning)
- [ ] No "Resume or Start Fresh" prompt shown
- [ ] `play` event recorded with correct position

### 2.2 Resume After App Restart
**Scenario:** User restarts the app and resumes playback.

**Steps:**
1. Play a book, pause at a specific position
2. Force quit the app completely
3. Reopen app
4. Navigate to the book and tap Play

**Expected:**
- [ ] Position loaded from state cache
- [ ] Playback resumes from correct position
- [ ] Playback rate preserved

### 2.3 Resume After Background Playback Stops
**Scenario:** User was playing in background, playback paused, app was killed by OS.

**Steps:**
1. Play a book
2. Background the app (playback continues)
3. Wait for playback to pause (battery saver, etc.) or pause manually
4. Swipe away the app from recents
5. Reopen app and tap Play on same book

**Expected:**
- [ ] Position is correct (from last pause event)
- [ ] No data loss from background session

---

## 3. Resume/Start Fresh Dialog

### 3.1 Finished Playthrough - Choose Resume
**Scenario:** User finished a book and chooses to resume.

**Steps:**
1. Use a book with a finished playthrough (or let one finish)
2. Navigate to that book
3. Tap Play
4. Dialog appears: "Resume or Start Fresh?"
5. Tap "Resume"

**Expected:**
- [ ] Dialog appears with book title
- [ ] Playthrough status reverts to `in_progress`
- [ ] `finished_at` cleared (set to null)
- [ ] Playback resumes from last position
- [ ] Book reappears in "In Progress" section

### 3.2 Finished Playthrough - Choose Start Fresh
**Scenario:** User finished a book and chooses to start fresh.

**Steps:**
1. Use a book with a finished playthrough
2. Navigate to that book, tap Play
3. Dialog appears
4. Tap "Start Fresh"

**Expected:**
- [ ] New playthrough created with status `in_progress`
- [ ] Original finished playthrough remains (status still `finished`)
- [ ] Playback starts from position 0
- [ ] `start` event recorded on new playthrough
- [ ] Book appears in "In Progress" section

### 3.3 Finished Playthrough - Cancel Dialog
**Scenario:** User cancels the resume/start fresh dialog.

**Steps:**
1. Use a book with a finished playthrough
2. Tap Play
3. Dialog appears
4. Tap "Cancel" or tap outside dialog

**Expected:**
- [ ] Dialog dismissed
- [ ] No changes to playthrough
- [ ] No playback started

### 3.4 Abandoned Playthrough - Resume
**Scenario:** User abandoned a book and chooses to resume.

**Prerequisites:** Need to abandon a playthrough (currently requires manual DB edit since 5c is deferred)

**Steps:**
1. Use a book with abandoned playthrough
2. Tap Play
3. Dialog appears
4. Tap "Resume"

**Expected:**
- [ ] Playthrough status reverts to `in_progress`
- [ ] `abandoned_at` cleared
- [ ] Playback resumes from last position

### 3.5 Abandoned Playthrough - Start Fresh
**Scenario:** User abandoned a book and starts fresh.

**Steps:**
1. Use a book with abandoned playthrough
2. Tap Play
3. Tap "Start Fresh"

**Expected:**
- [ ] New playthrough created
- [ ] Original abandoned playthrough remains
- [ ] Playback starts from beginning

---

## 4. Event Recording

### 4.1 Play/Pause Events
**Scenario:** Verify play and pause events are recorded correctly.

**Steps:**
1. Start playing a book
2. Let it play for 30 seconds
3. Pause
4. Wait 5 seconds
5. Play again
6. Let it play for 30 seconds
7. Pause

**Expected (check DB or server after sync):**
- [ ] `play` event at ~0:00
- [ ] `pause` event at ~0:30
- [ ] `play` event at ~0:30
- [ ] `pause` event at ~1:00
- [ ] Each event has correct `position` and `playbackRate`
- [ ] Each event has `deviceId`

### 4.2 Seek Events
**Scenario:** Verify seek events are recorded with debouncing.

**Steps:**
1. Start playing
2. Seek forward 2 minutes (single seek)
3. Wait 5+ seconds (for debounce to complete)
4. Rapidly seek several times in succession (scrubbing)
5. Stop scrubbing, wait 5+ seconds

**Expected:**
- [ ] First seek: `seekCompleted` event recorded after 5s debounce
- [ ] Scrubbing: Only ONE `seekCompleted` event recorded (debounced)
- [ ] Events have `fromPosition` and `toPosition`
- [ ] `position` matches `toPosition`

### 4.3 Rate Change Events
**Scenario:** Verify playback rate changes are recorded.

**Steps:**
1. Start playing at 1.0x speed
2. Change to 1.5x
3. Change to 2.0x
4. Change back to 1.0x

**Expected:**
- [ ] `rate_change` event for each change
- [ ] `previousRate` and `playbackRate` correct on each
- [ ] `position` recorded at time of change

### 4.4 State Cache Updates
**Scenario:** Verify state cache is updated periodically during playback.

**Steps:**
1. Start playing
2. Let it play for 60+ seconds without interaction
3. Check state cache

**Expected:**
- [ ] `playthroughStateCache` updated with current position
- [ ] Heartbeat mechanism keeps cache reasonably current

---

## 5. Finish Detection

### 5.1 Auto-Finish at End of Book
**Scenario:** Book finishes naturally and playthrough marked complete.

**Steps:**
1. Start a short audiobook or skip to near the end
2. Let it play until the end

**Expected:**
- [ ] `PlaybackQueueEnded` triggers finish logic
- [ ] `finish` lifecycle event recorded
- [ ] Playthrough status changed to `finished`
- [ ] `finished_at` timestamp set
- [ ] Book moves from "In Progress" to "Finished" section
- [ ] Sync triggered after finish

### 5.2 Finish Triggers Sync
**Scenario:** Verify sync happens after finish.

**Steps:**
1. Put device in airplane mode
2. Skip to end of book, let it finish
3. Check local DB - playthrough should be `finished` with `synced_at = NULL`
4. Turn off airplane mode
5. Wait a few seconds or trigger another pause

**Expected:**
- [ ] Playthrough synced to server
- [ ] Events synced to server
- [ ] `synced_at` populated locally

---

## 6. Sync Triggers

### 6.1 Sync on Pause
**Scenario:** Pausing triggers an up-sync.

**Steps:**
1. Put device in airplane mode
2. Play a book for 30 seconds
3. Pause
4. Turn off airplane mode immediately after pause
5. Check server for synced data

**Expected:**
- [ ] Sync attempted on pause
- [ ] Once online, playthrough and events appear on server

### 6.2 Sync on App Background
**Scenario:** Backgrounding the app triggers sync.

**Steps:**
1. Play a book
2. Background the app (home button)
3. Wait a moment
4. Check server

**Expected:**
- [ ] Events synced when app backgrounded
- [ ] (Note: Behavior depends on OS; may need to verify on specific platforms)

### 6.3 Down-Sync on App Foreground
**Scenario:** Returning to app pulls down changes from server.

**Steps:**
1. On Device A: Play a book, pause at position X
2. On Device B (or server): Modify the playthrough position
3. On Device A: Background then foreground the app
4. Check if Device A has updated data

**Expected:**
- [ ] Changes from server appear locally
- [ ] Latest timestamp wins for conflicts

### 6.4 Offline Play - Delayed Sync
**Scenario:** User plays offline, syncs when back online.

**Steps:**
1. Download a book for offline
2. Put device in airplane mode
3. Play, pause, seek, change rate - various events
4. Turn off airplane mode
5. Trigger a sync (pause or background app)

**Expected:**
- [ ] All events recorded locally while offline
- [ ] All events sync successfully when online
- [ ] Timestamps preserved correctly

---

## 7. My Shelf UI

### 7.1 In Progress Section
**Scenario:** Verify "In Progress" shows correct playthroughs.

**Steps:**
1. Have several in-progress playthroughs
2. Navigate to Shelf tab

**Expected:**
- [ ] "In Progress" section shows playthroughs with status `in_progress`
- [ ] Each tile shows: cover art, book title, progress bar
- [ ] Progress bar reflects current position vs total duration
- [ ] "Last listened" time shown (TimeAgo component)
- [ ] Sorted by most recent activity

### 7.2 In Progress - Tap to Play
**Scenario:** Tapping an in-progress tile starts playback.

**Steps:**
1. Tap a tile in "In Progress" section

**Expected:**
- [ ] Player loads with that book
- [ ] Playback starts from saved position
- [ ] No resume prompt (it's already in-progress)

### 7.3 Finished Section
**Scenario:** Verify "Finished" shows completed playthroughs.

**Steps:**
1. Have at least one finished playthrough
2. Navigate to Shelf tab
3. Look for "Finished" section

**Expected:**
- [ ] "Finished" section visible
- [ ] Shows playthroughs with status `finished`
- [ ] Tiles show cover art and title
- [ ] "Finished at" time shown
- [ ] No progress bar (already complete)

### 7.4 Finished - Tap to View
**Scenario:** Tapping a finished tile navigates to book.

**Steps:**
1. Tap a tile in "Finished" section

**Expected:**
- [ ] Navigates to book detail screen
- [ ] (Tapping play from there would show resume prompt)

### 7.5 TimeAgo Updates
**Scenario:** Verify TimeAgo component updates over time.

**Steps:**
1. Play a book briefly, then pause
2. Navigate to Shelf
3. Note the "Last listened" time
4. Wait 1 minute
5. Check if time updated

**Expected:**
- [ ] Time updates from "just now" to "1m ago" etc.
- [ ] Updates happen automatically (component refreshes)

### 7.6 View All - In Progress
**Scenario:** "See all" link shows full in-progress list.

**Steps:**
1. Tap "See all" in In Progress section

**Expected:**
- [ ] Full page list of all in-progress playthroughs
- [ ] Pagination/infinite scroll if many items
- [ ] Same tile format as home section

### 7.7 View All - Finished
**Scenario:** "See all" link shows full finished list.

**Steps:**
1. Navigate to Finished tab/page

**Expected:**
- [ ] Full list of all finished playthroughs
- [ ] Ordered by finished_at date (most recent first)

---

## 8. Multi-Device Scenarios

### 8.1 Start on Device A, Continue on Device B
**Scenario:** Seamless handoff between devices.

**Steps:**
1. Device A: Start a new book, play to 5:00, pause
2. Wait for sync
3. Device B: Open app, navigate to same book
4. Tap Play

**Expected:**
- [ ] Device B shows book in "In Progress"
- [ ] Device B resumes from ~5:00 position
- [ ] Same playthrough used (not new one created)

### 8.2 Both Devices Play Same Book
**Scenario:** Both devices have active playback on same book.

**Steps:**
1. Device A: Play book, get to 5:00
2. Device B: Open app, play same book (should resume from ~5:00)
3. Device A: Continue playing to 7:00, pause
4. Device B: Pause at 6:00
5. Device A: Resume
6. Both sync

**Expected:**
- [ ] Latest timestamp wins
- [ ] Both devices eventually converge to same position
- [ ] No duplicate playthroughs created
- [ ] No data corruption

### 8.3 Finish on Device A, Resume on Device B
**Scenario:** User finishes on one device, resumes on another.

**Steps:**
1. Device A: Finish a book (let it play to end)
2. Wait for sync
3. Device B: Navigate to that book, tap Play
4. Resume prompt should appear
5. Tap "Resume"

**Expected:**
- [ ] Device B sees finished status (after sync)
- [ ] Resume prompt appears on Device B
- [ ] After resuming, both devices see `in_progress`

### 8.4 New Device Setup
**Scenario:** User sets up app on brand new device.

**Steps:**
1. Install app on new device
2. Log in with existing account
3. Navigate to Shelf

**Expected:**
- [ ] All playthroughs sync down from server
- [ ] "In Progress" shows current books
- [ ] "Finished" shows completed books
- [ ] Tapping play resumes from correct position

---

## 9. Edge Cases

### 9.1 Very Short Book
**Scenario:** Book that's only a few minutes long.

**Steps:**
1. Find or upload a very short audiobook (< 5 minutes)
2. Play from beginning to end

**Expected:**
- [ ] Playthrough created correctly
- [ ] Finish detection works
- [ ] No issues with short duration

### 9.2 Very Long Book
**Scenario:** Book that's 30+ hours.

**Steps:**
1. Play a long audiobook
2. Skip around to various positions
3. Verify position saves correctly at large values

**Expected:**
- [ ] No precision issues with large position values
- [ ] Progress bar displays correctly
- [ ] Events recorded correctly

### 9.3 Rapid Play/Pause
**Scenario:** User rapidly taps play/pause.

**Steps:**
1. Tap play
2. Immediately tap pause (within 1 second)
3. Tap play
4. Immediately tap pause
5. Repeat 5-10 times

**Expected:**
- [ ] App doesn't crash
- [ ] Events recorded (may be many, that's OK)
- [ ] Final state is consistent

### 9.4 Seek While Paused
**Scenario:** User seeks while playback is paused.

**Steps:**
1. Play a book, pause
2. Seek to a different position
3. Wait for debounce (5s)
4. Resume playback

**Expected:**
- [ ] `seekCompleted` event recorded
- [ ] State cache updated with new position
- [ ] Playback resumes from seeked position

### 9.5 Change Rate While Paused
**Scenario:** User changes playback rate while paused.

**Steps:**
1. Play a book, pause
2. Change playback rate
3. Resume

**Expected:**
- [ ] `rate_change` event recorded
- [ ] New rate applied when playback resumes

### 9.6 Kill App During Playback
**Scenario:** Force quit app while audio is playing.

**Steps:**
1. Start playback
2. Force quit the app (swipe away from recents)
3. Reopen app
4. Resume playback

**Expected:**
- [ ] Position recovered (from last event or state cache)
- [ ] Minimal data loss (maybe a few seconds)
- [ ] No crash on reopen

### 9.7 No Network on First Launch
**Scenario:** User opens app with no network connection.

**Steps:**
1. Enable airplane mode
2. Open app (logged in previously)
3. Navigate to a downloaded book
4. Play the book

**Expected:**
- [ ] Playthrough created locally
- [ ] Events recorded locally
- [ ] Playback works normally
- [ ] Syncs when network returns

### 9.8 Server Unavailable During Sync
**Scenario:** Server goes down mid-sync.

**Steps:**
1. Play a book, pause (triggers sync)
2. While sync is in progress, stop the server
3. Observe behavior

**Expected:**
- [ ] App handles failure gracefully (no crash)
- [ ] Unsynced data preserved locally
- [ ] Retry on next trigger

### 9.9 Switch Accounts
**Scenario:** User logs out and logs in as different user.

**Steps:**
1. Play some books as User A
2. Log out
3. Log in as User B
4. Check Shelf

**Expected:**
- [ ] User B sees only their playthroughs
- [ ] User A's local data isolated or cleared
- [ ] No cross-contamination of data

### 9.10 Same Book, Multiple Servers
**Scenario:** User has same book on two different Ambry servers.

**Steps:**
1. Connect to Server A, play a book
2. Switch to Server B (has same book)
3. Play the same book

**Expected:**
- [ ] Separate playthroughs per server
- [ ] No data confusion between servers
- [ ] User identity is `(url, userEmail)` composite

---

## 10. Sleep Timer Interaction

### 10.1 Sleep Timer During Playback
**Scenario:** Sleep timer triggers while playing.

**Steps:**
1. Start playback
2. Set sleep timer for 1 minute
3. Wait for timer to fire

**Expected:**
- [ ] Playback pauses when timer fires
- [ ] `pause` event recorded
- [ ] Position saved correctly
- [ ] Sync triggered

### 10.2 Sleep Timer + Book Finishes
**Scenario:** Book finishes before sleep timer.

**Steps:**
1. Skip to near end of book
2. Set sleep timer for 10 minutes
3. Let book finish

**Expected:**
- [ ] Finish detected, playthrough marked finished
- [ ] Sleep timer cancelled (no orphan timer)

---

## 11. Chapter Navigation

### 11.1 Skip to Next Chapter
**Scenario:** User skips to next chapter.

**Steps:**
1. Start playback in middle of a chapter
2. Tap "next chapter" button
3. Wait for seek debounce

**Expected:**
- [ ] `seekCompleted` event recorded
- [ ] Position is at start of next chapter
- [ ] UI updates to show new chapter

### 11.2 Skip to Previous Chapter
**Scenario:** User skips to previous chapter.

**Steps:**
1. Start playback in middle of a chapter
2. Tap "previous chapter" button
3. Wait for seek debounce

**Expected:**
- [ ] `seekCompleted` event recorded
- [ ] Position is at start of current or previous chapter
- [ ] Behavior matches expected UX (restart current vs go back)

---

## Test Sign-Off

| Section | Tester | Date | Pass/Fail | Notes |
|---------|--------|------|-----------|-------|
| 1. Playthrough Creation | | | | |
| 2. Playthrough Resumption | | | | |
| 3. Resume/Start Fresh Dialog | | | | |
| 4. Event Recording | | | | |
| 5. Finish Detection | | | | |
| 6. Sync Triggers | | | | |
| 7. My Shelf UI | | | | |
| 8. Multi-Device Scenarios | | | | |
| 9. Edge Cases | | | | |
| 10. Sleep Timer Interaction | | | | |
| 11. Chapter Navigation | | | | |

---

## Known Limitations / Deferred Features

The following were deferred from the initial refactor (Phase 5c, 5f):

1. **Abandon Playthrough** - No UI to explicitly abandon a playthrough yet
2. **Mark as Finished** - No manual "Mark as Finished" action yet
3. **Delete Playthrough** - No UI to delete accidental playthroughs
4. **Undo Seek** - No undo functionality for accidental seeks

These will need separate test cases when implemented.

/**
 * Event reduction logic for deriving playthrough state from events.
 *
 * This is a direct port of the server's PlaythroughNew.reduce/3 function.
 * Both client and server must use identical logic to ensure state convergence.
 *
 * @see ambry/lib/ambry/playback/playthrough_new.ex
 */

import { asc, eq } from "drizzle-orm";

import { Database, getDb } from "@/db/db";
import * as schema from "@/db/schema";
import { PlaybackEventSelect, PlaythroughInsert } from "@/db/schema";
import { Session } from "@/types/session";
import { logBase } from "@/utils/logger";

const log = logBase.extend("playthrough-reducer");

/**
 * Derived playthrough state from event reduction.
 * Matches the server's PlaythroughNew schema fields.
 */
export interface PlaythroughDerivedState {
  id: string;
  url: string;
  userEmail: string;
  mediaId: string | null;
  status: "in_progress" | "finished" | "abandoned" | "deleted" | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  abandonedAt: Date | null;
  deletedAt: Date | null;
  position: number | null;
  playbackRate: number | null;
  lastEventAt: Date | null;
  refreshedAt: Date;
}

/**
 * Reduces a list of events (sorted by timestamp ascending) into playthrough state.
 *
 * This is a direct port of PlaythroughNew.reduce/3 from the server.
 * Returns a derived state object suitable for upserting to the playthroughs table.
 *
 * @param events - Events sorted by timestamp ASC
 * @param playthroughId - The playthrough ID
 * @param session - Session containing url and email
 */
export function reduceEvents(
  events: PlaybackEventSelect[],
  playthroughId: string,
  session: Session,
): PlaythroughDerivedState {
  const initialState: PlaythroughDerivedState = {
    id: playthroughId,
    url: session.url,
    userEmail: session.email,
    mediaId: null,
    status: null,
    startedAt: null,
    finishedAt: null,
    abandonedAt: null,
    deletedAt: null,
    position: null,
    playbackRate: null,
    lastEventAt: null,
    refreshedAt: new Date(),
  };

  return events.reduce(
    (state, event) => applyEvent(state, event),
    initialState,
  );
}

/**
 * Apply a single event to the current state.
 */
function applyEvent(
  state: PlaythroughDerivedState,
  event: PlaybackEventSelect,
): PlaythroughDerivedState {
  // Always update lastEventAt
  const updatedState = {
    ...state,
    lastEventAt: event.timestamp,
  };

  return applyEventType(updatedState, event);
}

/**
 * Apply event-type-specific state changes.
 * Matches the server's apply_event_type/2 function clauses.
 */
function applyEventType(
  state: PlaythroughDerivedState,
  event: PlaybackEventSelect,
): PlaythroughDerivedState {
  switch (event.type) {
    // Lifecycle events
    case "start":
      return {
        ...state,
        status: "in_progress",
        startedAt: event.timestamp,
        mediaId: event.mediaId,
        position: event.position ?? 0,
        playbackRate: event.playbackRate ?? 1.0,
      };

    case "finish":
      return {
        ...state,
        status: "finished",
        finishedAt: event.timestamp,
      };

    case "abandon":
      return {
        ...state,
        status: "abandoned",
        abandonedAt: event.timestamp,
      };

    case "delete":
      return {
        ...state,
        status: "deleted",
        deletedAt: event.timestamp,
      };

    case "resume":
      return {
        ...state,
        status: "in_progress",
        finishedAt: null,
        abandonedAt: null,
        deletedAt: null,
      };

    // Playback events - use null coalescing to preserve state if event value is null
    case "play":
      return {
        ...state,
        position: event.position ?? state.position,
      };

    case "pause":
      return {
        ...state,
        position: event.position ?? state.position,
      };

    case "seek":
      return {
        ...state,
        position: event.toPosition ?? state.position,
      };

    case "rate_change":
      return {
        ...state,
        playbackRate: event.playbackRate ?? state.playbackRate,
      };

    default:
      // Unknown event type - return state unchanged (matches server fallback)
      return state;
  }
}

/**
 * Rebuild a playthrough's state from all its events.
 *
 * This fetches all events for the playthrough, reduces them to derive state,
 * and upserts the result to the playthroughs table.
 *
 * @param playthroughId - The playthrough to rebuild
 * @param session - Session containing url and email
 * @param db - Optional database/transaction context
 */
export async function rebuildPlaythrough(
  playthroughId: string,
  session: Session,
  db: Database = getDb(),
  refreshedAt: Date,
): Promise<void> {
  log.debug(`Rebuilding playthrough ${playthroughId}`);

  // Fetch all events for this playthrough, sorted by timestamp ASC
  const events = await db.query.playbackEvents.findMany({
    where: eq(schema.playbackEvents.playthroughId, playthroughId),
    orderBy: asc(schema.playbackEvents.timestamp),
  });

  if (events.length === 0) {
    log.warn(
      `No events found for playthrough ${playthroughId}, cannot rebuild`,
    );
    return;
  }

  // Reduce events to derive state
  const derivedState = reduceEvents(events, playthroughId, session);

  // Validate required fields are present (start event should have set these)
  if (
    derivedState.mediaId === null ||
    derivedState.status === null ||
    derivedState.startedAt === null ||
    derivedState.position === null ||
    derivedState.playbackRate === null ||
    derivedState.lastEventAt === null
  ) {
    log.error(
      `Derived state missing required fields for playthrough ${playthroughId}`,
      derivedState,
    );
    throw new Error(
      `Invalid derived state for playthrough ${playthroughId}: missing required fields`,
    );
  }

  // Upsert to playthroughs table
  const playthroughData: PlaythroughInsert = {
    id: derivedState.id,
    url: derivedState.url,
    userEmail: derivedState.userEmail,
    mediaId: derivedState.mediaId,
    status: derivedState.status,
    startedAt: derivedState.startedAt,
    finishedAt: derivedState.finishedAt,
    abandonedAt: derivedState.abandonedAt,
    deletedAt: derivedState.deletedAt,
    position: derivedState.position,
    playbackRate: derivedState.playbackRate,
    lastEventAt: derivedState.lastEventAt,
    refreshedAt: derivedState.refreshedAt,
  };

  await db
    .insert(schema.playthroughs)
    .values(playthroughData)
    .onConflictDoUpdate({
      target: [schema.playthroughs.url, schema.playthroughs.id],
      set: {
        mediaId: playthroughData.mediaId,
        status: playthroughData.status,
        startedAt: playthroughData.startedAt,
        finishedAt: playthroughData.finishedAt,
        abandonedAt: playthroughData.abandonedAt,
        deletedAt: playthroughData.deletedAt,
        position: playthroughData.position,
        playbackRate: playthroughData.playbackRate,
        lastEventAt: playthroughData.lastEventAt,
        refreshedAt,
      },
    });

  log.debug(
    `Rebuilt playthrough ${playthroughId}: status=${derivedState.status}`,
  );
}

/**
 * Rebuild multiple playthroughs in a single transaction.
 *
 * @param playthroughIds - The playthroughs to rebuild
 * @param session - Session containing url and email
 */
export async function rebuildPlaythroughs(
  playthroughIds: string[],
  session: Session,
  tx: Database,
  refreshedAt: Date,
): Promise<void> {
  if (playthroughIds.length === 0) return;

  log.info(`Rebuilding ${playthroughIds.length} playthroughs`);

  for (const playthroughId of playthroughIds) {
    await rebuildPlaythrough(playthroughId, session, tx, refreshedAt);
  }
}

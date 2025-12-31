import { create } from "zustand";

import { FINISH_PROMPT_THRESHOLD } from "@/constants";
import {
  getFinishedOrAbandonedPlaythrough,
  getInProgressPlaythrough,
  getPlaythroughById,
} from "@/db/playthroughs";
import {
  finishPlaythrough,
  loadAndPlayMedia,
  resumeAndLoadPlaythrough,
  startFreshPlaythrough,
} from "@/services/playback-controls";
import { Session } from "@/stores/session";

// ============================================================================
// Types
// ============================================================================

export interface PendingResumePrompt {
  mediaId: string;
  playthroughId: string;
  playthroughStatus: "finished" | "abandoned";
  position: number;
  duration: number;
  statusDate: Date;
}

export interface PendingFinishPrompt {
  /** The playthrough that's about to be unloaded */
  currentPlaythroughId: string;
  currentMediaId: string;
  currentMediaTitle: string;
  currentPosition: number;
  currentDuration: number;
  /** The new media the user wants to load */
  newMediaId: string;
}

interface PlayerPromptsState {
  /** When set, shows a dialog asking user to resume or start fresh */
  pendingResumePrompt: PendingResumePrompt | null;
  /** When set, shows a dialog asking user if they want to mark current playthrough as finished */
  pendingFinishPrompt: PendingFinishPrompt | null;
}

// ============================================================================
// Store
// ============================================================================

const initialState: PlayerPromptsState = {
  pendingResumePrompt: null,
  pendingFinishPrompt: null,
};

export const usePlayerPrompts = create<PlayerPromptsState>()(
  () => initialState,
);

// ============================================================================
// Resume Prompt
// ============================================================================

/**
 * Playback state for finished or abandoned media.
 * This is a subset of MediaPlaybackState.
 */
type FinishedOrAbandonedState = {
  type: "finished" | "abandoned";
  playthrough: {
    id: string;
    mediaId: string;
    finishedAt: Date | null;
    abandonedAt: Date | null;
    stateCache: { currentPosition: number } | null;
    media: { duration: string | null } | null;
  };
};

/**
 * Set the pending resume prompt from a finished or abandoned playback state.
 * Extracts all necessary data from the playthrough to show the resume dialog.
 */
export function setPendingResumePrompt(state: FinishedOrAbandonedState) {
  const pt = state.playthrough;
  usePlayerPrompts.setState({
    pendingResumePrompt: {
      mediaId: pt.mediaId,
      playthroughId: pt.id,
      playthroughStatus: state.type,
      position: pt.stateCache?.currentPosition ?? 0,
      duration: parseFloat(pt.media?.duration || "0"),
      statusDate:
        (state.type === "finished" ? pt.finishedAt : pt.abandonedAt) ??
        new Date(),
    },
  });
}

/**
 * Cancel the resume prompt without making a choice.
 */
export function cancelResumePrompt() {
  usePlayerPrompts.setState({ pendingResumePrompt: null });
}

/**
 * Handle user choosing to resume a previous playthrough.
 * Called from the ResumePlaythroughDialog.
 */
export async function handleResumePlaythrough(session: Session) {
  const prompt = usePlayerPrompts.getState().pendingResumePrompt;
  if (!prompt) return;

  usePlayerPrompts.setState({ pendingResumePrompt: null });
  await resumeAndLoadPlaythrough(session, prompt.playthroughId);
}

/**
 * Handle user choosing to start fresh (new playthrough).
 * Called from the ResumePlaythroughDialog.
 */
export async function handleStartFresh(session: Session) {
  const prompt = usePlayerPrompts.getState().pendingResumePrompt;
  if (!prompt) return;

  console.debug(
    "[Prompts] User chose to start fresh for media:",
    prompt.mediaId,
  );

  usePlayerPrompts.setState({ pendingResumePrompt: null });
  await startFreshPlaythrough(session, prompt.mediaId);
}

// ============================================================================
// Finish Prompt
// ============================================================================

/**
 * Handle user choosing to mark the current playthrough as finished.
 * Called from the FinishPlaythroughDialog.
 */
export async function handleMarkFinished(session: Session) {
  const prompt = usePlayerPrompts.getState().pendingFinishPrompt;
  if (!prompt) return;

  console.debug(
    "[Prompts] User chose to mark playthrough as finished:",
    prompt.currentPlaythroughId,
  );

  usePlayerPrompts.setState({ pendingFinishPrompt: null });

  // Finish the current playthrough (skip unload since we're loading new media)
  await finishPlaythrough(session, prompt.currentPlaythroughId, {
    skipUnload: true,
  });

  // Now load the new media
  await proceedWithLoadingNewMedia(session, prompt.newMediaId);
}

/**
 * Handle user choosing to skip marking as finished and just load the new media.
 * Called from the FinishPlaythroughDialog.
 */
export async function handleSkipFinish(session: Session) {
  const prompt = usePlayerPrompts.getState().pendingFinishPrompt;
  if (!prompt) return;

  console.debug(
    "[Prompts] User chose to skip marking as finished, loading new media:",
    prompt.newMediaId,
  );

  usePlayerPrompts.setState({ pendingFinishPrompt: null });

  // Load the new media without marking current as finished
  await proceedWithLoadingNewMedia(session, prompt.newMediaId);
}

/**
 * Cancel the finish prompt without making a choice.
 */
export function cancelFinishPrompt() {
  usePlayerPrompts.setState({ pendingFinishPrompt: null });
}

// ============================================================================
// Prompt Checks (Entry points)
// ============================================================================

/**
 * Check if loading a new media item should first trigger a "finish" prompt for the current one.
 * If so, sets pendingFinishPrompt and returns true.
 * If not, returns false and the caller should proceed.
 */
export async function checkForFinishPrompt(
  session: Session,
  newMediaId: string,
  current: {
    loadedPlaythrough: { mediaId: string; playthroughId: string } | null;
    position: number;
    duration: number;
  },
): Promise<boolean> {
  const { loadedPlaythrough, position, duration } = current;

  if (!loadedPlaythrough || loadedPlaythrough.mediaId === newMediaId) {
    return false;
  }

  if (duration > 0 && position / duration > FINISH_PROMPT_THRESHOLD) {
    const currentPlaythrough = await getPlaythroughById(
      session,
      loadedPlaythrough.playthroughId,
    );
    if (!currentPlaythrough) return false;

    console.debug(
      "[Prompts] Current playthrough is >95% complete - showing finish prompt",
    );

    usePlayerPrompts.setState({
      pendingFinishPrompt: {
        currentPlaythroughId: loadedPlaythrough.playthroughId,
        currentMediaId: loadedPlaythrough.mediaId,
        currentMediaTitle: currentPlaythrough.media.book.title,
        currentPosition: position,
        currentDuration: duration,
        newMediaId,
      },
    });
    return true;
  }

  return false;
}

/**
 * Check if loading a media item should first trigger a "resume" prompt.
 * If so, sets pendingResumePrompt and returns true.
 * If not, returns false and the caller should proceed.
 */
export async function checkForResumePrompt(
  session: Session,
  mediaId: string,
): Promise<boolean> {
  const activePlaythrough = await getInProgressPlaythrough(session, mediaId);
  if (activePlaythrough) {
    return false; // Has in-progress, no prompt needed
  }

  const previous = await getFinishedOrAbandonedPlaythrough(session, mediaId);
  if (previous) {
    console.debug(
      "[Prompts] Found previous playthrough - showing resume prompt",
    );

    // Construct the FinishedOrAbandonedState object
    const finishedOrAbandonedState: FinishedOrAbandonedState = {
      type: previous.status === "finished" ? "finished" : "abandoned",
      playthrough: {
        id: previous.id,
        mediaId: previous.mediaId,
        finishedAt: previous.finishedAt,
        abandonedAt: previous.abandonedAt,
        stateCache: previous.stateCache,
        media: previous.media,
      },
    };
    setPendingResumePrompt(finishedOrAbandonedState);
    return true;
  }
  return false;
}

/**
 * Internal helper to proceed with loading new media after finish prompt is resolved.
 */
async function proceedWithLoadingNewMedia(
  session: Session,
  newMediaId: string,
) {
  const needsResumePrompt = await checkForResumePrompt(session, newMediaId);
  if (needsResumePrompt) {
    // Resume dialog will handle the rest
    return;
  }

  // No resume prompt needed - load and play
  await loadAndPlayMedia(session, newMediaId);
}

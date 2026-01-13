export const TAB_BAR_BASE_HEIGHT = 50;
export const PLAYER_HEIGHT = 70;
export const PAGE_SIZE = 64;
export const HORIZONTAL_TILE_WIDTH_RATIO = 2.35;
export const HORIZONTAL_TILE_SPACING = 10;
export const HORIZONTAL_LIST_LIMIT = 10;

/* How long to wait before applying the seek to the player */
export const SEEK_ACCUMULATION_WINDOW = 750;

/* How long to wait before saving a seek event to the db */
export const SEEK_EVENT_ACCUMULATION_WINDOW = 5000;

/* How long to wait before saving a play/pause event to the db */
export const PLAY_PAUSE_EVENT_ACCUMULATION_WINDOW = 2000;

/* How long to wait before saving a rate change event to the db */
export const RATE_CHANGE_EVENT_ACCUMULATION_WINDOW = 2000;

/* How often to save playback position to the database (in milliseconds) */
export const PROGRESS_SAVE_INTERVAL = 30000;

/* Sleep timer fade out duration (in milliseconds) */
export const SLEEP_TIMER_FADE_OUT_TIME = 30000;

/* Player expand animation duration (in milliseconds) - must match CustomTabBarWithPlayer */
export const PLAYER_EXPAND_ANIMATION_DURATION = 400;

/* Threshold for prompting user to mark playthrough as finished (95%) */
export const FINISH_PROMPT_THRESHOLD_PERCENT = 95;

/**
 * How many seconds to rewind when pausing playback.
 *
 * When you pause and later resume, it's helpful to hear a bit of context about
 * where you left off. Without this, resuming exactly from the pause point can
 * feel jarring and you lose the flow of the narration.
 *
 * Note: This is multiplied by playback rate, so at 1.5x speed it rewinds
 * 1.5 seconds of audio time (1 second of real time).
 */
export const PAUSE_REWIND_SECONDS = 1;

/**
 * How many seconds to rewind when the sleep timer pauses playback.
 *
 * When falling asleep while listening, you likely miss more of the narration
 * than when manually pausing. A longer rewind gives more context when you
 * resume the next day.
 *
 * Note: This is multiplied by playback rate, so at 1.5x speed it rewinds
 * 15 seconds of audio time (10 seconds of real time).
 */
export const SLEEP_TIMER_PAUSE_REWIND_SECONDS = 10;

export const DEFAULT_SLEEP_TIMER_SECONDS = 600; // 10 minutes
export const DEFAULT_SLEEP_TIMER_ENABLED = false;
export const DEFAULT_SLEEP_TIMER_MOTION_DETECTION_ENABLED = false;
export const DEFAULT_PREFERRED_PLAYBACK_RATE = 1.0;

export const FOREGROUND_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes

/**
 * Preferred Playback Rate Service
 *
 * Manages the user's preferred playback rate setting. This rate is used as the
 * default when starting new playthroughs (ones without existing state cache).
 */

import {
  getPreferredPlaybackRate,
  setPreferredPlaybackRate as setPreferredPlaybackRateDb,
} from "@/db/settings";
import {
  resetForTesting as resetPreferredPlaybackRateStore,
  usePreferredPlaybackRate,
} from "@/stores/preferred-playback-rate";
import { logBase } from "@/utils/logger";

const log = logBase.extend("preferred-rate");

// =============================================================================
// Public API
// =============================================================================

/**
 * Initialize the preferred playback rate store. Loads the device-level
 * preference from DB if not already initialized.
 */
export async function initialize() {
  if (isInitialized()) {
    log.debug("Already initialized, skipping");
    return;
  }

  const rate = await getPreferredPlaybackRate();
  usePreferredPlaybackRate.setState({
    initialized: true,
    preferredPlaybackRate: rate,
  });

  log.debug(`Initialized with rate ${rate}`);
}

/**
 * Sets the preferred playback rate and persists it to the database.
 */
export async function setPreferredPlaybackRate(rate: number) {
  log.info(`Setting preferred playback rate to ${rate}`);

  usePreferredPlaybackRate.setState({ preferredPlaybackRate: rate });
  await setPreferredPlaybackRateDb(rate);
}

// =============================================================================
// Internals
// =============================================================================

/**
 * Check if the store is initialized.
 */
function isInitialized() {
  return usePreferredPlaybackRate.getState().initialized;
}

// =============================================================================
// Testing Helpers
// =============================================================================

/**
 * Reset all module-level state for testing.
 */
export function resetForTesting() {
  resetPreferredPlaybackRateStore();
}

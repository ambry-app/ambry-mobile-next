import { Session } from "@/types/session";
import { toEditions } from "@/utils/editions";

import { MediaHeaderInfo } from "./get-media-header-info";
import {
  getEditionMediaForBook,
  getNarratorsForMedia,
  getPlaythroughStatusesForMedia,
  getSavedForLaterStatusForMedia,
} from "./shared-queries";

export type BookOtherEditions = Awaited<
  ReturnType<typeof getBookOtherEditions>
>;

/**
 * The book's other editions — true alternates only.
 *
 * The whole of the reader's own set is excluded, not just the recording they
 * are looking at: its remaining parts belong to "the rest of this set" above,
 * and a single leftover sibling would otherwise collapse to a lone edition and
 * present itself as an alternate. What is left collapses the usual way, so a
 * rival set arrives as one stacked tile rather than as loose parts.
 */
export async function getBookOtherEditions(
  session: Session,
  media: MediaHeaderInfo,
  limit: number,
) {
  const { book } = media;
  const otherMedia = await getEditionMediaForBook(session, book.id, {
    excludeSetId: media.set?.id,
  });
  const rest = otherMedia.filter((other) => other.id !== media.id);

  if (rest.length === 0) return null;

  const mediaIds = rest.map((m) => m.id);
  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);
  const playthroughStatuses = await getPlaythroughStatusesForMedia(
    session,
    mediaIds,
  );
  const savedForLater = await getSavedForLaterStatusForMedia(session, mediaIds);

  const withDetails = rest.map((media) => ({
    ...media,
    narrators: narratorsForMedia[media.id] ?? [],
    playthroughStatus: playthroughStatuses[media.id] ?? null,
    isOnSavedShelf: savedForLater.has(media.id),
  }));

  return { ...book, editions: toEditions(withDetails).slice(0, limit) };
}

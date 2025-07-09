import { Session } from "@/src/stores/session";
import {
  getAuthorsForBooks,
  getMediaByIds,
  getNarratorsForMedia,
} from "./shared-queries";

export type Media = Awaited<ReturnType<typeof getMedia>>[number];

export async function getMedia(session: Session, mediaIds: string[]) {
  if (mediaIds.length === 0) return [];

  const media = await getMediaByIds(session, mediaIds);

  const bookIds = media.map((m) => m.book.id);
  const authorsForBooks = await getAuthorsForBooks(session, bookIds);

  const narratorsForMedia = await getNarratorsForMedia(session, mediaIds);

  return media.map((media) => ({
    ...media,
    book: {
      ...media.book,
      authors: authorsForBooks[media.book.id] || [],
    },
    narrators: narratorsForMedia[media.id] || [],
  }));
}

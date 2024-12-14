import { router } from "expo-router";
import { useCallback } from "react";

type Book = {
  id: string;
  title: string;
};

type Media = {
  id: string;
};

export default function useNavigateToBookCallback(book: Book, media: Media[]) {
  return useCallback(() => {
    if (media.length === 1) {
      router.navigate({
        pathname: "/media/[id]",
        params: { id: media[0].id, title: book.title },
      });
    } else {
      router.navigate({
        pathname: "/book/[id]",
        params: { id: book.id, title: book.title },
      });
    }
  }, [book, media]);
}

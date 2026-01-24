import { ScrollHandler } from "@/components/FadingHeader";
import { FullLibrary } from "@/components/screens/library-screen/FullLibrary";
import { Session } from "@/types/session";

type LibraryScreenProps = {
  session: Session;
  scrollHandler?: ScrollHandler;
  topInset?: number;
};

export function LibraryScreen({
  session,
  scrollHandler,
  topInset = 0,
}: LibraryScreenProps) {
  return (
    <FullLibrary
      session={session}
      scrollHandler={scrollHandler}
      topInset={topInset}
    />
  );
}

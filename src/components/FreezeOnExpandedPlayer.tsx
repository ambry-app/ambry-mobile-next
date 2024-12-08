import { usePlayer } from "@/src/stores/player";
import { ReactNode } from "react";
import { Freeze } from "react-freeze";

type Props = { children: ReactNode };

export default function FreezeOnExpandedPlayer({ children }: Props) {
  const playerIsFullyExpanded = usePlayer((state) => state.isFullyExpanded);

  return <Freeze freeze={playerIsFullyExpanded}>{children}</Freeze>;
}

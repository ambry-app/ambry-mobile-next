import { usePlayer } from "@/src/stores/player";
import { ReactNode } from "react";
import { Freeze } from "react-freeze";

type Props = { children: ReactNode };

export default function FreezeOnCollapsedPlayer({ children }: Props) {
  const playerIsFullyCollapsed = usePlayer((state) => state.isFullyCollapsed);

  return <Freeze freeze={playerIsFullyCollapsed}>{children}</Freeze>;
}

import { useEffect, useState } from "react";
import { View, ViewProps } from "react-native";

type Props = ViewProps & {
  delay: number;
};

/**
 * A component that delays rendering its children until after a short timeout.
 * This can be useful for preventing rendering heavy components immediately on mount.
 *
 * @param - The props to pass to the View component.
 * @returns - Returns the View with children after a delay, or null if not yet ready.
 */
export function Delay({ children, delay, ...props }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  if (!show) return null;

  return <View {...props}>{children}</View>;
}

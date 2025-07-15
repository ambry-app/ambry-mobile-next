import { useEffect, useState } from "react";

type Props = {
  delay: number;
  children: React.ReactNode;
};

export function Delay({ children, delay }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  if (!show) return null;

  return <>{children}</>;
}

import { useEffect } from "react";

interface Props {
  onAuthenticated: () => void;
  onFallbackPassword: () => void;
}

/**
 * Web version of BiometricGate — biometrics are not available on web,
 * so immediately call onAuthenticated to skip the gate.
 */
export default function BiometricGate({ onAuthenticated }: Props) {
  useEffect(() => {
    onAuthenticated();
  }, []);

  return null;
}

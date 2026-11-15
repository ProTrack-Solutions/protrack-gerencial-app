import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/** Chama `reload` sempre que a tela volta a ficar visível (não na primeira vez). */
export function useFocusReload(reload: () => void) {
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reload();
      focusedOnce.current = true;
    }, [reload]),
  );
}

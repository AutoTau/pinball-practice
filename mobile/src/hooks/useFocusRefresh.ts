import { useFocusEffect } from 'expo-router';
import { useCallback, useReducer } from 'react';

/**
 * Re-renders the screen each time it comes into focus. The data layer is synchronous, so re-rendering
 * re-reads it: switching back to a tab shows what changed elsewhere.
 */
export function useFocusRefresh(): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useFocusEffect(useCallback(() => bump(), []));
}

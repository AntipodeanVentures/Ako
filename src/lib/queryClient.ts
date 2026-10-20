import { QueryClient } from '@tanstack/react-query';

import { initNetwork } from './network';

// Wire device connectivity into TanStack Query before any query runs.
initNetwork();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Create the router instance per-request for SSR safety
export function createRouter() {
  const queryClient = new QueryClient();

  return createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
}

// Alias required by your specific TanStack Start server handler
export const getRouter = createRouter;

// Register the router for strict TypeScript safety
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}


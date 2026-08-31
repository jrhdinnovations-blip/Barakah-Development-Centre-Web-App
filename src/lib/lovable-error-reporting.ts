export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  // Simple local error reporting to console, standing independently
  console.error("Runtime error caught:", error, context);
}

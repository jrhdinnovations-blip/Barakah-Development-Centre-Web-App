import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const host = (request.headers.get("host") || url.hostname || "").toLowerCase();
    const isSwiftDomain = host.includes("swiftmove") || url.searchParams.has("swiftmove");

    // 1. When hitting root on SwiftMove domain, immediately redirect to /swiftmove
    if (isSwiftDomain && url.pathname === "/") {
      const targetUrl = new URL("/swiftmove", request.url);
      targetUrl.search = url.search;
      return Response.redirect(targetUrl.toString(), 307);
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);

      const contentType = normalized.headers.get("content-type") ?? "";
      const isSwiftRoute =
        isSwiftDomain ||
        url.pathname.startsWith("/swift") ||
        url.pathname.startsWith("/drive") ||
        url.pathname.startsWith("/dispatcher") ||
        url.pathname.startsWith("/my-swift") ||
        url.pathname.startsWith("/my-vehicle");

      if (contentType.includes("text/html") && isSwiftRoute) {
        let html = await normalized.text();

        // Ensure title is SwiftMove
        html = html.replace(
          /<title>.*?Barakah.*?<\/title>/gi,
          `<title>SwiftMove Logistics — Fast, Reliable Deliveries & Ride Hailing</title>`
        );

        // Replace any Barakah favicons with SwiftMove logo
        html = html.replace(
          /<link[^>]*rel="icon"[^>]*>/gi,
          `<link rel="icon" type="image/jpeg" href="/swiftmove-logo.jpg">`
        );
        html = html.replace(
          /<link[^>]*rel="shortcut icon"[^>]*>/gi,
          `<link rel="shortcut icon" href="/swiftmove-logo.jpg">`
        );
        html = html.replace(
          /<link[^>]*rel="apple-touch-icon"[^>]*>/gi,
          `<link rel="apple-touch-icon" href="/swiftmove-logo.jpg">`
        );
        html = html.replace(
          /href="\/favicon(?:-32x32|-16x16)?\.png(?:\?v=\d+)?"/gi,
          `href="/swiftmove-logo.jpg"`
        );
        html = html.replace(
          /href="\/favicon\.ico(?:\?v=\d+)?"/gi,
          `href="/swiftmove-logo.jpg"`
        );
        html = html.replace(
          /href="\/apple-touch-icon\.png(?:\?v=\d+)?"/gi,
          `href="/swiftmove-logo.jpg"`
        );
        html = html.replace(
          /href="\/barakah-centre-logo\.png(?:\?v=\d+)?"/gi,
          `href="/swiftmove-logo.jpg"`
        );
        html = html.replace(
          /href="\/manifest\.json(?:\?v=\d+)?"/gi,
          `href="/manifest-swiftmove.json?v=1"`
        );
        html = html.replace(
          /content="Barakah"/gi,
          `content="SwiftMove"`
        );

        // Replace any Barakah brand image with SwiftMove logo
        html = html.replace(
          /src="\/barakah-centre-logo\.png[^"]*"/gi,
          `src="/swiftmove-logo.jpg"`
        );

        // Replace any lingering Barakah meta descriptions
        html = html.replace(
          /content="Barakah Development Centre[^"]*"/gi,
          `content="SwiftMove Logistics — Fast, Reliable Deliveries & On-Demand Rides across Nigeria"`
        );


        return new Response(html, {
          status: normalized.status,
          statusText: normalized.statusText,
          headers: normalized.headers,
        });
      }

      return normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};


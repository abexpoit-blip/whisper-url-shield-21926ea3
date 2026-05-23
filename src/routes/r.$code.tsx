import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveRedirect } from "@/lib/redirect.functions";

export const Route = createFileRoute("/r/$code")({
  loader: async ({ params, location }) => {
    // Pull request-side headers via serverFn — we don't have direct access to request here,
    // so we'll resolve with what the loader knows; the server fn re-derives from request headers if absent.
    const result = await resolveRedirect({
      data: {
        code: params.code,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        ip: "",
        referer: typeof document !== "undefined" ? document.referrer : "",
      },
    });
    throw redirect({ href: result.url, statusCode: 302 });
  },
  component: () => null,
});

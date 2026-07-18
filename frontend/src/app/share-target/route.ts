import { combineShareParts } from "@/lib/share-import";

export const dynamic = "force-dynamic";

function shareLandingHtml(payload: string): string {
  // Persist before auth redirect so login → import still has the text
  const encoded = JSON.stringify(payload);
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pocketa — دریافت اشتراک</title>
  <style>
    body { font-family: Tahoma, sans-serif; background: #0b1220; color: #e5e7eb;
      display: flex; min-height: 100dvh; align-items: center; justify-content: center; margin: 0; }
    p { opacity: .8; font-size: 14px; }
  </style>
</head>
<body>
  <p>در حال انتقال به ایمپورت بانکی…</p>
  <script>
    (function () {
      try {
        sessionStorage.setItem("pocketa.shareImportText", ${encoded});
      } catch (e) {}
      location.replace("/imports/bank-sms?from=share");
    })();
  </script>
</body>
</html>`;
}

function emptyLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pocketa</title>
</head>
<body>
  <script>location.replace("/imports/bank-sms");</script>
</body>
</html>`;
}

async function handleShare(parts: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): Promise<Response> {
  const payload = combineShareParts(parts);
  if (!payload) {
    return new Response(emptyLandingHtml(), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response(shareLandingHtml(payload), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Web Share Target (POST multipart) — Android Chrome installed PWA, etc. */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    return handleShare({
      title: formData.get("title")?.toString() ?? "",
      text: formData.get("text")?.toString() ?? "",
      url: formData.get("url")?.toString() ?? "",
    });
  } catch {
    return handleShare({});
  }
}

/** Fallback GET share target / deep link with query params. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleShare({
    title: url.searchParams.get("title"),
    text: url.searchParams.get("text"),
    url: url.searchParams.get("url"),
  });
}

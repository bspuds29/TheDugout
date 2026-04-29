// Vercel Edge Middleware — runs before the SPA rewrite, server-side.
// Social crawlers (iMessage, Twitter, Slack, etc.) don't execute JavaScript,
// so react-helmet-async never fires for them. This middleware intercepts bot
// requests to /player and /team/:id and returns a minimal HTML page whose
// <head> contains the correct OG / Twitter Card meta tags.

export const config = {
  matcher: ['/player', '/team/:path*'],
};

// User-agent strings used by common social crawlers & link-preview bots
const BOT_UA =
  /twitterbot|facebookexternalhit|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|imessage|slack-imgproxy|vkshare|googlebot|bingbot|rogerbot|embedly|quora|outbrain|w3c_validator/i;

export default function middleware(request: Request): Response | undefined {
  const ua = request.headers.get('user-agent') ?? '';
  // Let regular browser traffic reach the SPA as usual
  if (!BOT_UA.test(ua)) return undefined;

  const url  = new URL(request.url);
  const year = new Date().getFullYear();

  // ── /player?mlbId=682928&name=James+Wood ─────────────────────────────
  if (url.pathname === '/player') {
    const mlbId = url.searchParams.get('mlbId');
    const name  = url.searchParams.get('name')
      ? decodeURIComponent(url.searchParams.get('name')!)
      : null;

    if (mlbId && name) {
      // MLB CDN action shot — falls back to generic silhouette if unavailable
      const image = `https://img.mlbstatic.com/mlb-photos/image/upload/w_600,d_people:generic:action:hero:current.png,q_auto:best,f_auto/v1/people/${mlbId}/action/hero/current`;
      const title = `${name} · The Dugout`;
      const desc  = `${name} ${year} MLB stats — batting, pitching, Statcast & more | The Dugout`;
      return ogResponse(title, desc, image, request.url, 'summary_large_image');
    }
  }

  // ── /team/133 ─────────────────────────────────────────────────────────
  const teamMatch = url.pathname.match(/^\/team\/(\d+)$/);
  if (teamMatch) {
    const teamId = teamMatch[1];
    const image  = `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
    const title  = `Team Stats · The Dugout`;
    const desc   = `${year} MLB team stats, roster & standings | The Dugout`;
    return ogResponse(title, desc, image, request.url, 'summary');
  }

  return undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ogResponse(
  title:   string,
  desc:    string,
  image:   string,
  pageUrl: string,
  card:    string,
): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${esc(pageUrl)}">
  <meta property="og:title"       content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image"       content="${esc(image)}">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="400">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="${esc(card)}">
  <meta name="twitter:title"       content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image"       content="${esc(image)}">
</head>
<body></body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type':  'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}

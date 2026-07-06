# Launch Strategy — Docwell

## Positioning

Two wedges:
1. **SaaS support deflection** — a good help center is the cheapest support hire you'll ever make. Docwell's helpful-vote report turns docs into a measurable ticket-deflection tool.
2. **Agencies / freelancers** — deploy white-label help centers per client with zero recurring cost. Subscriptions kill agency margins; a one-time tool is pure markup.

## Target communities (rules-aware)

- **r/selfhosted** (700k+) — loves exactly this. Angle: "I built an MIT-licensed self-hosted alternative to HelpScout Docs/GitBook — single Node process + SQLite." Lead with the GitHub repo, not the paid installer (self-promo is tolerated when source is open and you engage in comments).
- **r/SaaS** — angle: support deflection math. "Your help center should cut tickets, not add a $79/mo line item." Share the helpful-vote report screenshot; no direct link until asked (check current self-promo thread rules — often Saturday promo threads only).
- **r/Entrepreneur / r/smallbusiness** — angle: "the software subscriptions quietly eating your margin" listicle-style post; mention Docwell once. Strict on self-promo — post value first.
- **r/webdev** — angle: technical write-up "Server-rendered help center with SQLite FTS5 — why I skipped React for the public pages." Show HN-style, links allowed in comments.
- **r/opensource** — straightforward repo share; must be the MIT repo, never the Whop link.
- **Indie Hackers** — build-in-public post with revenue math of the one-time model vs. subscription.

## Hacker News — Show HN draft

**Title:** Show HN: Docwell – self-hosted help center with SQLite FTS5 search (MIT)

**Post:**
I kept paying monthly for hosted docs tools (HelpScout Docs, GitBook) that are, at their core, markdown files with a search box. So I built a self-hosted replacement.

Technical bits that might interest HN:
- Public pages are server-rendered plain HTML — no framework. TTFB is basically SQLite query time, and SEO (meta/OG/sitemap/canonical) is trivial when you own the HTML.
- Search is SQLite FTS5 with prefix queries and `snippet()` highlighting — instant as-you-type without Elasticsearch or Algolia.
- The admin is a React SPA, but the markdown preview calls the *server's* render endpoint, so preview and published output can never drift.
- One process, one SQLite file (WAL). Runs as a $5 VPS Docker container or as an Electron desktop app that boots the same Express server on a free port.
- "Was this helpful?" votes are deduped by an anonymous visitor cookie; the admin report sorts worst articles first — docs as a measurable support-deflection tool.

MIT licensed. There's a paid 1-click Windows installer, which is how I'm funding it — the source is complete, nothing held back. Feedback welcome, especially on the FTS ranking.

## SEO keywords (10)

1. self hosted knowledge base
2. helpscout docs alternative
3. gitbook alternative self hosted
4. open source help center
5. intercom articles alternative
6. self hosted help center software
7. knowledge base software one time payment
8. documentation site generator with search
9. sqlite full text search knowledge base
10. white label help center for agencies

## AppSumo / PitchGround pitch

Docwell is a self-hosted help center that replaces HelpScout Docs ($22+/user/mo), GitBook ($79/site/mo) and Intercom Articles ($39+/mo) with a one-time purchase. Customers get a branded, SEO-ready docs site with instant full-text search; owners get a split-pane markdown editor and a feedback report that ranks their worst articles first — turning documentation into measurable ticket deflection. It deploys in minutes on any $5 VPS via Docker, or runs as a Windows desktop app with zero setup. MIT-licensed code, single SQLite file, no telemetry, unlimited articles and unlimited installs make it a perfect lifetime-deal product: your buyers never see a renewal notice, and agencies can white-label it for every client they serve.

## Pricing

**Suggested: $29 one-time** (installer + lifetime updates on Whop).

Competitor math:
- GitBook Premium $79/mo → Docwell pays for itself in **11 days**.
- Intercom Articles $39/mo → pays for itself in **under 1 month**.
- HelpScout Plus (docs incl.) $22/user/mo, 2 seats = $44/mo → pays for itself in **~3 weeks**.
- 3-year cost of ownership: Docwell $29 vs. GitBook $2,844 — **98% cheaper**.

Upsell later: $79 "agency license" positioning (same code, license to deploy for clients) once reviews exist.

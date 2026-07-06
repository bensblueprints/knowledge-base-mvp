# Product Hunt Launch — Docwell

## Name
Docwell

## Tagline (60 chars)
Self-hosted help center. Pay once, never rent your docs again

## Description (260 chars)
Docwell is a self-hosted knowledge base that replaces HelpScout Docs, GitBook & Intercom Articles. Markdown editor with live preview, branded help center, instant FTS5 search, helpful-vote analytics, SEO built in. One-time $29 — runs on a $5 VPS or as a desktop app.

## Full description

Every SaaS needs a help center, and somehow that means paying $29–$99/month forever to host what is essentially a folder of markdown files.

Docwell fixes that. It's a complete help center you own:

- **Write** in a markdown editor with split-pane live preview, image paste-to-upload, slug control and draft/publish workflow
- **Organize** articles into collections → categories with full ordering control
- **Publish** a branded public help center: your logo & color, hero search, article pages with auto table of contents, prev/next and related articles
- **Search** is instant — SQLite FTS5 with highlighted snippets, as-you-type
- **Learn** from readers: "Was this helpful? 👍👎" with comments on downvotes, and an admin report that surfaces your worst articles first
- **Rank**: meta descriptions, OG tags, sitemap.xml, clean URLs out of the box

Run it two ways: as a Windows desktop app (Electron, zero setup) or on any $5 VPS with Docker. One SQLite file holds everything — backups are a copy-paste.

MIT-licensed source. $29 once for the packaged installer. No telemetry, no lock-in, no monthly bill.

## Maker first comment

Hey PH 👋

I run a few small SaaS products and got tired of paying subscription pricing for docs. HelpScout wanted $22/user/month, GitBook $79/month for the tier with custom branding — for what is fundamentally markdown files with a search box.

So I built Docwell. It's the help center I wanted: write markdown, hit publish, customers get a fast branded site with instant search. The feature I'm proudest of is the feedback loop — every article gets a "was this helpful?" widget, downvotes can leave a comment, and the admin report sorts your *worst* articles first so you always know what's causing support tickets.

The whole thing is one Node process and one SQLite file. Runs on a $5 VPS or as a plain Windows app if you don't even want a server.

Source is MIT on GitHub. The one-time $29 gets you the 1-click installer + lifetime updates. Ask me anything — honest answers only.

## Gallery shots (5)

1. **Hero shot** — public help center home page: logo, brand-colored hero, big search box mid-search showing highlighted dropdown results.
2. **Split-pane editor** — admin markdown editor, left pane markdown with a code block, right pane live rendered preview, publish button visible.
3. **Article page** — rendered article with table-of-contents sidebar highlighted, code block, and "Was this helpful? 👍👎" widget at the bottom.
4. **Feedback report** — admin table of worst-scoring articles with red/amber/green score bars and reader comments on 👎 votes.
5. **Comparison card** — "Docwell $29 once vs GitBook $79/mo → $2,844 over 3 years" pricing graphic, with the desktop-app + VPS dual-mode diagram.

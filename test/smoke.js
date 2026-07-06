// Docwell end-to-end smoke test: boots the real server on an ephemeral port,
// exercises the admin API + public help center, and asserts every core behavior.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docwell-smoke-'));
const { createApp } = require('../server/app.js');

const PASSWORD = 'smoke-test-pw';
let base = '';
let adminCookie = '';
const results = [];

function ok(name) {
  results.push(name);
  console.log(`  ✓ ${name}`);
}

async function req(method, url, { body, cookie, raw, formData } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let payload;
  if (formData) payload = formData;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: raw ? null : safeJson(text) };
}
const safeJson = (t) => { try { return JSON.parse(t); } catch { return null; } };

async function main() {
  const app = createApp({ dataDir, adminPassword: PASSWORD });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  console.log(`Smoke test against ${base} (data: ${dataDir})\n`);

  // --- auth ---
  const bad = await req('POST', '/api/login', { body: { password: 'wrong' } });
  assert.strictEqual(bad.status, 401, 'wrong password rejected');
  const login = await req('POST', '/api/login', { body: { password: PASSWORD } });
  assert.strictEqual(login.status, 200);
  adminCookie = login.headers.get('set-cookie').split(';')[0];
  const noAuth = await req('GET', '/api/collections');
  assert.strictEqual(noAuth.status, 401, 'admin API requires auth');
  ok('admin auth: wrong password rejected, session cookie issued, API gated');

  // --- create collection / category / article ---
  const col = (await req('POST', '/api/collections', { cookie: adminCookie, body: { name: 'Getting Started', description: 'First steps', icon: 'rocket' } })).json;
  assert.strictEqual(col.slug, 'getting-started');
  const cat = (await req('POST', '/api/categories', { cookie: adminCookie, body: { name: 'Installation', collection_id: col.id } })).json;
  assert.strictEqual(cat.slug, 'installation');

  const bodyMd = [
    '# Installing Docwell',
    '',
    'This guide covers the **zanzibar deployment** flow end to end.',
    '',
    '## Requirements',
    '',
    'You need Node 20 or newer.',
    '',
    '## Install steps',
    '',
    'Run the following:',
    '',
    '```bash',
    'npm install && npm start',
    '```',
    '',
    '### Verify it worked',
    '',
    'Open the help center in your browser.'
  ].join('\n');

  const art = (await req('POST', '/api/articles', {
    cookie: adminCookie,
    body: { title: 'Installing Docwell', category_id: cat.id, description: 'How to install', body_md: bodyMd, status: 'published' }
  })).json;
  assert.strictEqual(art.status, 'published');
  assert.strictEqual(art.slug, 'installing-docwell');
  ok('created collection, category and published article via API (auto slugs)');

  // --- public article page: HTML render + TOC anchors + code block ---
  const page = await req('GET', `/articles/${art.slug}`, { raw: true });
  assert.strictEqual(page.status, 200);
  assert.ok(page.text.includes('id="requirements"'), 'h2 got TOC anchor id');
  assert.ok(page.text.includes('id="install-steps"'), 'second h2 anchor');
  assert.ok(page.text.includes('id="verify-it-worked"'), 'h3 anchor');
  assert.ok(/class="toc"/.test(page.text) && page.text.includes('href="#requirements"'), 'TOC sidebar links to headings');
  assert.ok(page.text.includes('<pre><code class="language-bash">'), 'fenced code block rendered');
  assert.ok(page.text.includes('<strong>zanzibar deployment</strong>'), 'markdown emphasis rendered');
  assert.ok(page.text.includes('Was this article helpful?'), 'feedback widget present');
  ok('public article page renders markdown → HTML with TOC anchors + code block');

  // --- collection & category pages ---
  const colPage = await req('GET', `/collections/${col.slug}`, { raw: true });
  assert.ok(colPage.status === 200 && colPage.text.includes('Installing Docwell'));
  const catPage = await req('GET', `/categories/${cat.slug}`, { raw: true });
  assert.ok(catPage.status === 200 && catPage.text.includes('Installing Docwell'));
  ok('collection and category pages list the published article');

  // --- FTS search with snippet (body word) ---
  const search = (await req('GET', '/api/search?q=zanzibar')).json;
  assert.strictEqual(search.results.length, 1);
  assert.strictEqual(search.results[0].slug, art.slug);
  assert.ok(search.results[0].snippet.includes('<mark>zanzibar</mark>'), 'snippet highlights matched body word');
  const prefix = (await req('GET', '/api/search?q=zanz')).json;
  assert.strictEqual(prefix.results.length, 1, 'prefix search-as-you-type matches');
  ok('FTS search finds article by body word with highlighted snippet (incl. prefix match)');

  // --- draft: not public, not in search ---
  const draft = (await req('POST', '/api/articles', {
    cookie: adminCookie,
    body: { title: 'Secret Draft', category_id: cat.id, body_md: 'The hidden kraken procedure.', status: 'draft' }
  })).json;
  const draftPage = await req('GET', `/articles/${draft.slug}`, { raw: true });
  assert.strictEqual(draftPage.status, 404, 'draft article is not public');
  const draftSearch = (await req('GET', '/api/search?q=kraken')).json;
  assert.strictEqual(draftSearch.results.length, 0, 'draft not in search index');
  // publish it → appears; unpublish → gone again
  await req('PUT', `/api/articles/${draft.id}`, { cookie: adminCookie, body: { status: 'published' } });
  assert.strictEqual((await req('GET', '/api/search?q=kraken')).json.results.length, 1, 'publishing indexes it');
  await req('PUT', `/api/articles/${draft.id}`, { cookie: adminCookie, body: { status: 'draft' } });
  assert.strictEqual((await req('GET', '/api/search?q=kraken')).json.results.length, 0, 'unpublishing deindexes it');
  ok('draft article returns 404 publicly and is excluded from search; publish/unpublish syncs FTS');

  // --- helpful vote: once per visitor token ---
  const v1 = await req('POST', `/api/articles/${art.slug}/vote`, { body: { helpful: 0, comment: 'Missing docker steps' } });
  assert.strictEqual(v1.status, 200);
  assert.strictEqual(v1.json.duplicate, false);
  const vt = v1.headers.get('set-cookie').split(';')[0]; // vt=...
  const v2 = await req('POST', `/api/articles/${art.slug}/vote`, { body: { helpful: 1 }, cookie: vt });
  assert.strictEqual(v2.json.duplicate, true, 'second vote from same visitor ignored');
  const report = (await req('GET', '/api/report/votes', { cookie: adminCookie })).json;
  assert.strictEqual(report.articles.length, 1);
  assert.strictEqual(report.articles[0].down, 1);
  assert.strictEqual(report.articles[0].up, 0, 'duplicate vote not recorded');
  assert.strictEqual(report.comments[0].comment, 'Missing docker steps');
  ok('helpful vote recorded once per visitor token; 👎 comment appears in admin report');

  // --- sitemap ---
  const sitemap = await req('GET', '/sitemap.xml', { raw: true });
  assert.strictEqual(sitemap.status, 200);
  assert.ok(sitemap.text.includes(`/articles/${art.slug}`), 'sitemap lists published article');
  assert.ok(!sitemap.text.includes(draft.slug), 'sitemap excludes draft');
  assert.ok(sitemap.text.startsWith('<?xml'), 'valid xml prologue');
  ok('sitemap.xml lists the published article and excludes drafts');

  // --- image upload + serving ---
  // 1x1 transparent PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
  const up = await req('POST', '/api/upload', { cookie: adminCookie, formData: fd });
  assert.strictEqual(up.status, 200);
  assert.ok(up.json.url.startsWith('/uploads/'));
  const served = await fetch(base + up.json.url);
  assert.strictEqual(served.status, 200);
  assert.strictEqual((await served.arrayBuffer()).byteLength, png.length, 'uploaded image served intact');
  ok('image upload stored and served from /uploads');

  // --- SEO tags on article page ---
  assert.ok(page.text.includes('<meta name="description" content="How to install"'), 'meta description');
  assert.ok(page.text.includes('property="og:title"'), 'OG tags');
  ok('SEO meta description + OG tags present');

  // --- 404 suggestions ---
  const nf = await req('GET', '/articles/installing-dockwell-typo', { raw: true });
  assert.strictEqual(nf.status, 404);
  assert.ok(nf.text.includes('Installing Docwell'), '404 page suggests the close match');
  ok('404 page suggests similar published articles');

  // --- internal links + related articles ---
  const art2 = (await req('POST', '/api/articles', {
    cookie: adminCookie,
    body: {
      title: 'Upgrading Docwell', category_id: cat.id, status: 'published',
      body_md: 'Before upgrading, read [[installing-docwell]] first.',
      related_ids: [art.id]
    }
  })).json;
  const page2 = await req('GET', `/articles/${art2.slug}`, { raw: true });
  assert.ok(page2.text.includes(`href="/articles/${art.slug}"`), 'wiki-style internal link resolved');
  assert.ok(page2.text.includes('Related articles'), 'related articles section rendered');
  ok('internal [[slug]] links resolve and related articles render');

  // --- home page ---
  const home = await req('GET', '/', { raw: true });
  assert.ok(home.status === 200 && home.text.includes('Getting Started') && home.text.includes('kb-search'));
  ok('home page shows collections and hero search');

  server.close();
  console.log(`\nAll ${results.length} smoke checks passed.`);
  try {
    app.locals.db.close(); // release the SQLite handle so Windows lets us delete
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch { /* leftover temp dir is harmless */ }
  process.exit(0);
}

main().catch((e) => {
  console.error('\nSMOKE TEST FAILED:', e);
  process.exit(1);
});

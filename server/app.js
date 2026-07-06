const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const {
  openDb, getSettings, setSettings,
  reindexArticle, searchArticles, ftsQuery, uniqueSlug
} = require('./db');
const { renderMarkdown } = require('./markdown');
const pages = require('./public-pages');

function createApp(opts = {}) {
  const dataDir = opts.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD || 'admin';
  const autologinToken = opts.autologinToken || process.env.AUTOLOGIN_TOKEN || null;

  const db = openDb(dataDir);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // ---- sessions (in-memory, simple by design) ----
  const sessions = new Set();
  function newSession(res) {
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.add(sid);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    return sid;
  }
  function requireAuth(req, res, next) {
    if (req.cookies.sid && sessions.has(req.cookies.sid)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- anonymous visitor token (one helpful-vote per article per visitor) ----
  function visitorToken(req, res) {
    let vt = req.cookies.vt;
    if (!vt || !/^[a-f0-9]{32}$/.test(vt)) {
      vt = crypto.randomBytes(16).toString('hex');
      res.cookie('vt', vt, { sameSite: 'lax', maxAge: 365 * 24 * 3600 * 1000 });
    }
    return vt;
  }

  // ---- uploads ----
  const uploadsDir = path.join(dataDir, 'uploads');
  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.png').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      cb(null, /^image\/(png|jpe?g|webp|gif|svg\+xml|avif)$/.test(file.mimetype));
    }
  });
  app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', immutable: true }));

  // ---- shared queries ----
  const resolveTitle = (slug) => {
    const a = db.prepare("SELECT title FROM articles WHERE slug = ? AND status = 'published'").get(slug);
    return a ? a.title : null;
  };
  const publishedArticle = db.prepare(
    "SELECT * FROM articles WHERE slug = ? AND status = 'published'"
  );

  function relatedFor(article) {
    const ids = (() => { try { return JSON.parse(article.related_ids) || []; } catch { return []; } })();
    let rel = [];
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      rel = db.prepare(`SELECT id, title, slug FROM articles WHERE id IN (${ph}) AND status = 'published'`).all(...ids);
    }
    if (!rel.length) {
      // Fallback: "more like this" from the FTS index using the article title.
      rel = searchArticles(db, article.title, 4, { or: true }).filter((r) => r.id !== article.id).slice(0, 3);
    }
    return rel.filter((r) => r.id !== article.id).slice(0, 4);
  }

  // ================= PUBLIC =================

  app.get('/', (req, res) => {
    const settings = getSettings(db);
    const collections = db
      .prepare(
        `SELECT c.*, (
           SELECT COUNT(*) FROM articles a JOIN categories cat ON cat.id = a.category_id
           WHERE cat.collection_id = c.id AND a.status = 'published'
         ) AS article_count
         FROM collections c ORDER BY c.position ASC, c.id ASC`
      )
      .all();
    res.type('html').send(pages.renderHome({ settings, collections }));
  });

  app.get('/collections/:slug', (req, res, next) => {
    const collection = db.prepare('SELECT * FROM collections WHERE slug = ?').get(req.params.slug);
    if (!collection) return next();
    const settings = getSettings(db);
    const categories = db
      .prepare('SELECT * FROM categories WHERE collection_id = ? ORDER BY position ASC, id ASC')
      .all(collection.id)
      .map((cat) => ({
        ...cat,
        articles: db
          .prepare("SELECT id, title, slug FROM articles WHERE category_id = ? AND status = 'published' ORDER BY position ASC, id ASC")
          .all(cat.id)
      }))
      .filter((cat) => cat.articles.length > 0);
    res.type('html').send(pages.renderCollection({ settings, collection, categories }));
  });

  app.get('/categories/:slug', (req, res, next) => {
    const category = db.prepare('SELECT * FROM categories WHERE slug = ?').get(req.params.slug);
    if (!category) return next();
    const settings = getSettings(db);
    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(category.collection_id);
    const articles = db
      .prepare("SELECT id, title, slug FROM articles WHERE category_id = ? AND status = 'published' ORDER BY position ASC, id ASC")
      .all(category.id);
    res.type('html').send(pages.renderCategory({ settings, collection, category, articles }));
  });

  app.get('/articles/:slug', (req, res, next) => {
    const article = publishedArticle.get(req.params.slug);
    if (!article) return next();
    const settings = getSettings(db);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(article.category_id);
    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(category.collection_id);
    const siblings = db
      .prepare("SELECT id, title, slug FROM articles WHERE category_id = ? AND status = 'published' ORDER BY position ASC, id ASC")
      .all(category.id);
    const i = siblings.findIndex((s) => s.id === article.id);
    const prev = i > 0 ? siblings[i - 1] : null;
    const next2 = i >= 0 && i < siblings.length - 1 ? siblings[i + 1] : null;
    const { html, toc } = renderMarkdown(article.body_md, { resolveTitle });
    const vt = visitorToken(req, res);
    const alreadyVoted = !!db.prepare('SELECT id FROM votes WHERE article_id = ? AND token = ?').get(article.id, vt);
    res.type('html').send(
      pages.renderArticle({ settings, article, html, toc, collection, category, prev, next: next2, related: relatedFor(article), alreadyVoted })
    );
  });

  app.get('/search', (req, res) => {
    const q = String(req.query.q || '').slice(0, 200);
    const settings = getSettings(db);
    const results = q ? searchArticles(db, q, 20) : [];
    res.type('html').send(pages.renderSearchPage({ settings, q, results }));
  });

  // search-as-you-type JSON endpoint (published articles only, highlighted snippets)
  app.get('/api/search', (req, res) => {
    const q = String(req.query.q || '').slice(0, 200);
    res.json({ results: searchArticles(db, q, 8) });
  });

  // "Was this helpful?" — one vote per visitor token per article
  app.post('/api/articles/:slug/vote', (req, res) => {
    const article = publishedArticle.get(req.params.slug);
    if (!article) return res.status(404).json({ error: 'Not found' });
    const helpful = req.body?.helpful ? 1 : 0;
    const comment = String(req.body?.comment || '').slice(0, 2000);
    const vt = visitorToken(req, res);
    const info = db
      .prepare('INSERT OR IGNORE INTO votes (article_id, token, helpful, comment) VALUES (?, ?, ?, ?)')
      .run(article.id, vt, helpful, comment);
    if (info.changes === 0) {
      return res.json({ ok: true, duplicate: true, message: 'You already left feedback on this article — thanks!' });
    }
    res.json({ ok: true, duplicate: false, message: helpful ? 'Great — thanks for letting us know! 🙌' : 'Thanks — we’ll use this to improve the article.' });
  });

  app.get('/sitemap.xml', (req, res) => {
    const settings = getSettings(db);
    const base = (settings.site_url || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    const urls = [{ loc: `${base}/`, lastmod: null }];
    for (const c of db.prepare('SELECT slug FROM collections ORDER BY position').all())
      urls.push({ loc: `${base}/collections/${c.slug}` });
    for (const c of db.prepare('SELECT slug FROM categories ORDER BY position').all())
      urls.push({ loc: `${base}/categories/${c.slug}` });
    for (const a of db.prepare("SELECT slug, updated_at FROM articles WHERE status = 'published' ORDER BY id").all())
      urls.push({ loc: `${base}/articles/${a.slug}`, lastmod: String(a.updated_at).slice(0, 10) });
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${pages.esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') +
      `\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  app.get('/robots.txt', (req, res) => {
    const settings = getSettings(db);
    const base = (settings.site_url || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`);
  });

  // ================= AUTH =================

  app.post('/api/login', (req, res) => {
    const pw = String(req.body?.password || '');
    const a = Buffer.from(pw);
    const b = Buffer.from(adminPassword);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    newSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    sessions.delete(req.cookies.sid);
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ authed: !!(req.cookies.sid && sessions.has(req.cookies.sid)) });
  });

  // desktop-mode auto-login
  if (autologinToken) {
    app.get('/auth/auto', (req, res) => {
      if (req.query.token !== autologinToken) return res.status(403).send('Forbidden');
      newSession(res);
      res.redirect('/admin');
    });
  }

  // ================= ADMIN API =================

  app.get('/api/settings', requireAuth, (req, res) => res.json(getSettings(db)));
  app.put('/api/settings', requireAuth, (req, res) => {
    setSettings(db, req.body || {});
    res.json(getSettings(db));
  });

  app.get('/api/icons', requireAuth, (req, res) => res.json(Object.keys(pages.ICONS)));

  app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image received (png/jpg/webp/gif/svg/avif, max 10MB)' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // live-preview renderer for the split-pane editor (same pipeline as public pages)
  app.post('/api/render', requireAuth, (req, res) => {
    const { html, toc } = renderMarkdown(String(req.body?.md || ''), { resolveTitle });
    res.json({ html, toc });
  });

  // ---- collections ----
  app.get('/api/collections', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM collections ORDER BY position ASC, id ASC').all());
  });
  app.post('/api/collections', requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const slug = uniqueSlug(db, 'collections', req.body?.slug || name);
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM collections').get().m;
    const info = db
      .prepare('INSERT INTO collections (name, slug, description, icon, position) VALUES (?, ?, ?, ?, ?)')
      .run(name, slug, String(req.body?.description || ''), String(req.body?.icon || 'book-open'), maxPos + 1);
    res.status(201).json(db.prepare('SELECT * FROM collections WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/collections/reorder', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const stmt = db.prepare('UPDATE collections SET position = ? WHERE id = ?');
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
    res.json({ ok: true });
  });
  app.put('/api/collections/:id', requireAuth, (req, res) => {
    const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const name = String(req.body?.name ?? c.name).trim() || c.name;
    const slug = req.body?.slug ? uniqueSlug(db, 'collections', req.body.slug, c.id) : c.slug;
    db.prepare('UPDATE collections SET name=?, slug=?, description=?, icon=? WHERE id=?').run(
      name, slug, String(req.body?.description ?? c.description), String(req.body?.icon ?? c.icon), c.id
    );
    res.json(db.prepare('SELECT * FROM collections WHERE id = ?').get(c.id));
  });
  app.delete('/api/collections/:id', requireAuth, (req, res) => {
    const arts = db.prepare('SELECT a.id FROM articles a JOIN categories c ON c.id = a.category_id WHERE c.collection_id = ?').all(req.params.id);
    db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
    for (const a of arts) reindexArticle(db, a.id);
    res.json({ ok: true });
  });

  // ---- categories ----
  app.get('/api/categories', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM categories ORDER BY position ASC, id ASC').all());
  });
  app.post('/api/categories', requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    const collectionId = Number(req.body?.collection_id);
    if (!name || !collectionId) return res.status(400).json({ error: 'Name and collection_id required' });
    const slug = uniqueSlug(db, 'categories', req.body?.slug || name);
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM categories WHERE collection_id = ?').get(collectionId).m;
    const info = db
      .prepare('INSERT INTO categories (collection_id, name, slug, description, position) VALUES (?, ?, ?, ?, ?)')
      .run(collectionId, name, slug, String(req.body?.description || ''), maxPos + 1);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/categories/reorder', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const stmt = db.prepare('UPDATE categories SET position = ? WHERE id = ?');
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
    res.json({ ok: true });
  });
  app.put('/api/categories/:id', requireAuth, (req, res) => {
    const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const name = String(req.body?.name ?? c.name).trim() || c.name;
    const slug = req.body?.slug ? uniqueSlug(db, 'categories', req.body.slug, c.id) : c.slug;
    db.prepare('UPDATE categories SET name=?, slug=?, description=?, collection_id=? WHERE id=?').run(
      name, slug, String(req.body?.description ?? c.description), Number(req.body?.collection_id ?? c.collection_id), c.id
    );
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(c.id));
  });
  app.delete('/api/categories/:id', requireAuth, (req, res) => {
    const arts = db.prepare('SELECT id FROM articles WHERE category_id = ?').all(req.params.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    for (const a of arts) reindexArticle(db, a.id);
    res.json({ ok: true });
  });

  // ---- articles ----
  app.get('/api/articles', requireAuth, (req, res) => {
    res.json(
      db.prepare(
        `SELECT a.id, a.category_id, a.title, a.slug, a.description, a.status, a.position, a.updated_at,
                (SELECT COUNT(*) FROM votes v WHERE v.article_id = a.id AND v.helpful = 1) AS up,
                (SELECT COUNT(*) FROM votes v WHERE v.article_id = a.id AND v.helpful = 0) AS down
         FROM articles a ORDER BY a.position ASC, a.id ASC`
      ).all()
    );
  });
  app.get('/api/articles/:id', requireAuth, (req, res) => {
    const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(a);
  });
  app.post('/api/articles', requireAuth, (req, res) => {
    const title = String(req.body?.title || '').trim();
    const categoryId = Number(req.body?.category_id);
    if (!title || !categoryId) return res.status(400).json({ error: 'Title and category_id required' });
    const slug = uniqueSlug(db, 'articles', req.body?.slug || title);
    const status = req.body?.status === 'published' ? 'published' : 'draft';
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM articles WHERE category_id = ?').get(categoryId).m;
    const info = db
      .prepare(
        `INSERT INTO articles (category_id, title, slug, description, body_md, status, position, related_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        categoryId, title, slug,
        String(req.body?.description || ''), String(req.body?.body_md || ''),
        status, maxPos + 1, JSON.stringify(Array.isArray(req.body?.related_ids) ? req.body.related_ids : [])
      );
    reindexArticle(db, info.lastInsertRowid);
    res.status(201).json(db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/articles/reorder', requireAuth, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const stmt = db.prepare('UPDATE articles SET position = ? WHERE id = ?');
    db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
    res.json({ ok: true });
  });
  app.put('/api/articles/:id', requireAuth, (req, res) => {
    const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const title = String(req.body?.title ?? a.title).trim() || a.title;
    const slug = req.body?.slug ? uniqueSlug(db, 'articles', req.body.slug, a.id) : a.slug;
    const status = req.body?.status ? (req.body.status === 'published' ? 'published' : 'draft') : a.status;
    db.prepare(
      `UPDATE articles SET category_id=?, title=?, slug=?, description=?, body_md=?, status=?,
       related_ids=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      Number(req.body?.category_id ?? a.category_id), title, slug,
      String(req.body?.description ?? a.description),
      String(req.body?.body_md ?? a.body_md), status,
      JSON.stringify(Array.isArray(req.body?.related_ids) ? req.body.related_ids : JSON.parse(a.related_ids || '[]')),
      a.id
    );
    reindexArticle(db, a.id);
    res.json(db.prepare('SELECT * FROM articles WHERE id = ?').get(a.id));
  });
  app.delete('/api/articles/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM articles_fts WHERE article_id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ---- helpful-votes report (worst articles first) ----
  app.get('/api/report/votes', requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT a.id, a.title, a.slug, a.status,
                SUM(CASE WHEN v.helpful = 1 THEN 1 ELSE 0 END) AS up,
                SUM(CASE WHEN v.helpful = 0 THEN 1 ELSE 0 END) AS down,
                COUNT(v.id) AS total
         FROM articles a JOIN votes v ON v.article_id = a.id
         GROUP BY a.id
         ORDER BY (CAST(SUM(CASE WHEN v.helpful = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(v.id)) ASC, total DESC`
      )
      .all()
      .map((r) => ({ ...r, score: r.total ? Math.round((r.up / r.total) * 100) : null }));
    const comments = db
      .prepare(
        `SELECT v.article_id, v.comment, v.ts, a.title FROM votes v
         JOIN articles a ON a.id = v.article_id
         WHERE v.helpful = 0 AND v.comment != '' ORDER BY v.ts DESC LIMIT 100`
      )
      .all();
    res.json({ articles: rows, comments });
  });

  // ================= ADMIN SPA =================
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use('/admin', express.static(distDir));
    app.get('/admin/*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    app.get('/admin', (req, res) =>
      res.status(503).type('html').send('<h1>Admin UI not built</h1><p>Run <code>npm run build</code> first.</p>')
    );
  }

  // ================= 404 with suggestions =================
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    const settings = getSettings(db);
    const words = req.path.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 2).join(' ');
    const suggestions = words ? searchArticles(db, words, 5, { or: true }) : [];
    res.status(404).type('html').send(pages.render404({ settings, suggestions }));
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp };

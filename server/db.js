const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(path.join(dataDir, 'app.db'), nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'book-open',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',    -- meta description / summary
      body_md TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',    -- draft | published
      position INTEGER NOT NULL DEFAULT 0,
      related_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of article ids
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      helpful INTEGER NOT NULL,                -- 1 = 👍, 0 = 👎
      comment TEXT NOT NULL DEFAULT '',
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(article_id, token)
    );
    CREATE INDEX IF NOT EXISTS idx_categories_collection ON categories(collection_id);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_votes_article ON votes(article_id);
  `);

  // Plain FTS5 table maintained manually (only published articles are indexed).
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title, description, body,
      article_id UNINDEXED, slug UNINDEXED,
      tokenize = 'unicode61'
    );
  `);

  return db;
}

// Strip markdown syntax to plain text so FTS snippets read cleanly.
function mdToPlain(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?|```/g, ' '))
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, s, t) => t || s)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>~#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Keep the FTS index in sync with one article (drafts drop out of the index).
function reindexArticle(db, articleId) {
  db.prepare('DELETE FROM articles_fts WHERE article_id = ?').run(articleId);
  const a = db.prepare("SELECT * FROM articles WHERE id = ? AND status = 'published'").get(articleId);
  if (a) {
    db.prepare(
      'INSERT INTO articles_fts (title, description, body, article_id, slug) VALUES (?, ?, ?, ?, ?)'
    ).run(a.title, a.description, mdToPlain(a.body_md), a.id, a.slug);
  }
}

// Escape user input into a safe FTS5 prefix query: each token quoted + starred.
function ftsQuery(q, { or = false } = {}) {
  const tokens = String(q || '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(or ? ' OR ' : ' ');
}

function searchArticles(db, q, limit = 8, opts = {}) {
  const match = ftsQuery(q, opts);
  if (!match) return [];
  try {
    return db
      .prepare(
        `SELECT f.article_id AS id, f.slug,
                snippet(articles_fts, 0, '<mark>', '</mark>', '…', 10) AS title_hl,
                snippet(articles_fts, 2, '<mark>', '</mark>', '…', 14) AS snippet,
                a.title, a.description,
                cat.name AS category, col.name AS collection
         FROM articles_fts f
         JOIN articles a ON a.id = f.article_id
         JOIN categories cat ON cat.id = a.category_id
         JOIN collections col ON col.id = cat.collection_id
         WHERE articles_fts MATCH ?
         ORDER BY rank LIMIT ?`
      )
      .all(match, limit);
  } catch {
    return [];
  }
}

const DEFAULT_SETTINGS = {
  site_name: 'Docwell',
  tagline: 'Help Center',
  logo: '',                       // /uploads/... image url
  accent: '#6366f1',
  hero_title: 'How can we help?',
  hero_subtitle: 'Search our knowledge base or browse the collections below.',
  meta_description: 'Answers, guides and documentation — searchable and always up to date.',
  footer_text: 'Powered by Docwell',
  site_url: ''                    // canonical base URL for sitemap/OG, e.g. https://help.example.com
};

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (k in DEFAULT_SETTINGS) stmt.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(obj));
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

// Ensure slug uniqueness within a table (appends -2, -3, ... when taken).
function uniqueSlug(db, table, desired, excludeId = null) {
  let slug = slugify(desired);
  let i = 1;
  for (;;) {
    const row = excludeId
      ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).get(slug, excludeId)
      : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(slug);
    if (!row) return slug;
    i++;
    slug = `${slugify(desired)}-${i}`;
  }
}

module.exports = {
  openDb, getSettings, setSettings, DEFAULT_SETTINGS,
  reindexArticle, searchArticles, ftsQuery, mdToPlain, slugify, uniqueSlug
};

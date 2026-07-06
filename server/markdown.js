const { marked } = require('marked');
const { slugify } = require('./db');

marked.setOptions({ gfm: true, breaks: false });

// Pre-process internal wiki-style links: [[slug]] or [[slug|Link text]]
// resolveTitle(slug) → article title or null (broken links render as plain text).
function resolveInternalLinks(md, resolveTitle) {
  return String(md || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, slug, text) => {
    const s = slug.trim();
    const title = resolveTitle ? resolveTitle(s) : null;
    if (!title) return text || s;
    return `[${text || title}](/articles/${s})`;
  });
}

// Render markdown → { html, toc }. Heading IDs are injected by post-processing
// the HTML (version-agnostic vs. marked renderer API churn) and h2/h3 collected
// into a TOC used by the article sidebar.
function renderMarkdown(md, { resolveTitle } = {}) {
  const source = resolveInternalLinks(md, resolveTitle);
  let html = marked.parse(source);

  const toc = [];
  const used = new Map();
  html = html.replace(/<h([123])>([\s\S]*?)<\/h\1>/g, (m, level, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim();
    let id = slugify(text);
    const n = used.get(id) || 0;
    used.set(id, n + 1);
    if (n > 0) id = `${id}-${n + 1}`;
    if (level !== '1') toc.push({ level: Number(level), id, text });
    return `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to ${text.replace(/"/g, '&quot;')}">#</a></h${level}>`;
  });

  return { html, toc };
}

module.exports = { renderMarkdown, resolveInternalLinks };

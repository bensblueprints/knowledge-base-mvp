// Server-rendered public help center — zero client framework, SEO-friendly,
// clean URLs, OG tags, instant FTS search dropdown via /api/search.

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ICONS = {
  'book-open': '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  'credit-card': '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
};

function icon(name, size = 22) {
  const paths = ICONS[name] || ICONS['book-open'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const CSS = `
:root { color-scheme: dark; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0b0d12; color: #e4e7ee;
  font: 16px/1.65 -apple-system, "Segoe UI", Inter, Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { max-width: 1060px; margin: 0 auto; padding: 0 24px; }
header.site {
  border-bottom: 1px solid #1c2030; background: rgba(11,13,18,.85); backdrop-filter: blur(10px);
  position: sticky; top: 0; z-index: 40;
}
header.site .wrap { display: flex; align-items: center; gap: 14px; height: 62px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; color: #fff; }
.brand:hover { text-decoration: none; }
.brand img { height: 30px; width: auto; border-radius: 6px; }
.brand .dot { width: 26px; height: 26px; border-radius: 8px; background: var(--accent); display: grid; place-items: center; color: #fff; font-size: 14px; }
.brand small { color: #8b93a7; font-weight: 500; }
.hero {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 16%, #0b0d12), #0b0d12 92%);
  padding: 72px 0 56px; text-align: center;
}
.hero h1 { font-size: clamp(28px, 4.5vw, 42px); color: #fff; letter-spacing: -.02em; }
.hero p { color: #9aa2b5; margin-top: 10px; font-size: 17px; }
.searchbox { position: relative; max-width: 620px; margin: 28px auto 0; text-align: left; }
.searchbox input {
  width: 100%; padding: 15px 18px 15px 48px; font-size: 16px; color: #fff;
  background: #12151d; border: 1px solid #262c3e; border-radius: 14px; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.searchbox input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
.searchbox .mag { position: absolute; left: 16px; top: 16px; color: #8b93a7; }
.search-results {
  position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 50;
  background: #12151d; border: 1px solid #262c3e; border-radius: 14px; overflow: hidden;
  box-shadow: 0 18px 50px rgba(0,0,0,.5); display: none; max-height: 420px; overflow-y: auto;
}
.search-results.open { display: block; }
.search-results a { display: block; padding: 12px 16px; border-bottom: 1px solid #1c2030; color: #e4e7ee; }
.search-results a:last-child { border-bottom: 0; }
.search-results a:hover, .search-results a.active { background: #171b26; text-decoration: none; }
.search-results .t { font-weight: 600; color: #fff; font-size: 15px; }
.search-results .s { font-size: 13px; color: #9aa2b5; margin-top: 2px; }
.search-results .c { font-size: 11.5px; color: #6d7590; margin-top: 3px; text-transform: uppercase; letter-spacing: .06em; }
.search-results .none { padding: 14px 16px; color: #8b93a7; font-size: 14px; }
mark { background: color-mix(in srgb, var(--accent) 32%, transparent); color: #fff; border-radius: 3px; padding: 0 2px; }
main { padding: 44px 0 80px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.card {
  display: block; background: #10131b; border: 1px solid #1c2030; border-radius: 16px;
  padding: 22px; color: #e4e7ee; transition: border-color .15s, transform .15s, box-shadow .15s;
}
.card:hover { border-color: color-mix(in srgb, var(--accent) 55%, #1c2030); transform: translateY(-2px); text-decoration: none; box-shadow: 0 12px 32px rgba(0,0,0,.35); }
.card .ic { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); margin-bottom: 14px; }
.card h3 { color: #fff; font-size: 17px; }
.card p { color: #9aa2b5; font-size: 14px; margin-top: 6px; }
.card .n { color: #6d7590; font-size: 12.5px; margin-top: 12px; }
.crumbs { font-size: 13.5px; color: #8b93a7; margin-bottom: 26px; display: flex; gap: 8px; flex-wrap: wrap; }
.crumbs a { color: #8b93a7; }
.crumbs a:hover { color: #fff; }
h1.page { font-size: 30px; color: #fff; letter-spacing: -.02em; }
p.lead { color: #9aa2b5; margin-top: 8px; }
.cat-block { margin-top: 38px; }
.cat-block h2 { font-size: 19px; color: #fff; margin-bottom: 4px; }
.cat-block > p { color: #9aa2b5; font-size: 14px; margin-bottom: 12px; }
.alist { border: 1px solid #1c2030; border-radius: 14px; overflow: hidden; background: #10131b; }
.alist a { display: flex; align-items: center; gap: 12px; padding: 14px 18px; color: #dfe3ec; border-bottom: 1px solid #171b26; font-size: 15px; }
.alist a:last-child { border-bottom: 0; }
.alist a:hover { background: #141824; text-decoration: none; color: #fff; }
.alist svg { color: #6d7590; flex: none; }
.article-layout { display: grid; grid-template-columns: minmax(0,1fr) 240px; gap: 48px; }
@media (max-width: 900px) { .article-layout { grid-template-columns: 1fr; } .toc { display: none; } }
.toc { position: sticky; top: 90px; align-self: start; font-size: 13.5px; }
.toc .h { text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: #6d7590; margin-bottom: 10px; font-weight: 600; }
.toc a { display: block; color: #9aa2b5; padding: 4px 0 4px 12px; border-left: 2px solid #1c2030; }
.toc a.l3 { padding-left: 26px; }
.toc a:hover, .toc a.on { color: #fff; border-left-color: var(--accent); text-decoration: none; }
article.body { font-size: 16px; }
article.body h1, article.body h2, article.body h3 { color: #fff; letter-spacing: -.01em; scroll-margin-top: 84px; position: relative; }
article.body h1 { font-size: 30px; }
article.body h2 { font-size: 22px; margin: 36px 0 14px; padding-top: 8px; }
article.body h3 { font-size: 18px; margin: 28px 0 10px; }
article.body p { margin: 14px 0; color: #c9cfdd; }
article.body ul, article.body ol { margin: 14px 0 14px 26px; color: #c9cfdd; }
article.body li { margin: 6px 0; }
article.body code { background: #171b26; border: 1px solid #262c3e; border-radius: 6px; padding: 2px 6px; font-size: 13.5px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; color: #e8ebf4; }
article.body pre { background: #0d1017; border: 1px solid #1c2030; border-radius: 12px; padding: 16px 18px; overflow-x: auto; margin: 18px 0; }
article.body pre code { background: none; border: 0; padding: 0; font-size: 13.5px; line-height: 1.6; }
article.body img { max-width: 100%; border-radius: 12px; border: 1px solid #1c2030; }
article.body blockquote { border-left: 3px solid var(--accent); margin: 16px 0; padding: 4px 18px; color: #9aa2b5; background: #10131b; border-radius: 0 10px 10px 0; }
article.body table { border-collapse: collapse; width: 100%; margin: 18px 0; font-size: 14.5px; }
article.body th, article.body td { border: 1px solid #1c2030; padding: 9px 13px; text-align: left; }
article.body th { background: #12151d; color: #fff; }
article.body hr { border: 0; border-top: 1px solid #1c2030; margin: 28px 0; }
article.body a.anchor { opacity: 0; margin-left: 8px; font-size: .8em; color: #6d7590; }
article.body h1:hover .anchor, article.body h2:hover .anchor, article.body h3:hover .anchor { opacity: 1; text-decoration: none; }
.meta-line { color: #6d7590; font-size: 13px; margin: 8px 0 24px; }
.feedback { margin-top: 48px; border: 1px solid #1c2030; border-radius: 16px; padding: 22px; background: #10131b; text-align: center; }
.feedback p.q { color: #fff; font-weight: 600; }
.feedback .btns { display: flex; gap: 10px; justify-content: center; margin-top: 14px; }
.feedback button { font-size: 15px; padding: 9px 22px; border-radius: 10px; border: 1px solid #262c3e; background: #171b26; color: #e4e7ee; cursor: pointer; transition: all .12s; }
.feedback button:hover { border-color: var(--accent); transform: translateY(-1px); }
.feedback textarea { width: 100%; margin-top: 12px; background: #0d1017; color: #e4e7ee; border: 1px solid #262c3e; border-radius: 10px; padding: 10px 12px; font: inherit; font-size: 14px; min-height: 76px; resize: vertical; }
.feedback .send { margin-top: 10px; background: var(--accent); border-color: var(--accent); color: #fff; }
.feedback .done { color: #9aa2b5; margin-top: 8px; }
.pn { display: flex; gap: 14px; margin-top: 34px; }
.pn a { flex: 1; border: 1px solid #1c2030; border-radius: 14px; padding: 14px 18px; background: #10131b; color: #e4e7ee; }
.pn a:hover { border-color: color-mix(in srgb, var(--accent) 55%, #1c2030); text-decoration: none; }
.pn .lbl { font-size: 11.5px; text-transform: uppercase; letter-spacing: .07em; color: #6d7590; }
.pn .t { color: #fff; font-size: 14.5px; margin-top: 3px; font-weight: 600; }
.pn a.next { text-align: right; }
.related { margin-top: 40px; }
.related h2 { font-size: 17px; color: #fff; margin-bottom: 12px; }
footer.site { border-top: 1px solid #1c2030; padding: 26px 0; color: #6d7590; font-size: 13.5px; text-align: center; }
.err { text-align: center; padding: 40px 0 10px; }
.err .code { font-size: 64px; font-weight: 800; color: color-mix(in srgb, var(--accent) 60%, #fff); letter-spacing: -.04em; }
`;

const SEARCH_JS = `
(function(){
  var input=document.getElementById('kb-search'); if(!input) return;
  var box=document.getElementById('kb-results'), t=null, idx=-1;
  function close(){ box.classList.remove('open'); idx=-1; }
  input.addEventListener('input', function(){
    clearTimeout(t); var q=input.value.trim();
    if(!q){ close(); return; }
    t=setTimeout(function(){
      fetch('/api/search?q='+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(d){
        var rs=d.results||[];
        box.innerHTML = rs.length
          ? rs.map(function(r){ return '<a href="/articles/'+r.slug+'"><div class="t">'+r.title_hl+'</div><div class="s">'+r.snippet+'</div><div class="c">'+r.collection+' › '+r.category+'</div></a>'; }).join('')
          : '<div class="none">No articles found for “'+q.replace(/</g,'&lt;')+'”</div>';
        box.classList.add('open');
      });
    }, 120);
  });
  input.addEventListener('keydown', function(e){
    var links=box.querySelectorAll('a'); if(!box.classList.contains('open')||!links.length) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); idx=Math.min(idx+1,links.length-1); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); idx=Math.max(idx-1,0); }
    else if(e.key==='Enter'&&idx>=0){ e.preventDefault(); location.href=links[idx].href; return; }
    else if(e.key==='Escape'){ close(); return; }
    else return;
    links.forEach(function(l,i){ l.classList.toggle('active', i===idx); });
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.searchbox')) close(); });
})();
`;

function searchBox(placeholder = 'Search for answers…') {
  return `<div class="searchbox">
    <span class="mag"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
    <input id="kb-search" type="search" placeholder="${esc(placeholder)}" autocomplete="off" />
    <div class="search-results" id="kb-results"></div>
  </div>`;
}

function layout({ settings, title, description, body, path = '/', ogType = 'website', extraHead = '', extraJs = '', status = 200 }) {
  const s = settings;
  const fullTitle = title ? `${title} — ${s.site_name}` : `${s.site_name} · ${s.tagline}`;
  const desc = description || s.meta_description;
  const base = (s.site_url || '').replace(/\/+$/, '');
  const canonical = base ? `${base}${path}` : '';
  const logo = s.logo
    ? `<img src="${esc(s.logo)}" alt="${esc(s.site_name)} logo" />`
    : `<span class="dot">${esc(s.site_name.slice(0, 1).toUpperCase())}</span>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:title" content="${esc(fullTitle)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="${esc(s.site_name)}" />
${canonical ? `<meta property="og:url" content="${esc(canonical)}" />\n<link rel="canonical" href="${esc(canonical)}" />` : ''}
<meta name="twitter:card" content="summary" />
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='${s.accent}'/><text x='12' y='17' font-size='13' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='bold'>${esc(s.site_name.slice(0, 1).toUpperCase())}</text></svg>`)}" />
<style>:root{--accent:${esc(s.accent)};}${CSS}</style>
${extraHead}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="/">${logo} ${esc(s.site_name)} <small>${esc(s.tagline)}</small></a>
</div></header>
${body}
<footer class="site"><div class="wrap">${esc(s.footer_text)}</div></footer>
<script>${SEARCH_JS}${extraJs}</script>
</body>
</html>`;
}

function renderHome({ settings, collections }) {
  const cards = collections
    .map(
      (c) => `<a class="card" href="/collections/${esc(c.slug)}">
      <div class="ic">${icon(c.icon)}</div>
      <h3>${esc(c.name)}</h3>
      <p>${esc(c.description)}</p>
      <div class="n">${c.article_count} article${c.article_count === 1 ? '' : 's'}</div>
    </a>`
    )
    .join('\n');
  const body = `
<div class="hero"><div class="wrap">
  <h1>${esc(settings.hero_title)}</h1>
  <p>${esc(settings.hero_subtitle)}</p>
  ${searchBox()}
</div></div>
<main><div class="wrap">
  <div class="grid">${cards || '<p class="lead">No collections yet — log in to <a href="/admin">the admin</a> to create your first one.</p>'}</div>
</div></main>`;
  return layout({ settings, title: '', description: settings.meta_description, body, path: '/' });
}

function articleRow(a) {
  return `<a href="/articles/${esc(a.slug)}">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
    ${esc(a.title)}</a>`;
}

function renderCollection({ settings, collection, categories }) {
  const blocks = categories
    .map(
      (cat) => `<div class="cat-block">
      <h2><a href="/categories/${esc(cat.slug)}">${esc(cat.name)}</a></h2>
      ${cat.description ? `<p>${esc(cat.description)}</p>` : ''}
      <div class="alist">${cat.articles.map(articleRow).join('') || '<a>—</a>'}</div>
    </div>`
    )
    .join('\n');
  const body = `<main><div class="wrap">
    <div class="crumbs"><a href="/">${esc(settings.site_name)}</a> / <span>${esc(collection.name)}</span></div>
    <h1 class="page">${esc(collection.name)}</h1>
    ${collection.description ? `<p class="lead">${esc(collection.description)}</p>` : ''}
    ${blocks || '<p class="lead" style="margin-top:24px">Nothing published here yet.</p>'}
  </div></main>`;
  return layout({
    settings, title: collection.name, description: collection.description || `${collection.name} — ${settings.site_name}`,
    body, path: `/collections/${collection.slug}`
  });
}

function renderCategory({ settings, collection, category, articles }) {
  const body = `<main><div class="wrap">
    <div class="crumbs"><a href="/">${esc(settings.site_name)}</a> / <a href="/collections/${esc(collection.slug)}">${esc(collection.name)}</a> / <span>${esc(category.name)}</span></div>
    <h1 class="page">${esc(category.name)}</h1>
    ${category.description ? `<p class="lead">${esc(category.description)}</p>` : ''}
    <div class="cat-block"><div class="alist">${articles.map(articleRow).join('') || '<a>Nothing published here yet.</a>'}</div></div>
  </div></main>`;
  return layout({
    settings, title: category.name, description: category.description || `${category.name} — ${settings.site_name}`,
    body, path: `/categories/${category.slug}`
  });
}

function renderArticle({ settings, article, html, toc, collection, category, prev, next, related, alreadyVoted }) {
  const tocHtml = toc.length
    ? `<nav class="toc"><div class="h">On this page</div>${toc
        .map((h) => `<a href="#${esc(h.id)}" class="l${h.level}">${esc(h.text)}</a>`)
        .join('')}</nav>`
    : '<div></div>';
  const pn = (prev || next)
    ? `<div class="pn">${prev ? `<a href="/articles/${esc(prev.slug)}"><div class="lbl">← Previous</div><div class="t">${esc(prev.title)}</div></a>` : '<span style="flex:1"></span>'}${next ? `<a class="next" href="/articles/${esc(next.slug)}"><div class="lbl">Next →</div><div class="t">${esc(next.title)}</div></a>` : '<span style="flex:1"></span>'}</div>`
    : '';
  const rel = related.length
    ? `<div class="related"><h2>Related articles</h2><div class="alist">${related.map(articleRow).join('')}</div></div>`
    : '';
  const feedback = alreadyVoted
    ? `<div class="feedback"><p class="done">Thanks — your feedback for this article was recorded. 🙌</p></div>`
    : `<div class="feedback" id="fb">
    <p class="q">Was this article helpful?</p>
    <div class="btns">
      <button type="button" data-v="1">👍 Yes</button>
      <button type="button" data-v="0">👎 No</button>
    </div>
    <div id="fb-no" style="display:none">
      <textarea id="fb-comment" placeholder="Sorry to hear that — what were you looking for? (optional)"></textarea>
      <button type="button" class="send" id="fb-send">Send feedback</button>
    </div>
    <p class="done" id="fb-done" style="display:none"></p>
  </div>`;
  const fbJs = `
(function(){
  var fb=document.getElementById('fb'); if(!fb) return;
  function done(msg){ fb.querySelector('.btns').style.display='none'; document.getElementById('fb-no').style.display='none'; fb.querySelector('.q').style.display='none'; var d=document.getElementById('fb-done'); d.textContent=msg; d.style.display='block'; }
  function send(h,c){ fetch('/api/articles/${article.slug}/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({helpful:h,comment:c||''})}).then(function(r){return r.json();}).then(function(d){ done(d.message||'Thanks for the feedback!'); }); }
  fb.querySelectorAll('.btns button').forEach(function(b){ b.addEventListener('click', function(){
    if(b.dataset.v==='1'){ send(1); } else { fb.querySelector('.btns').style.display='none'; document.getElementById('fb-no').style.display='block'; }
  }); });
  document.getElementById('fb-send').addEventListener('click', function(){ send(0, document.getElementById('fb-comment').value); });
})();
(function(){
  var links=[].slice.call(document.querySelectorAll('.toc a')); if(!links.length) return;
  var heads=links.map(function(l){ return document.getElementById(l.getAttribute('href').slice(1)); });
  function upd(){ var i=heads.length-1; while(i>0 && heads[i] && heads[i].getBoundingClientRect().top>110) i--; links.forEach(function(l,j){ l.classList.toggle('on', j===i); }); }
  document.addEventListener('scroll', upd, {passive:true}); upd();
})();`;
  const body = `<main><div class="wrap">
    <div class="crumbs"><a href="/">${esc(settings.site_name)}</a> / <a href="/collections/${esc(collection.slug)}">${esc(collection.name)}</a> / <a href="/categories/${esc(category.slug)}">${esc(category.name)}</a></div>
    <div class="article-layout">
      <div>
        <article class="body">
          <h1>${esc(article.title)}</h1>
          <div class="meta-line">Updated ${esc(String(article.updated_at).slice(0, 10))}</div>
          ${html}
        </article>
        ${feedback}
        ${pn}
        ${rel}
      </div>
      ${tocHtml}
    </div>
  </div></main>`;
  return layout({
    settings, title: article.title,
    description: article.description || `${article.title} — ${settings.site_name}`,
    body, path: `/articles/${article.slug}`, ogType: 'article',
    extraJs: article.status === 'published' && !alreadyVoted ? fbJs : fbJs
  });
}

function renderSearchPage({ settings, q, results }) {
  const rows = results
    .map(
      (r) => `<a class="card" style="margin-bottom:14px" href="/articles/${esc(r.slug)}">
      <h3>${r.title_hl}</h3>
      <p>${r.snippet}</p>
      <div class="n">${esc(r.collection)} › ${esc(r.category)}</div>
    </a>`
    )
    .join('\n');
  const body = `
<div class="hero" style="padding:48px 0 40px"><div class="wrap">
  <h1 style="font-size:26px">Search</h1>
  ${searchBox()}
</div></div>
<main><div class="wrap">
  ${q ? `<p class="lead" style="margin-bottom:20px">${results.length} result${results.length === 1 ? '' : 's'} for “${esc(q)}”</p>` : ''}
  ${rows || (q ? '<p class="lead">No articles matched. Try different keywords.</p>' : '')}
</div></main>
<script>var i=document.getElementById('kb-search'); if(i) i.value=${JSON.stringify(q || '')};</script>`;
  return layout({ settings, title: q ? `Search: ${q}` : 'Search', body, path: '/search' });
}

function render404({ settings, suggestions }) {
  const sugg = suggestions.length
    ? `<div style="max-width:560px;margin:26px auto 0;text-align:left"><p class="lead" style="text-align:center;margin-bottom:12px">Were you looking for one of these?</p><div class="alist">${suggestions.map(articleRow).join('')}</div></div>`
    : '';
  const body = `<main><div class="wrap">
    <div class="err">
      <div class="code">404</div>
      <h1 class="page">Page not found</h1>
      <p class="lead">That page doesn't exist (or isn't published yet).</p>
      <div style="max-width:560px;margin:24px auto 0">${searchBox('Search the knowledge base…')}</div>
      ${sugg}
      <p style="margin-top:26px"><a href="/">← Back to help center</a></p>
    </div>
  </div></main>`;
  return layout({ settings, title: 'Page not found', body, path: '/404' });
}

module.exports = { renderHome, renderCollection, renderCategory, renderArticle, renderSearchPage, render404, esc, ICONS };

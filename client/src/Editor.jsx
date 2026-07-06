import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Save, ImagePlus, Eye, EyeOff, Link2, Loader2, ExternalLink } from 'lucide-react';
import { api } from './api.js';

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function Editor({ articleId, categoryId, data, onBack }) {
  const [a, setA] = useState(null); // article fields
  const [slugTouched, setSlugTouched] = useState(!!articleId);
  const [preview, setPreview] = useState({ html: '', toc: [] });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);
  const fileRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    if (articleId) {
      api.get(`/api/articles/${articleId}`).then((art) => setA({ ...art, related_ids: JSON.parse(art.related_ids || '[]') }));
    } else {
      setA({
        id: null,
        category_id: categoryId || data.categories[0]?.id || null,
        title: '',
        slug: '',
        description: '',
        body_md: '# New article\n\nWrite your article in **markdown**.\n',
        status: 'draft',
        related_ids: []
      });
    }
  }, [articleId, categoryId]);

  // live preview via the server's real markdown pipeline (identical output to public pages)
  useEffect(() => {
    if (!a) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.post('/api/render', { md: a.body_md }).then(setPreview).catch(() => {});
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [a?.body_md]);

  const otherArticles = useMemo(
    () => data.articles.filter((x) => x.id !== a?.id),
    [data.articles, a?.id]
  );

  if (!a) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin text-zinc-600" size={28} />
      </div>
    );
  }

  function set(patch) {
    setA((prev) => ({ ...prev, ...patch }));
  }

  async function save(overrides = {}) {
    setSaving(true);
    setError('');
    try {
      const payload = { ...a, ...overrides, slug: a.slug || slugify(a.title) };
      let saved;
      if (a.id) saved = await api.put(`/api/articles/${a.id}`, payload);
      else saved = await api.post('/api/articles', payload);
      setA({ ...saved, related_ids: JSON.parse(saved.related_ids || '[]') });
      setSavedAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function insertAtCursor(text) {
    const el = bodyRef.current;
    if (!el) return set({ body_md: a.body_md + text });
    const start = el.selectionStart ?? a.body_md.length;
    const end = el.selectionEnd ?? start;
    set({ body_md: a.body_md.slice(0, start) + text + a.body_md.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  async function uploadImage(file) {
    if (!file) return;
    try {
      const { url } = await api.upload(file);
      insertAtCursor(`\n![${file.name.replace(/\.[^.]+$/, '')}](${url})\n`);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* toolbar */}
      <div className="flex flex-none items-center gap-3 border-b border-zinc-900 bg-zinc-950 px-4 py-2.5">
        <button className="btn" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </button>
        <input
          className="input !w-72 font-medium"
          placeholder="Article title"
          value={a.title}
          onChange={(e) => {
            const title = e.target.value;
            set(slugTouched ? { title } : { title, slug: slugify(title) });
          }}
        />
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          /articles/
          <input
            className="input !w-48 !px-2 !py-1 text-xs"
            placeholder="slug"
            value={a.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: slugify(e.target.value) });
            }}
          />
        </div>
        <select
          className="input !w-48"
          value={a.category_id || ''}
          onChange={(e) => set({ category_id: Number(e.target.value) })}
        >
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {data.collections.find((x) => x.id === c.collection_id)?.name} / {c.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          {savedAt && !error && <span className="text-xs text-zinc-600">Saved {savedAt.toLocaleTimeString()}</span>}
          {a.id && a.status === 'published' && (
            <a className="btn" href={`/articles/${a.slug}`} target="_blank" rel="noreferrer" title="View live">
              <ExternalLink size={14} />
            </a>
          )}
          <button className="btn" onClick={() => save()} disabled={saving || !a.title.trim() || !a.category_id}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            className={`btn ${a.status === 'published' ? '' : 'btn-primary'}`}
            onClick={() => save({ status: a.status === 'published' ? 'draft' : 'published' })}
            disabled={saving || !a.title.trim() || !a.category_id}
          >
            {a.status === 'published' ? (
              <>
                <EyeOff size={14} /> Unpublish
              </>
            ) : (
              <>
                <Eye size={14} /> Publish
              </>
            )}
          </button>
        </div>
      </div>

      {/* meta row */}
      <div className="flex flex-none items-center gap-3 border-b border-zinc-900 bg-zinc-950/60 px-4 py-2">
        <input
          className="input flex-1"
          placeholder="Meta description (SEO + search snippet, ~155 chars)"
          value={a.description}
          maxLength={200}
          onChange={(e) => set({ description: e.target.value })}
        />
        <button className="btn" onClick={() => fileRef.current?.click()} title="Upload image and insert at cursor">
          <ImagePlus size={14} /> Image
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
        <div className="flex items-center gap-1.5" title="Related articles (shown under the article)">
          <Link2 size={14} className="text-zinc-500" />
          <select
            className="input !w-52"
            value=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (id && !a.related_ids.includes(id)) set({ related_ids: [...a.related_ids, id] });
            }}
          >
            <option value="">+ Related article…</option>
            {otherArticles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {a.related_ids.length > 0 && (
        <div className="flex flex-none flex-wrap items-center gap-2 border-b border-zinc-900 bg-zinc-950/60 px-4 py-2">
          <span className="text-xs text-zinc-600">Related:</span>
          {a.related_ids.map((id) => {
            const art = data.articles.find((x) => x.id === id);
            return (
              <button
                key={id}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-xs text-zinc-300 hover:border-red-700 hover:text-red-400"
                onClick={() => set({ related_ids: a.related_ids.filter((x) => x !== id) })}
                title="Click to remove"
              >
                {art?.title || `#${id}`} ×
              </button>
            );
          })}
        </div>
      )}

      {/* split pane */}
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <textarea
          ref={bodyRef}
          className="h-full resize-none border-r border-zinc-900 bg-zinc-950 p-5 font-mono text-[13.5px] leading-relaxed text-zinc-200 outline-none"
          spellCheck={false}
          value={a.body_md}
          placeholder={'# Heading\n\nMarkdown supported: **bold**, `code`, ```code blocks```, images, tables.\nInternal links: [[article-slug]] or [text](/articles/slug)'}
          onChange={(e) => set({ body_md: e.target.value })}
          onPaste={(e) => {
            const img = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
            if (img) {
              e.preventDefault();
              uploadImage(img.getAsFile());
            }
          }}
        />
        <div className="h-full overflow-y-auto bg-zinc-950/50 p-6">
          <div className="preview" dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, FileText, FolderOpen,
  BookOpen, Eye, EyeOff, ThumbsUp, ThumbsDown, X, Check
} from 'lucide-react';
import { api } from './api.js';

function MoveButtons({ list, item, endpoint, reload }) {
  const idx = list.findIndex((x) => x.id === item.id);
  async function move(dir) {
    const ids = list.map((x) => x.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await api.put(endpoint, { ids });
    reload();
  }
  return (
    <span className="flex flex-col">
      <button className="text-zinc-600 hover:text-white disabled:opacity-30" disabled={idx === 0} onClick={() => move(-1)} title="Move up">
        <ChevronUp size={13} />
      </button>
      <button className="text-zinc-600 hover:text-white disabled:opacity-30" disabled={idx === list.length - 1} onClick={() => move(1)} title="Move down">
        <ChevronDown size={13} />
      </button>
    </span>
  );
}

function InlineForm({ initial = {}, fields, onSave, onCancel }) {
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ''])));
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
      <div className="my-2 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        {fields.map((f) => (
          <input
            key={f.key}
            className="input flex-1"
            style={{ minWidth: 140 }}
            placeholder={f.label}
            value={vals[f.key]}
            autoFocus={f === fields[0]}
            onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && vals[fields[0].key].trim() && onSave(vals)}
          />
        ))}
        <button className="btn btn-primary" onClick={() => vals[fields[0].key].trim() && onSave(vals)}>
          <Check size={14} /> Save
        </button>
        <button className="btn" onClick={onCancel}>
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export default function Content({ data, loading, reload, onEdit, onNew }) {
  const { collections, categories, articles } = data;
  const [form, setForm] = useState(null); // {type:'collection'|'category', parentId?, edit?}

  async function saveCollection(vals, edit) {
    if (edit) await api.put(`/api/collections/${edit.id}`, vals);
    else await api.post('/api/collections', vals);
    setForm(null);
    reload();
  }
  async function saveCategory(vals, collectionId, edit) {
    if (edit) await api.put(`/api/categories/${edit.id}`, vals);
    else await api.post('/api/categories', { ...vals, collection_id: collectionId });
    setForm(null);
    reload();
  }
  async function del(kind, item, warning) {
    if (!confirm(`Delete "${item.name || item.title}"? ${warning}`)) return;
    await api.del(`/api/${kind}/${item.id}`);
    reload();
  }

  const colFields = [
    { key: 'name', label: 'Collection name' },
    { key: 'description', label: 'Short description' }
  ];
  const catFields = [
    { key: 'name', label: 'Category name' },
    { key: 'description', label: 'Short description' }
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Content</h1>
          <p className="text-sm text-zinc-500">Collections → categories → articles. Order here is the public order.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ type: 'collection' })}>
          <Plus size={15} /> New collection
        </button>
      </div>

      {form?.type === 'collection' && !form.edit && (
        <InlineForm fields={colFields} onSave={(v) => saveCollection(v)} onCancel={() => setForm(null)} />
      )}

      {collections.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
          <BookOpen className="mx-auto mb-3 text-zinc-700" size={28} />
          Create your first collection — e.g. “Getting Started”, “Billing”, “Troubleshooting”.
        </div>
      )}

      <div className="flex flex-col gap-5">
        {collections.map((col) => {
          const cats = categories.filter((c) => c.collection_id === col.id);
          return (
            <div key={col.id} className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
              {form?.type === 'collection' && form.edit?.id === col.id ? (
                <InlineForm initial={col} fields={colFields} onSave={(v) => saveCollection(v, col)} onCancel={() => setForm(null)} />
              ) : (
                <div className="flex items-center gap-3">
                  <MoveButtons list={collections} item={col} endpoint="/api/collections/reorder" reload={reload} />
                  <BookOpen size={17} className="text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white">{col.name}</div>
                    <div className="truncate text-xs text-zinc-500">/collections/{col.slug}{col.description ? ` — ${col.description}` : ''}</div>
                  </div>
                  <button className="btn" onClick={() => setForm({ type: 'category', parentId: col.id })}>
                    <Plus size={14} /> Category
                  </button>
                  <button className="btn" onClick={() => setForm({ type: 'collection', edit: col })} title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-danger" onClick={() => del('collections', col, 'All its categories and articles will be deleted.')} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}

              {form?.type === 'category' && form.parentId === col.id && !form.edit && (
                <div className="ml-9">
                  <InlineForm fields={catFields} onSave={(v) => saveCategory(v, col.id)} onCancel={() => setForm(null)} />
                </div>
              )}

              <div className="mt-3 ml-9 flex flex-col gap-3">
                {cats.map((cat) => {
                  const arts = articles.filter((a) => a.category_id === cat.id);
                  return (
                    <div key={cat.id} className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-3">
                      {form?.type === 'category' && form.edit?.id === cat.id ? (
                        <InlineForm initial={cat} fields={catFields} onSave={(v) => saveCategory(v, col.id, cat)} onCancel={() => setForm(null)} />
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <MoveButtons list={cats} item={cat} endpoint="/api/categories/reorder" reload={reload} />
                          <FolderOpen size={15} className="text-zinc-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-zinc-100">{cat.name}</div>
                            <div className="truncate text-[11px] text-zinc-600">/categories/{cat.slug}</div>
                          </div>
                          <button className="btn" onClick={() => onNew(cat.id)}>
                            <Plus size={13} /> Article
                          </button>
                          <button className="btn" onClick={() => setForm({ type: 'category', parentId: col.id, edit: cat })} title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-danger" onClick={() => del('categories', cat, 'All its articles will be deleted.')} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      <div className="mt-2 ml-8 flex flex-col">
                        {arts.map((a) => (
                          <div key={a.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-zinc-900">
                            <MoveButtons list={arts} item={a} endpoint="/api/articles/reorder" reload={reload} />
                            <FileText size={14} className="text-zinc-600" />
                            <button className="min-w-0 flex-1 truncate text-left text-sm text-zinc-300 hover:text-white" onClick={() => onEdit(a.id)}>
                              {a.title}
                            </button>
                            <span className="flex items-center gap-1 text-[11px] text-zinc-600" title="Helpful votes">
                              <ThumbsUp size={11} /> {a.up} <ThumbsDown size={11} className="ml-1" /> {a.down}
                            </span>
                            {a.status === 'published' ? (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-400"><Eye size={11} /> Live</span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-500"><EyeOff size={11} /> Draft</span>
                            )}
                            <button className="btn btn-danger !px-2 !py-1 opacity-0 group-hover:opacity-100" onClick={() => del('articles', a, '')} title="Delete">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        {arts.length === 0 && <div className="px-2 py-1 text-xs text-zinc-700">No articles yet.</div>}
                      </div>
                    </div>
                  );
                })}
                {cats.length === 0 && <div className="text-xs text-zinc-700">No categories yet — add one to hold articles.</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

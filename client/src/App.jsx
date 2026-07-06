import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, FileText, Settings as SettingsIcon, ThumbsDown, LogOut, ExternalLink, Loader2 } from 'lucide-react';
import { api } from './api.js';
import Login from './Login.jsx';
import Content from './Content.jsx';
import Editor from './Editor.jsx';
import Settings from './Settings.jsx';
import Reports from './Reports.jsx';

const NAV = [
  { key: 'content', label: 'Content', icon: BookOpen },
  { key: 'reports', label: 'Feedback', icon: ThumbsDown },
  { key: 'settings', label: 'Settings', icon: SettingsIcon }
];

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [view, setView] = useState({ page: 'content' }); // {page} | {page:'editor', articleId}
  const [data, setData] = useState({ collections: [], categories: [], articles: [] });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [collections, categories, articles] = await Promise.all([
        api.get('/api/collections'),
        api.get('/api/categories'),
        api.get('/api/articles')
      ]);
      setData({ collections, categories, articles });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/api/me').then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) reload();
  }, [authed, reload]);

  if (authed === null) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin text-zinc-600" size={28} />
      </div>
    );
  }
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  if (view.page === 'editor') {
    return (
      <Editor
        articleId={view.articleId}
        categoryId={view.categoryId}
        data={data}
        onBack={async () => {
          await reload();
          setView({ page: 'content' });
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-none flex-col border-r border-zinc-900 bg-zinc-950 p-4">
        <div className="mb-6 flex items-center gap-2.5 px-1">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">D</div>
          <div>
            <div className="text-sm font-semibold text-white">Docwell</div>
            <div className="text-[11px] text-zinc-500">Admin</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView({ page: key })}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                view.page === key ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-6">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900/60 hover:text-zinc-200">
            <ExternalLink size={16} /> View help center
          </a>
          <button
            onClick={async () => {
              await api.post('/api/logout');
              setAuthed(false);
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-zinc-900/60 hover:text-zinc-200"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view.page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {view.page === 'content' && (
              <Content
                data={data}
                loading={loading}
                reload={reload}
                onEdit={(articleId) => setView({ page: 'editor', articleId })}
                onNew={(categoryId) => setView({ page: 'editor', articleId: null, categoryId })}
              />
            )}
            {view.page === 'reports' && <Reports />}
            {view.page === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

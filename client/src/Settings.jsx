import React, { useEffect, useRef, useState } from 'react';
import { Save, Upload, Loader2 } from 'lucide-react';
import { api } from './api.js';

const FIELDS = [
  { key: 'site_name', label: 'Site name', hint: 'Shown in the header and page titles.' },
  { key: 'tagline', label: 'Tagline', hint: 'Small text next to the site name, e.g. "Help Center".' },
  { key: 'hero_title', label: 'Hero title', hint: 'Big headline on the home page.' },
  { key: 'hero_subtitle', label: 'Hero subtitle' },
  { key: 'meta_description', label: 'Meta description', hint: 'Default SEO description for the home page.' },
  { key: 'footer_text', label: 'Footer text' },
  { key: 'site_url', label: 'Public URL', hint: 'e.g. https://help.yourapp.com — used for sitemap.xml and canonical/OG tags.' }
];

export default function Settings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/api/settings').then(setS);
  }, []);

  if (!s) return <Loader2 className="animate-spin text-zinc-600" size={24} />;

  async function save() {
    setSaving(true);
    try {
      setS(await api.put('/api/settings', s));
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-zinc-500">Branding for your public help center.</p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs text-zinc-600">Saved {savedAt.toLocaleTimeString()}</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-zinc-900 bg-zinc-950 p-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">Logo</label>
            <div className="flex items-center gap-3">
              {s.logo ? (
                <img src={s.logo} alt="logo" className="h-10 rounded-lg border border-zinc-800" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-lg text-white" style={{ background: s.accent }}>
                  {s.site_name?.[0]?.toUpperCase() || 'D'}
                </div>
              )}
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Upload logo
              </button>
              {s.logo && (
                <button className="btn btn-danger" onClick={() => setS({ ...s, logo: '' })}>
                  Remove
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const { url } = await api.upload(f);
                    setS({ ...s, logo: url });
                  }
                }}
              />
            </div>
          </div>
          <div className="ml-auto">
            <label className="mb-1 block text-sm font-medium text-zinc-300">Brand color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.accent}
                onChange={(e) => setS({ ...s, accent: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900"
              />
              <input className="input !w-28" value={s.accent} onChange={(e) => setS({ ...s, accent: e.target.value })} />
            </div>
          </div>
        </div>

        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium text-zinc-300">{f.label}</label>
            <input className="input" value={s[f.key] || ''} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
            {f.hint && <p className="mt-1 text-xs text-zinc-600">{f.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

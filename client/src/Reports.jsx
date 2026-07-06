import React, { useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, ExternalLink, Loader2, MessageSquare } from 'lucide-react';
import { api } from './api.js';

export default function Reports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/report/votes').then(setData);
  }, []);

  if (!data) return <Loader2 className="animate-spin text-zinc-600" size={24} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Article feedback</h1>
        <p className="text-sm text-zinc-500">Worst-scoring articles first — fix these to deflect more tickets.</p>
      </div>

      {data.articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
          No votes yet. The “Was this helpful?” widget appears at the bottom of every published article.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-950 text-left text-xs text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Article</th>
                <th className="px-4 py-2.5 font-medium">Helpful score</th>
                <th className="px-3 py-2.5 font-medium"><ThumbsUp size={13} /></th>
                <th className="px-3 py-2.5 font-medium"><ThumbsDown size={13} /></th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.articles.map((a) => (
                <tr key={a.id} className="border-t border-zinc-900 bg-zinc-950/50">
                  <td className="px-4 py-3 text-zinc-200">{a.title}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full ${a.score >= 70 ? 'bg-emerald-500' : a.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${a.score}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400">{a.score}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-emerald-400">{a.up}</td>
                  <td className="px-3 py-3 text-red-400">{a.down}</td>
                  <td className="px-3 py-3">
                    <a href={`/articles/${a.slug}`} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white">
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.comments.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <MessageSquare size={15} /> Comments on 👎 votes
          </h2>
          <div className="flex flex-col gap-2">
            {data.comments.map((c, i) => (
              <div key={i} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
                <div className="text-sm text-zinc-300">“{c.comment}”</div>
                <div className="mt-1.5 text-xs text-zinc-600">
                  on <span className="text-zinc-400">{c.title}</span> · {c.ts}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

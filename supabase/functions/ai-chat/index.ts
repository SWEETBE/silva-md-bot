import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-flash-latest',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-8b',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY haijawekwa kwenye Supabase secrets.' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, model, generationConfig } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt inahitajika.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const tryModels = [...new Set([model, ...FALLBACK_MODELS])].filter(Boolean);
    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: generationConfig ?? { temperature: 0.6, maxOutputTokens: 500 },
    });

    let text = '';
    let lastErr = '';

    for (const m of tryModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${GEMINI_API_KEY}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        text = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text).filter(Boolean).join('') || '';
        if (text) break;
        lastErr = d?.error?.message || 'Jibu tupu.';
      } else {
        lastErr = d?.error?.message || d?.message || `HTTP ${r.status}`;
      }
    }

    if (!text) {
      return new Response(JSON.stringify({ error: lastErr || 'Hakuna modeli iliyofanya kazi.' }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Hitilafu ya seva.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

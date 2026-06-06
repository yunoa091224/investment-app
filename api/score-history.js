const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function sb(path, method = 'GET', body = null, extraHeaders = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'resolution=ignore-duplicates,return=minimal' : '',
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Supabase ${method} ${path}: ${r.status} ${text}`);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

function parsePrice(str) {
  if (typeof str === 'number') return str;
  const n = parseFloat((str || '').replace(/[¥$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

// 今日 (JST) の日付文字列 YYYY-MM-DD
function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  // ── POST: ランキングスコアを score_history に保存 ───────────────
  if (req.method === 'POST') {
    const { mode, stocks } = req.body || {};
    if (!mode || !Array.isArray(stocks) || !stocks.length) {
      return res.status(400).json({ error: 'mode と stocks[] が必要です' });
    }

    const today = todayJST();

    // 今日のデータが既に存在するか確認（重複防止）
    const market = mode === 'jp' ? 'jp' : 'us';
    const existing = await sb(
      `score_history?market=eq.${market}&recorded_at=gte.${today}T00:00:00Z&select=id&limit=1`
    );
    if (existing?.length > 0) {
      return res.json({ skipped: true, reason: 'already saved today', date: today });
    }

    const rows = stocks.map(s => ({
      symbol: s.ticker,
      market,
      score: typeof s.score === 'number' ? s.score : null,
      price_at_signal: parsePrice(s.current_price),
      // price_after_10days, result は後でcronが自動更新
    }));

    await sb('score_history', 'POST', rows);
    return res.json({ saved: rows.length, date: today });
  }

  // ── GET: 的中率・統計を返す ────────────────────────────────────
  if (req.method === 'GET') {
    const { market } = req.query;

    const calcStats = async (mkt) => {
      // result が確定済みのレコードを取得
      const rows = await sb(
        `score_history?market=eq.${mkt}&result=not.is.null&select=result,price_at_signal,price_after_10days`
      );
      if (!rows?.length) {
        return { totalTrades: 0, hits: 0, winRate: null, totalPnl: 0, hasData: false };
      }
      const hits = rows.filter(r => r.result === 'win').length;
      const winRate = Math.round(hits / rows.length * 1000) / 10;

      // P&L試算（1銘柄100万円投資と仮定）
      let totalPnl = 0;
      for (const r of rows) {
        if (r.price_at_signal && r.price_after_10days) {
          const pct = (r.price_after_10days - r.price_at_signal) / r.price_at_signal;
          totalPnl += 1_000_000 * pct;
        }
      }
      return { totalTrades: rows.length, hits, winRate, totalPnl: Math.round(totalPnl), hasData: true };
    };

    if (market) {
      return res.json(await calcStats(market));
    }

    // market 未指定時: us + jp 両方返す
    const [usStats, jpStats] = await Promise.all([calcStats('us'), calcStats('jp')]);
    return res.json({ us: usStats, jp: jpStats });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

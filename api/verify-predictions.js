// cron: 毎日 01:00 UTC に実行
// 10日前に記録したシグナルの価格を取得し、result（win/lose）を自動更新する
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const FINNHUB_KEY = process.env.VITE_FINNHUB_KEY;

async function sb(path, method = 'GET', body = null) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'PATCH' ? 'return=minimal' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function fetchUSPrice(symbol) {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
    );
    const d = await r.json();
    return d?.c > 0 ? d.c : null;
  } catch { return null; }
}

async function fetchJPPrice(symbol) {
  try {
    const ticker = symbol.endsWith('.T') ? symbol : `${symbol}.T`;
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const d = await r.json();
    return d?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  // 10日以上前に記録されて、まだ result が null のレコードを取得
  const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const rows = await sb(
    `score_history?recorded_at=lte.${cutoff}&result=is.null&select=id,symbol,market,price_at_signal&limit=100`
  );

  if (!rows?.length) {
    return res.json({ verified: 0, message: '対象データなし' });
  }

  let verified = 0;
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const row of rows) {
    try {
      const isJP = row.market === 'jp';
      const price = isJP
        ? await fetchJPPrice(row.symbol)
        : await fetchUSPrice(row.symbol);

      if (!price || !row.price_at_signal) continue;

      const result = price > row.price_at_signal ? 'win' : 'lose';
      const priceChange = Math.round((price - row.price_at_signal) / row.price_at_signal * 10000) / 100;

      await sb(`score_history?id=eq.${row.id}`, 'PATCH', {
        price_after_10days: Math.round(price * 100) / 100,
        result,
        // price_change_pct は price_at_signal / price_after_10days から計算可能なので別途不要
      });
      verified++;
    } catch (e) {
      errors.push(`${row.symbol}: ${e.message}`);
    }
  }

  return res.json({ verified, errors, date: today, total: rows.length });
}

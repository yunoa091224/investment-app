export default async function handler(req, res) {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8',
      },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Yahoo Finance error' });

    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return res.status(404).json({ error: 'no price' });

    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const dp    = prev ? ((price - prev) / prev * 100) : null;

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    res.json({ price, dp });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

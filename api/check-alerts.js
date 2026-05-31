import { Resend } from 'resend';

async function fetchPrice(ticker) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await r.json();
    return data.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

function buildEmailHtml(ticker, currentPrice, targetPrice, direction) {
  const dirLabel = direction === 'above' ? '以上' : '以下';
  const arrow = direction === 'above' ? '📈' : '📉';
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#060e18;color:#eaf4ff;padding:32px;border-radius:12px">
      <h2 style="color:#00e5a0;margin-top:0">${arrow} 目標株価に到達しました</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#4a7090;padding:8px 0">銘柄</td><td style="font-weight:700">${ticker}</td></tr>
        <tr><td style="color:#4a7090;padding:8px 0">現在価格</td><td style="font-weight:700;color:#00e5a0">$${currentPrice.toFixed(2)}</td></tr>
        <tr><td style="color:#4a7090;padding:8px 0">目標価格</td><td style="font-weight:700">$${targetPrice} ${dirLabel}</td></tr>
      </table>
      <p style="margin-top:24px">Kabu.AI で詳細を確認し、投資判断を行ってください。</p>
      <p style="color:#2a4560;font-size:11px">※ 本メールはKabu.AIからの自動送信です。投資判断はご自身の責任で行ってください。</p>
    </div>
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { alerts } = req.body;
  if (!Array.isArray(alerts) || alerts.length === 0) return res.json({ triggered: [] });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const triggered = [];

  for (const alert of alerts) {
    const { id, ticker, targetPrice, email, direction } = alert;
    if (!ticker || !targetPrice || !email) continue;

    const currentPrice = await fetchPrice(ticker);
    if (currentPrice === null) continue;

    const hit = direction === 'above'
      ? currentPrice >= Number(targetPrice)
      : currentPrice <= Number(targetPrice);

    if (hit) {
      try {
        await resend.emails.send({
          from: 'Kabu.AI <onboarding@resend.dev>',
          to: email,
          subject: `${direction === 'above' ? '📈' : '📉'} ${ticker} が目標株価に到達しました`,
          html: buildEmailHtml(ticker, currentPrice, targetPrice, direction),
        });
        triggered.push({ id, ticker, currentPrice, targetPrice });
      } catch {
        // continue processing remaining alerts even if one email fails
      }
    }
  }

  return res.json({ triggered });
}

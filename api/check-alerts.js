import { put, list } from '@vercel/blob';
import { Resend } from 'resend';

const BLOB_PATH = 'kabuai-alerts/data.json';

async function readAlerts() {
  const { blobs } = await list({ prefix: 'kabuai-alerts/' });
  if (blobs.length === 0) return [];
  try {
    const r = await fetch(blobs[0].downloadUrl);
    return await r.json();
  } catch {
    return [];
  }
}

async function writeAlerts(alerts) {
  await put(BLOB_PATH, JSON.stringify(alerts), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

async function fetchPrice(ticker) {
  const key = process.env.VITE_FINNHUB_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`);
    const data = await r.json();
    return typeof data.c === 'number' && data.c > 0 ? data.c : null;
  } catch {
    return null;
  }
}

function isJPTicker(ticker) {
  return /^\d{4,5}\.T$/i.test(ticker);
}

function buildEmailHtml(ticker, currentPrice, targetPrice, direction) {
  const isJP = isJPTicker(ticker);
  const priceStr  = isJP ? `¥${Math.round(currentPrice).toLocaleString()}` : `$${currentPrice.toFixed(2)}`;
  const targetStr = isJP ? `¥${Number(targetPrice).toLocaleString()}`      : `$${targetPrice}`;
  const dirLabel = direction === 'above' ? '以上' : '以下';
  const arrow = direction === 'above' ? '📈' : '📉';
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#060e18;color:#eaf4ff;padding:32px;border-radius:12px">
      <h2 style="color:#00e5a0;margin-top:0">${arrow} 目標株価に到達しました</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="color:#4a7090;padding:8px 0;width:120px">銘柄</td><td style="font-weight:700">${ticker.replace(/\.T$/, "")}${isJP ? " 🇯🇵" : ""}</td></tr>
        <tr><td style="color:#4a7090;padding:8px 0">現在株価</td><td style="font-weight:700;color:#00e5a0">${priceStr}</td></tr>
        <tr><td style="color:#4a7090;padding:8px 0">目標株価</td><td style="font-weight:700">${targetStr} ${dirLabel}</td></tr>
      </table>
      <p style="margin-top:24px">Kabu.AI で詳細を確認し、投資判断を行ってください。</p>
      <p style="color:#2a4560;font-size:11px;margin-top:16px">※ 本メールはKabu.AIからの自動送信です。投資判断はご自身の責任で行ってください。</p>
    </div>
  `;
}

// Vercel Cron はGETリクエストで呼び出す
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const alerts = await readAlerts();
  if (alerts.length === 0) return res.json({ triggered: [], checked: 0 });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const triggered = [];
  const remaining = [];

  for (const alert of alerts) {
    const { id, ticker, targetPrice, email, direction } = alert;
    const currentPrice = await fetchPrice(ticker);

    if (currentPrice === null) {
      remaining.push(alert);
      continue;
    }

    const hit = direction === 'above'
      ? currentPrice >= Number(targetPrice)
      : currentPrice <= Number(targetPrice);

    if (hit) {
      try {
        await resend.emails.send({
          from: 'Kabu.AI <onboarding@resend.dev>',
          to: email,
          subject: `【Kabu.AI】${ticker}が目標株価に達しました`,
          html: buildEmailHtml(ticker, currentPrice, targetPrice, direction),
        });
        triggered.push({ id, ticker, currentPrice, targetPrice });
      } catch {
        remaining.push(alert);
      }
    } else {
      remaining.push(alert);
    }
  }

  if (triggered.length > 0) {
    await writeAlerts(remaining);
  }

  return res.json({ triggered, checked: alerts.length });
}

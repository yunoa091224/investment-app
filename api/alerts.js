import { put, list } from '@vercel/blob';
import { Resend } from 'resend';

const BLOB_PATH = 'kabuai-alerts/data.json';

async function readAlerts() {
  const { blobs } = await list({ prefix: 'kabuai-alerts/' });
  if (blobs.length === 0) return [];
  try {
    const r = await fetch(blobs[0].url);
    return await r.json();
  } catch {
    return [];
  }
}

async function writeAlerts(alerts) {
  await put(BLOB_PATH, JSON.stringify(alerts), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // GET: アラート一覧取得
  if (req.method === 'GET') {
    const alerts = await readAlerts();
    return res.json(alerts);
  }

  // POST: アラート追加
  if (req.method === 'POST') {
    const { ticker, targetPrice, direction, email } = req.body;
    if (!ticker || !targetPrice || !email) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    const alerts = await readAlerts();
    const newAlert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ticker: ticker.toUpperCase(),
      targetPrice: Number(targetPrice),
      direction: direction || 'above',
      email,
      createdAt: new Date().toISOString(),
    };
    alerts.push(newAlert);
    await writeAlerts(alerts);

    // 確認メール送信
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const dirLabel = newAlert.direction === 'above' ? '以上' : '以下';
      await resend.emails.send({
        from: 'Kabu.AI <onboarding@resend.dev>',
        to: email,
        subject: `【Kabu.AI】${newAlert.ticker} のアラートを設定しました`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#060e18;color:#eaf4ff;padding:32px;border-radius:12px">
            <h2 style="color:#00e5a0;margin-top:0">✅ アラート設定完了</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#4a7090;padding:8px 0;width:120px">銘柄</td><td style="font-weight:700">${newAlert.ticker}</td></tr>
              <tr><td style="color:#4a7090;padding:8px 0">目標株価</td><td style="font-weight:700">$${newAlert.targetPrice} ${dirLabel}</td></tr>
            </table>
            <p style="color:#4a7090;font-size:13px;margin-top:24px">目標株価に達した際に再度メールでお知らせします。</p>
            <p style="color:#2a4560;font-size:11px;margin-top:16px">※ 本メールはKabu.AIからの自動送信です。投資判断はご自身の責任で行ってください。</p>
          </div>
        `,
      });
    } catch {
      // メール送信失敗でもアラート登録は成功扱い
    }

    return res.json(newAlert);
  }

  // DELETE: アラート削除
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id が必要です' });

    const alerts = await readAlerts();
    const next = alerts.filter(a => a.id !== id);
    await writeAlerts(next);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

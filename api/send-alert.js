import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, ticker, targetPrice, direction } = req.body;
  if (!email || !ticker || !targetPrice) {
    return res.status(400).json({ error: '必須パラメータが不足しています' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const dirLabel = direction === 'above' ? '以上' : '以下';

  try {
    await resend.emails.send({
      from: 'Kabu.AI <onboarding@resend.dev>',
      to: email,
      subject: `✅ Kabu.AI アラート設定完了: ${ticker}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#060e18;color:#eaf4ff;padding:32px;border-radius:12px">
          <h2 style="color:#00e5a0;margin-top:0">Kabu.AI アラート設定完了</h2>
          <p>以下のアラートが設定されました。</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#4a7090;padding:8px 0">銘柄</td><td style="font-weight:700">${ticker}</td></tr>
            <tr><td style="color:#4a7090;padding:8px 0">目標株価</td><td style="font-weight:700">$${targetPrice} ${dirLabel}</td></tr>
          </table>
          <p style="color:#4a7090;font-size:12px;margin-top:24px">目標株価に達した際にメールでお知らせします。</p>
          <p style="color:#2a4560;font-size:11px">※ 本メールはKabu.AIからの自動送信です</p>
        </div>
      `,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

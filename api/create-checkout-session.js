import Stripe from 'stripe';

const PLANS = {
  light: { name: 'Kabu.AI ライトプラン', amount: 980 },
  pro:   { name: 'Kabu.AI プロプラン',   amount: 2980 },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY が未設定です' });
  }

  const stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia' });
  const { plan } = req.body;
  const planData = PLANS[plan];

  if (!planData) {
    return res.status(400).json({ error: '無効なプランです' });
  }

  const origin = req.headers.origin || 'https://investment-app-zeta-six.vercel.app';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'jpy',
          product_data: { name: planData.name },
          unit_amount: planData.amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${origin}/?success=1&plan=${plan}`,
      cancel_url:  `${origin}/?canceled=1`,
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

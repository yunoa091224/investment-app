export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=JPY", {
      headers: { "Accept": "application/json" },
    });
    if (!r.ok) return res.status(r.status).json({ error: "Frankfurter error" });

    const data = await r.json();
    const rate = data?.rates?.JPY;
    if (!rate || rate <= 0) return res.status(404).json({ error: "no rate" });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    res.json({ rate: parseFloat(rate) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

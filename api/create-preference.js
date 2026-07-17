export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Faltan datos' });

  // ID único para este checkout
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Guardar nombre + email en Upstash Redis (expira en 24hs)
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/yl_${id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: JSON.stringify({ name, email }), ex: 86400 }),
  });

  // Crear preferencia de pago en Mercado Pago
  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{
        title: 'Ebook Phrasal Verbs — YouLearn',
        quantity: 1,
        unit_price: 14000,
        currency_id: 'ARS',
      }],
      external_reference: id,
      notification_url: 'https://youlearnba.com/api/mp-webhook',
      back_urls: {
        success: 'https://youlearnba.com/phrasal-verbs-descarga',
        failure: 'https://youlearnba.com/phrasal-verbs-checkout',
        pending: 'https://youlearnba.com/phrasal-verbs-descarga',
      },
      auto_return: 'approved',
    }),
  });

  const mpData = await mpRes.json();

  if (!mpData.init_point) {
    console.error('MP error:', mpData);
    return res.status(500).json({ error: 'No se pudo crear el link de pago' });
  }

  return res.status(200).json({ url: mpData.init_point });
}

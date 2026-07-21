// Este archivo va a: api/admin-payment.js en GitHub
// Agrega un pago cargado a mano (transferencia directa, MercadoPago, PayPal, etc.)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { key, email, amount, currency, method, packType, packClasses, paymentDate, notes } = req.body ?? {};

  const ADMIN_KEY = process.env.ADMIN_PANEL_KEY;
  if (!ADMIN_KEY) {
    console.error('[admin-payment] ADMIN_PANEL_KEY not configured');
    return res.status(500).json({ error: 'Panel no configurado' });
  }
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!email || !packType || !packClasses) {
    return res.status(400).json({ error: 'Faltan campos: email, packType, packClasses' });
  }
  if (!['Individual', 'Grupal'].includes(packType)) {
    return res.status(400).json({ error: 'packType inválido' });
  }
  if (![4, 8, 12].includes(Number(packClasses))) {
    return res.status(400).json({ error: 'packClasses debe ser 4, 8 o 12' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[admin-payment] Supabase env vars missing');
    return res.status(500).json({ error: 'Configuración de base de datos faltante' });
  }

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/manual_payments`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        student_email: email,
        amount: amount ?? null,
        currency: currency || 'ARS',
        method: method || null,
        pack_type: packType,
        pack_classes: Number(packClasses),
        payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        notes: notes || null
      })
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error('[admin-payment] Supabase error:', text);
      return res.status(500).json({ error: 'Error al guardar el pago' });
    }

    // Pack nuevo cargado a mano → resetea el contador de reprogramaciones.
    const resetRes = await fetch(`${SUPABASE_URL}/rest/v1/class_schedule`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        student_email: email,
        reschedules_used: 0,
        updated_at: new Date().toISOString()
      })
    });
    if (!resetRes.ok) {
      console.error('[admin-payment] Could not reset reschedules_used:', await resetRes.text());
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[admin-payment] Unexpected error:', err);
    return res.status(500).json({ error: 'Error inesperado' });
  }
}

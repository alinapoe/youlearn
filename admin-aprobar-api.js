export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email, packType, classes } = req.body ?? {};

  if (!email || !packType || !classes) {
    return res.status(400).json({ error: 'Faltan campos: email, packType, classes' });
  }
  if (!['Individual', 'Grupal'].includes(packType)) {
    return res.status(400).json({ error: 'packType inválido' });
  }
  if (![4, 8, 12].includes(Number(classes))) {
    return res.status(400).json({ error: 'classes debe ser 4, 8 o 12' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[admin-aprobar] Supabase env vars missing');
    return res.status(500).json({ error: 'Configuración de base de datos faltante' });
  }

  try {
    // Update comprobante_submissions: mark latest pending submission as approved
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/comprobante_submissions?student_email=eq.${encodeURIComponent(email)}&pack_approved=eq.false&order=created_at.desc&limit=1`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          pack_approved: true,
          pack_type: packType,
          pack_classes: Number(classes),
          approved_at: new Date().toISOString()
        })
      }
    );

    if (!updateRes.ok) {
      const text = await updateRes.text();
      console.error('[admin-aprobar] Supabase error:', text);
      return res.status(500).json({ error: 'Error al actualizar en base de datos' });
    }

    // Pack nuevo aprobado → resetea el contador de reprogramaciones a 0.
    // merge-duplicates para no pisar día/hora/profe ya cargados en class_schedule.
    const resetRes = await fetch(`${SUPABASE_URL}/rest/v1/class_schedule`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        student_email: email,
        reschedules_used: 0,
        updated_at: new Date().toISOString()
      })
    });
    if (!resetRes.ok) {
      console.error('[admin-aprobar] Could not reset reschedules_used:', await resetRes.text());
      // No cortamos el flujo por esto — el pack ya quedó aprobado igual.
    }

    console.log(`[admin-aprobar] Approved: ${email} → ${packType} x${classes}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[admin-aprobar] Unexpected error:', err);
    return res.status(500).json({ error: 'Error inesperado' });
  }
}

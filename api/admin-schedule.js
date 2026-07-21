// Este archivo va a: api/admin-schedule.js en GitHub
// Guarda/actualiza el dia y horario de clase de una alumna.

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

  const { key, email, dayOfWeek, time, notes, teacher } = req.body ?? {};

  const ADMIN_KEY = process.env.ADMIN_PANEL_KEY;
    if (!ADMIN_KEY) {
          console.error('[admin-schedule] ADMIN_PANEL_KEY not configured');
          return res.status(500).json({ error: 'Panel no configurado' });
    }
    if (key !== ADMIN_KEY) {
          return res.status(401).json({ error: 'No autorizado' });
    }

  if (!email) {
        return res.status(400).json({ error: 'Falta email' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('[admin-schedule] Supabase env vars missing');
        return res.status(500).json({ error: 'Configuracion de base de datos faltante' });
  }

  try {
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/class_schedule`, {
                method: 'POST',
                headers: {
                          apikey: SUPABASE_KEY,
                          Authorization: `Bearer ${SUPABASE_KEY}`,
                          'Content-Type': 'application/json',
                          Prefer: 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify({
                          student_email: email,
                          day_of_week: dayOfWeek || null,
                          time: time || null,
                          notes: notes || null,
                          ...(teacher !== undefined && { teacher: teacher || null }),
                          updated_at: new Date().toISOString()
                })
        });

      if (!upsertRes.ok) {
              const text = await upsertRes.text();
              console.error('[admin-schedule] Supabase error:', text);
              return res.status(500).json({ error: 'Error al guardar el horario' });
      }

      return res.status(200).json({ ok: true });

  } catch (err) {
        console.error('[admin-schedule] Unexpected error:', err);
        return res.status(500).json({ error: 'Error inesperado' });
  }
}

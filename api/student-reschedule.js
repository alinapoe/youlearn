// Este archivo va a: api/student-reschedule.js en GitHub
// La alumna hace click en "Ya reprograme" despues de reservar un nuevo
// horario en el link de la profe. Suma 1 a reschedules_used, bloqueando
// si ya llego al limite de su pack actual.

const RESCHEDULES_ALLOWED = { 4: 2, 8: 3, 12: 4 };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Falta sesion' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
          console.error('[student-reschedule] Supabase env vars missing');
          return res.status(500).json({ error: 'Configuracion de base de datos faltante' });
    }

  try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
        });
        if (!userRes.ok) return res.status(401).json({ error: 'Sesion invalida' });
        const user = await userRes.json();
        const email = (user.email || '').trim().toLowerCase();
        if (!email) return res.status(401).json({ error: 'Sesion invalida' });

      const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

      const [approvedRes, manualRes, scheduleRes] = await Promise.all([
              fetch(`${SUPABASE_URL}/rest/v1/comprobante_submissions?select=pack_classes,approved_at&student_email=eq.${encodeURIComponent(email)}&pack_approved=eq.true`, { headers }),
              fetch(`${SUPABASE_URL}/rest/v1/manual_payments?select=pack_classes,payment_date&student_email=eq.${encodeURIComponent(email)}`, { headers }),
              fetch(`${SUPABASE_URL}/rest/v1/class_schedule?select=*&student_email=eq.${encodeURIComponent(email)}`, { headers })
            ]);

      if (!approvedRes.ok || !manualRes.ok || !scheduleRes.ok) {
              console.error('[student-reschedule] Supabase fetch error');
              return res.status(500).json({ error: 'Error al leer la base de datos' });
      }

      const approved = await approvedRes.json();
        const manual = await manualRes.json();
        const scheduleRows = await scheduleRes.json();
        const schedule = scheduleRows[0] || null;

      const history = [
              ...approved.map(p => ({ date: p.approved_at, pack_classes: p.pack_classes })),
              ...manual.map(p => ({ date: p.payment_date, pack_classes: p.pack_classes }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

      const currentPack = history[0];
        if (!currentPack || !currentPack.pack_classes) {
                return res.status(400).json({ error: 'No encontramos un pack activo' });
        }

      const allowed = RESCHEDULES_ALLOWED[currentPack.pack_classes];
        const used = schedule?.reschedules_used ?? 0;

      if (allowed == null) {
              return res.status(400).json({ error: 'Pack invalido' });
      }
        if (used >= allowed) {
                return res.status(409).json({ error: 'Ya usaste todas las reprogramaciones de este pack' });
        }

      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/class_schedule`, {
              method: 'POST',
              headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                        Prefer: 'resolution=merge-duplicates,return=minimal'
              },
              body: JSON.stringify({
                        student_email: email,
                        reschedules_used: used + 1,
                        updated_at: new Date().toISOString()
              })
      });

      if (!upsertRes.ok) {
              console.error('[student-reschedule] Supabase upsert error:', await upsertRes.text());
              return res.status(500).json({ error: 'No se pudo registrar la reprogramacion' });
      }

      return res.status(200).json({ ok: true, used: used + 1, allowed, remaining: allowed - (used + 1) });

  } catch (err) {
        console.error('[student-reschedule] Unexpected error:', err);
        return res.status(500).json({ error: 'Error inesperado' });
  }
}

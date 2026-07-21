// Este archivo va a: api/student-portal-data.js en GitHub
// Devuelve el pack actual, progreso, vencimiento y reprogramaciones
// disponibles de la alumna autenticada. El mail nunca se toma de lo que
// manda el cliente — se verifica el token de sesión de Supabase contra
// GoTrue y se usa el mail que devuelve Supabase, así nadie puede pedir
// datos de otra alumna cambiando un parámetro.

const ARGENTINA_HOLIDAYS_2026 = [
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-23', '2026-03-24',
  '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-25', '2026-06-15',
  '2026-06-20', '2026-07-09', '2026-07-10', '2026-08-17', '2026-10-12',
  '2026-11-23', '2026-12-07', '2026-12-08', '2026-12-25'
];

const WEEKS_ALLOWED = { 4: 6, 8: 11, 12: 16 };
const RESCHEDULES_ALLOWED = { 4: 2, 8: 3, 12: 4 };

const DAY_NAME_TO_NUM = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3,
  jueves: 4, viernes: 5, sabado: 6, 'sábado': 6
};

const TEACHER_BOOKING_LINKS = {
  Ali: 'https://301.tv/ynppD',
  Anto: 'https://calendar.app.google/upBhneQMrwsqED499',
  Sil: 'https://calendar.app.google/9rfdAKP6UEqDpBQR7'
};

function firstDayNumber(text) {
  if (!text) return null;
  const normalized = text.toLowerCase();
  for (const [name, num] of Object.entries(DAY_NAME_TO_NUM)) {
    if (normalized.includes(name)) return num;
  }
  return null;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// Devuelve la fecha de la última clase válida (sin feriados) dentro de la
// ventana de `weeksNeeded` semanas, ancladas al día de la semana `weekday`.
function computeExpiration(startDateStr, weeksNeeded, weekday, holidays) {
  let d = new Date(startDateStr + 'T00:00:00');
  if (weekday != null) {
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  }
  let count = 0;
  let lastDate = new Date(d);
  let iterations = 0;
  while (count < weeksNeeded && iterations < weeksNeeded * 3) {
    const iso = toISODate(d);
    if (!holidays.includes(iso)) {
      count++;
      lastDate = new Date(d);
    }
    d.setDate(d.getDate() + 7);
    iterations++;
  }
  return lastDate;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta sesión' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[student-portal-data] Supabase env vars missing');
    return res.status(500).json({ error: 'Configuración de base de datos faltante' });
  }

  try {
    // Verificar el token de sesión contra Supabase Auth y obtener el mail real.
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Sesión inválida' });
    const user = await userRes.json();
    const email = (user.email || '').trim().toLowerCase();
    if (!email) return res.status(401).json({ error: 'Sesión inválida' });

    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

    const [approvedRes, manualRes, scheduleRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/comprobante_submissions?select=pack_type,pack_classes,approved_at&student_email=eq.${encodeURIComponent(email)}&pack_approved=eq.true`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/manual_payments?select=pack_type,pack_classes,payment_date&student_email=eq.${encodeURIComponent(email)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/class_schedule?select=*&student_email=eq.${encodeURIComponent(email)}`, { headers })
    ]);

    if (!approvedRes.ok || !manualRes.ok || !scheduleRes.ok) {
      console.error('[student-portal-data] Supabase fetch error');
      return res.status(500).json({ error: 'Error al leer la base de datos' });
    }

    const approved = await approvedRes.json();
    const manual = await manualRes.json();
    const scheduleRows = await scheduleRes.json();
    const schedule = scheduleRows[0] || null;

    const history = [
      ...approved.map(p => ({ date: p.approved_at, pack_type: p.pack_type, pack_classes: p.pack_classes })),
      ...manual.map(p => ({ date: p.payment_date, pack_type: p.pack_type, pack_classes: p.pack_classes }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const currentPack = history[0] || null;

    let progress = null;
    let expiration = null;
    let reschedules = null;

    if (currentPack && currentPack.pack_classes) {
      const weeksPassed = Math.floor((Date.now() - new Date(currentPack.date).getTime()) / (7 * 24 * 60 * 60 * 1000));
      progress = {
        classesGiven: Math.min(Math.max(weeksPassed, 0), currentPack.pack_classes),
        packClasses: currentPack.pack_classes
      };

      const weeksAllowed = WEEKS_ALLOWED[currentPack.pack_classes];
      if (weeksAllowed) {
        const weekday = firstDayNumber(schedule?.day_of_week);
        const startDateStr = new Date(currentPack.date).toISOString().slice(0, 10);
        const expDate = computeExpiration(startDateStr, weeksAllowed, weekday, ARGENTINA_HOLIDAYS_2026);
        expiration = {
          date: toISODate(expDate),
          estimated: weekday == null // si no hay día cargado, es una estimación sin ajuste de feriados
        };
      }

      const allowed = RESCHEDULES_ALLOWED[currentPack.pack_classes] ?? null;
      if (allowed != null) {
        const used = schedule?.reschedules_used ?? 0;
        reschedules = { used, allowed, remaining: Math.max(allowed - used, 0) };
      }
    }

    const teacher = schedule?.teacher || null;
    const bookingLink = teacher ? TEACHER_BOOKING_LINKS[teacher] : null;

    return res.status(200).json({
      email,
      currentPack,
      progress,
      expiration,
      reschedules,
      teacher,
      bookingLink,
      schedule: schedule ? { day_of_week: schedule.day_of_week, time: schedule.time } : null
    });

  } catch (err) {
    console.error('[student-portal-data] Unexpected error:', err);
    return res.status(500).json({ error: 'Error inesperado' });
  }
}

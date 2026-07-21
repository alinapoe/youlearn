// Este archivo va a: api/admin-students.js en GitHub

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { key } = req.query ?? {};
  const ADMIN_KEY = process.env.ADMIN_PANEL_KEY;

  if (!ADMIN_KEY) {
    console.error('[admin-students] ADMIN_PANEL_KEY not configured');
    return res.status(500).json({ error: 'Panel no configurado' });
  }
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[admin-students] Supabase env vars missing');
    return res.status(500).json({ error: 'Configuración de base de datos faltante' });
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  };

  try {
    const [studentsRes, approvedRes, manualRes, scheduleRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/students?select=*&order=name.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/comprobante_submissions?select=student_email,student_name,pack_type,pack_classes,approved_at&pack_approved=eq.true`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/manual_payments?select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/class_schedule?select=*`, { headers })
    ]);

    if (!studentsRes.ok || !approvedRes.ok || !manualRes.ok || !scheduleRes.ok) {
      console.error('[admin-students] Supabase fetch error', {
        students: studentsRes.status, approved: approvedRes.status,
        manual: manualRes.status, schedule: scheduleRes.status
      });
      return res.status(500).json({ error: 'Error al leer la base de datos' });
    }

    const students   = await studentsRes.json();
    const approved    = await approvedRes.json();
    const manual       = await manualRes.json();
    const schedules    = await scheduleRes.json();

    // Historial de pagos combinado (portal + manual), por mail de alumna
    const paymentsByEmail = {};
    const addPayment = (email, payment) => {
      if (!paymentsByEmail[email]) paymentsByEmail[email] = [];
      paymentsByEmail[email].push(payment);
    };

    approved.forEach(p => addPayment(p.student_email, {
      date: p.approved_at,
      pack_type: p.pack_type,
      pack_classes: p.pack_classes,
      amount: null,
      method: null,
      source: 'Portal'
    }));

    manual.forEach(p => addPayment(p.student_email, {
      date: p.payment_date,
      pack_type: p.pack_type,
      pack_classes: p.pack_classes,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      notes: p.notes,
      source: 'Manual'
    }));

    const scheduleByEmail = {};
    schedules.forEach(s => { scheduleByEmail[s.student_email] = s; });

    const now = Date.now();
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

    const result = students.map(student => {
      const history = (paymentsByEmail[student.email] || [])
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const current = history[0] || null;
      let progress = null;
      if (current && current.pack_classes) {
        const weeksPassed = Math.floor((now - new Date(current.date).getTime()) / MS_WEEK);
        const classesGiven = Math.min(Math.max(weeksPassed, 0), current.pack_classes);
        progress = { classesGiven, packClasses: current.pack_classes };
      }

      return {
        email: student.email,
        name: student.name,
        classType: student.class_type,
        code: student.code,
        currentPack: current,
        progress,
        paymentHistory: history,
        schedule: scheduleByEmail[student.email] || null
      };
    });

    return res.status(200).json({ students: result });

  } catch (err) {
    console.error('[admin-students] Unexpected error:', err);
    return res.status(500).json({ error: 'Error inesperado' });
  }
}

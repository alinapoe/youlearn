export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Faltan datos' });

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 24px;background:#f8f7fa;">
      <div style="background:white;border-radius:16px;padding:40px 32px;">
        <p style="font-size:1.4rem;font-weight:800;margin:0 0 24px;">
          <span style="color:#785fb3">You</span><span style="color:#00bf90">Learn</span>
        </p>
        <h1 style="font-size:1.3rem;color:#38464f;margin:0 0 12px;">
          ¡Hola ${name}! Tu ebook ya está listo 🎉
        </h1>
        <p style="color:#38464f;line-height:1.6;margin:0 0 32px;">
          Gracias por tu compra. Hacé click en el botón para descargar tu ebook de <strong>Phrasal Verbs</strong>.
        </p>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="https://drive.google.com/file/d/1SJpisfdoPrqALeBsyQd66wFIXgisO0zW/view"
             style="background:#785fb3;color:white;text-decoration:none;padding:16px 36px;border-radius:100px;font-weight:700;font-size:1rem;display:inline-block;">
            Descargar mi ebook →
          </a>
        </div>
        <p style="color:#8a96a0;font-size:0.82rem;line-height:1.5;">
          Si el botón no funciona, copiá este link:<br>
          <a href="https://drive.google.com/file/d/1SJpisfdoPrqALeBsyQd66wFIXgisO0zW/view" style="color:#785fb3;">
            https://drive.google.com/file/d/1SJpisfdoPrqALeBsyQd66wFIXgisO0zW/view
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5cdf9;margin:28px 0;" />
        <p style="color:#8a96a0;font-size:0.78rem;text-align:center;margin:0;">
          ¿Alguna duda? Escribinos por
          <a href="https://wa.me/541565727391" style="color:#785fb3;">WhatsApp</a>
          o en <a href="https://youlearnba.com" style="color:#785fb3;">youlearnba.com</a>
        </p>
      </div>
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'YouLearn <onboarding@resend.dev>',
        to: [email],
        subject: '¡Tu ebook de Phrasal Verbs ya está listo! 📚',
        html,
      }),
    });

    if (r.ok) return res.status(200).json({ success: true });
    const err = await r.json();
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'No se pudo enviar el email' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error interno' });
  }
}

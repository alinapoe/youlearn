const PDF_URL = 'https://www.youlearnba.com/recursos-ingles.pdf';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Faltan datos' });

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 24px;background:#f8f7fa;">
      <div style="background:white;border-radius:16px;padding:40px 32px;">
        <p style="font-size:1.4rem;font-weight:800;margin:0 0 24px;">
          <span style="color:#785fb3">You</span><span style="color:#00bf90">Learn</span>
        </p>
        <h1 style="font-size:1.3rem;color:#38464f;margin:0 0 12px;">
          ¡Hola ${name}! Acá está tu banco de recursos 🎁
        </h1>
        <p style="color:#38464f;line-height:1.6;margin:0 0 24px;">
          Te lo dejamos adjunto en este mail y también podés descargarlo desde el botón.
          Adentro vas a encontrar sitios para <strong>practicar jugando</strong>,
          <strong>entrenar el oído con inglés real</strong>, <strong>repasar gramática con ejercicios
          que se corrigen solos</strong> y una selección de <strong>podcasts por nivel</strong>.
        </p>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="${PDF_URL}"
             style="background:#785fb3;color:white;text-decoration:none;padding:16px 36px;border-radius:100px;font-weight:700;font-size:1rem;display:inline-block;">
            Descargar mis recursos →
          </a>
        </div>
        <p style="color:#38464f;line-height:1.6;margin:0 0 24px;font-size:0.9rem;">
          <strong>Un consejo:</strong> no intentes usarlos todos. Elegí uno de juegos y uno de
          escucha, y hacé 10 minutos por día. La constancia rinde mucho más que las maratones.
        </p>
        <hr style="border:none;border-top:1px solid #e5cdf9;margin:28px 0;" />
        <p style="color:#38464f;font-size:0.85rem;line-height:1.6;text-align:center;margin:0 0 16px;">
          ¿Querés que te ayudemos a ordenar la práctica y por fin soltarte a hablar?
          Escribinos y agendá tu <strong>test de nivel sin cargo</strong>.
        </p>
        <p style="text-align:center;margin:0 0 24px;">
          <a href="https://wa.me/541565727391"
             style="background:#25d366;color:white;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:700;font-size:0.9rem;display:inline-block;">
            Hablar por WhatsApp
          </a>
        </p>
        <p style="color:#8a96a0;font-size:0.78rem;text-align:center;margin:0;">
          Nos encontrás en <a href="https://youlearnba.com" style="color:#785fb3;">youlearnba.com</a>
          y en <a href="https://www.instagram.com/youlearnba/" style="color:#785fb3;">@youlearnba</a>
        </p>
      </div>
    </div>
  `;

  let attachments = [];
  try {
    const pdfRes = await fetch(PDF_URL);
    if (pdfRes.ok) {
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      attachments = [{
        filename: 'Recursos-para-practicar-ingles-YouLearn.pdf',
        content: buf.toString('base64'),
      }];
    }
  } catch (e) {
    console.error('No se pudo adjuntar el PDF:', e);
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'YouLearn <onboarding@resend.dev>',
        to: [email],
        subject: '🎁 Tu banco de recursos gratuitos para practicar inglés',
        html,
        ...(attachments.length ? { attachments } : {}),
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

export default async function handler(req, res) {
  // CORS headers (in case called from browser directly)
  res.setHeader('Access-Control-Allow-Origin', 'https://www.youlearnba.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { studentName, studentEmail, classType, fileUrl } = req.body ?? {};

  if (!studentName || !studentEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('[notify-comprobante] RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const adminUrl = `https://www.youlearnba.com/admin-aprobar?email=${encodeURIComponent(studentEmail)}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(120,95,179,.12)">

    <!-- Header -->
    <div style="background:#785fb3;padding:28px 32px;text-align:center">
      <img src="https://www.youlearnba.com/logo.png" alt="YouLearn" style="height:32px">
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <h2 style="margin:0 0 6pz;font-size:18px;color:#785fb3">Nuevo comprobante de pago 📎</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#8a8fa8">Una alumna subió su comprobante y está esperando confirmación.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0edf8;font-size:13px;color:#8a8fa8;width:36%">Alumna</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0edf8;font-size:14px;font-weight:600;color:#38464f">${studentName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0edf8;font-size:13px;color:#8a8fa8">Mail</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0edf8;font-size:14px;color:#38464f">${studentEmail}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#8a8fa8">Tipo</td>
          <td style="padding:10px 0;font-size:14px;color:#38464f">
            <span style="background:${classType === 'Individual' ? '#deff83' : '#e5cdf9'};color:${classType === 'Individual' ? '#2d3a1e' : '#785fb3'};padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600">${classType}</span>
          </td>
        </tr>
      </table>

      ${fileUrl ? `
      <a href="${fileUrl}" style="display:inline-block;background:#38464f;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:500;margin-bottom:12px">
        Ver comprobante →
      </a>
      <br>
      ` : ''}

      <a href="${adminUrl}" style="display:inline-block;background:#785fb3;color:#fff;text-decoration:none;padding:13px 28px;border-radius:100px;font-size:15px;font-weight:700;margin-top:8px">
        ✅ Aprobar pack
      </a>

      <p style="margin:24px 0 0;font-size:12px;color:#c5bde0">
        Este mail fue generado automáticamente por el portal de YouLearn.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        from:    'YouLearn <onboarding@resend.dev>',
        to:      ['alina.pouyau@gmail.com'],
        subject: `📎 Comprobante de ${studentName}`,
        html
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[notify-comprobante] Resend error:', body);
      return res.status(500).json({ error: 'Email delivery failed' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[notify-comprobante] Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

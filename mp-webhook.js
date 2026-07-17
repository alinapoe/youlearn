export default async function handler(req, res) {
  // MP siempre espera 200 rápido, sino reintenta
  res.status(200).end();

  try {
    const { type, data } = req.body;
    if (type !== 'payment' || !data?.id) return;

    // Consultar el pago a MP
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const payment = await payRes.json();

    // Solo procesar pagos aprobados
    if (payment.status !== 'approved') return;

    const id = payment.external_reference;
    if (!id) return;

    // Recuperar email de Upstash
    const kvRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/yl_${id}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const kvData = await kvRes.json();
    if (!kvData.result) return;

    const { name, email } = JSON.parse(kvData.result);

    // Enviar ebook por mail
    const emailHtml = `
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
          </p>
        </div>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'YouLearn <onboarding@resend.dev>',
        to: [email],
        subject: '¡Tu ebook de Phrasal Verbs ya está listo! 📚',
        html: emailHtml,
      }),
    });

    // Borrar de Redis (ya no se necesita)
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/yl_${id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
    });

  } catch (e) {
    console.error('Webhook error:', e);
  }
}

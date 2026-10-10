require('dotenv').config();
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const COMIDAS = ['Pasta', 'Carne'];
const HORARIOS = ['20:00', '20:30', '21:00', '21:30', '22:00'];

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.error('⚠️  No se pudo conectar al SMTP:', err.message);
  else console.log('✅ SMTP listo para enviar mails');
});

// Límite simple por IP: 5 envíos cada 10 minutos
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ ok: false });
  recent.push(now);
  hits.set(ip, recent);
  next();
}

app.post('/api/respuesta', rateLimit, async (req, res) => {
  const { comida, horario } = req.body || {};

  if (!COMIDAS.includes(comida) || !HORARIOS.includes(horario)) {
    return res.status(400).json({ ok: false, error: 'Datos inválidos' });
  }

  const fecha = new Date().toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: process.env.MAIL_TO || process.env.SMTP_USER,
      subject: '¡Dijo que sí! 🍝 Respuesta a tu propuesta',
      text:
        `¡Dijo que sí!\n\n` +
        `Menú: ${comida}\n` +
        `La pasás a buscar a las: ${horario}\n\n` +
        `Respondió el: ${fecha}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:16px;background:#fff7f4;color:#2b1630">
          <h2 style="margin:0 0 12px">¡Dijo que sí! 🎉</h2>
          <p style="margin:0 0 16px">Estos son los detalles que eligió:</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#7a5a6e">Menú</td><td style="padding:8px 0;text-align:right"><b>${comida}</b></td></tr>
            <tr><td style="padding:8px 0;color:#7a5a6e">Horario</td><td style="padding:8px 0;text-align:right"><b>${horario} hs</b></td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#7a5a6e">Respondió el ${fecha}</p>
        </div>`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error enviando el mail:', err.message);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`💌 Propuesta virtual en http://localhost:${PORT}`);
});

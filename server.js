const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { users, wydarzenia, rejestracje, opinie } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'pwsg-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// ── Mailer ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(email, token, baseUrl) {
  const link = baseUrl + '/verify-email.html?token=' + token;
  await transporter.sendMail({
    from: '"Platforma Wydarzen Studenckich" <' + process.env.SMTP_USER + '>',
    to: email,
    subject: 'Potwierdz swoj adres e-mail',
    html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">'
      + '<h2 style="color:#2b6cb0">Platforma Wydarzen Studenckich</h2>'
      + '<p>Witaj! Kliknij ponizszy przycisk, aby potwierdzic swoj adres e-mail i aktywowac konto.</p>'
      + '<a href="' + link + '" style="display:inline-block;padding:12px 28px;background:#2b6cb0;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Potwierdz e-mail</a>'
      + '<p style="color:#718096;font-size:.85rem;margin-top:24px">Jezeli nie zakladales konta, zignoruj ta wiadomosc.</p>'
      + '</div>',
  });
}

// ── Middleware ────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Niezalogowany' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Niezalogowany' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Brak uprawnien' });
    next();
  };
}

// ── Self-registration ─────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { email, password, imie_nazwisko } = req.body;
  if (!email || !password || !imie_nazwisko)
    return res.status(400).json({ error: 'Wypelnij wszystkie pola.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Haslo musi miec co najmniej 6 znakow.' });
  const existing = await users.findByEmail(email);
  if (existing) return res.status(400).json({ error: 'Ten email jest juz zarejestrowany.' });
  const token = crypto.randomBytes(32).toString('hex');
  const id = await users.register(email, password, imie_nazwisko, token);
  const baseUrl = req.protocol + '://' + req.get('host');
  try {
    await sendVerificationEmail(email, token, baseUrl);
  } catch (e) {
    console.error('Blad wysylania emaila:', e.message);
  }
  res.json({ ok: true, id });
});

// ── Email verification ────────────────────────────────────────
app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Brak tokenu.' });
  const ok = await users.verifyByToken(token);
  if (!ok) return res.status(400).json({ error: 'Nieprawidlowy lub wygasly link weryfikacyjny.' });
  res.json({ ok: true });
});

// ── Auth ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const existing = await users.findByEmail(req.body.email);
  if (existing && existing.password === req.body.password && !existing.active)
    return res.status(403).json({ error: 'Twoje konto zostalo zablokowane. Skontaktuj sie z administratorem.' });
  const user = await users.findByCredentials(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo.' });
  if (user.email_verified === false)
    return res.status(403).json({ error: 'Potwierdz adres e-mail. Sprawdz skrzynke pocztowa i kliknij link weryfikacyjny.' });
  req.session.userId = user.id;
  req.session.role   = user.rola;
  res.json({ user: { id: user.id, email: user.email, rola: user.rola, imie_nazwisko: user.imie_nazwisko, suma_punktow: user.suma_punktow } });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/me', requireAuth, async (req, res) => {
  const user = await users.findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Niezalogowany' });
  res.json({ user: { id: user.id, email: user.email, rola: user.rola, imie_nazwisko: user.imie_nazwisko, suma_punktow: user.suma_punktow } });
});

// ── Events ──────────────────────────────────────────────────
app.get('/api/events', requireAuth, async (req, res) => {
  res.json(req.query.mine ? await wydarzenia.getMine(req.session.userId) : await wydarzenia.getAll(req.session.userId));
});

app.post('/api/events', requireRole('Organizator', 'Admin'), async (req, res) => {
  const { nazwa, data_wydarzenia, miejsce, limit_miejsc, typ_wydarzenia, punkty } = req.body;
  if (!nazwa || !data_wydarzenia || !miejsce || !limit_miejsc)
    return res.status(400).json({ error: 'Wypelnij wszystkie pola.' });
  const id = await wydarzenia.create({ nazwa, data_wydarzenia, miejsce, limit_miejsc, id_organizatora: req.session.userId, typ_wydarzenia, punkty });
  res.json({ id });
});

app.put('/api/events/:id', requireRole('Organizator', 'Admin'), async (req, res) => {
  const { nazwa, data_wydarzenia, miejsce, limit_miejsc } = req.body;
  if (!nazwa || !data_wydarzenia || !miejsce || !limit_miejsc)
    return res.status(400).json({ error: 'Wypelnij wszystkie wymagane pola.' });
  const ok = await wydarzenia.update(parseInt(req.params.id), req.session.userId, req.session.role === 'Admin', req.body);
  ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Nie znaleziono lub brak uprawnien.' });
});

app.delete('/api/events/:id', requireRole('Organizator', 'Admin'), async (req, res) => {
  const ok = await wydarzenia.delete(parseInt(req.params.id), req.session.userId, req.session.role === 'Admin');
  ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Nie znaleziono.' });
});

// ── Registration ─────────────────────────────────────────────
app.post('/api/events/:id/register', requireRole('Student'), async (req, res) => {
  const eventId = parseInt(req.params.id);
  const event   = await wydarzenia.findById(eventId);
  if (!event) return res.status(404).json({ error: 'Nie znaleziono wydarzenia.' });
  if (await rejestracje.countByEvent(eventId) >= event.limit_miejsc) return res.status(400).json({ error: 'Brak wolnych miejsc.' });
  if (await rejestracje.findByStudentEvent(req.session.userId, eventId)) return res.status(400).json({ error: 'Juz jestes zapisany.' });
  await rejestracje.create(req.session.userId, eventId);
  res.json({ ok: true });
});

app.post('/api/events/:id/unregister', requireRole('Student'), async (req, res) => {
  await rejestracje.removeByStudentEvent(req.session.userId, parseInt(req.params.id));
  res.json({ ok: true });
});

app.post('/api/events/:id/checkin', requireRole('Student'), async (req, res) => {
  const eventId = parseInt(req.params.id);
  const userId  = req.session.userId;
  const event   = await wydarzenia.findById(eventId);
  if (!event) return res.status(404).json({ error: 'Nie znaleziono wydarzenia.' });
  const pts = event.punkty || 10;
  let reg = await rejestracje.findByStudentEvent(userId, eventId);
  if (!reg) {
    if (await rejestracje.countByEvent(eventId) >= event.limit_miejsc)
      return res.status(400).json({ error: 'Brak wolnych miejsc na tym wydarzeniu.' });
    const regId = await rejestracje.create(userId, eventId);
    await rejestracje.setStatus(regId, 'OBECNY');
    await users.addPoints(userId, pts);
    return res.json({ ok: true, msg: 'Zarejestrowano i oznaczono obecnosc! +' + pts + ' pkt' });
  }
  if (reg.status_obecnosci === 'OBECNY') {
    return res.json({ ok: true, msg: 'Obecnosc juz potwierdzona.' });
  }
  await rejestracje.setStatus(reg.id, 'OBECNY');
  await users.addPoints(userId, pts);
  res.json({ ok: true, msg: 'Obecnosc potwierdzona! +' + pts + ' pkt' });
});

// ── Participants ─────────────────────────────────────────────
app.get('/api/events/:id/participants', requireRole('Organizator', 'Admin'), async (req, res) => {
  res.json(await rejestracje.getParticipants(parseInt(req.params.id)));
});

app.post('/api/registrations/:regId/attend', requireRole('Organizator', 'Admin'), async (req, res) => {
  const reg = await rejestracje.findById(parseInt(req.params.regId));
  if (!reg) return res.status(404).json({ error: 'Nie znaleziono.' });
  if (reg.status_obecnosci !== 'OBECNY') {
    const event = await wydarzenia.findById(reg.id_wydarzenia);
    const pts = (event && event.punkty) ? event.punkty : 10;
    await rejestracje.setStatus(reg.id, 'OBECNY');
    await users.addPoints(reg.id_studenta, pts);
  }
  res.json({ ok: true });
});

app.post('/api/registrations/:regId/absent', requireRole('Organizator', 'Admin'), async (req, res) => {
  const reg = await rejestracje.findById(parseInt(req.params.regId));
  if (!reg) return res.status(404).json({ error: 'Nie znaleziono.' });
  if (reg.status_obecnosci === 'OBECNY') {
    const event = await wydarzenia.findById(reg.id_wydarzenia);
    const pts = (event && event.punkty) ? event.punkty : 10;
    await rejestracje.setStatus(reg.id, 'NIEOBECNY');
    await users.addPoints(reg.id_studenta, -pts);
  }
  res.json({ ok: true });
});

// ── Ranking ──────────────────────────────────────────────────
app.get('/api/ranking', requireAuth, async (req, res) => {
  const ranking = await users.getRanking();
  const me      = await users.findById(req.session.userId);
  const myRank  = ranking.findIndex(u => u.id === req.session.userId) + 1;
  res.json({ ranking, my_points: me ? me.suma_punktow : 0, my_rank: myRank || null });
});

// ── Opinions ─────────────────────────────────────────────────
app.get('/api/opinions/by-reg/:regId', requireRole('Student'), async (req, res) => {
  const reg = await rejestracje.findById(parseInt(req.params.regId));
  if (!reg || reg.id_studenta !== req.session.userId)
    return res.status(403).json({ error: 'Brak dostepu.' });
  res.json(await opinie.findByRegId(parseInt(req.params.regId)) || null);
});

app.put('/api/opinions/:regId', requireRole('Student'), async (req, res) => {
  const id_rejestracji = parseInt(req.params.regId);
  const { ocena, tresc } = req.body;
  if (!ocena || !tresc) return res.status(400).json({ error: 'Wypelnij wszystkie pola.' });
  const ocenaInt = parseInt(ocena);
  if (ocenaInt < 1 || ocenaInt > 5) return res.status(400).json({ error: 'Ocena musi byc od 1 do 5.' });
  const reg = await rejestracje.findById(id_rejestracji);
  if (!reg || reg.id_studenta !== req.session.userId || reg.status_obecnosci !== 'OBECNY')
    return res.status(400).json({ error: 'Nie mozesz wystawic opinii.' });
  await opinie.upsert(id_rejestracji, ocenaInt, tresc);
  res.json({ ok: true });
});

app.get('/api/events/:id/opinions', requireRole('Organizator', 'Admin'), async (req, res) => {
  res.json(await opinie.getByEvent(parseInt(req.params.id)));
});

// ── Admin — users ─────────────────────────────────────────────
app.get('/api/admin/users', requireRole('Admin'), async (req, res) => res.json(await users.getAll()));

app.put('/api/admin/users/:id/role', requireRole('Admin'), async (req, res) => {
  const uid = parseInt(req.params.id);
  const { role } = req.body;
  if (!['Student', 'Organizator', 'Admin'].includes(role))
    return res.status(400).json({ error: 'Nieprawidlowa rola.' });
  if (uid === req.session.userId)
    return res.status(400).json({ error: 'Nie mozesz zmienic wlasnej roli.' });
  await users.setRole(uid, role);
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/toggle', requireRole('Admin'), async (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.session.userId) return res.status(400).json({ error: 'Nie mozesz zablokowac wlasnego konta.' });
  await users.toggle(uid);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireRole('Admin'), async (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.session.userId) return res.status(400).json({ error: 'Nie mozesz usunac wlasnego konta.' });
  await users.delete(uid);
  res.json({ ok: true });
});

// ── Admin — verify user manually ─────────────────────────────
app.post('/api/admin/users/:id/verify', requireRole('Admin'), async (req, res) => {
  const uid = parseInt(req.params.id);
  await users.setVerified(uid);
  res.json({ ok: true });
});

// ── Resend verification email ─────────────────────────────────
app.post('/api/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Brak emaila.' });
  const user = await users.findByEmail(email);
  if (!user) return res.status(404).json({ error: 'Nie znaleziono konta.' });
  if (user.email_verified !== false) return res.json({ ok: true, msg: 'Konto juz zweryfikowane.' });
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  await users.setVerificationToken(user.id, token);
  const baseUrl = req.protocol + '://' + req.get('host');
  try {
    await sendVerificationEmail(email, token, baseUrl);
    res.json({ ok: true });
  } catch (e) {
    console.error('SMTP error:', e);
    res.status(500).json({ error: 'Blad wysylania emaila: ' + e.message });
  }
});

// ── Admin — events ────────────────────────────────────────────
app.get('/api/admin/events', requireRole('Admin'), async (req, res) => res.json(await wydarzenia.getAllAdmin()));

app.put('/api/admin/events/:id', requireRole('Admin'), async (req, res) => {
  const { nazwa, data_wydarzenia, miejsce, limit_miejsc } = req.body;
  if (!nazwa || !data_wydarzenia || !miejsce || !limit_miejsc)
    return res.status(400).json({ error: 'Wypelnij wszystkie wymagane pola.' });
  const ok = await wydarzenia.update(parseInt(req.params.id), null, true, req.body);
  ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Nie znaleziono.' });
});

app.delete('/api/admin/events/:id', requireRole('Admin'), async (req, res) => {
  const ok = await wydarzenia.delete(parseInt(req.params.id), null, true);
  ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Nie znaleziono.' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('PWSG dziala na http://localhost:' + PORT));

const express = require('express');
const session = require('express-session');
const path = require('path');
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
  const id = await users.register(email, password, imie_nazwisko);
  res.json({ ok: true, id });
});

// ── Auth ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const existing = await users.findByEmail(req.body.email);
  if (existing && existing.password === req.body.password && !existing.active)
    return res.status(403).json({ error: 'Twoje konto zostalo zablokowane. Skontaktuj sie z administratorem.' });
  const user = await users.findByCredentials(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo.' });
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
  const ok = await wydarzenia.delete(parseInt(req.params.id), req.session.userId);
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
  const reg = await rejestracje
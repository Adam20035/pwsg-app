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

// ── Auth ────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const existing = users.findByEmail(req.body.email);
  if (existing && existing.password === req.body.password && !existing.active)
    return res.status(403).json({ error: 'Twoje konto zostalo zablokowane. Skontaktuj sie z administratorem.' });
  const user = users.findByCredentials(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: 'Nieprawidlowy email lub haslo.' });
  req.session.userId = user.id;
  req.session.role   = user.rola;
  res.json({ user: { id: user.id, email: user.email, rola: user.rola, imie_nazwisko: user.imie_nazwisko, suma_punktow: user.suma_punktow } });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/me', requireAuth, (req, res) => {
  const user = users.findById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Niezalogowany' });
  res.json({ user: { id: user.id, email: user.email, rola: user.rola, imie_nazwisko: user.imie_nazwisko, suma_punktow: user.suma_punktow } });
});

// ── Events ──────────────────────────────────────────────────
app.get('/api/events', requireAuth, (req, res) => {
  res.json(req.query.mine ? wydarzenia.getMine(req.session.userId) : wydarzenia.getAll(req.session.userId));
});

app.post('/api/events', requireRole('Organizator', 'Admin'), (req, res) => {
  const { nazwa, data_wydarzenia, miejsce, limit_miejsc, typ_wydarzenia, punkty } = req.body;
  if (!nazwa || !data_wydarzenia || !miejsce || !limit_miejsc)
    return res.status(400).json({ error: 'Wypelnij wszystkie pola.' });
  const id = wydarzenia.create({ nazwa, data_wydarzenia, miejsce, limit_miejsc, id_organizatora: req.session.userId, typ_wydarzenia, punkty });
  res.json({ id });
});

app.delete('/api/events/:id', requireRole('Organizator', 'Admin'), (req, res) => {
  const ok = wydarzenia.delete(parseInt(req.params.id), req.session.userId);
  ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Nie znaleziono.' });
});

// ── Registration ─────────────────────────────────────────────
app.post('/api/events/:id/register', requireRole('Student'), (req, res) => {
  const eventId = parseInt(req.params.id);
  const event   = wydarzenia.findById(eventId);
  if (!event) return res.status(404).json({ error: 'Nie znaleziono wydarzenia.' });
  if (rejestracje.countByEvent(eventId) >= event.limit_miejsc) return res.status(400).json({ error: 'Brak wolnych miejsc.' });
  if (rejestracje.findByStudentEvent(req.session.userId, eventId)) return res.status(400).json({ error: 'Juz jestes zapisany.' });
  rejestracje.create(req.session.userId, eventId);
  res.json({ ok: true });
});

app.post('/api/events/:id/unregister', requireRole('Student'), (req, res) => {
  rejestracje.removeByStudentEvent(req.session.userId, parseInt(req.params.id));
  res.json({ ok: true });
});

// ── Participants ─────────────────────────────────────────────
app.get('/api/events/:id/participants', requireRole('Organizator', 'Admin'), (req, res) => {
  res.json(rejestracje.getParticipants(parseInt(req.params.id)));
});

app.post('/api/registrations/:regId/attend', requireRole('Organizator', 'Admin'), (req, res) => {
  const reg = rejestracje.findById(parseInt(req.params.regId));
  if (!reg) return res.status(404).json({ error: 'Nie znaleziono.' });
  if (reg.status_obecnosci !== 'OBECNY') {
    const event = wydarzenia.findById(reg.id_wydarzenia);
    const pts = (event && event.punkty) ? event.punkty : 10;
    rejestracje.setStatus(reg.id, 'OBECNY');
    users.addPoints(reg.id_studenta, pts);
  }
  res.json({ ok: true });
});

app.post('/api/registrations/:regId/absent', requireRole('Organizator', 'Admin'), (req, res) => {
  const reg = rejestracje.findById(parseInt(req.params.regId));
  if (!reg) return res.status(404).json({ error: 'Nie znaleziono.' });
  if (reg.status_obecnosci === 'OBECNY') {
    const event = wydarzenia.findById(reg.id_wydarzenia);
    const pts = (event && event.punkty) ? event.punkty : 10;
    rejestracje.setStatus(reg.id, 'NIEOBECNY');
    users.addPoints(reg.id_studenta, -pts);
  }
  res.json({ ok: true });
});

// ── Ranking ──────────────────────────────────────────────────
app.get('/api/ranking', requireAuth, (req, res) => {
  const ranking = users.getRanking();
  const me      = users.findById(req.session.userId);
  const myRank  = ranking.findIndex(u => u.id === req.session.userId) + 1;
  res.json({ ranking, my_points: me ? me.suma_punktow : 0, my_rank: myRank || null });
});

// ── Opinions ─────────────────────────────────────────────────
app.get('/api/opinions/by-reg/:regId', requireRole('Student'), (req, res) => {
  const reg = rejestracje.findById(parseInt(req.params.regId));
  if (!reg || reg.id_studenta !== req.session.userId)
    return res.status(403).json({ error: 'Brak dostepu.' });
  res.json(opinie.findByRegId(parseInt(req.params.regId)) || null);
});

app.put('/api/opinions/:regId', requireRole('Student'), (req, res) => {
  const id_rejestracji = parseInt(req.params.regId);
  const { ocena, tresc } = req.body;
  if (!ocena || !tresc) return res.status(400).json({ error: 'Wypelnij wszystkie pola.' });
  const ocenaInt = parseInt(ocena);
  if (ocenaInt < 1 || ocenaInt > 5) return res.status(400).json({ error: 'Ocena musi byc od 1 do 5.' });
  const reg = rejestracje.findById(id_rejestracji);
  if (!reg || reg.id_studenta !== req.session.userId || reg.status_obecnosci !== 'OBECNY')
    return res.status(400).json({ error: 'Nie mozesz wystawic opinii.' });
  opinie.upsert(id_rejestracji, ocenaInt, tresc);
  res.json({ ok: true });
});

app.get('/api/events/:id/opinions', requireRole('Organizator', 'Admin'), (req, res) => {
  res.json(opinie.getByEvent(parseInt(req.params.id)));
});

// ── Admin ─────────────────────────────────────────────────────
app.get('/api/admin/users', requireRole('Admin'), (req, res) => res.json(users.getAll()));

app.post('/api/admin/users/:id/toggle', requireRole('Admin'), (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.session.userId) return res.status(400).json({ error: 'Nie mozesz zablokowac wlasnego konta.' });
  users.toggle(uid);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', requireRole('Admin'), (req, res) => {
  const uid = parseInt(req.params.id);
  if (uid === req.session.userId) return res.status(400).json({ error: 'Nie mozesz usunac wlasnego konta.' });
  users.delete(uid);
  res.json({ ok: true });
});

app.get('/api/admin/events', requireRole('Admin'), (req, res) => res.json(wydarzenia.getAllAdmin()));

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PWSG dziala na http://localhost:${PORT}`));

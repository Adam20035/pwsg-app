// db.js — wersja Firestore (Firebase). Eksportuje te same obiekty i funkcje co
// oryginalny db.js na data.json, więc server.js wymaga tylko dodania async/await
// (patrz server_firestore_patch.txt).

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const COL = {
  users: db.collection('users'),
  wydarzenia: db.collection('wydarzenia'),
  rejestracje: db.collection('rejestracje'),
  opinie: db.collection('opinie'),
  meta: db.collection('meta'),
};

// ── Licznik kolejnych ID (Firestore nie ma auto-increment) ──────────────────
async function nextId(name) {
  const ref = COL.meta.doc('counters');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const current = data[name] || 0;
    const next = current + 1;
    tx.set(ref, { ...data, [name]: next }, { merge: true });
    return next;
  });
}

// ── Inicjalizacja danych testowych (uruchamia się tylko raz, jeśli baza pusta) ──
async function seedIfEmpty() {
  const snap = await COL.users.limit(1).get();
  if (!snap.empty) return;

  const usersSeed = [
    { id: 1, email: 'admin@pwsg.pl', password: 'admin123', imie_nazwisko: 'Administrator Systemu', rola: 'Admin', active: 1, suma_punktow: 0 },
    { id: 2, email: 'organizator@pwsg.pl', password: 'org123', imie_nazwisko: 'Samorzad Studencki', rola: 'Organizator', active: 1, suma_punktow: 0 },
    { id: 3, email: 'samorzad@wat.edu.pl', password: 'org123', imie_nazwisko: 'Samorzad WAT', rola: 'Organizator', active: 1, suma_punktow: 0 },
    { id: 4, email: 'jan.kowalski@student.pl', password: 'student123', imie_nazwisko: 'Jan Kowalski', rola: 'Student', active: 1, suma_punktow: 450 },
    { id: 5, email: 'anna.nowak@student.pl', password: 'student123', imie_nazwisko: 'Anna Nowak', rola: 'Student', active: 1, suma_punktow: 600 },
    { id: 6, email: 'piotr.wisniewski@student.pl', password: 'student123', imie_nazwisko: 'Piotr Wisniewski', rola: 'Student', active: 1, suma_punktow: 550 },
    { id: 7, email: 'marek.zielinski@student.pl', password: 'student123', imie_nazwisko: 'Marek Zielinski', rola: 'Student', active: 1, suma_punktow: 520 },
    { id: 8, email: 'student@pwsg.pl', password: 'student123', imie_nazwisko: 'Adam Kowalczyk', rola: 'Student', active: 1, suma_punktow: 380 },
  ];
  const wydarzeniaSeed = [
    { id: 1, nazwa_wydarzenia: 'Hackathon WAT 2026', data_wydarzenia: '2026-06-20', miejsce: 'Aula A1', limit_miejsc: 100, id_organizatora: 2, typ_wydarzenia: 'Warsztaty', punkty: 20 },
    { id: 2, nazwa_wydarzenia: 'Dzien Studenta', data_wydarzenia: '2026-06-25', miejsce: 'Dziedziniec', limit_miejsc: 500, id_organizatora: 2, typ_wydarzenia: 'Inne', punkty: 10 },
    { id: 3, nazwa_wydarzenia: 'Warsztaty AI', data_wydarzenia: '2026-07-05', miejsce: 'Sala 301', limit_miejsc: 30, id_organizatora: 3, typ_wydarzenia: 'Warsztaty', punkty: 15 },
    { id: 4, nazwa_wydarzenia: 'Konferencja Naukowa', data_wydarzenia: '2026-07-15', miejsce: 'Aula B2', limit_miejsc: 200, id_organizatora: 2, typ_wydarzenia: 'Wyklad', punkty: 10 },
  ];
  const rejestracjeSeed = [
    { id: 1, id_studenta: 4, id_wydarzenia: 1, status_obecnosci: 'ZAPISANY' },
    { id: 2, id_studenta: 5, id_wydarzenia: 1, status_obecnosci: 'OBECNY' },
    { id: 3, id_studenta: 6, id_wydarzenia: 1, status_obecnosci: 'ZAPISANY' },
    { id: 4, id_studenta: 7, id_wydarzenia: 1, status_obecnosci: 'ZAPISANY' },
    { id: 5, id_studenta: 4, id_wydarzenia: 2, status_obecnosci: 'ZAPISANY' },
    { id: 6, id_studenta: 8, id_wydarzenia: 2, status_obecnosci: 'ZAPISANY' },
  ];
  const opinieSeed = [
    { id: 1, id_rejestracji: 2, ocena: 5, tresc: 'Swietnie zorganizowane! Na pewno wroce.' },
  ];

  const batch = db.batch();
  usersSeed.forEach(u => batch.set(COL.users.doc(String(u.id)), u));
  wydarzeniaSeed.forEach(e => batch.set(COL.wydarzenia.doc(String(e.id)), e));
  rejestracjeSeed.forEach(r => batch.set(COL.rejestracje.doc(String(r.id)), r));
  opinieSeed.forEach(o => batch.set(COL.opinie.doc(String(o.id)), o));
  batch.set(COL.meta.doc('counters'), { users: 8, wydarzenia: 4, rejestracje: 6, opinie: 1 });
  await batch.commit();
  console.log('Dane testowe wczytane do Firestore.');
}
const ready = seedIfEmpty();

function docToObj(doc) {
  return { id: parseInt(doc.id), ...doc.data() };
}

// ── users ────────────────────────────────────────────────────────────────
const users = {
  findByCredentials: async (email, password) => {
    await ready;
    const snap = await COL.users.where('email', '==', email).where('password', '==', password).where('active', '==', 1).limit(1).get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },
  findByEmail: async (email) => {
    await ready;
    const snap = await COL.users.where('email', '==', email).limit(1).get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },
  findById: async (id) => {
    await ready;
    const doc = await COL.users.doc(String(id)).get();
    return doc.exists ? docToObj(doc) : null;
  },
  getAll: async () => {
    await ready;
    const snap = await COL.users.get();
    return snap.docs.map(docToObj).sort((a, b) => a.rola.localeCompare(b.rola) || a.email.localeCompare(b.email));
  },
  getRanking: async () => {
    await ready;
    const snap = await COL.users.where('rola', '==', 'Student').where('active', '==', 1).get();
    return snap.docs.map(docToObj).sort((a, b) => b.suma_punktow - a.suma_punktow).slice(0, 20);
  },
  addPoints: async (id, pts) => {
    await ready;
    const ref = COL.users.doc(String(id));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const current = snap.data().suma_punktow || 0;
      tx.update(ref, { suma_punktow: Math.max(0, current + pts) });
    });
  },
  register: async (email, password, imie_nazwisko) => {
    await ready;
    const id = await nextId('users');
    await COL.users.doc(String(id)).set({ id, email, password, imie_nazwisko, rola: 'Student', active: 1, suma_punktow: 0 });
    return id;
  },
  toggle: async (id) => {
    await ready;
    const ref = COL.users.doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return;
    await ref.update({ active: snap.data().active ? 0 : 1 });
  },
  delete: async (id) => {
    await ready;
    const regsSnap = await COL.rejestracje.where('id_studenta', '==', id).get();
    const regIds = regsSnap.docs.map(d => parseInt(d.id));
    const batch = db.batch();
    for (const rid of regIds) {
      const opSnap = await COL.opinie.where('id_rejestracji', '==', rid).get();
      opSnap.docs.forEach(d => batch.delete(d.ref));
    }
    regsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(COL.users.doc(String(id)));
    await batch.commit();
  },
};

// ── wydarzenia ───────────────────────────────────────────────────────────
const wydarzenia = {
  getAll: async (userId) => {
    await ready;
    const [evSnap, regSnap, usSnap] = await Promise.all([COL.wydarzenia.get(), COL.rejestracje.get(), COL.users.get()]);
    const regs = regSnap.docs.map(docToObj);
    const usersMap = Object.fromEntries(usSnap.docs.map(d => [parseInt(d.id), d.data()]));
    return evSnap.d
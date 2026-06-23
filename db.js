// db.js — wersja Firestore (Firebase).
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const COL = {
  users: db.collection('users'),
  wydarzenia: db.collection('wydarzenia'),
  rejestracje: db.collection('rejestracje'),
  opinie: db.collection('opinie'),
  meta: db.collection('meta'),
};

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

async function seedIfEmpty() {
  const snap = await COL.users.limit(1).get();
  if (!snap.empty) return;
  const usersSeed = [
    { id: 1, email: 'admin@pwsg.pl', password: 'admin123', imie_nazwisko: 'Administrator Systemu', rola: 'Admin', active: 1, suma_punktow: 0, email_verified: true },
    { id: 2, email: 'organizator@pwsg.pl', password: 'org123', imie_nazwisko: 'Samorzad Studencki', rola: 'Organizator', active: 1, suma_punktow: 0, email_verified: true },
    { id: 3, email: 'samorzad@wat.edu.pl', password: 'org123', imie_nazwisko: 'Samorzad WAT', rola: 'Organizator', active: 1, suma_punktow: 0, email_verified: true },
    { id: 4, email: 'jan.kowalski@student.pl', password: 'student123', imie_nazwisko: 'Jan Kowalski', rola: 'Student', active: 1, suma_punktow: 450, email_verified: true },
    { id: 5, email: 'anna.nowak@student.pl', password: 'student123', imie_nazwisko: 'Anna Nowak', rola: 'Student', active: 1, suma_punktow: 600, email_verified: true },
    { id: 6, email: 'piotr.wisniewski@student.pl', password: 'student123', imie_nazwisko: 'Piotr Wisniewski', rola: 'Student', active: 1, suma_punktow: 550, email_verified: true },
    { id: 7, email: 'marek.zielinski@student.pl', password: 'student123', imie_nazwisko: 'Marek Zielinski', rola: 'Student', active: 1, suma_punktow: 520, email_verified: true },
    { id: 8, email: 'student@pwsg.pl', password: 'student123', imie_nazwisko: 'Adam Kowalczyk', rola: 'Student', active: 1, suma_punktow: 380, email_verified: true },
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
    const snap = await COL.users.where('email','==',email).where('password','==',password).where('active','==',1).limit(1).get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },
  findByEmail: async (email) => {
    await ready;
    const snap = await COL.users.where('email','==',email).limit(1).get();
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
    return snap.docs.map(docToObj).sort((a,b) => a.rola.localeCompare(b.rola) || a.email.localeCompare(b.email));
  },
  getRanking: async () => {
    await ready;
    const snap = await COL.users.where('rola','==','Student').where('active','==',1).get();
    return snap.docs.map(docToObj).sort((a,b) => b.suma_punktow - a.suma_punktow).slice(0,20);
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
  register: async (email, password, imie_nazwisko, token) => {
    await ready;
    const id = await nextId('users');
    await COL.users.doc(String(id)).set({
      id, email, password, imie_nazwisko,
      rola: 'Student', active: 1,
      suma_punktow: 0,
      email_verified: false,
      verification_token: token,
    });
    return id;
  },
  verifyByToken: async (token) => {
    await ready;
    const snap = await COL.users.where('verification_token','==',token).limit(1).get();
    if (snap.empty) return false;
    await snap.docs[0].ref.update({ email_verified: true, verification_token: null });
    return true;
  },
  toggle: async (id) => {
    await ready;
    const ref = COL.users.doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return;
    await ref.update({ active: snap.data().active ? 0 : 1 });
  },
  setVerified: async (id) => {
    await ready;
    await COL.users.doc(String(id)).update({ email_verified: true, verification_token: null });
  },
  setVerificationToken: async (id, token) => {
    await ready;
    await COL.users.doc(String(id)).update({ verification_token: token });
  },
  setRole: async (id, role) => {
    await ready;
    await COL.users.doc(String(id)).update({ rola: role });
  },
  delete: async (id) => {
    await ready;
    const regsSnap = await COL.rejestracje.where('id_studenta','==',id).get();
    const regIds = regsSnap.docs.map(d => parseInt(d.id));
    const batch = db.batch();
    for (const rid of regIds) {
      const opSnap = await COL.opinie.where('id_rejestracji','==',rid).get();
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
    return evSnap.docs.map(docToObj).sort((a,b) => a.data_wydarzenia.localeCompare(b.data_wydarzenia)).map(e => {
      const reg = regs.find(r => r.id_wydarzenia === e.id && r.id_studenta === userId) || null;
      return {
        ...e,
        zapisani: regs.filter(r => r.id_wydarzenia === e.id).length,
        organizator_nazwa: (usersMap[e.id_organizatora] || {}).imie_nazwisko || '',
        user_registered: reg ? 1 : 0,
        user_status: reg ? reg.status_obecnosci : null,
        user_reg_id: reg ? reg.id : null,
      };
    });
  },
  getMine: async (orgId) => {
    await ready;
    const [evSnap, regSnap] = await Promise.all([
      COL.wydarzenia.where('id_organizatora','==',orgId).get(),
      COL.rejestracje.get(),
    ]);
    const regs = regSnap.docs.map(docToObj);
    return evSnap.docs.map(docToObj).sort((a,b) => a.data_wydarzenia.localeCompare(b.data_wydarzenia)).map(e => ({
      ...e, zapisani: regs.filter(r => r.id_wydarzenia === e.id).length,
    }));
  },
  getAllAdmin: async () => {
    await ready;
    const [evSnap, regSnap, usSnap] = await Promise.all([COL.wydarzenia.get(), COL.rejestracje.get(), COL.users.get()]);
    const regs = regSnap.docs.map(docToObj);
    const usersMap = Object.fromEntries(usSnap.docs.map(d => [parseInt(d.id), d.data()]));
    return evSnap.docs.map(docToObj).sort((a,b) => a.data_wydarzenia.localeCompare(b.data_wydarzenia)).map(e => ({
      ...e,
      zapisani: regs.filter(r => r.id_wydarzenia === e.id).length,
      organizator_nazwa: (usersMap[e.id_organizatora] || {}).imie_nazwisko || '',
    }));
  },
  findById: async (id) => {
    await ready;
    const doc = await COL.wydarzenia.doc(String(id)).get();
    return doc.exists ? docToObj(doc) : null;
  },
  create: async ({ nazwa, data_wydarzenia, miejsce, limit_miejsc, id_organizatora, typ_wydarzenia, punkty }) => {
    await ready;
    const id = await nextId('wydarzenia');
    await COL.wydarzenia.doc(String(id)).set({
      id, nazwa_wydarzenia: nazwa, data_wydarzenia, miejsce,
      limit_miejsc: parseInt(limit_miejsc), id_organizatora,
      typ_wydarzenia: typ_wydarzenia || 'Inne', punkty: parseInt(punkty) || 10,
    });
    return id;
  },
  update: async (id, orgId, isAdmin, data) => {
    await ready;
    const doc = await COL.wydarzenia.doc(String(id)).get();
    if (!doc.exists) return false;
    if (!isAdmin && doc.data().id_organizatora !== orgId) return false;
    const allowed = {};
    if (data.nazwa) allowed.nazwa_wydarzenia = data.nazwa;
    if (data.data_wydarzenia) allowed.data_wydarzenia = data.data_wydarzenia;
    if (data.miejsce) allowed.miejsce = data.miejsce;
    if (data.limit_miejsc) allowed.limit_miejsc = parseInt(data.limit_miejsc);
    if (data.typ_wydarzenia) allowed.typ_wydarzenia = data.typ_wydarzenia;
    if (data.punkty !== undefined) allowed.punkty = parseInt(data.punkty) || 10;
    await COL.wydarzenia.doc(String(id)).update(allowed);
    return true;
  },
  delete: async (id, orgId, isAdmin = false) => {
    await ready;
    const doc = await COL.wydarzenia.doc(String(id)).get();
    if (!doc.exists) return false;
    if (!isAdmin && doc.data().id_organizatora !== orgId) return false;
    const regsSnap = await COL.rejestracje.where('id_wydarzenia','==',id).get();
    const regIds = regsSnap.docs.map(d => parseInt(d.id));
    const batch = db.batch();
    for (const rid of regIds) {
      const opSnap = await COL.opinie.where('id_rejestracji','==',rid).get();
      opSnap.docs.forEach(d => batch.delete(d.ref));
    }
    regsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(COL.wydarzenia.doc(String(id)));
    await batch.commit();
    return true;
  },
};

// ── rejestracje ──────────────────────────────────────────────────────────
const rejestracje = {
  findById: async (id) => {
    await ready;
    const doc = await COL.rejestracje.doc(String(id)).get();
    return doc.exists ? docToObj(doc) : null;
  },
  findByStudentEvent: async (id_studenta, id_wydarzenia) => {
    await ready;
    const snap = await COL.rejestracje.where('id_studenta','==',id_studenta).where('id_wydarzenia','==',id_wydarzenia).limit(1).get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },
  countByEvent: async (id_wydarzenia) => {
    await ready;
    const snap = await COL.rejestracje.where('id_wydarzenia','==',id_wydarzenia).get();
    return snap.size;
  },
  create: async (id_studenta, id_wydarzenia) => {
    await ready;
    const id = await nextId('rejestracje');
    await COL.rejestracje.doc(String(id)).set({ id, id_studenta, id_wydarzenia, status_obecnosci: 'ZAPISANY' });
    return id;
  },
  removeByStudentEvent: async (id_studenta, id_wydarzenia) => {
    await ready;
    const snap = await COL.rejestracje
      .where('id_studenta','==',id_studenta)
      .where('id_wydarzenia','==',id_wydarzenia)
      .where('status_obecnosci','==','ZAPISANY')
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },
  setStatus: async (id, status) => {
    await ready;
    const ref = COL.rejestracje.doc(String(id));
    const snap = await ref.get();
    if (snap.exists) await ref.update({ status_obecnosci: status });
  },
  getParticipants: async (id_wydarzenia) => {
    await ready;
    const [regSnap, usSnap] = await Promise.all([
      COL.rejestracje.where('id_wydarzenia','==',id_wydarzenia).get(),
      COL.users.get(),
    ]);
    const usersMap = Object.fromEntries(usSnap.docs.map(d => [parseInt(d.id), d.data()]));
    return regSnap.docs.map(docToObj).map(r => {
      const u = usersMap[r.id_studenta] || {};
      return { reg_id: r.id, imie_nazwisko: u.imie_nazwisko || '?', email: u.email || '?', status_obecnosci: r.status_obecnosci };
    }).sort((a,b) => a.imie_nazwisko.localeCompare(b.imie_nazwisko));
  },
  getPendingOpinions: async (id_studenta) => {
    await ready;
    const [regSnap, evSnap, opSnap] = await Promise.all([
      COL.rejestracje.where('id_studenta','==',id_studenta).where('status_obecnosci','==','OBECNY').get(),
      COL.wydarzenia.get(),
      COL.opinie.get(),
    ]);
    const evMap = Object.fromEntries(evSnap.docs.map(d => [parseInt(d.id), d.data()]));
    const opRegIds = new Set(opSnap.docs.map(d => d.data().id_rejestracji));
    return regSnap.docs.map(docToObj).filter(r => !opRegIds.has(r.id)).map(r => {
      const e = evMap[r.id_wydarzenia] || {};
      return { reg_id: r.id, nazwa_wydarzenia: e.nazwa_wydarzenia || '?', data_wydarzenia: e.data_wydarzenia || '' };
    });
  },
};

// ── opinie ───────────────────────────────────────────────────────────────
const opinie = {
  findByRegId: async (id_rejestracji) => {
    await ready;
    const snap = await COL.opinie.where('id_rejestracji','==',id_rejestracji).limit(1).get();
    return snap.empty ? null : docToObj(snap.docs[0]);
  },
  upsert: async (id_rejestracji, ocena, tresc) => {
    await ready;
    const snap = await COL.opinie.where('id_rejestracji','==',id_rejestracji).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({ ocena, tresc });
    } else {
      const id = await nextId('opinie');
      await COL.opinie.doc(String(id)).set({ id, id_rejestracji, ocena, tresc });
    }
  },
  getByEvent: async (id_wydarzenia) => {
    await ready;
    const [regSnap, usSnap, opSnap] = await Promise.all([
      COL.rejestracje.where('id_wydarzenia','==',id_wydarzenia).where('status_obecnosci','==','OBECNY').get(),
      COL.users.get(),
      COL.opinie.get(),
    ]);
    const usersMap = Object.fromEntries(usSnap.docs.map(d => [parseInt(d.id), d.data()]));
    const opByReg = Object.fromEntries(opSnap.docs.map(d => [d.data().id_rejestracji, d.data()]));
    return regSnap.docs.map(docToObj).map(r => {
      const u = usersMap[r.id_studenta] || {};
      const o = opByReg[r.id] || null;
      return { imie_nazwisko: u.imie_nazwisko || '?', ocena: o ? o.ocena : null, tresc: o ? o.tresc : null };
    });
  },
};

module.exports = { users, wydarzenia, rejestracje, opinie };

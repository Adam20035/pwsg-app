const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'data.json');
function save() { fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }
let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
if (!db) {
  db = {
    _next: { users:9, wydarzenia:5, rejestracje:7, opinie:2 },
    users: [
      {id:1,email:'admin@pwsg.pl',password:'admin123',imie_nazwisko:'Administrator Systemu',rola:'Admin',active:1,suma_punktow:0},
      {id:2,email:'organizator@pwsg.pl',password:'org123',imie_nazwisko:'Samorzad Studencki',rola:'Organizator',active:1,suma_punktow:0},
      {id:3,email:'samorzad@wat.edu.pl',password:'org123',imie_nazwisko:'Samorzad WAT',rola:'Organizator',active:1,suma_punktow:0},
      {id:4,email:'jan.kowalski@student.pl',password:'student123',imie_nazwisko:'Jan Kowalski',rola:'Student',active:1,suma_punktow:450},
      {id:5,email:'anna.nowak@student.pl',password:'student123',imie_nazwisko:'Anna Nowak',rola:'Student',active:1,suma_punktow:600},
      {id:6,email:'piotr.wisniewski@student.pl',password:'student123',imie_nazwisko:'Piotr Wisniewski',rola:'Student',active:1,suma_punktow:550},
      {id:7,email:'marek.zielinski@student.pl',password:'student123',imie_nazwisko:'Marek Zielinski',rola:'Student',active:1,suma_punktow:520},
      {id:8,email:'student@pwsg.pl',password:'student123',imie_nazwisko:'Adam Kowalczyk',rola:'Student',active:1,suma_punktow:380}
    ],
    wydarzenia: [
      {id:1,nazwa_wydarzenia:'Hackathon WAT 2026',data_wydarzenia:'2026-06-20',miejsce:'Aula A1',limit_miejsc:100,id_organizatora:2,typ_wydarzenia:'Warsztaty',punkty:20},
      {id:2,nazwa_wydarzenia:'Dzien Studenta',data_wydarzenia:'2026-06-25',miejsce:'Dziedziniec',limit_miejsc:500,id_organizatora:2,typ_wydarzenia:'Inne',punkty:10},
      {id:3,nazwa_wydarzenia:'Warsztaty AI',data_wydarzenia:'2026-07-05',miejsce:'Sala 301',limit_miejsc:30,id_organizatora:3,typ_wydarzenia:'Warsztaty',punkty:15},
      {id:4,nazwa_wydarzenia:'Konferencja Naukowa',data_wydarzenia:'2026-07-15',miejsce:'Aula B2',limit_miejsc:200,id_organizatora:2,typ_wydarzenia:'Wyklad',punkty:10}
    ],
    rejestracje: [
      {id:1,id_studenta:4,id_wydarzenia:1,status_obecnosci:'ZAPISANY'},
      {id:2,id_studenta:5,id_wydarzenia:1,status_obecnosci:'OBECNY'},
      {id:3,id_studenta:6,id_wydarzenia:1,status_obecnosci:'ZAPISANY'},
      {id:4,id_studenta:7,id_wydarzenia:1,status_obecnosci:'ZAPISANY'},
      {id:5,id_studenta:4,id_wydarzenia:2,status_obecnosci:'ZAPISANY'},
      {id:6,id_studenta:8,id_wydarzenia:2,status_obecnosci:'ZAPISANY'}
    ],
    opinie: [
      {id:1,id_rejestracji:2,ocena:5,tresc:'Swietnie zorganizowane! Na pewno wroce.'}
    ]
  };
  save();
  console.log('Dane testowe wczytane.');
}
function nextId(t){const id=db._next[t];db._next[t]++;return id;}
const users={
  findByCredentials:(email,password)=>db.users.find(u=>u.email===email&&u.password===password&&u.active===1)||null,
  findByEmail:(email)=>db.users.find(u=>u.email===email)||null,
  findById:(id)=>db.users.find(u=>u.id===id)||null,
  getAll:()=>[...db.users].sort((a,b)=>a.rola.localeCompare(b.rola)||a.email.localeCompare(b.email)),
  getRanking:()=>db.users.filter(u=>u.rola==='Student'&&u.active===1).sort((a,b)=>b.suma_punktow-a.suma_punktow).slice(0,20),
  addPoints:(id,pts)=>{const u=db.users.find(u=>u.id===id);if(u){u.suma_punktow=Math.max(0,(u.suma_punktow||0)+pts);save();}},
  toggle:(id)=>{const u=db.users.find(u=>u.id===id);if(u){u.active=u.active?0:1;save();}},
  delete:(id)=>{const rIds=db.rejestracje.filter(r=>r.id_studenta===id).map(r=>r.id);db.opinie=db.opinie.filter(o=>!rIds.includes(o.id_rejestracji));db.rejestracje=db.rejestracje.filter(r=>r.id_studenta!==id);db.users=db.users.filter(u=>u.id!==id);save();}
};
const wydarzenia={
  getAll:(userId)=>[...db.wydarzenia].sort((a,b)=>a.data_wydarzenia.localeCompare(b.data_wydarzenia)).map(e=>{const reg=db.rejestracje.find(r=>r.id_wydarzenia===e.id&&r.id_studenta===userId)||null;return{...e,zapisani:db.rejestracje.filter(r=>r.id_wydarzenia===e.id).length,organizator_nazwa:(db.users.find(u=>u.id===e.id_organizatora)||{}).imie_nazwisko||'',user_registered:reg?1:0,user_status:reg?reg.status_obecnosci:null,user_reg_id:reg?reg.id:null};}),
  getMine:(orgId)=>[...db.wydarzenia].filter(e=>e.id_organizatora===orgId).sort((a,b)=>a.data_wydarzenia.localeCompare(b.data_wydarzenia)).map(e=>({...e,zapisani:db.rejestracje.filter(r=>r.id_wydarzenia===e.id).length})),
  getAllAdmin:()=>[...db.wydarzenia].sort((a,b)=>a.data_wydarzenia.localeCompare(b.data_wydarzenia)).map(e=>({...e,zapisani:db.rejestracje.filter(r=>r.id_wydarzenia===e.id).length,organizator_nazwa:(db.users.find(u=>u.id===e.id_organizatora)||{}).imie_nazwisko||''})),
  findById:(id)=>db.wydarzenia.find(e=>e.id===id)||null,
  create:({nazwa,data_wydarzenia,miejsce,limit_miejsc,id_organizatora,typ_wydarzenia,punkty})=>{const id=nextId('wydarzenia');db.wydarzenia.push({id,nazwa_wydarzenia:nazwa,data_wydarzenia,miejsce,limit_miejsc:parseInt(limit_miejsc),id_organizatora,typ_wydarzenia:typ_wydarzenia||'Inne',punkty:parseInt(punkty)||10});save();return id;},
  delete:(id,orgId)=>{const e=db.wydarzenia.find(e=>e.id===id&&e.id_organizatora===orgId);if(!e)return false;const rIds=db.rejestracje.filter(r=>r.id_wydarzenia===id).map(r=>r.id);db.opinie=db.opinie.filter(o=>!rIds.includes(o.id_rejestracji));db.rejestracje=db.rejestracje.filter(r=>r.id_wydarzenia!==id);db.wydarzenia=db.wydarzenia.filter(e=>e.id!==id);save();return true;}
};
const rejestracje={
  findById:(id)=>db.rejestracje.find(r=>r.id===id)||null,
  findByStudentEvent:(id_studenta,id_wydarzenia)=>db.rejestracje.find(r=>r.id_studenta===id_studenta&&r.id_wydarzenia===id_wydarzenia)||null,
  countByEvent:(id_wydarzenia)=>db.rejestracje.filter(r=>r.id_wydarzenia===id_wydarzenia).length,
  create:(id_studenta,id_wydarzenia)=>{const id=nextId('rejestracje');db.rejestracje.push({id,id_studenta,id_wydarzenia,status_obecnosci:'ZAPISANY'});save();return id;},
  removeByStudentEvent:(id_studenta,id_wydarzenia)=>{db.rejestracje=db.rejestracje.filter(r=>!(r.id_studenta===id_studenta&&r.id_wydarzenia===id_wydarzenia&&r.status_obecnosci==='ZAPISANY'));save();},
  setStatus:(id,status)=>{const r=db.rejestracje.find(r=>r.id===id);if(r){r.status_obecnosci=status;save();}},
  getParticipants:(id_wydarzenia)=>db.rejestracje.filter(r=>r.id_wydarzenia===id_wydarzenia).map(r=>{const u=db.users.find(u=>u.id===r.id_studenta)||{};return{reg_id:r.id,imie_nazwisko:u.imie_nazwisko||'?',email:u.email||'?',status_obecnosci:r.status_obecnosci};}).sort((a,b)=>a.imie_nazwisko.localeCompare(b.imie_nazwisko)),
  getPendingOpinions:(id_studenta)=>db.rejestracje.filter(r=>r.id_studenta===id_studenta&&r.status_obecnosci==='OBECNY'&&!db.opinie.find(o=>o.id_rejestracji===r.id)).map(r=>{const e=db.wydarzenia.find(e=>e.id===r.id_wydarzenia)||{};return{reg_id:r.id,nazwa_wydarzenia:e.nazwa_wydarzenia||'?',data_wydarzenia:e.data_wydarzenia||''};})
};
const opinie={
  findByRegId:(id_rejestracji)=>db.opinie.find(o=>o.id_rejestracji===id_rejestracji)||null,
  create:(id_rejestracji,ocena,tresc)=>{db.opinie.push({id:nextId('opinie'),id_rejestracji,ocena,tresc});save();},
  upsert:(id_rejestracji,ocena,tresc)=>{const o=db.opinie.find(o=>o.id_rejestracji===id_rejestracji);if(o){o.ocena=ocena;o.tresc=tresc;}else{db.opinie.push({id:nextId('opinie'),id_rejestracji,ocena,tresc});}save();},
  getByEvent:(id_wydarzenia)=>{const regs=db.rejestracje.filter(r=>r.id_wydarzenia===id_wydarzenia&&r.status_obecnosci==='OBECNY');return regs.map(r=>{const u=db.users.find(u=>u.id===r.id_studenta)||{};const o=db.opinie.find(o=>o.id_rejestracji===r.id)||null;return{imie_nazwisko:u.imie_nazwisko||'?',ocena:o?o.ocena:null,tresc:o?o.tresc:null};}).filter(x=>x.ocena!==null);}
};
module.exports={users,wydarzenia,rejestracje,opinie};

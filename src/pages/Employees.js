import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Badge,Btn,Input,Select,Card,Modal,Loader,PageHeader,fmt } from '../components/ui';
import { db, nowISO } from '../db';

const ROLES=['gérant','vendeur','caissière','magasinier','comptable'];
const EMPTY={name:'',role:'vendeur',phone:'',pin:'',salary:'',active:true};
const ROLE_COLOR={gérant:'violet',vendeur:'cyan',caissière:'blue',magasinier:'amber',comptable:'green'};

export default function Employees() {
  const { theme: C } = useTheme();
  const isLight = C.isLight;
  const [employees,setEmployees]=useState([]);
  const [sales,setSales]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const [e,s]=await Promise.all([db.employees.toArray(),db.sales.toArray()]);
    setEmployees(e);setSales(s);setLoading(false);
  }

  const openAdd=()=>{setForm(EMPTY);setModal('add');};
  const openEdit=e=>{setForm({...e,salary:e.salary||''});setModal(e);};

  async function save(){
    if(!form.name.trim()) return alert('Nom requis');
    setSaving(true);
    const payload={name:form.name,role:form.role,phone:form.phone,
      pin:form.pin||null,salary:Number(form.salary)||0,active:!!form.active};
    if(modal==='add') await db.employees.add({...payload,createdAt:nowISO()});
    else await db.employees.update(modal.id,payload);
    await load();setModal(null);setSaving(false);
  }

  const empStats=employees.map(e=>{
    const empSales=sales.filter(s=>s.employeeId===e.id);
    return {...e,salesTotal:empSales.reduce((s,v)=>s+Number(v.total||0),0),salesCount:empSales.length};
  });

  const totalSalaries=employees.filter(e=>e.active).reduce((s,e)=>s+Number(e.salary||0),0);

  if(loading) return <Loader/>;

  return (
    <div>
      <PageHeader title="Employés & RH"
        sub={`${employees.filter(e=>e.active).length} actifs · Masse salariale: ${fmt(totalSalaries)}/mois`}>
        <Btn onClick={openAdd}>+ Ajouter employé</Btn>
      </PageHeader>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:24}}>
        {[
          {label:'Employés actifs',val:employees.filter(e=>e.active).length,icon:'👨‍💼',color:C.accent},
          {label:'Masse salariale',val:fmt(totalSalaries),icon:'💶',color:C.green},
          {label:'Ventes enregistrées',val:sales.length,icon:'📈',color:C.blue},
        ].map(s=>(
          <Card key={s.label} style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{fontSize:28}}>{s.icon}</div>
            <div>
              <div style={{color:C.sub,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:900,color:s.color,fontFamily:C.fontDisplay}}>{s.val}</div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
        {empStats.map(e=>(
          <Card key={e.id} style={{opacity:e.active?1:.55}}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
              <div style={{width:50,height:50,borderRadius:14,
                background:`linear-gradient(135deg,${C.accent},${C.violet})`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:900,fontSize:20,color:'#000',fontFamily:C.fontDisplay}}>
                {e.name[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,fontFamily:C.fontDisplay}}>{e.name}</div>
                <div style={{display:'flex',gap:6,marginTop:4}}>
                  <Badge color={ROLE_COLOR[e.role]||'blue'} small>{e.role}</Badge>
                  {!e.active&&<Badge color="red" small>Inactif</Badge>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:C.accent,fontWeight:700,fontSize:13}}>{fmt(e.salary||0)}</div>
                <div style={{color:C.sub,fontSize:10}}>/mois</div>
              </div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:14,
              display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div>
                <div style={{color:C.sub,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>Ventes</div>
                <div style={{fontWeight:800,fontSize:20,color:C.green,fontFamily:C.fontDisplay}}>{e.salesCount}</div>
              </div>
              <div>
                <div style={{color:C.sub,fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>CA généré</div>
                <div style={{fontWeight:800,fontSize:15,color:C.accent,fontFamily:C.fontDisplay}}>{fmt(e.salesTotal)}</div>
              </div>
            </div>
            {e.phone&&<div style={{color:C.sub,fontSize:12,marginBottom:12}}>📞 {e.phone}</div>}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>openEdit(e)} style={{background:C.accentLo,border:'none',borderRadius:8,padding:'6px 14px',color:C.accent,fontWeight:700,cursor:'pointer',fontSize:12}}>✏ Modifier</button>
              <button onClick={async()=>{await db.employees.update(e.id,{active:!e.active});await load();}}
                style={{background:e.active?C.redLo:C.greenLo,border:'none',borderRadius:8,padding:'6px 14px',
                  color:e.active?C.red:C.green,cursor:'pointer',fontSize:12,fontWeight:700,marginLeft:'auto'}}>
                {e.active?'🔴 Désactiver':'🟢 Réactiver'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {modal&&<Modal title={modal==='add'?'+ Nouvel employé':`✏ ${form.name}`} onClose={()=>setModal(null)}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <Input label="Nom complet *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Amar Djelloul"/>
          <Select label="Rôle" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </Select>
          <Input label="Téléphone" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0661 11 22 33"/>
          <Input label="PIN (4 chiffres)" value={form.pin||''} onChange={e=>setForm(f=>({...f,pin:e.target.value}))} placeholder="1234" maxLength={4}/>
          <Input label="Salaire mensuel (DA)" type="number" value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))} placeholder="45000"/>
          {modal!=='add'&&<label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
            <input type="checkbox" checked={!!form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/>
            <span style={{color:C.sub,fontSize:13}}>Employé actif</span>
          </label>}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'⏳...':'✓ Enregistrer'}</Btn>
        </div>
      </Modal>}
    </div>
  );
}
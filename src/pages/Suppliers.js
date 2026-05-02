import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Btn,Input,Textarea,Card,Modal,Confirm,Loader,PageHeader } from '../components/ui';
import { db, nowISO } from '../db';

const EMPTY={name:'',contact:'',phone:'',city:'',notes:''};
const COLORS_HEX=['#0095CC','#8B5CF6','#4D9FFF','#00E5A0','#FFC04D','#C084FC'];

export default function Suppliers() {
  const { theme: C } = useTheme();
  const isLight = C.isLight;
  const [suppliers,setSuppliers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);
  const [confirm,setConfirm]=useState(null);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    setSuppliers(await db.suppliers.toArray());
    setLoading(false);
  }

  const openAdd=()=>{setForm(EMPTY);setModal('add');};
  const openEdit=s=>{setForm({name:s.name,contact:s.contact||'',phone:s.phone||'',city:s.city||'',notes:s.notes||''});setModal(s);};

  async function save(){
    if(!form.name.trim()) return alert('Nom requis');
    setSaving(true);
    if(modal==='add') await db.suppliers.add({...form,createdAt:nowISO()});
    else await db.suppliers.update(modal.id,form);
    await load();setModal(null);setSaving(false);
  }

  if(loading) return <Loader/>;

  return (
    <div>
      <PageHeader title="Fournisseurs" sub={`${suppliers.length} fournisseurs`}>
        <Btn onClick={openAdd}>+ Ajouter fournisseur</Btn>
      </PageHeader>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {suppliers.map((s,idx)=>{
          const color=COLORS_HEX[idx%COLORS_HEX.length];
          return <Card key={s.id}>
            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
              <div style={{width:48,height:48,borderRadius:14,
                background:`linear-gradient(135deg,${color},${color}80)`,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontWeight:900,fontSize:20,color:'#000'}}>
                {s.name[0]}
              </div>
              <div>
                <div style={{fontWeight:800,fontSize:14,fontFamily:C.fontDisplay}}>{s.name}</div>
                <div style={{color:C.sub,fontSize:12,marginTop:2}}>📍 {s.city||'—'}</div>
              </div>
            </div>
            {s.contact&&<div style={{color:C.sub,fontSize:12,marginBottom:5}}>👤 {s.contact}</div>}
            {s.phone&&<div style={{color:C.sub,fontSize:12,marginBottom:10}}>📞 {s.phone}</div>}
            {s.notes&&<div style={{color:C.muted,fontSize:11,marginBottom:10,fontStyle:'italic'}}>{s.notes}</div>}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10,display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>openEdit(s)} style={{background:C.accentLo,border:'none',borderRadius:8,padding:'5px 14px',color:C.accent,fontWeight:700,cursor:'pointer',fontSize:12}}>✏ Modifier</button>
              <button onClick={()=>setConfirm(s.id)} style={{background:C.redLo,border:'none',borderRadius:8,padding:'5px 12px',color:C.red,cursor:'pointer',fontSize:12}}>🗑</button>
            </div>
          </Card>;
        })}
        {suppliers.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:C.sub}}>Aucun fournisseur</div>}
      </div>

      {modal&&<Modal title={modal==='add'?'+ Nouveau fournisseur':`✏ ${form.name}`} onClose={()=>setModal(null)}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <Input label="Nom société *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Alpha Distribution"/>
          <Input label="Contact" value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} placeholder="Mourad"/>
          <Input label="Téléphone" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0550 10 20 30"/>
          <Input label="Ville" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} placeholder="Alger"/>
          <Textarea label="Notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'⏳...':'✓ Enregistrer'}</Btn>
        </div>
      </Modal>}

      {confirm&&<Confirm msg="Supprimer ce fournisseur ?" onOk={async()=>{await db.suppliers.delete(confirm);await load();setConfirm(null);}} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}
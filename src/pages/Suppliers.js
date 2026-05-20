import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Btn,Input,Textarea,Card,Modal,Confirm,Loader,PageHeader,fmt } from '../components/ui';
import { db, nowISO } from '../db';

const EMPTY={name:'',contact:'',phone:'',city:'',notes:''};
const COLORS_HEX=['#0095CC','#8B5CF6','#4D9FFF','#00E5A0','#FFC04D','#C084FC'];

export default function Suppliers() {
  const { theme: C } = useTheme();
  const isLight = C.isLight;
  const [suppliers,setSuppliers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(null);
  const [purchaseModal,setPurchaseModal]=useState(false);
  const [form,setForm]=useState(EMPTY);
  const [purchase,setPurchase]=useState({supplierId:'',invoiceNumber:'',total:'',paid:'',dueDate:'',note:''});
  const [purchases,setPurchases]=useState([]);
  const [saving,setSaving]=useState(false);
  const [confirm,setConfirm]=useState(null);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const [s,p]=await Promise.all([db.suppliers.toArray(),db.purchases.orderBy('createdAt').reverse().toArray().catch(()=>[])]);
    setSuppliers(s.map(x=>{
      const ps=p.filter(a=>a.supplierId===x.id);
      const total=ps.reduce((sum,a)=>sum+Number(a.total||0),0);
      const paid=ps.reduce((sum,a)=>sum+Number(a.paid||0),0);
      return {...x,totalPurchases:total,totalDue:total-paid,purchasesCount:ps.length};
    }));
    setPurchases(p);
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

  async function savePurchase(){
    if(!purchase.supplierId||!purchase.total) return alert('Fournisseur et total requis');
    const supplier=suppliers.find(s=>s.id===Number(purchase.supplierId));
    const total=Number(purchase.total)||0;
    const paid=Number(purchase.paid)||0;
    await db.purchases.add({
      supplierId:Number(purchase.supplierId),supplierName:supplier?.name||'',
      invoiceNumber:purchase.invoiceNumber,total,paid,dueDate:purchase.dueDate||null,
      note:purchase.note,status:paid>=total?'paye':'credit',createdAt:nowISO()
    });
    setPurchase({supplierId:'',invoiceNumber:'',total:'',paid:'',dueDate:'',note:''});
    setPurchaseModal(false);await load();
  }

  if(loading) return <Loader/>;

  return (
    <div>
      <PageHeader title="Fournisseurs" sub={`${suppliers.length} fournisseurs`}>
        <Btn variant="success" onClick={()=>setPurchaseModal(true)}>+ Achat fournisseur</Btn>
        <Btn onClick={openAdd}>+ Ajouter fournisseur</Btn>
      </PageHeader>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
        <Card><div style={{color:C.sub,fontSize:11,fontWeight:800}}>Achats fournisseurs</div><div style={{fontSize:22,fontWeight:900,color:C.accent}}>{fmt(purchases.reduce((s,p)=>s+Number(p.total||0),0))}</div></Card>
        <Card><div style={{color:C.sub,fontSize:11,fontWeight:800}}>Dettes fournisseurs</div><div style={{fontSize:22,fontWeight:900,color:C.red}}>{fmt(purchases.reduce((s,p)=>s+Math.max(0,Number(p.total||0)-Number(p.paid||0)),0))}</div></Card>
        <Card><div style={{color:C.sub,fontSize:11,fontWeight:800}}>Factures suivies</div><div style={{fontSize:22,fontWeight:900,color:C.green}}>{purchases.length}</div></Card>
      </div>

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
            <div style={{background:C.bg,borderRadius:10,padding:10,marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:C.sub}}>Achats</span><b>{fmt(s.totalPurchases||0)}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:4}}><span style={{color:C.sub}}>Reste</span><b style={{color:(s.totalDue||0)>0?C.red:C.green}}>{fmt(s.totalDue||0)}</b></div>
            </div>
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

      {purchaseModal&&<Modal title="+ Achat fournisseur" onClose={()=>setPurchaseModal(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <select value={purchase.supplierId} onChange={e=>setPurchase(f=>({...f,supplierId:e.target.value}))} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px',color:C.text}}>
            <option value="">Choisir fournisseur</option>
            {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Input label="Numero facture" value={purchase.invoiceNumber} onChange={e=>setPurchase(f=>({...f,invoiceNumber:e.target.value}))}/>
          <Input label="Total achat" type="number" value={purchase.total} onChange={e=>setPurchase(f=>({...f,total:e.target.value}))}/>
          <Input label="Montant paye" type="number" value={purchase.paid} onChange={e=>setPurchase(f=>({...f,paid:e.target.value}))}/>
          <Input label="Date echeance" type="date" value={purchase.dueDate} onChange={e=>setPurchase(f=>({...f,dueDate:e.target.value}))}/>
          <Textarea label="Note" value={purchase.note} onChange={e=>setPurchase(f=>({...f,note:e.target.value}))}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setPurchaseModal(false)}>Annuler</Btn>
          <Btn onClick={savePurchase}>Enregistrer achat</Btn>
        </div>
      </Modal>}

      {confirm&&<Confirm msg="Supprimer ce fournisseur ?" onOk={async()=>{await db.suppliers.delete(confirm);await load();setConfirm(null);}} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

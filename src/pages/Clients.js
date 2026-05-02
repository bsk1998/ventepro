import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Badge,Btn,Input,Textarea,Card,Modal,Confirm,Loader,PageHeader,fmt } from '../components/ui';
import { db, nowISO } from '../db';

const CEMPTY={name:'',phone:'',address:'',notes:''};

export function Clients() {
  const { theme: C } = useTheme();
  const isLight = C.isLight;
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState(null);
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(CEMPTY);
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState('');
  const [confirm,setConfirm]=useState(null);
  const [payModal,setPayModal]=useState(null);
  const [payAmount,setPayAmount]=useState('');

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const cl=await db.clients.toArray();
    const enriched=await Promise.all(cl.map(async c=>{
      const sales=await db.sales.where('clientId').equals(c.id).toArray();
      const total=sales.reduce((s,v)=>s+Number(v.total||0),0);
      const paid=sales.reduce((s,v)=>s+Number(v.paid||0),0);
      return {...c,total,paid,totalDue:total-paid,salesCount:sales.length,sales};
    }));
    setClients(enriched);setLoading(false);
  }

  const openAdd=()=>{setForm(CEMPTY);setModal('add');};
  const openEdit=c=>{setForm({name:c.name,phone:c.phone||'',address:c.address||'',notes:c.notes||''});setModal(c);};

  async function save(){
    if(!form.name.trim()) return alert('Nom requis');
    setSaving(true);
    if(modal==='add') await db.clients.add({...form,createdAt:nowISO()});
    else await db.clients.update(modal.id,form);
    await load();setModal(null);setSaving(false);
  }

  async function addPayment(){
    if(!payAmount||Number(payAmount)<=0) return;
    const openSales=await db.sales.where('clientId').equals(payModal.id).toArray();
    const credit=openSales.filter(s=>s.status==='crédit').sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    let remaining=Number(payAmount);
    for(const s of credit){
      if(remaining<=0) break;
      const due=Number(s.total)-Number(s.paid);
      const paying=Math.min(due,remaining);
      const newPaid=Number(s.paid)+paying;
      await db.sales.update(s.id,{paid:newPaid,status:newPaid>=Number(s.total)?'payé':'crédit'});
      remaining-=paying;
    }
    await db.payments.add({clientId:payModal.id,amount:Number(payAmount),note:'Versement',createdAt:nowISO()});
    setPayModal(null);setPayAmount('');await load();
  }

  const filtered=clients.filter(c=>!search||c.name?.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search));
  const totalDue=clients.reduce((s,c)=>s+c.totalDue,0);
  const client=sel?clients.find(c=>c.id===sel):null;

  if(loading) return <Loader/>;

  return (
    <div>
      <PageHeader title="Clients & Crédits" sub={`${clients.length} clients · Crédit total: ${fmt(totalDue)}`}>
        <Btn onClick={openAdd}>+ Nouveau client</Btn>
      </PageHeader>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un client..."
        style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:10,
          padding:'9px 14px',color:C.text,fontSize:13,outline:'none',marginBottom:16}}/>

      <div style={{display:'grid',gridTemplateColumns:sel?'1fr 1fr':'1fr',gap:16}}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.map(c=>{
            const pct=c.total>0?Math.round((c.paid/c.total)*100):100;
            const done=c.totalDue<=0;
            return <Card key={c.id} style={{border:`1px solid ${sel===c.id?C.accent:done?C.green+'30':C.border}`,cursor:'pointer',padding:18}}
              onClick={()=>setSel(s=>s===c.id?null:c.id)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div>
                  <div style={{fontWeight:800,fontSize:15,fontFamily:C.fontDisplay}}>{c.name}</div>
                  <div style={{color:C.sub,fontSize:12,marginTop:2}}>📞 {c.phone||'—'} · 📍 {c.address||'—'}</div>
                </div>
                <Badge color={done?'green':c.totalDue>5000?'red':'amber'}>
                  {done?'✓ Soldé':`Reste ${fmt(c.totalDue)}`}
                </Badge>
              </div>
              {c.total>0&&<>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                  <span style={{color:C.sub}}>Avancement</span>
                  <span style={{fontWeight:700}}>{pct}% · {fmt(c.paid)}/{fmt(c.total)}</span>
                </div>
                <div style={{background:C.bg,borderRadius:6,height:6,marginBottom:12}}>
                  <div style={{width:`${pct}%`,height:'100%',borderRadius:6,
                    background:done?C.green:pct>60?C.accent:C.red,transition:'width .4s'}}/>
                </div>
              </>}
              <div style={{display:'flex',gap:8}}>
                <button onClick={e=>{e.stopPropagation();openEdit(c);}} style={{background:C.accentLo,border:'none',borderRadius:8,padding:'5px 14px',color:C.accent,fontWeight:700,cursor:'pointer',fontSize:12}}>✏ Modifier</button>
                {c.totalDue>0&&<button onClick={e=>{e.stopPropagation();setPayModal(c);setPayAmount('');}} style={{background:C.greenLo,border:'none',borderRadius:8,padding:'5px 14px',color:C.green,fontWeight:700,cursor:'pointer',fontSize:12}}>💳 Versement</button>}
                <button onClick={e=>{e.stopPropagation();setConfirm(c.id);}} style={{background:C.redLo,border:'none',borderRadius:8,padding:'5px 12px',color:C.red,cursor:'pointer',fontSize:12,marginLeft:'auto'}}>🗑</button>
              </div>
            </Card>;
          })}
          {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:C.sub}}>Aucun client</div>}
        </div>

        {client&&(
          <Card>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div style={{fontWeight:900,fontSize:17,fontFamily:C.fontDisplay}}>{client.name}</div>
              <button onClick={()=>setSel(null)} style={{background:'none',border:'none',color:C.sub,fontSize:20,cursor:'pointer'}}>×</button>
            </div>
            {[['📞 Tél',client.phone||'—'],['📍 Adresse',client.address||'—'],['📝 Notes',client.notes||'—'],['📅 Depuis',new Date(client.createdAt||Date.now()).toLocaleDateString('fr-DZ')]].map(([k,v])=>(
              <div key={k} style={{marginBottom:10}}>
                <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.8,fontWeight:700,marginBottom:2}}>{k}</div>
                <div style={{fontSize:13,fontWeight:600}}>{v}</div>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:14,paddingTop:14}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>💳 Achats ({client.salesCount})</div>
              {(client.sales||[]).slice(0,5).map(s=>(
                <div key={s.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                  <div>
                    <div style={{fontWeight:600}}>Vente VP-{String(s.id).padStart(4,'0')}</div>
                    <div style={{color:C.sub,fontSize:10}}>{new Date(s.createdAt).toLocaleDateString('fr-DZ')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:C.accent,fontWeight:700}}>{fmt(s.total)}</div>
                    <Badge color={s.status==='payé'?'green':'amber'} small>{s.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:C.accentLo,border:`1px solid ${C.accentMd}`,borderRadius:10,padding:14,marginTop:14}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{color:C.sub,fontSize:13}}>Total acheté</span>
                <span style={{fontWeight:800,color:C.accent}}>{fmt(client.total)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:C.sub,fontSize:13}}>Reste à payer</span>
                <span style={{fontWeight:800,color:client.totalDue>0?C.red:C.green}}>{fmt(client.totalDue)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {modal&&<Modal title={modal==='add'?'+ Nouveau client':`✏ ${form.name}`} onClose={()=>setModal(null)}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <Input label="Nom complet *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Rachid Benmoussa"/>
          <Input label="Téléphone" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0661 23 45 67"/>
          <Input label="Adresse" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Alger Centre"/>
          <Textarea label="Notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
          <Btn variant="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'⏳...':'✓ Enregistrer'}</Btn>
        </div>
      </Modal>}

      {payModal&&<Modal title={`💳 Versement — ${payModal.name}`} onClose={()=>setPayModal(null)} width={400}>
        <div style={{marginBottom:16}}>
          <div style={{color:C.sub,fontSize:13,marginBottom:6}}>Total acheté: <b style={{color:C.text}}>{fmt(payModal.total)}</b></div>
          <div style={{color:C.sub,fontSize:13,marginBottom:16}}>Reste: <b style={{color:C.red}}>{fmt(payModal.totalDue)}</b></div>
          <Input label="Montant versé (DA)" type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)}/>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setPayModal(null)}>Annuler</Btn>
          <Btn variant="success" onClick={addPayment}>✓ Enregistrer</Btn>
        </div>
      </Modal>}

      {confirm&&<Confirm msg="Supprimer ce client ?" onOk={async()=>{await db.clients.delete(confirm);await load();setConfirm(null);}} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}
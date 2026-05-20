import { useTheme } from '../ThemeContext';
export { fmt } from '../db';

// All UI components now use live theme via useTheme() hook
// This ensures they respond to dark/light mode and palette changes

export function Badge({color='blue',children,small}){
  const {theme:C} = useTheme();
  const MAP={
    green:[C.green,C.greenLo], red:[C.red,C.redLo], amber:[C.amber,C.amberLo],
    blue:[C.blue,C.blueLo], purple:[C.purple,C.purpleLo], violet:[C.violet,C.violetLo],
    cyan:[C.accent,C.accentLo],
  };
  const[fg,bg]=MAP[color]||MAP.blue;
  return <span style={{background:bg,color:fg,border:`1px solid ${fg}35`,borderRadius:20,
    padding:small?'3px 9px':'5px 13px',fontSize:small?12:13,fontWeight:800,
    letterSpacing:.4,whiteSpace:'nowrap'}}>{children}</span>;
}

export function Pill({label,active,onClick}){
  const {theme:C} = useTheme();
  return <button onClick={onClick} style={{
    background:active?C.accent:C.isLight?'#fff':C.card,
    color:active?'#fff':C.sub,
    border:`1px solid ${active?C.accent:C.border}`,
    borderRadius:20,padding:'7px 16px',fontSize:14,fontWeight:active?800:700,
    cursor:'pointer',transition:'all .15s'}}>{label}</button>;
}

export function Input({label,style:st,...props}){
  const {theme:C} = useTheme();
  return <div style={st}>
    {label&&<div style={{color:C.sub,fontSize:12,fontWeight:800,marginBottom:6,
      letterSpacing:.6,textTransform:'uppercase'}}>{label}</div>}
    <input {...props} style={{width:'100%',background:C.isLight?'#fff':C.bg,
      border:`1px solid ${C.border}`,borderRadius:10,padding:'11px 13px',
      color:C.text,fontSize:15,outline:'none',transition:'border-color .15s',...props.style}}
      onFocus={e=>{e.target.style.borderColor=C.accent}}
      onBlur={e=>{e.target.style.borderColor=C.border}}/>
  </div>;
}

export function Textarea({label,style:st,...props}){
  const {theme:C} = useTheme();
  return <div style={st}>
    {label&&<div style={{color:C.sub,fontSize:12,fontWeight:800,marginBottom:6,
      letterSpacing:.6,textTransform:'uppercase'}}>{label}</div>}
    <textarea {...props} style={{width:'100%',background:C.isLight?'#fff':C.bg,
      border:`1px solid ${C.border}`,borderRadius:10,padding:'11px 13px',
      color:C.text,fontSize:15,outline:'none',resize:'vertical',minHeight:80,...props.style}}
      onFocus={e=>{e.target.style.borderColor=C.accent}}
      onBlur={e=>{e.target.style.borderColor=C.border}}/>
  </div>;
}

export function Select({label,style:st,children,...props}){
  const {theme:C} = useTheme();
  return <div style={st}>
    {label&&<div style={{color:C.sub,fontSize:12,fontWeight:800,marginBottom:6,
      letterSpacing:.6,textTransform:'uppercase'}}>{label}</div>}
    <select {...props} style={{width:'100%',background:C.isLight?'#fff':C.bg,
      border:`1px solid ${C.border}`,borderRadius:10,padding:'11px 13px',
      color:C.text,fontSize:15,outline:'none',...props.style}}>{children}</select>
  </div>;
}

export function Btn({variant='primary',children,style:st,...props}){
  const {theme:C} = useTheme();
  const VARIANTS = {
    primary: {background:C.accentGrad,color:'#fff',border:'none',fontWeight:800},
    ghost:   {background:C.isLight?'#F1F5F9':C.card,color:C.sub,border:`1px solid ${C.border}`,fontWeight:500},
    danger:  {background:C.redLo,color:C.red,border:`1px solid ${C.red}35`,fontWeight:700},
    success: {background:C.greenLo,color:C.green,border:`1px solid ${C.green}35`,fontWeight:700},
    violet:  {background:C.violetLo,color:C.violet,border:`1px solid ${C.violet}35`,fontWeight:700},
    amber:   {background:C.amberLo,color:C.amber,border:`1px solid ${C.amber}35`,fontWeight:700},
  };
  return <button {...props} style={{...VARIANTS[variant]||VARIANTS.primary,
    borderRadius:10,padding:'11px 20px',cursor:'pointer',fontSize:15,
    display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap',
    opacity:props.disabled?.5:1,transition:'all .15s',...st}}>{children}</button>;
}

export function Card({children,style:st,glow}){
  const {theme:C} = useTheme();
  return <div style={{
    background:C.isLight?'#fff':C.card,
    border:`1px solid ${C.isLight?'#E2E8F0':C.border}`,
    borderRadius:20,padding:22,
    boxShadow:glow?C.glow:C.isLight?'0 2px 12px rgba(0,0,0,.07)':`0 4px 16px rgba(0,0,0,.3)`,
    transition:'all .2s',...st}}>{children}</div>;
}

export function Modal({title,onClose,children,width=520}){
  const {theme:C} = useTheme();
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:300,
    display:'flex',alignItems:'center',justifyContent:'center'}}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:C.isLight?'#fff':C.card,
      border:`1px solid ${C.isLight?'#E2E8F0':C.border}`,borderRadius:20,
      width,maxWidth:'95vw',maxHeight:'90vh',overflow:'auto',
      boxShadow:'0 40px 100px rgba(0,0,0,.3)'}}>
      <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.isLight?'#E2E8F0':C.border}`,
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontWeight:800,fontSize:16,fontFamily:C.fontDisplay,color:C.text}}>{title}</div>
        <button onClick={onClose} style={{background:'none',border:'none',
          color:C.sub,fontSize:24,cursor:'pointer',lineHeight:1}}>×</button>
      </div>
      <div style={{padding:22}}>{children}</div>
    </div>
  </div>;
}

export function Confirm({msg,onOk,onCancel}){
  return <Modal title="Confirmer" onClose={onCancel} width={380}>
    <p style={{fontSize:14,marginBottom:20,color:'#64748B'}}>{msg}</p>
    <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
      <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
      <Btn variant="danger" onClick={onOk}>Confirmer</Btn>
    </div>
  </Modal>;
}

export function StatCard({icon,label,value,sub,color}){
  const {theme:C} = useTheme();
  const col = color||C.accent;
  const isLight = C.isLight;
  const gradient = isLight
    ? `linear-gradient(135deg,${col}15,${col}08)`
    : `linear-gradient(135deg,${col}20,${col}08)`;
  return <div style={{background:gradient,border:`1px solid ${col}30`,borderRadius:20,
    padding:22,position:'relative',overflow:'hidden',
    boxShadow:`0 4px 16px ${col}15`,cursor:'default',transition:'all .2s'}}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 24px ${col}25`;}}
    onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 4px 16px ${col}15`;}}>
    <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,
      borderRadius:'50%',background:col+'18'}}/>
    <div style={{fontSize:24,marginBottom:10}}>{icon}</div>
    <div style={{color:C.sub,fontSize:10,fontWeight:700,letterSpacing:1,
      textTransform:'uppercase',marginBottom:4}}>{label}</div>
    <div style={{color:isLight?'#1E293B':C.text,fontSize:22,fontWeight:900,letterSpacing:-.5,
      fontFamily:C.fontDisplay}}>{value}</div>
    {sub&&<div style={{color:col,fontSize:11,marginTop:4,fontWeight:600}}>{sub}</div>}
  </div>;
}

export function Loader(){
  const {theme:C} = useTheme();
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:60,color:C.sub}}>
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:28,marginBottom:10}}>⏳</div>
      <div style={{fontSize:13}}>Chargement...</div>
    </div>
  </div>;
}

export function PageHeader({title,sub,children}){
  const {theme:C} = useTheme();
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
    <div>
      <h2 style={{margin:0,fontWeight:900,fontSize:22,letterSpacing:-.5,
        fontFamily:C.fontDisplay,color:C.text}}>{title}</h2>
      {sub&&<div style={{color:C.sub,fontSize:13,marginTop:3}}>{sub}</div>}
    </div>
    <div style={{display:'flex',gap:8}}>{children}</div>
  </div>;
}

export function TableWrap({headers,children,empty='Aucune donnée'}){
  const {theme:C} = useTheme();
  return <Card style={{padding:0,overflow:'hidden'}}>
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr style={{background:C.isLight?'#F8FAFC':'#0A0D18'}}>
        {headers.map(h=><th key={h} style={{padding:'12px 16px',textAlign:'left',
          color:C.muted,fontSize:10,fontWeight:800,letterSpacing:1,
          textTransform:'uppercase',borderBottom:`2px solid ${C.isLight?'#E2E8F0':C.border}`}}>{h}</th>)}
      </tr></thead>
      <tbody>{children}</tbody>
    </table>
    {!children||children.length===0
      ?<div style={{textAlign:'center',padding:40,color:C.sub}}>{empty}</div>:null}
  </Card>;
}

export function TR({children,i=0,onClick}){
  const {theme:C} = useTheme();
  const base = i%2===0?'transparent':C.isLight?'#F8FAFC':'#ffffff03';
  return <tr onClick={onClick} style={{borderBottom:`1px solid ${C.isLight?'#F1F5F9':C.border}`,
    background:base,cursor:onClick?'pointer':'default',transition:'background .1s'}}
    onMouseEnter={e=>{ e.currentTarget.style.background=C.isLight?'#EFF6FF':C.accentLo+'40'; }}
    onMouseLeave={e=>{ e.currentTarget.style.background=base; }}>
    {children}
  </tr>;
}

export function TD({children,style:st}){
  const {theme:C} = useTheme();
  return <td style={{padding:'13px 16px',fontSize:15,color:C.text,...st}}>{children}</td>;
}

export function MiniChart({data=[]}){
  const {theme:C} = useTheme();
  if(!data.length) return null;
  const max=Math.max(...data.map(d=>d.total),1);
  return <div style={{display:'flex',gap:5,alignItems:'flex-end',height:72}}>
    {data.map((d,i)=><div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
      <div style={{width:'100%',
        height:`${Math.max(4,Math.round((d.total/max)*64))}px`,
        background:i===data.length-1?C.accentGrad:`linear-gradient(180deg,${C.accent}60,${C.accent}25)`,
        borderRadius:'4px 4px 0 0',transition:'height .3s'}}/>
      <span style={{color:C.muted,fontSize:9}}>{d.label}</span>
    </div>)}
  </div>;
}

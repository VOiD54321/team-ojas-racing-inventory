'use client';

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Box, ChevronDown, Edit3, Eye, MapPin, Package, Plus,
  Search, Settings, ShieldCheck, Trash2, Wrench, X, Sun, Moon,
  Users, LayoutDashboard, ImagePlus, RefreshCw, LogOut, Lock, Mail, KeyRound, UserPlus
} from "lucide-react";
import { supabase } from "../lib/supabase";

type Status = "Free" | "In Use" | "Out of Stock";
type Category = { id: string; name: string };
type Role = "Admin" | "Team Member" | "Viewer";
type Profile = { id: string; full_name: string | null; role: Role };
type Part = {
  id: string; name: string; category: string; quantity: number;
  location: string; status: Status; condition: string; notes: string; image?: string;
};

const seed: Part[] = [
  {id:"BRK-CAL-001",name:"Front Brake Caliper",category:"Brakes",quantity:4,location:"Rack B / Shelf 2",status:"Free",condition:"Good",notes:"Front axle caliper set."},
  {id:"BRK-DIS-002",name:"Brake Disc (Front)",category:"Brakes",quantity:2,location:"Rack B / Shelf 1",status:"In Use",condition:"Good",notes:"Current race setup."},
  {id:"SUS-DMP-003",name:"Suspension Damper",category:"Suspension",quantity:6,location:"Rack A / Shelf 3",status:"Free",condition:"Good",notes:"Front and rear dampers."},
  {id:"EXH-MAN-004",name:"Exhaust Manifold",category:"Engine",quantity:1,location:"Engine Bay Shelf",status:"In Use",condition:"Good",notes:"Current engine package."},
  {id:"ECU-001",name:"Engine Control Unit",category:"Electrical",quantity:1,location:"Electronics Box",status:"Out of Stock",condition:"Needs Repair",notes:"Replacement required."},
  {id:"WHL-RIM-006",name:"Wheel Rim (OZ)",category:"Wheels",quantity:4,location:"Rack C / Shelf 1",status:"Free",condition:"Good",notes:"Race wheel set."},
  {id:"AERO-FW-007",name:"Front Wing Element",category:"Aerodynamics",quantity:2,location:"Aero Rack",status:"Free",condition:"Good",notes:"Spare aerodynamic element."},
  {id:"FAS-BLT-008",name:"M6x20 Bolt",category:"Fasteners",quantity:50,location:"Fastener Drawer 1",status:"Free",condition:"New",notes:"General assembly hardware."}
];
const defaultCats = ["Engine","Transmission","Suspension","Brakes","Electrical","Aerodynamics","Wheels","Fasteners","Other"];

export default function Home() {
  const [items,setItems] = useState<Part[]>([]);
  const [categories,setCategories] = useState<Category[]>([]);
  const [page,setPage] = useState("Dashboard");
  const [query,setQuery] = useState("");
  const [cat,setCat] = useState("All Categories");
  const [status,setStatus] = useState("All Status");
  const [viewMode,setViewMode] = useState<"table"|"grid">("table");
  const [dark,setDark] = useState(true);
  const [adding,setAdding] = useState(false);
  const [editing,setEditing] = useState<Part|null>(null);
  const [detail,setDetail] = useState<Part|null>(null);
  const [newCat,setNewCat] = useState("");
  const [editingCat,setEditingCat] = useState<string|null>(null);
  const [catName,setCatName] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [session,setSession] = useState<any>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authMode,setAuthMode] = useState<"login"|"signup">("login");
  const [authEmail,setAuthEmail] = useState("");
  const [authPassword,setAuthPassword] = useState("");
  const [authName,setAuthName] = useState("");
  const [authBusy,setAuthBusy] = useState(false);
  const [authMessage,setAuthMessage] = useState("");
  const [members,setMembers] = useState<Profile[]>([]);

  useEffect(()=>{
    const saved=localStorage.getItem("ojas-theme");
    if(saved) setDark(saved!=="light");

    let alive=true;

    // Mobile browsers can occasionally leave the Supabase auth lock/session
    // waiting indefinitely. Never let that keep the whole app on the loading
    // screen forever.
    const timeout = window.setTimeout(()=>{
      if(alive) {
        setAuthLoading(false);
        setError(prev => prev || "Authentication is taking too long. You can still sign in below.");
      }
    }, 8000);

    supabase.auth.getSession()
      .then(({data, error:e})=>{
        if(!alive) return;
        window.clearTimeout(timeout);
        if(e) setError(e.message);
        setSession(data.session);
        setAuthLoading(false);

        // Load the profile outside the auth callback so mobile browsers do not
        // deadlock on Supabase's internal auth lock.
        if(data.session) {
          loadProfile(data.session.user.id);
        }
      })
      .catch((e:any)=>{
        if(!alive) return;
        window.clearTimeout(timeout);
        setError(e?.message || "Could not initialize authentication.");
        setAuthLoading(false);
      });

    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      if(!alive) return;
      setSession(next);
      setAuthLoading(false);

      // IMPORTANT: do not await Supabase queries inside onAuthStateChange.
      // Doing so can deadlock the auth lock in some mobile browsers.
      if(next) {
        window.setTimeout(()=>{ if(alive) loadProfile(next.user.id); }, 0);
      } else {
        setProfile(null);
        setItems([]);
        setCategories([]);
      }
    });

    return ()=>{
      alive=false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  },[]);

  useEffect(()=>{
    if(!session)return;
    loadData();
    const channel=supabase.channel("ojas-inventory-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"parts"},()=>loadParts(false))
      .on("postgres_changes",{event:"*",schema:"public",table:"categories"},()=>loadCategories(false))
      .subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[session]);

  useEffect(()=>{localStorage.setItem("ojas-theme",dark?"dark":"light")},[dark]);

  async function loadProfile(userId:string){
    const {data,error:e}=await supabase.from("profiles").select("id,full_name,role").eq("id",userId).single();
    if(e){setError(e.message);return;}
    setProfile(data as Profile);
  }

  async function submitAuth(){
    setAuthBusy(true); setAuthMessage(""); setError("");
    if(!authEmail||!authPassword){setAuthMessage("Enter your email and password.");setAuthBusy(false);return;}
    if(authMode==="signup"&&!authName.trim()){setAuthMessage("Enter your name.");setAuthBusy(false);return;}
    if(authMode==="login") {
      const {error:e}=await supabase.auth.signInWithPassword({email:authEmail.trim(),password:authPassword});
      if(e)setAuthMessage(e.message);
    } else {
      const {data,error:e}=await supabase.auth.signUp({email:authEmail.trim(),password:authPassword,options:{data:{full_name:authName.trim()}}});
      if(e)setAuthMessage(e.message);
      else if(!data.session)setAuthMessage("Account created. Check your email to confirm your account, then sign in.");
    }
    setAuthBusy(false);
  }

  async function signOut(){await supabase.auth.signOut();setPage("Dashboard");setAuthMessage("");}

  const role=profile?.role||"Viewer";
  const canWrite=role!=="Viewer";
  const isAdmin=role==="Admin";


  async function loadData(){
    setLoading(true); setError("");
    const [catsRes,partsRes]=await Promise.all([
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("parts").select("part_id,name,quantity,location,status,condition,image_url,notes,category_id").order("created_at",{ascending:false})
    ]);
    if(catsRes.error||partsRes.error){setError(catsRes.error?.message||partsRes.error?.message||"Could not load Supabase data.");setLoading(false);return;}
    let cats=(catsRes.data||[]) as Category[];
    if(cats.length===0){
      const ins=await supabase.from("categories").insert(defaultCats.map(name=>({name}))).select("id,name");
      if(ins.error){setError(ins.error.message);setLoading(false);return;}
      cats=(ins.data||[]) as Category[];
    }
    setCategories(cats);
    const byId=new Map(cats.map(c=>[c.id,c.name]));
    let parts=mapParts(partsRes.data||[],byId);
    if(parts.length===0){
      const rows=seed.map(x=>({part_id:x.id,name:x.name,category_id:cats.find(c=>c.name===x.category)?.id||cats.find(c=>c.name==="Other")?.id||null,quantity:x.quantity,location:x.location,status:x.status,condition:x.condition,notes:x.notes,image_url:null}));
      const ins=await supabase.from("parts").insert(rows);
      if(ins.error){setError(ins.error.message);setLoading(false);return;}
      const fresh=await supabase.from("parts").select("part_id,name,quantity,location,status,condition,image_url,notes,category_id").order("created_at",{ascending:false});
      parts=mapParts(fresh.data||[],byId);
    }
    setItems(parts); setLoading(false);
  }
  async function loadParts(show=true){
    if(show)setLoading(true);
    const {data,error:e}=await supabase.from("parts").select("part_id,name,quantity,location,status,condition,image_url,notes,category_id").order("created_at",{ascending:false});
    if(e){setError(e.message)} else {const byId=new Map(categories.map(c=>[c.id,c.name]));setItems(mapParts(data||[],byId));}
    if(show)setLoading(false);
  }
  async function loadCategories(show=true){
    if(show)setLoading(true);
    const {data,error:e}=await supabase.from("categories").select("id,name").order("name");
    if(e){setError(e.message)} else setCategories((data||[]) as Category[]);
    if(show)setLoading(false);
  }

  const filtered = useMemo(()=>items.filter(p=>
    (!query || [p.name,p.id,p.location,p.category].some(v=>v.toLowerCase().includes(query.toLowerCase()))) &&
    (cat==="All Categories" || p.category===cat) &&
    (status==="All Status" || p.status===status)
  ),[items,query,cat,status]);
  const totals = {
    parts: items.reduce((n,p)=>n+p.quantity,0),
    free: items.filter(p=>p.status==="Free").reduce((n,p)=>n+p.quantity,0),
    inUse: items.filter(p=>p.status==="In Use").reduce((n,p)=>n+p.quantity,0),
    out: items.filter(p=>p.status==="Out of Stock").length
  };

  async function savePart(p:Part){
    if(!canWrite)return;
    setSaving(true); setError("");
    const categoryId=categories.find(c=>c.name===p.category)?.id||null;
    let imageUrl=p.image||null;
    if(p.image?.startsWith("data:")){
      try{
        const match=p.image.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if(match){
          const mime=match[1],base64=match[2],ext=(mime.split("/")[1]||"jpg").replace("jpeg","jpg");
          const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
          const path=`${p.id.toLowerCase()}-${Date.now()}.${ext}`;
          const up=await supabase.storage.from("part-images").upload(path,bytes,{contentType:mime,upsert:false});
          if(up.error) throw up.error;
          imageUrl=supabase.storage.from("part-images").getPublicUrl(path).data.publicUrl;
        }
      }catch(e:any){setError(`Image upload failed: ${e.message||"Storage is not configured yet."}`);setSaving(false);return;}
    }
    const row={part_id:p.id,name:p.name,category_id:categoryId,quantity:p.quantity,location:p.location,status:p.status,condition:p.condition,image_url:imageUrl,notes:p.notes};
    const res=editing?await supabase.from("parts").update(row).eq("part_id",p.id):await supabase.from("parts").insert(row);
    if(res.error){setError(res.error.message);setSaving(false);return;}
    await loadParts(false); setAdding(false);setEditing(null);setDetail(null);setSaving(false);
  }
  async function deletePart(id:string){
    if(!canWrite)return;
    if(!confirm("Delete this part from inventory?"))return;
    const {error:e}=await supabase.from("parts").delete().eq("part_id",id);
    if(e)setError(e.message); else setItems(old=>old.filter(p=>p.id!==id));
  }
  async function addCategory(){
    if(!canWrite)return;
    const n=newCat.trim(); if(!n)return;
    if(categories.some(x=>x.name.toLowerCase()===n.toLowerCase()))return alert("That category already exists.");
    const {data,error:e}=await supabase.from("categories").insert({name:n}).select("id,name").single();
    if(e){setError(e.message);return;} setCategories(old=>[...old,data as Category]);setNewCat("");
  }
  async function renameCategory(oldName:string){
    if(!canWrite)return;
    const n=catName.trim(); if(!n||n===oldName){setEditingCat(null);return;}
    if(categories.some(x=>x.name!==oldName&&x.name.toLowerCase()===n.toLowerCase()))return alert("That category already exists.");
    const c=categories.find(x=>x.name===oldName); if(!c)return;
    const {error:e}=await supabase.from("categories").update({name:n}).eq("id",c.id);
    if(e){setError(e.message);return;}
    setCategories(old=>old.map(x=>x.id===c.id?{...x,name:n}:x));
    if(cat===oldName)setCat(n); setEditingCat(null);setCatName("");
  }
  async function removeCategory(name:string){
    if(!canWrite)return;
    const c=categories.find(x=>x.name===name); if(!c)return;
    const used=items.some(p=>p.category===name);
    if(!confirm(used?`"${name}" is used by parts. Delete it and move those parts to Other?`:`Delete "${name}"?`))return;
    if(used){
      const other=categories.find(x=>x.name==="Other"&&x.id!==c.id);
      if(!other){setError("The Other category is required when moving parts.");return;}
      const {error:e}=await supabase.from("parts").update({category_id:other.id}).eq("category_id",c.id);
      if(e){setError(e.message);return;}
    }
    const {error:e}=await supabase.from("categories").delete().eq("id",c.id);
    if(e){setError(e.message);return;}
    setCategories(old=>old.filter(x=>x.id!==c.id)); await loadParts(false); if(cat===name)setCat("All Categories");
  }

  async function loadMembers(){
    if(!isAdmin)return;
    const {data,error:e}=await supabase.from("profiles").select("id,full_name,role").order("full_name");
    if(e)setError(e.message); else setMembers((data||[]) as Profile[]);
  }
  async function changeRole(id:string,next:Role){
    if(!isAdmin)return;
    const {error:e}=await supabase.from("profiles").update({role:next}).eq("id",id);
    if(e)setError(e.message); else setMembers(old=>old.map(m=>m.id===id?{...m,role:next}:m));
  }
  const nav = [["Dashboard", LayoutDashboard],["Inventory", Package],["Categories", Box],["Maintenance", Wrench],["Team", Users]] as const;
  if(authLoading)return <div className="authscreen"><div className="authcard"><div className="authlogo"><img src="/ojas-logo.jpeg" alt="Team Ojas Racing"/></div><div className="eyebrow">TEAM OJAS RACING</div><h1>LOADING INVENTORY</h1><p>Connecting securely…</p></div></div>;
  if(!session)return <AuthScreen dark={dark} mode={authMode} setMode={setAuthMode} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} name={authName} setName={setAuthName} busy={authBusy} message={authMessage} onSubmit={submitAuth}/>;

  return <div className={dark?"app":"app light"}>
    <aside className="side">
      <div className="brand"><img src="/ojas-logo.jpeg" alt="Team Ojas Racing" className="logo"/><div><b>TEAM OJAS</b><small>RACING</small></div></div>
      <nav>{nav.map(([name,Icon])=><button key={name} className={page===name?"nav active":"nav"} onClick={()=>{setPage(name);setQuery("");setCat("All Categories");setStatus("All Status");if(name==="Team")loadMembers()}}><Icon size={18}/><span>{name}</span></button>)}</nav>
      <div className="sidebottom"><button className="nav"><ShieldCheck size={18}/><span>{role}</span></button><button className="nav" onClick={signOut}><LogOut size={18}/><span>LOG OUT</span></button><button className="theme-toggle" onClick={()=>setDark(v=>!v)}>{dark?<Sun size={17}/>:<Moon size={17}/>}<span>{dark?"LIGHT MODE":"DARK MODE"}</span><i className={dark?"switch on":"switch"}><b/></i></button><div className="user"><div>{(profile?.full_name||session.user.email||"U").slice(0,2).toUpperCase()}</div><span><b>{profile?.full_name||"Team Member"}</b><small>{role} · Ojas Racing</small></span></div></div>
    </aside>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {nav.map(([name,Icon])=>
        <button
          key={name}
          className={page===name ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={()=>{setPage(name);setQuery("");setCat("All Categories");setStatus("All Status");if(name==="Team")loadMembers()}}
        >
          <Icon size={20}/>
          <span>{name}</span>
        </button>
      )}
    </nav>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">TEAM OJAS RACING</div><h1>{page}</h1><p>{page==="Dashboard"?"Your parts, stock levels and availability at a glance.":"Manage car parts and equipment."}</p></div><div className="top-actions"><label className="global-search"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);if(page!=="Inventory")setPage("Inventory")}} placeholder="Search parts, ID, location..."/></label><button className="primary" disabled={!canWrite} onClick={()=>canWrite&&setAdding(true)}><Plus size={18}/> ADD PART</button></div></header>
      {error&&<div className="errorbar">{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}
      {loading?<div className="empty"><RefreshCw size={35} className="spin"/><h2>Connecting to Supabase…</h2><p>Loading the shared team inventory.</p></div>:<>
      {page==="Dashboard"&&<><div className="hero"><div><span>INVENTORY CONTROL</span><h2>BUILD. RACE. REPEAT.</h2><p>Know what you have before you head to the workshop.</p></div><div className="hero-lines"><i/><i/><i/></div></div><section className="stats"><Stat icon={<Package/>} label="TOTAL PARTS" value={totals.parts} tone="neutral"/><Stat icon={<span className="dot green"/>} label="FREE" value={totals.free} tone="green"/><Stat icon={<Wrench/>} label="IN USE" value={totals.inUse} tone="yellow"/><Stat icon={<span className="alert">!</span>} label="OUT OF STOCK" value={totals.out} tone="red"/></section><div className="section-title"><div><h2>Inventory</h2><small>Recently added and updated parts</small></div><button className="ghost" onClick={()=>setPage("Inventory")}>VIEW ALL →</button></div><PartTable parts={items.slice(0,8)} onDetail={setDetail} onEdit={setEditing} onDelete={deletePart} canWrite={canWrite}/></>}
      {page==="Inventory"&&<><div className="inventory-head"><div><h2>All Parts</h2><small>{filtered.length} part types shown</small></div><div className="view-pill" role="group" aria-label="Inventory view"><button type="button" className={viewMode==="table"?"active":""} onClick={()=>setViewMode("table")}>TABLE</button><button type="button" className={viewMode==="grid"?"active":""} onClick={()=>setViewMode("grid")}>GRID</button></div></div><div className="filters"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search parts..."/></label><Select value={cat} set={setCat} options={["All Categories",...categories.map(c=>c.name)]}/><Select value={status} set={setStatus} options={["All Status","Free","In Use","Out of Stock"]}/></div>{viewMode==="table"?<PartTable parts={filtered} onDetail={setDetail} onEdit={setEditing} onDelete={deletePart} canWrite={canWrite}/>:<PartGrid parts={filtered} onDetail={setDetail} onEdit={setEditing} onDelete={deletePart} canWrite={canWrite}/>}</>}
      {page==="Categories"&&<CategoriesPage categories={categories} items={items} newCat={newCat} setNewCat={setNewCat} addCategory={addCategory} editingCat={editingCat} setEditingCat={setEditingCat} catName={catName} setCatName={setCatName} renameCategory={renameCategory} removeCategory={removeCategory} setPage={setPage} setCat={setCat} setQuery={setQuery} setStatus={setStatus} canWrite={canWrite}/>}
      {page==="Maintenance"&&<div className="empty"><Wrench size={40}/><h2>Maintenance</h2><p>Maintenance tracking can be added here next.</p></div>}
      {page==="Team"&&<TeamPage members={members} isAdmin={isAdmin} loadMembers={loadMembers} changeRole={changeRole} profile={profile}/>}
      </>}
    </main>
    {(adding||editing)&&<Form part={editing} categories={categories.map(c=>c.name)} saving={saving} onSave={savePart} onClose={()=>{setAdding(false);setEditing(null)}}/>}
    {detail&&<Details part={detail} onClose={()=>setDetail(null)} onEdit={()=>{setEditing(detail);setDetail(null)}} onDelete={()=>{deletePart(detail.id);setDetail(null)}}/>}
  </div>
}

function mapParts(rows:any[],byId:Map<string,string>):Part[]{return rows.map(r=>({id:r.part_id,name:r.name,category:byId.get(r.category_id)||"Other",quantity:r.quantity,location:r.location||"",status:r.status as Status,condition:r.condition||"New",notes:r.notes||"",image:r.image_url||undefined}));}
function Stat({icon,label,value,tone}:{icon:React.ReactNode,label:string,value:number,tone:string}){return <div className={"stat "+tone}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>}
function Select({value,set,options}:{value:string,set:(v:string)=>void,options:string[]}){return <label className="select"><select value={value} onChange={e=>set(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select><ChevronDown size={15}/></label>}
function PartGrid({parts,onDetail,onEdit,onDelete,canWrite}:{parts:Part[],onDetail:(p:Part)=>void,onEdit:(p:Part)=>void,onDelete:(id:string)=>void,canWrite:boolean}){return <div className="part-grid">{parts.map(p=><article className="part-card" key={p.id} onClick={()=>onDetail(p)}><div className="part-card-image">{p.image?<img src={p.image} alt=""/>:<Package size={32}/>}<em className={"s "+p.status.replaceAll(" ","-").toLowerCase()}><i/>{p.status}</em></div><div className="part-card-body"><div className="part-card-title"><div><b>{p.name}</b><small>{p.id}</small></div><span>{p.quantity}</span></div><div className="part-card-meta"><span className="catbadge">{p.category}</span><span className="loc"><MapPin size={13}/>{p.location||"No location"}</span></div><small className="condition">{p.condition}</small></div><div className="part-card-actions" onClick={e=>e.stopPropagation()}><button title="View" onClick={()=>onDetail(p)}><Eye size={15}/> VIEW</button><button title="Edit" disabled={!canWrite} onClick={()=>canWrite&&onEdit(p)}><Edit3 size={15}/> EDIT</button><button title="Delete" disabled={!canWrite} onClick={()=>canWrite&&onDelete(p.id)}><Trash2 size={15}/></button></div></article>)}{parts.length===0&&<div className="empty small grid-empty"><Package size={30}/><b>No parts found</b><span>Try changing your search or filters.</span></div>}</div>}
function PartTable({parts,onDetail,onEdit,onDelete,canWrite}:{parts:Part[],onDetail:(p:Part)=>void,onEdit:(p:Part)=>void,onDelete:(id:string)=>void,canWrite:boolean}){return <div className="tablebox"><table><thead><tr><th>IMAGE</th><th>PART NAME</th><th>PART ID</th><th>CATEGORY</th><th>QTY</th><th>LOCATION</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{parts.map(p=><tr key={p.id}><td onClick={()=>onDetail(p)}><div className="pic">{p.image?<img src={p.image} alt=""/>:<Package size={20}/>}</div></td><td onClick={()=>onDetail(p)}><div className="partname"><b>{p.name}</b><small>{p.condition}</small></div></td><td onClick={()=>onDetail(p)}>{p.id}</td><td onClick={()=>onDetail(p)}><span className="catbadge">{p.category}</span></td><td onClick={()=>onDetail(p)}><b>{p.quantity}</b></td><td onClick={()=>onDetail(p)}><span className="loc"><MapPin size={14}/>{p.location}</span></td><td onClick={()=>onDetail(p)}><em className={"s "+p.status.replaceAll(" ","-").toLowerCase()}><i/>{p.status}</em></td><td><div className="rowactions"><button title="View" onClick={()=>onDetail(p)}><Eye size={15}/></button><button title="Edit" disabled={!canWrite} onClick={()=>canWrite&&onEdit(p)}><Edit3 size={15}/></button><button title="Delete" disabled={!canWrite} onClick={()=>canWrite&&onDelete(p.id)}><Trash2 size={15}/></button></div></td></tr>)}{parts.length===0&&<tr><td colSpan={8}><div className="empty small"><Package size={30}/><b>No parts found</b><span>Try changing your search or filters.</span></div></td></tr>}</tbody></table></div>}
function CategoriesPage({categories,items,newCat,setNewCat,addCategory,editingCat,setEditingCat,catName,setCatName,renameCategory,removeCategory,setPage,setCat,setQuery,setStatus,canWrite}:any){return <div className="categories-page"><div className="category-add"><div><h2>Categories</h2><small>Organize your parts your way.</small></div><div className="addcat"><input value={newCat} onChange={(e:any)=>setNewCat(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&addCategory()} placeholder="New category"/><button className="primary" disabled={!canWrite} onClick={addCategory}><Plus size={16}/> ADD</button></div></div><div className="category-grid">{categories.map((c:any)=><div className="category-card" key={c.id}><button className="category-main" onClick={()=>{setPage("Inventory");setCat(c.name);setQuery("");setStatus("All Status")}}><div className="cat-icon"><Box size={22}/></div>{editingCat===c.name?<div className="rename" onClick={e=>e.stopPropagation()}><input autoFocus value={catName} onChange={(e:any)=>setCatName(e.target.value)} onKeyDown={(e:any)=>{if(e.key==="Enter")renameCategory(c.name);if(e.key==="Escape")setEditingCat(null)}}/><button onClick={()=>renameCategory(c.name)}>✓</button><button onClick={()=>setEditingCat(null)}>×</button></div>:<><b>{c.name}</b><span>{items.filter((p:Part)=>p.category===c.name).length} part types</span><em>VIEW PARTS →</em></>}</button><div className="cat-actions">{canWrite&&editingCat!==c.name&&<button onClick={()=>{setEditingCat(c.name);setCatName(c.name)}}><Edit3 size={13}/> RENAME</button>}{canWrite&&<button onClick={()=>removeCategory(c.name)}><Trash2 size={13}/> DELETE</button>}</div></div>)}</div></div>}
function Form({part,categories,saving,onSave,onClose}:{part:Part|null,categories:string[],saving:boolean,onSave:(p:Part)=>void,onClose:()=>void}){const [p,setP]=useState<Part>(part||{id:"",name:"",category:categories[0]||"Other",quantity:1,location:"",status:"Free",condition:"New",notes:""});const [image,setImage]=useState(p.image||"");const change=(k:keyof Part,v:any)=>setP({...p,[k]:k==="quantity"?Number(v):v});function upload(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;if(f.size>1500000)return alert("Please use an image smaller than 1.5 MB.");const r=new FileReader();r.onload=()=>setImage(String(r.result));r.readAsDataURL(f)}return <Modal title={part?"EDIT PART":"ADD PART"} close={onClose}><div className="formgrid"><label className="image-upload">PART IMAGE<input type="file" accept="image/*" onChange={upload}/><div>{image?<img src={image} alt="Preview"/>:<><ImagePlus size={22}/><span>UPLOAD IMAGE</span></>}</div></label><div className="formfields"><label>Part ID<input value={p.id} disabled={!!part} placeholder="BRK-CAL-001" onChange={e=>change("id",e.target.value)}/></label><label>Part Name<input value={p.name} placeholder="Front Brake Caliper" onChange={e=>change("name",e.target.value)}/></label><label>Category<select value={p.category} onChange={e=>change("category",e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>Quantity<input type="number" min="0" value={p.quantity} onChange={e=>change("quantity",e.target.value)}/></label><label>Location<input value={p.location} placeholder="Rack B / Shelf 2" onChange={e=>change("location",e.target.value)}/></label><label>Status<select value={p.status} onChange={e=>change("status",e.target.value)}><option>Free</option><option>In Use</option><option>Out of Stock</option></select></label><label>Condition<select value={p.condition} onChange={e=>change("condition",e.target.value)}><option>New</option><option>Good</option><option>Needs Repair</option><option>Damaged</option></select></label></div><label className="wide">Notes<textarea value={p.notes} placeholder="Specifications, fitment, remarks..." onChange={e=>change("notes",e.target.value)}/></label></div><div className="modalfoot"><button className="ghost" onClick={onClose}>CANCEL</button><button className="primary" disabled={!p.id||!p.name||saving} onClick={()=>onSave({...p,image})}>{saving?"SAVING…":part?"SAVE CHANGES":"ADD TO INVENTORY"}</button></div></Modal>}
function Details({part,onClose,onEdit,onDelete}:{part:Part,onClose:()=>void,onEdit:()=>void,onDelete:()=>void}){return <Modal title="PART DETAILS" close={onClose}><div className="detailtop"><div className="detailpic">{part.image?<img src={part.image} alt=""/>:<Package size={45}/>}</div><div><h2>{part.name}</h2><span>{part.id}</span></div></div><div className="detailgrid"><D l="CATEGORY" v={part.category}/><D l="QUANTITY" v={String(part.quantity)}/><D l="LOCATION" v={part.location}/><D l="STATUS" v={part.status}/><D l="CONDITION" v={part.condition}/></div><div className="notes"><b>NOTES</b><p>{part.notes||"No notes added."}</p></div><div className="modalfoot"><button className="danger" onClick={onDelete}><Trash2 size={15}/> DELETE</button><button className="primary" onClick={onEdit}><Edit3 size={15}/> EDIT PART</button></div></Modal>}
function D({l,v}:{l:string,v:string}){return <div><span>{l}</span><b>{v}</b></div>}
function AuthScreen({dark,mode,setMode,email,setEmail,password,setPassword,name,setName,busy,message,onSubmit}:{dark:boolean,mode:"login"|"signup",setMode:(v:"login"|"signup")=>void,email:string,setEmail:(v:string)=>void,password:string,setPassword:(v:string)=>void,name:string,setName:(v:string)=>void,busy:boolean,message:string,onSubmit:()=>void}){return <div className={dark?"authscreen":"authscreen lightauth"}><div className="authcard"><img src="/ojas-logo.jpeg" alt="Team Ojas Racing" className="authlogoimg"/><div className="eyebrow">TEAM OJAS RACING</div><h1>{mode==="login"?"TEAM LOGIN":"JOIN THE TEAM"}</h1><p>{mode==="login"?"Sign in to access the shared inventory.":"Create your team account. New accounts start as Team Member."}</p>{mode==="signup"&&<label className="authfield"><span>NAME</span><div><UserPlus size={17}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></div></label>}<label className="authfield"><span>EMAIL</span><div><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label><label className="authfield"><span>PASSWORD</span><div><KeyRound size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&onSubmit()}/></div></label>{message&&<div className="authmessage">{message}</div>}<button className="primary authsubmit" disabled={busy} onClick={onSubmit}>{busy?"PLEASE WAIT…":mode==="login"?"SIGN IN":"CREATE ACCOUNT"}</button><button className="authswitch" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Need an account? Create one":"Already have an account? Sign in"}</button><small className="authnote"><Lock size={12}/> Secured by Supabase Auth</small></div></div>}

function TeamPage({members,isAdmin,loadMembers,changeRole,profile}:{members:Profile[],isAdmin:boolean,loadMembers:()=>void,changeRole:(id:string,next:Role)=>void,profile:Profile|null}){useEffect(()=>{loadMembers()},[isAdmin]);return <div className="team-page"><div className="team-head"><div><h2>Team Access</h2><small>Manage who can view and edit the shared inventory.</small></div><button className="ghost" onClick={loadMembers}>REFRESH</button></div><div className="role-note"><ShieldCheck size={20}/><div><b>{profile?.role}</b><span>Admin can manage roles. Team Members can add and edit inventory. Viewers have read-only access.</span></div></div><div className="members-list">{members.map(m=><div className="member-row" key={m.id}><div className="member-avatar">{(m.full_name||"U").slice(0,2).toUpperCase()}</div><div className="member-info"><b>{m.full_name||"Unnamed member"}</b><small>{m.id===profile?.id?"You":"Team account"}</small></div>{isAdmin?<select value={m.role} onChange={e=>changeRole(m.id,e.target.value as Role)}><option>Admin</option><option>Team Member</option><option>Viewer</option></select>:<span className="role-pill">{m.role}</span>}</div>)}{members.length===0&&<div className="empty small"><Users size={30}/><b>No team accounts found</b></div>}</div></div>}

function Modal({title,close,children}:{title:string,close:()=>void,children:React.ReactNode}){return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal"><div className="modalhead"><b>{title}</b><button onClick={close}><X size={19}/></button></div>{children}</div></div>}

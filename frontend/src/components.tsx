import { AnimatePresence, motion } from "framer-motion";
import { Bell, BookOpenCheck, BriefcaseBusiness, ChevronRight, ClipboardList, FileCheck2, Gauge, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Sparkles, Target, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth";

export const roleHome: Record<string,string> = { student: "/student/dashboard", mentor: "/mentor/dashboard", placement: "/placement/dashboard", admin: "/admin/dashboard" };

export function Protected({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />;
  return <Outlet />;
}

const links: Record<string, {label:string;to:string;icon:any}[]> = {
  student: [
    { label:"Overview", to:"/student/dashboard", icon:LayoutDashboard }, { label:"My profile", to:"/student/profile", icon:Users },
    { label:"Skills", to:"/student/skills", icon:Sparkles }, { label:"Evidence", to:"/student/evidence", icon:FileCheck2 },
    { label:"Career roles", to:"/student/roles", icon:BriefcaseBusiness }, { label:"Gap analysis", to:"/student/gap-analysis", icon:Target },
    { label:"My roadmap", to:"/student/roadmap", icon:BookOpenCheck }, { label:"Reports", to:"/student/reports", icon:ClipboardList }
  ],
  mentor: [{ label:"Overview",to:"/mentor/dashboard",icon:LayoutDashboard },{ label:"My students",to:"/mentor/students",icon:Users }],
  placement: [{ label:"Overview",to:"/placement/dashboard",icon:LayoutDashboard },{ label:"Analytics",to:"/placement/analytics",icon:Gauge },{ label:"Students",to:"/placement/students",icon:Users }],
  admin: [{ label:"Overview",to:"/admin/dashboard",icon:LayoutDashboard },{ label:"Users",to:"/admin/users",icon:Users },{ label:"Career roles",to:"/admin/roles",icon:BriefcaseBusiness },{ label:"Audit logs",to:"/admin/audit-logs",icon:ShieldCheck }]
};

export function AppLayout() {
  const { user, logout } = useAuth(); const [open,setOpen]=useState(false);
  const sidebar = <div className="flex h-full flex-col bg-[#0c1830] px-4 py-5 text-slate-300">
    <div className="mb-8 flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500 text-white"><GraduationCap/></div><div><b className="font-[Manrope] text-lg text-white">SGIP</b><p className="text-[10px] uppercase tracking-[.18em] text-blue-300">Career Intelligence</p></div></div>
    <nav className="flex-1 space-y-1">{links[user.role].map(item=><NavLink key={item.to} to={item.to} onClick={()=>setOpen(false)} className={({isActive})=>`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive?"bg-blue-600 text-white shadow-lg shadow-blue-950/20":"hover:bg-white/5 hover:text-white"}`}><item.icon size={18}/>{item.label}</NavLink>)}</nav>
    <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white"><LogOut size={18}/> Sign out</button>
  </div>;
  return <div className="min-h-screen bg-[#f7f9fc]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
    <AnimatePresence>{open&&<><motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" onClick={()=>setOpen(false)}/><motion.aside initial={{x:-280}} animate={{x:0}} exit={{x:-280}} className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden">{sidebar}<button className="absolute right-3 top-3 text-white" onClick={()=>setOpen(false)}><X/></button></motion.aside></>}</AnimatePresence>
    <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur md:px-8">
      <button className="lg:hidden" onClick={()=>setOpen(true)}><Menu/></button>
      <div className="hidden md:block"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Skill Gap Intelligence Platform</p></div>
      <div className="flex items-center gap-3"><button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100"><Bell size={19}/><i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500"/></button><div className="h-8 w-px bg-slate-200"/><div className="text-right"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs capitalize text-slate-500">{user.role}</p></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">{user.name[0]}</div></div>
    </header><main className="mx-auto max-w-[1500px] p-4 md:p-8"><Outlet/></main></div>
  </div>;
}

export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:ReactNode}) {
  return <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div>{eyebrow&&<p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-blue-600">{eyebrow}</p>}<h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{title}</h1>{description&&<p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}</div>{action}</div>;
}
export function Stat({label,value,detail,icon:Icon,tone="blue"}:any) {
  const colors:any={blue:"bg-blue-50 text-blue-600",emerald:"bg-emerald-50 text-emerald-600",amber:"bg-amber-50 text-amber-600",violet:"bg-violet-50 text-violet-600"};
  return <div className="card"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div><div className={`rounded-xl p-3 ${colors[tone]}`}><Icon size={21}/></div></div></div>;
}
export const ScoreRing=({value,size=132}:{value:number;size?:number})=><div className="relative grid place-items-center" style={{width:size,height:size}}><svg className="-rotate-90" width={size} height={size}><circle cx={size/2} cy={size/2} r={size/2-9} fill="none" stroke="#e8edf5" strokeWidth="10"/><circle cx={size/2} cy={size/2} r={size/2-9} fill="none" stroke="url(#score)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(value/100)*Math.PI*(size-18)} ${Math.PI*(size-18)}`}/><defs><linearGradient id="score"><stop stopColor="#2563eb"/><stop offset="1" stopColor="#10b981"/></linearGradient></defs></svg><div className="absolute text-center"><b className="text-3xl">{value}%</b><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ready</p></div></div>;
export const Loading=()=> <div className="grid min-h-[300px] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"/></div>;
export const Empty=({title,text,action}:{title:string;text:string;action?:ReactNode})=><div className="card grid min-h-64 place-items-center text-center"><div><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Sparkles/></div><h3 className="text-lg font-bold">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{text}</p>{action&&<div className="mt-5">{action}</div>}</div></div>;
export const ErrorText=({error}:{error:any})=><p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error?.response?.data?.message||error?.message||"Something went wrong"}</p>;
export const NextLink=({to,children}:{to:string;children:ReactNode})=><NavLink to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">{children}<ChevronRight size={16}/></NavLink>;

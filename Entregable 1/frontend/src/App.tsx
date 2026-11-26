import { useState } from 'react'
import { Landing } from './pages/public/Landing'
import { Login } from './pages/public/Login'
import { Workspace } from './pages/Workspace'
import type { Session } from './types/session'
export default function App(){
 const [screen,setScreen]=useState<'landing'|'login'|'workspace'>('landing')
 const [session,setSession]=useState<Session|null>(null)
 const enterPreview=()=>{setSession(null);setScreen('workspace')}
 return screen==='landing'?<Landing onLogin={()=>setScreen('login')} onPreview={enterPreview}/>:screen==='login'?<Login onBack={()=>setScreen('landing')} onPreview={enterPreview} onSuccess={value=>{setSession(value);setScreen('workspace')}}/>:<Workspace session={session} onExit={()=>{setSession(null);setScreen('landing')}}/>
}


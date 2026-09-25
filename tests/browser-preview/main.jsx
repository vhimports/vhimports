import React from 'react'
import { createRoot } from 'react-dom/client'
import { Dashboard } from '../../src/app/Dashboard'
import { failNextSummary } from './fixture'
import '../../src/styles.css'
import '../../src/modules.css'

createRoot(document.getElementById('root')).render(<><div style={{ position: 'fixed', bottom: 0, left: 0, zIndex: 1000, background: '#fff4be', padding: 8, fontSize: 12 }}>QA ISOLADO · dados fictícios · sem acesso ao Supabase <button onClick={failNextSummary}>Simular falha do painel</button></div><Dashboard session={{ user: { id: 'master-test' } }} /></>)


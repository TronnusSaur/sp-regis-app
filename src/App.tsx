import { useState, useEffect } from 'react'
import { LayoutGrid, Plus, LayoutList, Map as MapIcon, WifiOff, LogOut, AlertTriangle } from 'lucide-react'
import { registerAutoSync } from './lib/syncService'
import { getPendingItems } from './lib/robustStore'
import { onAuthChange, signOut, type AppUser } from './lib/firebase'
import { apiFetch } from './lib/apiFetch'
import MetricsScreen from './screens/MetricsScreen'
import FormScreen from './screens/FormScreen'
import LogScreen from './screens/LogScreen'
import MapScreen from './screens/MapScreen'
import LoginScreen from './screens/LoginScreen'

type Tab = 'MAPA' | 'NUEVO' | 'BITACORA' | 'METRICAS'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('METRICAS')
  const [pendingCount, setPendingCount] = useState(0)
  const [user, setUser] = useState<AppUser | null>(null)
  const [userProfile, setUserProfile] = useState<{role: string, assignments: string[]} | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState<number>(0)
  const [filterCorrectionsActive, setFilterCorrectionsActive] = useState<boolean>(false)

  // Listen to auth state (auto-restores from cache, works offline)
  useEffect(() => {
    const unsubscribe = onAuthChange((appUser) => {
      setUser(appUser)
      if (!appUser) {
        setUserProfile(null)
      }
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const fetchPendingCorrections = async () => {
    try {
      const res = await apiFetch('/api/corrections')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setPendingCorrectionsCount(data.length)
        }
      }
    } catch {
      // offline or silent
    }
  }

  // Check pending corrections periodically and on custom sync events
  useEffect(() => {
    if (!user) return
    fetchPendingCorrections()
    const interval = setInterval(fetchPendingCorrections, 4000)
    
    const handleSync = () => {
      fetchPendingCorrections()
    }
    window.addEventListener('sp-regis-corrections-updated', handleSync)

    return () => {
      clearInterval(interval)
      window.removeEventListener('sp-regis-corrections-updated', handleSync)
    }
  }, [user])

  // Initialize sync & pending count only when authenticated
  useEffect(() => {
    if (!user) return

    async function initApp() {
      try {
        // Fetch extended profile (role/assignments)
        import('./lib/apiFetch').then(({ apiFetch }) => {
          apiFetch('/api/profile')
            .then(res => res.json())
            .then(profile => {
               if (profile && !profile.error) {
                  setUserProfile(profile);
               }
            })
            .catch(e => console.warn('[PROFILE] Error fetching profile:', e));
        });

        registerAutoSync(({ synced }) => {
          getPendingItems().then(items => setPendingCount(items.length)).catch(() => {});
        });
        const items = await getPendingItems();
        setPendingCount(items.length);
      } catch (e) {
        console.error('Error durante la inicialización del app:', e);
      }
    }
    
    initApp();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('[LOGOUT ERROR]', err)
    }
  }

  // Show loading spinner while Firebase checks cached session
  if (authLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0f172a',
        color: '#64748b',
        fontFamily: 'var(--font-family)',
        fontSize: '0.7rem',
        fontWeight: 900,
        letterSpacing: '0.2em',
        textTransform: 'uppercase'
      }}>
        CARGANDO SISTEMA...
      </div>
    )
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen onLoginSuccess={() => {}} />
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-top">
          <span className="brand-name">SP REGIS <span className="brand-accent">Servicios Públicos</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {user?.email?.toLowerCase() === 'juanpablobumblebee@gmail.com' && pendingCorrectionsCount > 0 && (
              <button 
                onClick={() => {
                  setFilterCorrectionsActive(true)
                  setActiveTab('BITACORA')
                }}
                title={`${pendingCorrectionsCount} solicitud(es) de corrección pendiente(s)`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: '#fef3c7',
                  border: '1.5px solid #f59e0b',
                  color: '#b45309',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  padding: '0.25rem 0.55rem',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)'
                }}
              >
                <AlertTriangle size={13} color="#d97706" />
                <span>{pendingCorrectionsCount}</span>
              </button>
            )}

            {pendingCount > 0 && (
              <div className="offline-badge" title={`${pendingCount} reporte(s) pendiente(s) de sincronizar`}>
                <WifiOff size={12} />
                <span>{pendingCount}</span>
              </div>
            )}
            <div className="status-indicator">
              <span className="status-dot"></span>
              {pendingCount > 0 ? 'Pendientes' : 'En Línea'}
            </div>
            <button 
              onClick={handleSignOut} 
              title="Cerrar Sesión"
              style={{
                background: 'none',
                border: '1px solid #f1f5f9',
                borderRadius: '999px',
                padding: '0.35rem',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s'
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
        <nav className="header-nav">
          <TabButton 
            active={activeTab === 'MAPA'} 
            onClick={() => setActiveTab('MAPA')}
            label="Mapa"
            icon={<MapIcon size={20} />}
          />
          <TabButton 
            active={activeTab === 'NUEVO'} 
            onClick={() => setActiveTab('NUEVO')}
            label="Apertura"
            icon={<Plus size={20} />}
          />
          <TabButton 
            active={activeTab === 'BITACORA'} 
            onClick={() => {
              setFilterCorrectionsActive(false)
              setActiveTab('BITACORA')
            }}
            label="Bitácora"
            icon={<LayoutList size={20} />}
          />
          <TabButton 
            active={activeTab === 'METRICAS'} 
            onClick={() => setActiveTab('METRICAS')}
            label="Métricas"
            icon={<LayoutGrid size={20} />}
          />
        </nav>
      </header>

      <main className="app-main overflow-y-auto">
        {activeTab === 'METRICAS' && <MetricsScreen />}
        {activeTab === 'NUEVO' && <FormScreen userProfile={userProfile} />}
        {activeTab === 'BITACORA' && (
          <LogScreen 
            userProfile={{ ...(userProfile || {}), email: user?.email }} 
            initialFilter={filterCorrectionsActive ? 'CORRECCION' : undefined}
            onFilterHandled={() => setFilterCorrectionsActive(false)}
            onCorrectionsChanged={fetchPendingCorrections}
          />
        )}
        {activeTab === 'MAPA' && <MapScreen />}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`tab-btn ${active ? 'active' : ''}`}
    >
      <div className="tab-icon">{icon}</div>
      <span className="tab-label">{label}</span>
      {active && <div className="tab-indicator" />}
    </button>
  )
}

import { useState, useEffect, Suspense, lazy } from 'react'
import { RiArrowLeftLine } from 'react-icons/ri'
import { getSystemStatus } from '@renderer/services/system-info'
import ViewSkeleton from '@renderer/components/ViewSkelrton'

import DashboardView from '../views/Dashboard'
import PhoneView from '../views/Phone'
import { VisionMode } from '@renderer/IndexRoot'

const AppsView = lazy(() => import('../views/APP'))
const WorkFlowEditorView = lazy(() => import('../views/WorkFlowEditor'))
const NotesView = lazy(() => import('../views/Notes'))
const SettingsView = lazy(() => import('../views/Settings'))
const GalleryView = lazy(() => import('../views/Gallery'))

interface ShadowProps {
  isSystemActive: boolean
  toggleSystem: () => void
  isMicMuted: boolean
  toggleMic: () => void
  isVideoOn: boolean
  visionMode: VisionMode
  startVision: (mode: 'camera' | 'screen') => void
  stopVision: () => void
  activeStream: MediaStream | null
}

const glassPanel = 'bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl'

const SHADOW = (props: ShadowProps) => {
  const [activeTab, setActiveTab] = useState('DASHBOARD')
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      getSystemStatus().then(setStats)
    }, 500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const openDashboard = () => setActiveTab('DASHBOARD')
    window.addEventListener('shadow:dashboard', openDashboard)
    return () => window.removeEventListener('shadow:dashboard', openDashboard)
  }, [])

  return (
    <div className="h-full w-full bg-black text-zinc-100 font-sans overflow-hidden select-none relative">
      <div className="h-full overflow-hidden relative bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-zinc-900/50 via-black to-black">
        {activeTab !== 'DASHBOARD' && (
          <button onClick={() => setActiveTab('DASHBOARD')} className="dashboard-back-button">
            <RiArrowLeftLine /> <span>BACK TO DASHBOARD</span>
          </button>
        )}
        <div className={`absolute inset-0 ${activeTab === 'DASHBOARD' ? 'block' : 'hidden'}`}>
          <DashboardView
            props={props}
            stats={stats}
            navigate={setActiveTab}
          />
        </div>

        <div className={`absolute inset-0 ${activeTab === 'PHONE' ? 'block' : 'hidden'}`}>
          <PhoneView glassPanel={glassPanel} />
        </div>

        <Suspense fallback={<ViewSkeleton />}>
          <div className={`absolute inset-0 ${activeTab === 'Macros' ? 'block' : 'hidden'}`}>
            <WorkFlowEditorView />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'Apps' ? 'flex' : 'hidden'} flex-col overflow-hidden`}>
            <AppsView />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'NOTES' ? 'block' : 'hidden'}`}>
            <NotesView glassPanel={glassPanel} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'SETTINGS' ? 'block' : 'hidden'}`}>
            <SettingsView isSystemActive={props.isSystemActive} />
          </div>
          <div className={`absolute inset-0 ${activeTab === 'GALLERY' ? 'block' : 'hidden'}`}>
            <GalleryView />
          </div>
        </Suspense>
      </div>

    </div>
  )
}

export default SHADOW

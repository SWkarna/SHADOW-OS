import { useEffect, useMemo, useRef, useState } from 'react'
import Sphere from '@renderer/components/Sphere'
import GlobalDataStream from '@renderer/components/GlobalDataStream'
import {
  RiApps2Line,
  RiArticleLine,
  RiCameraLine,
  RiChat3Line,
  RiCheckLine,
  RiCloseLine,
  RiComputerLine,
  RiCpuLine,
  RiDashboardLine,
  RiFileTextLine,
  RiFullscreenExitLine,
  RiFullscreenLine,
  RiGalleryLine,
  RiHistoryLine,
  RiLayoutGridLine,
  RiMicLine,
  RiMicOffLine,
  RiPhoneLine,
  RiRadarLine,
  RiRefreshLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiSendPlane2Line,
  RiDeleteBinLine,
  RiToolsLine,
  RiWifiLine
} from 'react-icons/ri'
import { FaMemory } from 'react-icons/fa6'
import { GiTinker } from 'react-icons/gi'
import { HiComputerDesktop } from 'react-icons/hi2'
import { VisionMode } from '@renderer/IndexRoot'
import { ShadowService } from '@renderer/services/Shadow-voice-ai'
import { getHistory } from '@renderer/services/shadow-ai-brain'

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

interface DashboardViewProps {
  props: ShadowProps
  stats: any
  navigate: (tab: string) => void
}

const Panel = ({ children, className = '', expanded = false }: { children: React.ReactNode; className?: string; expanded?: boolean }) => (
  <section className={`command-panel ${className} ${expanded ? 'expanded-panel' : ''}`}>{children}</section>
)

const Bar = ({ value, color = 'cyan' }: { value: number; color?: 'cyan' | 'green' }) => (
  <div className="metric-bar">
    <span className={color === 'green' ? 'bar-fill green' : 'bar-fill'} style={{ width: `${Math.min(value, 100)}%` }} />
  </div>
)

export default function DashboardView({ props, stats, navigate }: DashboardViewProps) {
  const { isSystemActive, isVideoOn, activeStream, toggleSystem, toggleMic, isMicMuted, startVision, stopVision } = props
  const [network, setNetwork] = useState({ cpu: 31, memory: 58, disk: 72, traffic: 63 })
  const [mode, setMode] = useState('ULTIMATE')
  const [showSources, setShowSources] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatText, setChatText] = useState('')
  const [chatNotice, setChatNotice] = useState('')
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [doubleClapEnabled, setDoubleClapEnabled] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [headlinesVisible, setHeadlinesVisible] = useState(true)
  const [headlineRefresh, setHeadlineRefresh] = useState(0)
  const [orbZoom, setOrbZoom] = useState(6.35)
  const [orbOffset, setOrbOffset] = useState({ x: 0, y: 0 })
  const [orbShatterFx, setOrbShatterFx] = useState(false)
  const [hubAnswer, setHubAnswer] = useState('')
  const [hubHistory, setHubHistory] = useState<string[]>([])
  const [hubOpen, setHubOpen] = useState(false)
  const [dataStreamChoiceOpen, setDataStreamChoiceOpen] = useState(false)
  const [streamCategory, setStreamCategory] = useState<'news' | 'markets' | 'energy' | 'climate' | 'cyber'>('news')
  const hubMinimizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const insightLabels = useMemo(() => ['MEMORY // 84.2 TB', 'IPS // SECURE', 'DATA ANALYSIS', 'CODE MATRIX // READY', 'NEURAL CACHE // SYNCED', 'THREAT MAP // CLEAR', 'VISION INDEX // ACTIVE', 'MODEL CONTEXT // 128K', 'TASK QUEUE // 07', 'VECTOR SEARCH // ONLINE', 'SYSTEM LATENCY // 12ms', 'KNOWLEDGE GRAPH // LINKED'].map((label, index) => ({ label, x: 12 + ((index * 29) % 72), y: 16 + ((index * 37) % 64), delay: index * .17 })), [])

  useEffect(() => {
    if (!isSystemActive) return
    const interval = setInterval(() => {
      setNetwork({
        cpu: Math.floor(Math.random() * 28) + 18,
        memory: Math.floor(Math.random() * 26) + 45,
        disk: Math.floor(Math.random() * 12) + 66,
        traffic: Math.floor(Math.random() * 30) + 55
      })
    }, 1600)
    return () => clearInterval(interval)
  }, [isSystemActive])

  const selectSource = (source: 'camera' | 'screen') => {
    setShowSources(false)
    startVision(source)
  }

  const submitChat = async (event: React.FormEvent) => {
    event.preventDefault()
    const sent = await ShadowService.sendText(chatText)
    if (sent) {
      setChatText('')
      setChatNotice('Command sent to SHADOW')
    } else {
      setChatNotice('Start AI before sending a message')
    }
  }

  const toggleExpand = (panel: string) => setExpandedPanel((current) => current === panel ? null : panel)
  const toggleHub = () => setHubOpen((open) => !open)
  const requestDataStreamChoice = () => window.dispatchEvent(new Event('global-datastream-choice'))
  const dismissDataStreamChoice = () => window.dispatchEvent(new Event('global-datastream-choice-dismiss'))
  const chooseDataStream = (choice: 'quick' | 'live') => {
    window.dispatchEvent(new CustomEvent('global-datastream-choice-select', { detail: { choice } }))
    // A manual maximize has no spoken query to retain; live still has a
    // concrete destination, while Quick Answer simply dismisses the chooser.
    if (choice === 'live') window.dispatchEvent(new CustomEvent('global-datastream-open', { detail: { category: 'news' } }))
  }

  useEffect(() => {
    const updateZoom = (event: Event) => setOrbZoom((event as CustomEvent<number>).detail)
    const updateOffset = (event: Event) => setOrbOffset((event as CustomEvent<{ x: number; y: number }>).detail)
    let flashTimer: ReturnType<typeof setTimeout> | undefined
    const flashOrbData = () => {
      setOrbShatterFx(true)
      if (flashTimer) clearTimeout(flashTimer)
      flashTimer = setTimeout(() => setOrbShatterFx(false), 1300)
    }
    window.addEventListener('shadow-orb-zoom', updateZoom)
    window.addEventListener('shadow-orb-move', updateOffset)
    window.addEventListener('shadow-orb-shatter', flashOrbData)
    return () => {
      window.removeEventListener('shadow-orb-zoom', updateZoom)
      window.removeEventListener('shadow-orb-move', updateOffset)
      window.removeEventListener('shadow-orb-shatter', flashOrbData)
      if (flashTimer) clearTimeout(flashTimer)
    }
  }, [])

  useEffect(() => {
    const openGlobalStream = (event: Event) => {
      const category = (event as CustomEvent<{ category?: 'news' | 'markets' | 'energy' | 'climate' | 'cyber' }>).detail?.category
      console.log('[Global Data-Stream] open action received by Dashboard')
      if (category) setStreamCategory(category)
      setExpandedPanel('stream')
    }
    const closeGlobalStream = () => {
      console.log('[Global Data-Stream] close action received by Dashboard')
      setExpandedPanel((current) => current === 'stream' ? null : current)
    }
    window.addEventListener('global-datastream-open', openGlobalStream)
    window.addEventListener('global-datastream-close', closeGlobalStream)
    return () => {
      window.removeEventListener('global-datastream-open', openGlobalStream)
      window.removeEventListener('global-datastream-close', closeGlobalStream)
    }
  }, [])

  // Lets voice routing resolve ambiguous "close kar do" commands only when
  // this is the active live panel. Unmounting the live view clears its polling.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('global-datastream-state', { detail: { open: expandedPanel === 'stream' } }))
  }, [expandedPanel])

  useEffect(() => {
    const showChoice = () => {
      setExpandedPanel(null)
      setDataStreamChoiceOpen(true)
    }
    const dismissChoice = () => setDataStreamChoiceOpen(false)
    window.addEventListener('global-datastream-choice', showChoice)
    window.addEventListener('global-datastream-choice-dismiss', dismissChoice)
    return () => {
      window.removeEventListener('global-datastream-choice', showChoice)
      window.removeEventListener('global-datastream-choice-dismiss', dismissChoice)
    }
  }, [])

  useEffect(() => {
    const clearHubTimer = () => {
      if (hubMinimizeTimer.current) {
        clearTimeout(hubMinimizeTimer.current)
        hubMinimizeTimer.current = null
      }
    }
    const minimizeHub = () => {
      clearHubTimer()
      setHubOpen(false)
    }
    const closeHub = () => {
      clearHubTimer()
      setHubOpen(false)
    }
    const storeAnswer = (answer: string) => {
      setHubAnswer(answer)
      setHubHistory((items) => [answer, ...items.filter((item) => item !== answer)].slice(0, 30))
    }
    const storeAnswerSilently = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; skipHubSave?: boolean }>).detail
      // Never allow a UI-action acknowledgement to reach Hub state/history.
      if (detail?.skipHubSave) return
      const answer = detail?.text?.trim()
      if (!answer) return
      storeAnswer(answer)
    }
    const showAnswer = (event: Event) => {
      const answer = (event as CustomEvent<{ text?: string }>).detail?.text?.trim()
      if (!answer) return
      storeAnswer(answer)
    }
    const voiceOverride = (event: Event) => {
      const action = (event as CustomEvent<{ action?: 'minimize' | 'close' | 'open' }>).detail?.action
      if (action === 'minimize') minimizeHub()
      if (action === 'close') closeHub()
      if (action === 'open') setHubOpen(true)
    }

    window.addEventListener('intelligence-hub-answer', showAnswer)
    window.addEventListener('intelligence-hub-store', storeAnswerSilently)
    window.addEventListener('intelligence-hub-override', voiceOverride)
    return () => {
      clearHubTimer()
      window.removeEventListener('intelligence-hub-answer', showAnswer)
      window.removeEventListener('intelligence-hub-store', storeAnswerSilently)
      window.removeEventListener('intelligence-hub-override', voiceOverride)
    }
  }, [])

  const loadHistory = async () => setHistory((await getHistory()).slice(-30).reverse())
  const toggleTools = () => {
    setToolsOpen((open) => !open)
    setHistoryOpen(false)
  }
  const openHistory = async () => {
    setHistoryOpen(true)
    await loadHistory()
  }

  const refreshHeadlines = () => {
    setHeadlinesVisible(true)
    setHeadlineRefresh((value) => value + 1)
  }

  const metrics = [
    { icon: <RiCpuLine />, label: 'CPU LOAD', value: stats && isSystemActive ? `${stats.cpu}%` : '--' },
    { icon: <FaMemory />, label: 'RAM USAGE', value: stats && isSystemActive ? `${stats.memory.usedPercentage}%` : '--' },
    { icon: <GiTinker />, label: 'TEMP', value: stats && isSystemActive ? `${stats.temperature}°C` : '--' },
    { icon: <HiComputerDesktop />, label: 'OS', value: stats && isSystemActive ? stats.os.type : '--' }
  ]

  const shortcuts = [
    { label: 'Macros', icon: <RiLayoutGridLine />, tab: 'Macros' },
    { label: 'Apps', icon: <RiApps2Line />, tab: 'Apps' },
    { label: 'Notes', icon: <RiArticleLine />, tab: 'NOTES' },
    { label: 'Gallery', icon: <RiGalleryLine />, tab: 'GALLERY' },
    { label: 'Phone', icon: <RiPhoneLine />, tab: 'PHONE' },
    { label: 'Settings', icon: <RiSettings3Line />, tab: 'SETTINGS' }
  ]

  return (
    <main className={`command-dashboard ${toolsOpen ? 'tools-popover-open' : ''}`}>
      {expandedPanel && <button className="panel-scrim" onClick={() => setExpandedPanel(null)} aria-label="Close expanded panel" />}
      <div className="orb-background-layer"><Sphere doubleClapEnabled={doubleClapEnabled} /><div className={`orb-insight-data ${orbZoom < 6.28 ? 'visible' : ''} ${orbZoom < 6.1 ? 'deep' : ''} ${orbZoom < 5.88 ? 'ultra' : ''} ${orbShatterFx ? 'shatter-fx' : ''}`} style={{ transform: `translate(${orbOffset.x * 7}%, ${-orbOffset.y * 7}%)` }}>{insightLabels.map((item, index) => <span key={item.label} className={`insight-item level-${index < 4 ? 'one' : index < 8 ? 'two' : 'three'}`} style={{ left: `${item.x}%`, top: `${item.y}%`, animationDelay: `${item.delay}s` }}>{item.label}</span>)}</div></div>
      <aside className="dashboard-left">
        <Panel className={`media-panel ${isVideoOn ? 'camera-live' : ''}`} expanded={expandedPanel === 'media'}>
          <PanelTitle icon={<RiRadarLine />} title="MEDIA LINK" status={isVideoOn ? 'LIVE' : 'OFFLINE'} onExpand={() => toggleExpand('media')} expanded={expandedPanel === 'media'} />
          <div className="media-frame">
            {isVideoOn ? (
              <video ref={(node) => { if (node && activeStream) { node.srcObject = activeStream; node.play().catch(() => {}) } }} autoPlay playsInline muted className="media-video" />
            ) : (
              <div className="offline-feed"><RiCameraLine size={28} /><span>SYSTEM OFFLINE</span></div>
            )}
          </div>
          {!isVideoOn && expandedPanel !== 'media' && <div className="feed-label"><span>SAT-LINK FEED</span><button onClick={requestDataStreamChoice} title="Choose stream mode"><RiFullscreenLine /></button></div>}
          {!isVideoOn && expandedPanel !== 'media' && false &&
          <div className="feed-preview">
            <div className="preview-top"><span>GLOBAL DATA-STREAM</span><i /></div>
            <div className="preview-globe">◌</div>
            <div className="preview-lines"><span /><span /><span /></div>
          </div>
          }
          {!isVideoOn && expandedPanel !== 'media' && <GlobalDataStream live={false} />}
        </Panel>

        <Panel className="headlines-panel" expanded={expandedPanel === 'headlines'}>
          <PanelTitle icon={<RiArticleLine />} title="TODAY HEADLINES" />
          <div className="headlines-action"><button onClick={() => toggleExpand('headlines')} title={expandedPanel === 'headlines' ? 'Minimize headlines' : 'Maximize headlines'} aria-label="Maximize headlines">{expandedPanel === 'headlines' ? <RiFullscreenExitLine /> : <RiFullscreenLine />}</button><button onClick={refreshHeadlines} title="Refresh headlines" aria-label="Refresh headlines"><RiRefreshLine /></button><button onClick={() => setHeadlinesVisible(false)} title="Delete headlines" aria-label="Delete headlines"><RiDeleteBinLine /></button></div>
          {headlinesVisible ? <div key={headlineRefresh} className="headline-skeleton"><span /><span /><span /><span /><span /></div> : <p className="headlines-empty">HEADLINES CLEARED</p>}
        </Panel>
      </aside>

      {expandedPanel === 'stream' && <Panel className="stream-agent-panel" expanded>
        <PanelTitle icon={<RiRadarLine />} title="SAT-LINK FEED" status="STANDBY" onExpand={() => toggleExpand('stream')} expanded />
        <button className="datastream-close" onClick={() => setExpandedPanel(null)} aria-label="Close Global Data-Stream"><RiCloseLine /></button>
        <div className="feed-preview">
          <div className="preview-top"><span>GLOBAL DATA-STREAM</span><i /></div>
          <div className="preview-globe">◌</div>
          <div className="preview-lines"><span /><span /><span /></div>
        </div>
        <GlobalDataStream live initialCategory={streamCategory} />
      </Panel>}

      <section className="dashboard-center">
        <Panel className="orb-panel">
          <div className={`orb-shell ${isSystemActive ? 'active' : ''}`} />
          <div className="ai-controls">
            <button onClick={() => { setShowChat((open) => !open); setChatNotice('') }} title="Open text chat"><RiChat3Line /></button>
            <button onClick={toggleMic} title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'} className={isMicMuted ? 'muted' : ''}>{isMicMuted ? <RiMicOffLine /> : <RiMicLine />}</button>
            <button onClick={toggleSystem} className={`start-ai ${isSystemActive ? 'running' : ''}`}>{isSystemActive ? 'STOP AI' : 'START AI'}</button>
            <button onClick={() => isVideoOn ? stopVision() : setShowSources((open) => !open)} title={isVideoOn ? 'Stop active video feed' : 'Choose video source'} className={isVideoOn ? 'feed-active' : ''}>{isVideoOn ? <RiCloseLine /> : <RiCameraLine />}</button>
            {showSources && !isVideoOn && <div className="source-menu"><button onClick={() => selectSource('camera')}><RiCameraLine /> WEBCAM</button><button onClick={() => selectSource('screen')}><RiComputerLine /> SCREEN SHARE</button></div>}
          </div>
          {showChat && <form onSubmit={submitChat} className="command-chat"><button type="button" onClick={() => setShowChat(false)} aria-label="Close chat"><RiCloseLine /></button><input autoFocus value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Type a command for SHADOW..." /><button type="submit" aria-label="Send command"><RiSendPlane2Line /></button>{chatNotice && <small>{chatNotice}</small>}</form>}
        </Panel>

        <div className="dashboard-bottom">
          <Panel className="core-panel">
            <PanelTitle icon={<RiDashboardLine />} title="CORE METRICS" />
            <div className="core-metrics">{metrics.map((metric) => <div className="core-metric" key={metric.label}><span>{metric.icon}</span><small>{metric.label}</small><strong>{metric.value}</strong></div>)}</div>
          </Panel>
          <Panel className="status-panel">
            <PanelTitle icon={<RiShieldCheckLine />} title="STATUS" right="MONITOR" />
            {[['CPU', network.cpu, 'cyan'], ['MEMORY', network.memory, 'green'], ['DISK', network.disk, 'green'], ['NETWORK', network.traffic, 'cyan']].map(([label, value, color]) => <div className="status-row" key={String(label)}><span>{label}</span><Bar value={Number(value)} color={color as 'cyan' | 'green'} /><b>{value}%</b></div>)}
          </Panel>
          <Panel className="modes-panel">
            <PanelTitle icon={<RiMicLine />} title="MODES" />
            {['ULTIMATE', 'MINI', 'LIGHT'].map((item) => <button onClick={() => setMode(item)} key={item} className={mode === item ? 'selected-mode' : ''}>{item}</button>)}
          </Panel>
          <Panel className="shortcuts-panel">
            <PanelTitle icon={<RiLayoutGridLine />} title="SHORTCUTS" />
            <div className="shortcut-grid">{shortcuts.map((item) => <button onClick={() => navigate(item.tab)} key={item.label}>{item.icon}<span>{item.label}</span></button>)}<button onClick={toggleTools} className={toolsOpen ? 'tools-active' : ''}><RiToolsLine /><span>Tools</span></button>
              {toolsOpen && <div className="history-popover">{historyOpen ? <><div className="history-header"><button onClick={() => setHistoryOpen(false)} title="Back to tools">←</button><span><RiHistoryLine /> HISTORY</span><button onClick={loadHistory} title="Refresh history"><RiRefreshLine /></button><button onClick={() => setToolsOpen(false)} title="Close tools"><RiCloseLine /></button></div><div className="history-list">{history.length === 0 ? <p>No saved chats or commands yet.</p> : history.map((item, index) => <article key={index} className={item.role === 'user' ? 'history-user' : 'history-ai'}><small>{item.role === 'user' ? 'YOU' : 'SHADOW'}</small><span>{item.parts?.[0]?.text || item.content || 'Command activity'}</span></article>)}</div></> : <><div className="history-header"><span><RiToolsLine /> TOOLS</span><button onClick={() => setToolsOpen(false)} title="Close tools"><RiCloseLine /></button></div><div className="tools-menu"><label className="gesture-toggle"><span>DOUBLE-CLAP GESTURES</span><input type="checkbox" checked={doubleClapEnabled} onChange={(event) => setDoubleClapEnabled(event.target.checked)} /><b>{doubleClapEnabled ? 'ON' : 'OFF'}</b></label><button className="tool-menu-row" onClick={openHistory}><RiHistoryLine /><span>HISTORY</span><small>VIEW</small></button></div></>}</div>}</div>
          </Panel>
          <Panel className="connection-panel">
            <PanelTitle icon={<RiWifiLine />} title="CONNECTION" />
            <small>STATUS</small><strong><i /> {isSystemActive ? 'LINKED' : 'STANDBY'}</strong>
            <small>SIGNAL STRENGTH</small><div className="signal"><b>{isSystemActive ? '100%' : '0%'}</b><Bar value={isSystemActive ? 100 : 0} /><span>▂▄▆█</span></div>
            <small>SECURITY</small><strong>{isSystemActive ? 'ENCRYPTED' : 'LOCKED'} <RiCheckLine /></strong>
          </Panel>
        </div>
      </section>

      <aside className="dashboard-right">
        <Panel className="intelligence-panel">
          <PanelTitle icon={<RiRadarLine />} title="VIRTUAL INTELLIGENCE HUB" status={hubHistory.length ? `${hubHistory.length} SAVED` : 'READY'} onExpand={toggleHub} expanded={hubOpen} />
          {hubHistory.length ? (
            <div className="hub-history-list">
              {hubHistory.map((item, index) => (
                <button key={`${index}-${item.slice(0, 16)}`} className="hub-history-item" onClick={() => { setHubAnswer(item); setHubOpen(true) }} title="Open saved reply">
                  <span>{item.replace(/\s+/g, ' ').slice(0, 72)}{item.replace(/\s+/g, ' ').length > 72 ? '…' : ''}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <p>Ask SHADOW a question —<br />substantive answers appear here.</p>
              <small>SYSTEM READY · AWAITING DATA INPUT</small>
            </>
          )}
        </Panel>
        <Panel className="agents-panel" expanded={expandedPanel === 'agents'}>
          <PanelTitle icon={<RiRadarLine />} title="SUB AGENTS" status="5 ACTIVE" onExpand={() => toggleExpand('agents')} expanded={expandedPanel === 'agents'} />
          {['Main Assistant', 'Data Analyst', 'Code Executor', 'System Guardian', 'Web Scout'].map((agent, index) => <button key={agent} className="agent-row"><span className={`agent-icon i${index}`}>◈</span><b>{agent}</b><small>● ONLINE</small></button>)}
          <button className="manage-agents">MANAGE AGENTS</button>
        </Panel>
      </aside>
      <section className={`hub-briefing-overlay ${hubOpen ? 'is-open' : ''}`} aria-hidden={!hubOpen}>
        <article className="hub-answer" aria-live="polite">
          <header><RiFileTextLine /><span>SHADOW RESPONSE</span><button onClick={() => setHubOpen(false)} title="Close answer" aria-label="Close answer"><RiCloseLine /></button></header>
          <HubAnswerContent answer={hubAnswer} />
          <footer>{hubHistory.length} SAVED RESPONSE{hubHistory.length === 1 ? '' : 'S'} · CLOSE TO DISMISS</footer>
        </article>
      </section>
      {dataStreamChoiceOpen && <><button className="datastream-choice-backdrop" onClick={dismissDataStreamChoice} aria-label="Dismiss choice" /><section className="datastream-choice" role="dialog" aria-label="Choose news source">
        <button className="datastream-choice-close" onClick={dismissDataStreamChoice} aria-label="Close choice"><RiCloseLine /></button><p>GLOBAL NEWS REQUEST DETECTED</p><h2>CHOOSE RESPONSE MODE</h2>
        <div><button onClick={() => chooseDataStream('quick')}><b>LEFT · QUICK ANSWER</b><small>RSS briefing in SHADOW</small></button><button onClick={() => chooseDataStream('live')}><b>RIGHT · LIVE GLOBAL DATA STREAM</b><small>Open live world monitor</small></button></div>
      </section></>}
    </main>
  )
}

function HubAnswerContent({ answer }: { answer: string }) {
  const lines = answer.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const numberedSteps = answer.split(/(?=(?:step\s*\d+|\d+[.)])\s*)/i).map((line) => line.trim()).filter(Boolean)
  const steps = lines.length > 1 ? lines : numberedSteps
  const isDerivation = /(?:\b(?:step|derive|derivation|equation|solve|therefore)\b|[=±√∑∫÷×^])/i.test(answer) && steps.length > 1
  if (isDerivation) {
    return <div className="hub-answer-body hub-derivation">{steps.map((line, index) => (
      <section className="hub-derivation-step" key={`${index}-${line.slice(0, 16)}`}>
        <b>STEP {String(index + 1).padStart(2, '0')}</b>
        <p>{line.replace(/^(?:step\s*\d+\s*[:.)-]?|\d+[.)])\s*/i, '')}</p>
      </section>
    ))}</div>
  }
  return <div className="hub-answer-body hub-paragraphs">{steps.map((line, index) => (
    <section className="hub-paragraph" key={`${index}-${line.slice(0, 16)}`}>
      <p>{line.replace(/^(?:step\s*\d+\s*[:.)-]?|\d+[.)])\s*/i, '')}</p>
    </section>
  ))}</div>
}

function PanelTitle({ icon, title, status, right, onExpand, expanded = false }: { icon: React.ReactNode; title: string; status?: string; right?: string; onExpand?: () => void; expanded?: boolean }) {
  return <div className="panel-title"><span>{icon} {title}</span><span className="panel-actions">{(status || right) && <em>{status || right}</em>}{onExpand && <button onClick={onExpand} title={expanded ? 'Minimize panel' : 'Maximize panel'}>{expanded ? <RiFullscreenExitLine /> : <RiFullscreenLine />}</button>}</span></div>
}

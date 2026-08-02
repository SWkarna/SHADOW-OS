import { useState, useEffect, useRef } from 'react'
import MiniOverlay from './components/MiniOverlay'
import { ShadowService } from './services/Shadow-voice-ai'
import { getScreenSourceId } from './hooks/CaptureDesktop'
import SHADOW from './UI/SHADOW'
import TerminalOverlay from './components/TerminalOverlay'
import LeafletMapWidget from './Widgets/MapView'
import ImageWidget from './Widgets/ImageWidget'
import EmailWidget from './Widgets/EmailWidget'
import WeatherWidget from './Widgets/WeatherWidget'
import StockWidget from './Widgets/StockWidget'
import LiveCodingWidget from './Widgets/LiveCodingWidget'
import WormholeWidget from './Widgets/WormholeWidget'
import OracleWidget from './Widgets/RagOrcaleWidget'
import ResearchWidget from './Widgets/DeepResearch'
import SemanticWidget from './Widgets/SematicSearch'
import SmartDropZonesWidget from './Widgets/SmartZoneWidget'
import TitleBar from './components/Titlebar'

export type VisionMode = 'camera' | 'screen' | 'none'

const IndexRoot = () => {
  const [isOverlay, setIsOverlay] = useState(false)

  const [isSystemActive, setIsSystemActive] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)

  const [isVideoOn, setIsVideoOn] = useState(false)
  const [visionMode, setVisionMode] = useState<VisionMode>('none')

  const processingVideoRef = useRef<HTMLVideoElement>(document.createElement('video'))
  const activeStreamRef = useRef<MediaStream | null>(null)
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let lastHoverAt = 0
    const createUiSound = (notes: Array<[number, number, number, number]>, length: number) => {
      const sampleRate = 22050
      const samples = Math.ceil(sampleRate * length)
      const buffer = new ArrayBuffer(44 + samples * 2)
      const view = new DataView(buffer)
      const write = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
      write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
      write(36, 'data'); view.setUint32(40, samples * 2, true)
      for (let sample = 0; sample < samples; sample++) {
        const time = sample / sampleRate
        let value = 0
        notes.forEach(([frequency, start, duration, volume]) => {
          if (time < start || time > start + duration) return
          const progress = (time - start) / duration
          const envelope = Math.min(progress / 0.08, (1 - progress) / 0.24, 1)
          value += Math.sin(2 * Math.PI * frequency * (time - start)) * volume * envelope
        })
        view.setInt16(44 + sample * 2, Math.max(-1, Math.min(1, value)) * 32767, true)
      }
      return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
    }

    const hoverSound = createUiSound([[920, 0, 0.045, 0.2]], 0.06)
    const clickSound = createUiSound([[360, 0, 0.06, 0.24], [510, 0.045, 0.07, 0.16]], 0.13)
    const play = (source: string, volume: number) => {
      const audio = new Audio(source)
      audio.volume = volume
      audio.play().catch(() => {})
    }

    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element ? target.closest('button, [role="button"], a') : null

    const onPointerOver = (event: PointerEvent) => {
      const target = isInteractive(event.target)
      const from = isInteractive(event.relatedTarget)
      if (!target || target === from || target.hasAttribute('disabled') || target.hasAttribute('data-ui-silent')) return
      const now = performance.now()
      if (now - lastHoverAt < 70) return
      lastHoverAt = now
      play(hoverSound, 0.045)
    }

    const onClick = (event: MouseEvent) => {
      const target = isInteractive(event.target)
      if (!target || target.hasAttribute('disabled') || target.hasAttribute('data-ui-silent')) return
      play(clickSound, 0.085)
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('click', onClick)
      URL.revokeObjectURL(hoverSound)
      URL.revokeObjectURL(clickSound)
    }
  }, [])

  useEffect(() => {
    window.electron.ipcRenderer.on('overlay-mode', (_e, mode) => setIsOverlay(mode))
    return () => {
      window.electron.ipcRenderer.removeAllListeners('overlay-mode')
    }
  }, [])

  useEffect(() => {
    const watchdog = setInterval(() => {
      if (isSystemActive && !ShadowService.isConnected) {
        setIsSystemActive(false)
        setIsMicMuted(true)
        stopVision()
      }
    }, 1000)
    return () => clearInterval(watchdog)
  }, [isSystemActive])

  const toggleSystem = async () => {
    if (!isSystemActive) {
      try {
        await ShadowService.connect()
        setIsSystemActive(true)
        setIsMicMuted(false)
        ShadowService.setMute(false)
      } catch (err: any) {
        if (err.message === 'NO_API_KEY') {
          alert(
            '⚠️ CRITICAL ERROR: Gemini API Key is missing. Please enter it in the Command Center Vault (Settings Tab).'
          )
        } else {
          alert(`Connection failed: ${err.message}`)
        }
        setIsSystemActive(false)
      }
    } else {
      ShadowService.disconnect()
      setIsSystemActive(false)
      setIsMicMuted(true)
      ShadowService.setMute(true)
      stopVision()
    }
  }

  const toggleMic = () => {
    const s = !isMicMuted
    setIsMicMuted(s)
    ShadowService.setMute(s)
  }

  const startVision = async (mode: 'camera' | 'screen') => {
    if (!isSystemActive) return

    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop())
      }

      let stream: MediaStream

      if (mode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
      } else {
        const sourceId = await getScreenSourceId()
        if (!sourceId) return
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-ignore
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: 1280,
              maxHeight: 720
            }
          }
        })
      }

      activeStreamRef.current = stream

      processingVideoRef.current.srcObject = stream
      await processingVideoRef.current.play()

      setVisionMode(mode)
      setIsVideoOn(true)

      startAIProcessing()

      stream.getVideoTracks()[0].onended = () => stopVision()
    } catch (e) {
      stopVision()
    }
  }

  const stopVision = () => {
    setIsVideoOn(false)
    setVisionMode('none')

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop())
      activeStreamRef.current = null
    }

    if (processingVideoRef.current) {
      processingVideoRef.current.srcObject = null
    }

    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current)
      aiIntervalRef.current = null
    }
  }

  const startAIProcessing = () => {
    if (aiIntervalRef.current) clearInterval(aiIntervalRef.current)

    aiIntervalRef.current = setInterval(() => {
      const vid = processingVideoRef.current
      if (vid && vid.readyState === 4 && ShadowService.socket?.readyState === WebSocket.OPEN) {
        const canvas = document.createElement('canvas')
        canvas.width = 800
        canvas.height = 450
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
          const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]
          ShadowService.sendVideoFrame(base64)
        }
      }
    }, 2000)
  }

  if (isOverlay) {
    return (
      <div className="w-screen h-screen overflow-hidden flex items-center justify-center bg-transparent">
        <MiniOverlay
          isSystemActive={isSystemActive}
          toggleSystem={toggleSystem}
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isVideoOn={isVideoOn}
          visionMode={visionMode}
          startVision={startVision}
          stopVision={stopVision}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden relative border border-emerald-500/20 rounded-xl">
      <TitleBar />
      <div className="flex-1 relative">
        <SHADOW
          isSystemActive={isSystemActive}
          toggleSystem={toggleSystem}
          isMicMuted={isMicMuted}
          toggleMic={toggleMic}
          isVideoOn={isVideoOn}
          visionMode={visionMode}
          startVision={startVision}
          stopVision={stopVision}
          activeStream={activeStreamRef.current}
        />
      </div>
      <SmartDropZonesWidget />
      <SemanticWidget />
      <OracleWidget />
      <WormholeWidget />
      <LeafletMapWidget />
      <StockWidget />
      <WeatherWidget />
      <ImageWidget />
      <EmailWidget />
      <TerminalOverlay />
      <LiveCodingWidget />
      <ResearchWidget />
    </div>
  )
}

export default IndexRoot

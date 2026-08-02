import { useCallback, useEffect, useRef, useState } from 'react'
import { createOrbScene, type OrbSceneApi } from './ultronOrbScene'
import { HandTracker, type TrackerStatus } from './ultronHandTracker'

type GestureState = 'off' | 'starting' | 'on' | 'error'

export default function Sphere({ doubleClapEnabled }: { doubleClapEnabled: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<OrbSceneApi | null>(null)
  const trackerRef = useRef<HandTracker | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [gestureState, setGestureState] = useState<GestureState>('off')
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>({ hands: 0, mode: 'idle' })

  const announceGesture = useCallback((enabled: boolean) => {
    window.dispatchEvent(new CustomEvent('shadow-local-gesture-announcement', { detail: { duration: 1800 } }))
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const message = new SpeechSynthesisUtterance(`Gesture control ${enabled ? 'on' : 'off'}`)
    message.rate = 1.12
    message.volume = 0.45
    window.speechSynthesis.speak(message)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const scene = createOrbScene(containerRef.current)
    sceneRef.current = scene
    const pulse = () => scene.pulseResponse()

    // Disable automatic response-driven pulses by default to avoid
    // unsolicited visual activity. Expose a manual trigger instead.
    // Previous behavior: window listened to 'shadow-response-audio'.
    // Keep the ability to trigger programmatically via
    // `window.triggerShadowPulse()` when needed.
    // window.addEventListener('shadow-response-audio', pulse)
    // -- replaced by manual trigger exposure:
    // @ts-ignore - attach helper to window for dev/extension use
    ;(window as any).triggerShadowPulse = pulse

    return () => {
      // Cleanup manual trigger and tracker/scene resources
      try {
        // @ts-ignore
        delete (window as any).triggerShadowPulse
      } catch (e) {}
      trackerRef.current?.stop()
      trackerRef.current = null
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  const stopGestures = useCallback((announce = false) => {
    trackerRef.current?.stop()
    trackerRef.current = null
    setGestureState('off')
    setTrackerStatus({ hands: 0, mode: 'idle' })
    if (announce) announceGesture(false)
  }, [announceGesture])

  const enableGestures = useCallback(async (announce = false) => {
    if (trackerRef.current) return
    if (!videoRef.current || !overlayRef.current || !sceneRef.current) return
    setGestureState('starting')
    const tracker = new HandTracker(videoRef.current, overlayRef.current, {
      onRotate: (theta, phi) => sceneRef.current?.rotateBy(theta, phi),
      onZoom: (factor) => sceneRef.current?.zoomBy(factor),
      onMove: (x, y) => sceneRef.current?.moveBy(x, y),
      onThrow: () => sceneRef.current?.shatter(),
      onReassemble: () => sceneRef.current?.reassemble(),
      onStatus: setTrackerStatus
    })
    trackerRef.current = tracker
    try {
      await tracker.start()
      setGestureState('on')
      if (announce) announceGesture(true)
    } catch {
      tracker.stop()
      trackerRef.current = null
      setGestureState('error')
    }
  }, [announceGesture])

  const toggleGestures = useCallback((announce = true) => {
    if (trackerRef.current) stopGestures(announce)
    else void enableGestures(announce)
  }, [enableGestures, stopGestures])

  useEffect(() => {
    const enableFromVoice = () => { void enableGestures(false) }
    const disableFromVoice = () => stopGestures(false)
    const toggleFromClap = () => { if (doubleClapEnabled) toggleGestures(true) }
    const setFromVoice = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      if (enabled) void enableGestures(false)
      else stopGestures(false)
    }
    window.addEventListener('shadow-gesture-enable', enableFromVoice)
    window.addEventListener('shadow-gesture-disable', disableFromVoice)
    window.addEventListener('shadow-gesture-toggle', toggleFromClap)
    window.addEventListener('shadow-gesture-set', setFromVoice)
    return () => {
      window.removeEventListener('shadow-gesture-enable', enableFromVoice)
      window.removeEventListener('shadow-gesture-disable', disableFromVoice)
      window.removeEventListener('shadow-gesture-toggle', toggleFromClap)
      window.removeEventListener('shadow-gesture-set', setFromVoice)
    }
  }, [doubleClapEnabled, enableGestures, stopGestures, toggleGestures])

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const dragOrb = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    sceneRef.current?.moveBy(deltaX * 0.012, -deltaY * 0.012)
  }
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  return <div className="ultron-orb" onDoubleClick={(event) => { event.stopPropagation(); toggleGestures(true) }} onPointerDown={beginDrag} onPointerMove={dragOrb} onPointerUp={endDrag} onPointerCancel={endDrag} title="Drag to move orb · Double-click for gesture control">
    <div ref={containerRef} className="ultron-orb-scene" />
    <video ref={videoRef} className="ultron-gesture-video" muted playsInline />
    <canvas ref={overlayRef} width={208} height={156} className="ultron-gesture-overlay" />
    <div className={`ultron-gesture-status ${gestureState}`}>
      {gestureState === 'starting' && 'GESTURES: STARTING'}
      {gestureState === 'on' && `GESTURES: ${trackerStatus.hands ? `${trackerStatus.hands} HAND${trackerStatus.hands > 1 ? 'S' : ''} Â· ${trackerStatus.mode.toUpperCase()}` : 'SHOW HANDS'}`}
      {gestureState === 'error' && 'GESTURES: CAMERA UNAVAILABLE'}
      {gestureState === 'off' && (doubleClapEnabled ? 'DOUBLE-TAP / DOUBLE-CLAP / SHADOW VOICE' : 'DOUBLE-TAP / SHADOW VOICE')}
    </div>
  </div>
}

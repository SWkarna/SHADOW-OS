import './assets/main.css'

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import IndexRoot from './IndexRoot'

class SystemErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#050505] flex flex-col items-center justify-center text-red-500 font-mono p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">CRITICAL SYSTEM FAILURE</h1>
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 max-w-2xl wrap-break-word">
            {this.state.errorMsg}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (
    reason &&
    typeof reason === 'object' &&
    'type' in reason &&
    (reason as any).type === 'cancelation' &&
    (reason as any).msg?.toString().includes('operation is manually canceled')
  ) {
    return
  }

  console.error('[Unhandled Rejection]', reason)
  if (reason && (reason as any).stack) {
    console.error((reason as any).stack)
  }
})

window.addEventListener('error', (event) => {
  console.error('[Runtime Error]', event.message, event.error || event.filename)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <IndexRoot />
    </SystemErrorBoundary>
  </StrictMode>
)

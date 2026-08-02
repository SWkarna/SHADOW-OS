import { createElement, useEffect, useState } from 'react'
import { RiRefreshLine } from 'react-icons/ri'
import DataStreamEarth from './DataStreamEarth'

type Category = 'news' | 'markets' | 'energy' | 'climate' | 'cyber'
type Item = { title: string; source: string; meta?: string; url?: string }
const tabs: Array<[Category, string, number]> = [['news', 'WORLD', 240000], ['markets', 'MARKETS', 90000], ['energy', 'ENERGY', 1200000], ['climate', 'CLIMATE', 1200000], ['cyber', 'CYBER', 240000]]
const spark = (seed: string) => Array.from({ length: 18 }, (_, index) => 28 + ((seed.charCodeAt(index % Math.max(seed.length, 1)) * (index + 5)) % 52))
const weatherIcon = (name: string) => /london|new york/i.test(name) ? '☁' : /tokyo/i.test(name) ? '☀' : /delhi/i.test(name) ? '☀' : '◐'

export default function GlobalDataStream({ live, initialCategory = 'news' }: { live: boolean; initialCategory?: Category }) {
  const [category, setCategory] = useState<Category>(initialCategory)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Item | null>(null)
  const [feedState, setFeedState] = useState<'loading' | 'ready' | 'error'>('loading')
  const active = tabs.find(([key]) => key === category)!
  useEffect(() => { if (live) setCategory(initialCategory) }, [live, initialCategory])
  const load = async () => {
    setLoading(true); setError('')
    const result = await window.electron.ipcRenderer.invoke('global-datastream:fetch', category)
    setItems(result.items || []); setError(result.error || ''); setLoading(false)
  }
  useEffect(() => {
    if (!live) { setItems([]); setError(''); return }
    void load()
    const timer = window.setInterval(load, active[2])
    return () => window.clearInterval(timer)
  // category is deliberately the polling scope.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, category])
  if (!live) return <div className="datastream-idle"><span>◌</span><b>GLOBAL DATA-STREAM</b><small>IDLE SNAPSHOT · LIVE DATA ON MAXIMIZE</small></div>
  const liveWebview = createElement('webview', { src: 'https://worldmonitor.app', className: 'datastream-webview', onDidFinishLoad: () => setFeedState('ready'), onDidFailLoad: () => setFeedState('error') })
  // The selected live view is exclusive: do not mount the legacy RSS/globe
  // view underneath the embedded monitor.
  return <div className="datastream-live"><section className="datastream-webview-shell">{feedState === 'loading' && <p>CONNECTING TO LIVE FEED…</p>}{feedState === 'error' && <p>LIVE FEED UNAVAILABLE. RETRY LATER.</p>}{liveWebview}</section></div>
  return <div className="datastream-live">
    <section className="datastream-webview-shell">{feedState === 'loading' && <p>CONNECTING TO LIVE FEED…</p>}{feedState === 'error' && <p>LIVE FEED UNAVAILABLE. RETRY LATER.</p>}{liveWebview}</section>
    <nav>{tabs.map(([key, label]) => <button key={key} className={category === key ? 'active' : ''} onClick={() => setCategory(key)}>{label}</button>)}</nav>
    <div className="datastream-toolbar"><span>{active[1]} / LIVE</span><button onClick={load} title="Refresh stream"><RiRefreshLine /></button></div>
    <section className="datastream-visual" aria-label="Global live signal visualization">
      <DataStreamEarth items={items} onSelect={setSelected} />
      <div className="datastream-globe legacy-globe">
        <svg viewBox="0 0 400 230" role="img" aria-label="Animated global signal globe">
          <defs><radialGradient id="glow"><stop stopColor="#1ee8ed" stopOpacity=".32"/><stop offset="1" stopColor="#041519" stopOpacity="0"/></radialGradient></defs>
          <ellipse cx="200" cy="115" rx="156" ry="102" fill="url(#glow)"/><ellipse cx="200" cy="115" rx="146" ry="96" className="globe-outline"/>
          <ellipse cx="200" cy="115" rx="82" ry="96" className="globe-grid"/><path d="M56 115h288M72 76h256M72 154h256" className="globe-grid"/>
          <path d="M112 74l24-21 35 9 14 19-18 16-25-3-17 18-24-8zm94-27 45 18 40 37-17 16-30-6-19 18-31-18 11-20-18-19zm-10 90 39 5 14 31-25 22-40-10-18-25z" className="globe-land"/>
        </svg>
        <span className="globe-scan" /><b>{items.length || '…'} LIVE SIGNALS</b>
      </div>
      <div className="datastream-ticker"><span>{selected ? 'SELECTED SIGNAL //' : 'LIVE NEWSWIRE //'}</span><div>{selected ? <b className="selected-signal">{selected.title}<small>{selected.source} · {selected.meta || 'LIVE'}</small></b> : items.slice(0, 4).map((item) => <b key={item.title}>{item.title} <i>◆</i></b>)}</div></div>
    </section>
    {category === 'markets' || category === 'energy' ? <div className="datastream-metrics">{items.map((item) => <article key={item.title} className="metric-widget"><header><span>{item.title}</span><b className={item.meta?.includes('-') ? 'down' : 'up'}>{item.meta?.split('  ').at(-1)}</b></header><Sparkline values={spark(item.title)} /><small>{item.meta?.split('  ')[0]} · {item.source}</small></article>)}</div> : category === 'climate' ? <div className="datastream-metrics climate-widgets">{items.map((item) => <article key={item.title} className="climate-widget"><i>{weatherIcon(item.title)}</i><b>{item.title}</b><strong>{item.meta?.match(/-?\d+(?:\.\d+)?°C/)?.[0] || '—'}</strong><small>{item.meta?.replace(/^.*?· /, '')}</small></article>)}</div> : null}
    <div className="datastream-items">{loading && <p>SYNCING GLOBAL SIGNALS…</p>}{error && <p className="datastream-error">SOURCE UNAVAILABLE: {error}</p>}{!loading && !error && items.length === 0 && <p>NO LIVE SIGNALS RECEIVED.</p>}{items.map((item, index) => <a key={`${item.title}-${index}`} href={item.url} onClick={(event) => { if (!item.url) event.preventDefault() }}><b>{item.title}</b><footer><em>{item.source}</em><small>{item.meta || 'LIVE'}</small></footer></a>)}</div>
  </div>
}

function Sparkline({ values }: { values: number[] }) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - value}`).join(' ')
  return <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} /></svg>
}

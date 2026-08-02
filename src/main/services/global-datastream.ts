import { IpcMain } from 'electron'

type Category = 'news' | 'markets' | 'energy' | 'climate' | 'cyber'
type StreamItem = { title: string; source: string; time?: string; meta?: string; url?: string }

const rssFeeds: Record<'news' | 'cyber', Array<{ name: string; url: string }>> = {
  news: [
    { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-world' },
    { name: 'France 24', url: 'https://www.france24.com/en/rss' }
  ],
  cyber: [{ name: 'CISA', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' }]
}

const decode = (value = '') => value.replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim()
const tag = (xml: string, name: string) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1])
const rssItems = (xml: string, source: string): StreamItem[] => (xml.match(/<item[\s\S]*?<\/item>/gi) || []).map((item) => ({ title: tag(item, 'title'), source, time: tag(item, 'pubDate') || tag(item, 'dc:date'), url: tag(item, 'link') })).filter((item) => item.title)
const relative = (date?: string) => {
  const age = date ? Date.now() - Date.parse(date) : NaN
  if (!Number.isFinite(age) || age < 0) return 'recent'
  const minutes = Math.floor(age / 60000)
  return minutes < 60 ? `${minutes || 1}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`
}

async function fetchRss(kind: 'news' | 'cyber') {
  const settled = await Promise.allSettled(rssFeeds[kind].map(async ({ name, url }) => rssItems(await (await fetch(url, { headers: { 'User-Agent': 'SHADOW Global DataStream/1.0' } })).text(), name)))
  const seen = new Set<string>()
  return settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []).filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').slice(0, 8).join(' ')
    if (seen.has(key)) return false
    seen.add(key); return true
  }).sort((a, b) => Date.parse(b.time || '') - Date.parse(a.time || '')).slice(0, 18).map((item) => ({ ...item, meta: relative(item.time) }))
}

async function yahoo(symbols: string[]) {
  const data = await Promise.allSettled(symbols.map(async (symbol) => {
    const json = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`)).json()
    const result = json.chart?.result?.[0]; const quote = result?.meta || {}; const price = quote.regularMarketPrice ?? quote.previousClose
    const change = quote.regularMarketChangePercent
    return { title: quote.shortName || symbol, source: 'Yahoo Finance', meta: `${Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}  ${Number(change || 0) >= 0 ? '+' : ''}${Number(change || 0).toFixed(2)}%` }
  }))
  return data.flatMap((entry) => entry.status === 'fulfilled' ? [entry.value] : [])
}

async function climate() {
  const cities = [{ n: 'New York', a: 40.71, b: -74.01 }, { n: 'London', a: 51.51, b: -0.13 }, { n: 'Delhi', a: 28.61, b: 77.21 }, { n: 'Tokyo', a: 35.68, b: 139.65 }, { n: 'Sydney', a: -33.87, b: 151.21 }]
  return Promise.all(cities.map(async (city) => {
    const json = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.a}&longitude=${city.b}&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto`)).json()
    const current = json.current
    return { title: city.n, source: 'Open-Meteo', meta: `${current.temperature_2m}°C · wind ${current.wind_speed_10m} km/h · rain ${current.precipitation} mm` }
  }))
}

async function fetchCategory(category: Category): Promise<StreamItem[]> {
  if (category === 'news' || category === 'cyber') return fetchRss(category)
  if (category === 'markets') return yahoo(['^GSPC', '^IXIC', '^DJI', 'AAPL', 'MSFT', 'BTC-USD', 'ETH-USD'])
  if (category === 'energy') return yahoo(['CL=F', 'BZ=F', 'NG=F'])
  if (category === 'climate') return climate()
  return []
}

export default function registerGlobalDatastream(ipcMain: IpcMain) {
  ipcMain.handle('global-datastream:fetch', async (_event, category: Category) => {
    try { return { items: await fetchCategory(category), fetchedAt: Date.now() } }
    catch (error: any) { return { items: [], fetchedAt: Date.now(), error: error.message || 'Data source unavailable' } }
  })
}

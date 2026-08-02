import { useEffect, useMemo, useRef } from 'react'
import Globe from 'globe.gl'

const earthTexture = 'https://unpkg.com/three-globe/example/img/earth-night.jpg'
const topologyTexture = 'https://unpkg.com/three-globe/example/img/earth-topology.png'

export type EarthSignal = { title: string; source: string; meta?: string }
type Point = EarthSignal & { lat: number; lng: number; color: string }

const regions: Array<[RegExp, number, number]> = [
  [/usa|u\.s\.|america|washington|new york/i, 38, -97], [/uk|britain|london|europe|france|germany|russia|ukraine/i, 52, 15],
  [/china|japan|india|delhi|asia|korea/i, 30, 104], [/middle east|israel|iran|gaza|saudi/i, 30, 45],
  [/africa|sudan|egypt|nigeria/i, 7, 20], [/australia|sydney/i, -27, 134], [/brazil|argentina|latin america/i, -18, -58]
]

export default function DataStreamEarth({ items, onSelect }: { items: EarthSignal[]; onSelect: (item: EarthSignal) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)
  const points = useMemo<Point[]>(() => items.flatMap((item, index) => {
    const region = regions.find(([pattern]) => pattern.test(`${item.title} ${item.source}`))
    return region ? [{ ...item, lat: region[1], lng: region[2], color: index % 3 === 0 ? '#ff6b7d' : '#38edf0' }] : []
  }), [items])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const globe = new Globe(container)
      .globeImageUrl(earthTexture)
      .bumpImageUrl(topologyTexture)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#27e9ed')
      .atmosphereAltitude(0.18)
      .pointAltitude(0.08)
      .pointRadius(0.34)
      .pointColor('color')
      .pointLabel((point: any) => `<div style="max-width:220px;color:#dfffff;font:12px system-ui"><b>${point.title}</b><br/><small>${point.source} · ${point.meta || 'LIVE'}</small></div>`)
      .onPointClick((point: any) => onSelect(point as EarthSignal))
      .onPointHover((point: any) => { container.style.cursor = point ? 'pointer' : 'grab' })
      .ringLat('lat').ringLng('lng').ringColor(() => '#2deff2').ringMaxRadius(3.4).ringPropagationSpeed(2.4).ringRepeatPeriod(850)
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.35
    globe.controls().enablePan = false
    globe.pointOfView({ lat: 18, lng: 25, altitude: 2.05 })
    const resize = () => globe.width(container.clientWidth).height(container.clientHeight)
    const observer = new ResizeObserver(resize)
    observer.observe(container); resize(); globeRef.current = globe
    return () => { observer.disconnect(); globe._destructor(); globeRef.current = null }
  // globe only initializes once; points update in the next effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { globeRef.current?.pointsData(points).ringsData(points) }, [points])
  return <div className="datastream-earth" ref={containerRef} aria-label="Interactive 3D Earth with live event markers" />
}

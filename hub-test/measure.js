const puppeteer = require('puppeteer')
const path = require('path')

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 1 })
  const url = 'file:///' + path.resolve(__dirname, 'fixture.html').replace(/\\/g, '/')
  await page.goto(url, { waitUntil: 'networkidle0' })

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('.intelligence-panel')
    const list = document.querySelector('.hub-history-list')
    const listChildren = Array.from(list.children)
    const lastItem = listChildren[listChildren.length - 1]
    const pr = panel.getBoundingClientRect()
    const lr = list.getBoundingClientRect()
    const last = lastItem.getBoundingClientRect()
    const scroll = {
      clientHeight: list.clientHeight,
      scrollHeight: list.scrollHeight,
      scrollTop: list.scrollTop,
      overflowY: getComputedStyle(list).overflowY,
      maxHeight: getComputedStyle(list).maxHeight,
      display: getComputedStyle(list).display
    }
    return {
      panel: { top: pr.top, bottom: pr.bottom, height: pr.height, overflow: getComputedStyle(panel).overflow, display: getComputedStyle(panel).display, flexDir: getComputedStyle(panel).flexDirection },
      list: { top: lr.top, bottom: lr.bottom, height: lr.height, clientHeight: lr.height, scrollHeight: scroll.scrollHeight, scrollTop: scroll.scrollTop, overflowY: scroll.overflowY, maxHeight: scroll.maxHeight, display: scroll.display },
      lastItem: { bottom: last.bottom, visible: last.bottom <= pr.bottom }
    }
  })
  console.log(JSON.stringify(metrics, null, 2))

  await page.screenshot({ path: path.resolve(__dirname, 'fixture.png') })

  // Try scrolling the list and re-measure
  await page.evaluate(() => {
    const list = document.querySelector('.hub-history-list')
    list.scrollTop = list.scrollHeight
  })
  await new Promise((r) => setTimeout(r, 300))
  const afterScroll = await page.evaluate(() => {
    const list = document.querySelector('.hub-history-list')
    const items = Array.from(list.children)
    const last = items[items.length - 1].getBoundingClientRect()
    const pr = document.querySelector('.intelligence-panel').getBoundingClientRect()
    return { scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, lastBottom: last.bottom, panelBottom: pr.bottom, lastFullyVisible: last.bottom <= pr.bottom - 4, anyHorizontalOverflow: list.scrollWidth > list.clientWidth }
  })
  console.log('AFTER SCROLL:', JSON.stringify(afterScroll))

  // Degraded case: parent height chain collapses (command-dashboard height auto).
  await page.evaluate(() => {
    const dash = document.querySelector('.command-dashboard')
    dash.style.height = 'auto'
    const list = document.querySelector('.hub-history-list')
    list.scrollTop = list.scrollHeight
  })
  await new Promise((r) => setTimeout(r, 300))
  const degraded = await page.evaluate(() => {
    const list = document.querySelector('.hub-history-list')
    const pr = document.querySelector('.intelligence-panel')
    const items = Array.from(list.children)
    const last = items[items.length - 1].getBoundingClientRect()
    return {
      panelHeight: pr.getBoundingClientRect().height,
      listClientHeight: list.clientHeight,
      listScrollHeight: list.scrollHeight,
      listScrollTop: list.scrollTop,
      overflowY: getComputedStyle(list).overflowY,
      maxHeight: getComputedStyle(list).maxHeight,
      lastBottom: last.bottom,
      panelBottom: pr.getBoundingClientRect().bottom,
      lastFullyVisible: last.bottom <= pr.getBoundingClientRect().bottom - 4
    }
  })
  console.log('DEGRADED CASE:', JSON.stringify(degraded))

  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })

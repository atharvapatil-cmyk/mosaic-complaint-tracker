'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'

// Dynamic imports to avoid SSR issues with Chart.js
const ComplaintBarChart = dynamic(() => import('../components/charts/ComplaintBarChart'), { ssr: false })
const TrendLineChart = dynamic(() => import('../components/charts/TrendLineChart'), { ssr: false })
const PPMLineChart = dynamic(() => import('../components/charts/PPMLineChart'), { ssr: false })
const DonutChart = dynamic(() => import('../components/charts/DonutChart'), { ssr: false })

import {
  readSheet, parseComplaintRows, parseSalesRows,
  writeAnalysisColumns, writeHygieneColors, getSheetMetadata,
  ensureAnalysisHeaders, ensureSalesHeaders, writeSalesParsedColumns,
  SHEET_NAMES
} from '../lib/sheets-service.js'
import { runHygienePass, getHygieneSummary } from '../lib/hygiene-engine.js'
import { classifyVOC } from '../lib/voc-engine.js'
import { parseProduct, parseSalesProduct } from '../lib/product-parser.js'
import {
  getLastCompletedWeek, getLastCompletedMonth, getLastNDays,
  getWeeksForYear, getMonthsForYear, isInRange, parseDate,
  formatDate, formatWeekLabel, getWeekNumber
} from '../lib/week-calculator.js'
import {
  buildSalesLookup, aggregateComplaints,
  calculatePPMWeekly, calculatePPMMonthly, calculatePPMTrend
} from '../lib/ppm-calculator.js'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'

const BRANDS = ['MM', 'BB', 'LJ']
const BRAND_FULL = { MM: 'Man Matters', BB: 'Be Bodywise', LJ: 'Little Joys' }
const BRAND_COLORS = { MM: '#1a56db', BB: '#e11d48', LJ: '#059669' }

const BUCKET_COLORS = {
  'Delivery Issue': '#3b82f6',
  'Primary Packaging Issue': '#f59e0b',
  'Secondary Packaging Issue': '#8b5cf6',
  'Product Quality Issue': '#ef4444',
  'Infestation': '#dc2626',
  'Product Performance': '#06b6d4',
  'Technical Issue': '#64748b',
  'Other': '#9ca3af'
}

// âââ MAIN APP âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function Home() {
  const [accessToken, setAccessToken] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [toast, setToast] = useState(null)
  const [progress, setProgress] = useState(0)

  // Data state
  const [allData, setAllData] = useState({ MM: [], BB: [], LJ: [] })
  const [salesData, setSalesData] = useState([])
  const [salesLookup, setSalesLookup] = useState(null)
  const [sheetMeta, setSheetMeta] = useState({})
  const [lastLoaded, setLastLoaded] = useState(null)

  // Report filters
  const [reportType, setReportType] = useState('weekly')
  const [reportBrand, setReportBrand] = useState('ALL')
  const [reportView, setReportView] = useState('product') // 'product' | 'delivery'
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [availableWeeks, setAvailableWeeks] = useState([])
  const [availableMonths, setAvailableMonths] = useState([])

  const tokenClientRef = useRef(null)

  // ââ OAUTH INIT âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  useEffect(() => {
    const init = () => {
      if (!window.google) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
          if (resp.access_token) {
            setAccessToken(resp.access_token)
            showToast('â Connected to Google Sheets')
          } else {
            showToast('â Authentication failed')
          }
        }
      })
    }

    if (window.google) init()
    else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.onload = init
      document.head.appendChild(script)
    }
  }, [])

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const prevYear = year - 1
    const allWeeks = [...getWeeksForYear(prevYear), ...getWeeksForYear(year)]
    setAvailableWeeks(allWeeks.reverse())

    const allMonths = []
    for (let y = prevYear; y <= year; y++) {
      allMonths.push(...getMonthsForYear(y))
    }
    setAvailableMonths(allMonths.reverse())

    // Set defaults
    const lastWeek = getLastCompletedWeek(now)
    setSelectedWeek(lastWeek)
    const lastMonth = getLastCompletedMonth(now)
    setSelectedMonth(lastMonth)
  }, [])

  const showToast = (msg, duration = 3000) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  const handleConnect = () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast('â ï¸ Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local')
      return
    }
    tokenClientRef.current?.requestAccessToken()
  }

  // ââ LOAD ALL DATA âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const loadData = useCallback(async () => {
    if (!accessToken) { showToast('Connect Google Sheets first'); return }
    setLoading(true)
    setLoadingMsg('Loading sheet metadataâ¦')
    setProgress(5)

    try {
      const meta = await getSheetMetadata(accessToken)
      setSheetMeta(meta)

      const brands = {}
      const total = 4 // MM, BB, LJ, Sales
      let done = 0

      for (const brand of BRANDS) {
        setLoadingMsg(`Loading ${BRAND_FULL[brand]} dataâ¦`)
        const raw = await readSheet(SHEET_NAMES[brand], accessToken)
        const parsed = parseComplaintRows(raw, brand)
        brands[brand] = parsed
        done++
        setProgress(10 + (done / total) * 60)
      }

      setLoadingMsg('Loading Live Sales Dataâ¦')
      const rawSales = await readSheet(SHEET_NAMES.SALES, accessToken)
      const parsedSales = parseSalesRows(rawSales)

      // Parse product/packaging/flavour for sales if not already done
      const enrichedSales = parsedSales.map(r => {
        if (r.product) return r
        const parsed = parseSalesProduct(r.productName)
        return { ...r, ...parsed }
      })
      setSalesData(enrichedSales)

      setProgress(80)
      setLoadingMsg('Building sales lookupâ¦')
      const lookup = buildSalesLookup(enrichedSales)
      setSalesLookup(lookup)

      setAllData(brands)
      setLastLoaded(new Date())
      setProgress(100)
      showToast(`â Loaded ${Object.values(brands).reduce((s, b) => s + b.length, 0)} complaints + ${enrichedSales.length} sales rows`)
    } catch (err) {
      showToast(`â ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
      setLoadingMsg('')
      setTimeout(() => setProgress(0), 1000)
    }
  }, [accessToken])

  // ââ HYGIENE PASS ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const runHygiene = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)

    try {
      const updatedData = {}

      for (const brand of BRANDS) {
        setLoadingMsg(`Running hygiene on ${brand}â¦`)
        const processed = runHygienePass(allData[brand])
        updatedData[brand] = processed

        // Write colors to sheet
        const sheetId = sheetMeta[SHEET_NAMES[brand]]
        if (sheetId !== undefined) {
          setLoadingMsg(`Writing hygiene colors to ${brand}â¦`)
          await writeHygieneColors(SHEET_NAMES[brand], processed, sheetId, accessToken)
        }
      }

      setAllData(updatedData)
      showToast('â Hygiene pass complete â colors written to sheet')
    } catch (err) {
      showToast(`â ${err.message}`)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [accessToken, allData, sheetMeta])

  // ââ BUCKETING PASS ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const runBucketing = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)

    try {
      const updatedData = {}

      for (const brand of BRANDS) {
        const rows = allData[brand]
        const unprocessed = rows.filter(r => r.status !== 'Processed')

        if (unprocessed.length === 0) {
          updatedData[brand] = rows
          continue
        }

        setLoadingMsg(`Bucketing ${unprocessed.length} rows for ${brand}â¦`)

        const processed = rows.map(row => {
          if (row.status === 'Processed') return row

          const { bucket, subBucket } = classifyVOC(row.detailedVOC)
          const { product, packaging, flavour } = parseProduct(row.selectProduct)

          return {
            ...row,
            issueBucket: bucket,
            issueSubBucket: subBucket,
            product,
            packaging,
            flavour,
            status: 'Processed',
            acceptReject: row.hygieneStatus === 'clean' ? 'Accept' : 'Reject'
          }
        })

        // Ensure headers exist
        await ensureAnalysisHeaders(SHEET_NAMES[brand], accessToken)

        // Write to sheet
        setLoadingMsg(`Writing analysis to ${brand} sheetâ¦`)
        await writeAnalysisColumns(SHEET_NAMES[brand], processed, accessToken)

        updatedData[brand] = processed
      }

      setAllData(updatedData)
      showToast('â VOC bucketing complete')
    } catch (err) {
      showToast(`â ${err.message}`)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [accessToken, allData])

  // ââ GET ALL ROWS (optionally filtered by brand) ââââââââââââââââââââââââââ
  const getAllRows = useCallback((brand = 'ALL') => {
    if (brand === 'ALL') return [...allData.MM, ...allData.BB, ...allData.LJ]
    return allData[brand] || []
  }, [allData])

  // ââ GET REPORT DATA ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const getReportData = useCallback(() => {
    let dateRange

    if (reportType === 'weekly') {
      dateRange = selectedWeek || getLastCompletedWeek()
    } else if (reportType === 'monthly') {
      dateRange = selectedMonth || getLastCompletedMonth()
    } else {
      dateRange = getLastNDays(30)
    }

    const rows = getAllRows(reportBrand)
    return { ...aggregateComplaints(rows, dateRange.startDate, dateRange.endDate), dateRange }
  }, [reportType, reportBrand, selectedWeek, selectedMonth, getAllRows])

  // ââ TOTAL SUMMARY ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const totalSummary = (() => {
    const all = [...allData.MM, ...allData.BB, ...allData.LJ]
    return {
      total: all.length,
      processed: all.filter(r => r.status === 'Processed').length,
      accepted: all.filter(r => r.acceptReject === 'Accept').length,
      hygieneSummary: getHygieneSummary(all.filter(r => r.hygieneStatus))
    }
  })()

  // ââ RENDER âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <TopHeader
          accessToken={accessToken}
          onConnect={handleConnect}
          onLoadData={loadData}
          loading={loading}
          lastLoaded={lastLoaded}
          totalRows={totalSummary.total}
        />

        {/* Progress bar */}
        {progress > 0 && (
          <div className="h-1 bg-gray-200">
            <div
              className="h-1 bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center gap-3 text-sm text-blue-800">
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            {loadingMsg || 'Processingâ¦'}
          </div>
        )}

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              allData={allData}
              totalSummary={totalSummary}
              lastLoaded={lastLoaded}
              accessToken={accessToken}
              onConnect={handleConnect}
              onLoad={loadData}
              loading={loading}
            />
          )}

          {activeTab === 'hygiene' && (
            <HygieneView
              allData={allData}
              onRunHygiene={runHygiene}
              loading={loading}
              accessToken={accessToken}
            />
          )}

          {activeTab === 'bucketing' && (
            <BucketingView
              allData={allData}
              onRunBucketing={runBucketing}
              loading={loading}
              accessToken={accessToken}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              allData={allData}
              salesLookup={salesLookup}
              reportType={reportType}
              setReportType={setReportType}
              reportBrand={reportBrand}
              setReportBrand={setReportBrand}
              reportView={reportView}
              setReportView={setReportView}
              selectedWeek={selectedWeek}
              setSelectedWeek={setSelectedWeek}
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              availableWeeks={availableWeeks}
              availableMonths={availableMonths}
              getReportData={getReportData}
              getAllRows={getAllRows}
            />
          )}

          {activeTab === 'ppm' && (
            <PPMView
              allData={allData}
              salesLookup={salesLookup}
              selectedWeek={selectedWeek}
              selectedMonth={selectedMonth}
              availableWeeks={availableWeeks}
              availableMonths={availableMonths}
              setSelectedWeek={setSelectedWeek}
              setSelectedMonth={setSelectedMonth}
            />
          )}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ââ SIDEBAR ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function Sidebar({ activeTab, setActiveTab }) {
  const items = [
    { id: 'dashboard', icon: 'ð', label: 'Dashboard' },
    { id: 'hygiene', icon: 'ð§¹', label: 'Data Hygiene' },
    { id: 'bucketing', icon: 'ð§ ', label: 'VOC Bucketing' },
    { id: 'reports', icon: 'ð', label: 'Reports' },
    { id: 'ppm', icon: 'ð', label: 'PPM Analysis' },
  ]

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">M</div>
          <div>
            <div className="font-bold text-gray-900 text-sm">Mosaic QA</div>
            <div className="text-xs text-gray-400">Complaint Tracker</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {items.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Brand legend */}
      <div className="p-4 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Brands</div>
        {[['MM', '#1a56db', 'Man Matters'], ['BB', '#e11d48', 'Be Bodywise'], ['LJ', '#059669', 'Little Joys']].map(([code, color, name]) => (
          <div key={code} className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs text-gray-600">{code} â {name}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

// ââ TOP HEADER ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function TopHeader({ accessToken, onConnect, onLoadData, loading, lastLoaded, totalRows }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Complaint Analytics Tool</h1>
        {lastLoaded && (
          <p className="text-xs text-gray-400">
            Last loaded: {lastLoaded.toLocaleTimeString()} â¢ {totalRows} complaints
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {!accessToken ? (
          <button
            onClick={onConnect}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Sheets
          </button>
        ) : (
          <>
            <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium">
              â Connected
            </span>
            <button
              onClick={onLoadData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loadingâ¦' : 'â» Load Data'}
            </button>
          </>
        )}
      </div>
    </header>
  )
}

// ââ DASHBOARD VIEW ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function DashboardView({ allData, totalSummary, lastLoaded, accessToken, onConnect, onLoad, loading }) {
  const summary = getHygieneSummary([...allData.MM, ...allData.BB, ...allData.LJ].filter(r => r.hygieneStatus))
  const processedCount = [...allData.MM, ...allData.BB, ...allData.LJ].filter(r => r.status === 'Processed').length
  const totalCount = [...allData.MM, ...allData.BB, ...allData.LJ].length

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <div className="text-6xl mb-6">ð</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Connect Your Google Sheet</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Connect the QA Code V2 Google Sheet to start analysing complaints across Man Matters, Be Bodywise, and Little Joys.
        </p>
        <button
          onClick={onConnect}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors text-base"
        >
          Connect with Google
        </button>
        <div className="mt-10 bg-amber-50 border border-amber-200 rounded-xl p-5 max-w-lg text-left">
          <div className="font-semibold text-amber-800 mb-2">âï¸ Setup Required</div>
          <div className="text-sm text-amber-700 space-y-1">
            <p>1. Create a <code className="bg-amber-100 px-1 rounded">.env.local</code> file in the project root</p>
            <p>2. Add: <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id</code></p>
            <p>3. Set up Google Cloud OAuth 2.0 credentials with Sheets API enabled</p>
            <p>4. Add your deployment URL to authorized JavaScript origins</p>
          </div>
        </div>
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <div className="text-6xl mb-6">ð</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">No Data Loaded</h2>
        <p className="text-gray-500 mb-6">Click "Load Data" to fetch complaints from your Google Sheet.</p>
        <button onClick={onLoad} disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Loadingâ¦' : 'â» Load Data'}
        </button>
      </div>
    )
  }

  // Brand stats
  const brandStats = BRANDS.map(b => {
    const rows = allData[b]
    const hygiene = getHygieneSummary(rows.filter(r => r.hygieneStatus))
    return {
      brand: b, fullName: BRAND_FULL[b], color: BRAND_COLORS[b],
      total: rows.length,
      processed: rows.filter(r => r.status === 'Processed').length,
      accepted: rows.filter(r => r.acceptReject === 'Accept').length,
      hygiene
    }
  })

  // Bucket breakdown (all accepted rows)
  const allAccepted = [...allData.MM, ...allData.BB, ...allData.LJ].filter(r => r.acceptReject === 'Accept' && r.issueBucket)
  const bucketCounts = {}
  for (const row of allAccepted) {
    const b = row.issueBucket || 'Other'
    bucketCounts[b] = (bucketCounts[b] || 0) + 1
  }
  const bucketData = Object.entries(bucketCounts).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #1a56db 0%, #7e3af2 100%)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Complaint Dashboard</h2>
            <p className="text-blue-200 text-sm">Real-time analytics across all 3 brands</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{totalCount.toLocaleString()}</div>
            <div className="text-blue-200 text-sm">Total Complaints</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Accepted', value: summary.clean, color: 'bg-white/20', icon: 'â' },
            { label: 'Red (No Evidence)', value: summary.red, color: 'bg-red-400/30', icon: 'ð´' },
            { label: 'Yellow (Duplicate)', value: summary.yellow, color: 'bg-yellow-400/30', icon: 'ð¡' },
            { label: 'Processed', value: processedCount, color: 'bg-green-400/30', icon: 'âï¸' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-3 backdrop-blur-sm`}>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-blue-100 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand cards */}
      <div className="grid grid-cols-3 gap-5">
        {brandStats.map(b => (
          <div key={b.brand} className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: b.color }}>
                  {b.brand}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{b.fullName}</div>
                  <div className="text-xs text-gray-400">{b.total} total complaints</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <StatRow label="Accepted" value={b.accepted} color="text-green-600" />
              <StatRow label="Red rows" value={b.hygiene.red} color="text-red-600" />
              <StatRow label="Yellow rows" value={b.hygiene.yellow} color="text-yellow-600" />
              <StatRow label="Processed" value={b.processed} color="text-blue-600" />
            </div>
          </div>
        ))}
      </div>

      {/* Issue distribution */}
      {bucketData.length > 0 && (
        <div className="grid grid-cols-2 gap-5">
          <div className="stat-card">
            <h3 className="font-bold text-gray-900 mb-4">Issue Category Distribution</h3>
            <div className="space-y-3">
              {bucketData.map(([bucket, count]) => (
                <div key={bucket}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{bucket}</span>
                    <span className="text-gray-500">{count} ({allAccepted.length > 0 ? ((count / allAccepted.length) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${allAccepted.length > 0 ? (count / allAccepted.length) * 100 : 0}%`,
                        background: BUCKET_COLORS[bucket] || '#9ca3af'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stat-card">
            <h3 className="font-bold text-gray-900 mb-4">Brand Comparison</h3>
            <DonutChart
              data={BRANDS.map(b => allData[b].filter(r => r.acceptReject === 'Accept').length)}
              labels={BRANDS.map(b => `${b} â ${BRAND_FULL[b]}`)}
              colors={BRANDS.map(b => BRAND_COLORS[b])}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  )
}

// ââ HYGIENE VIEW ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function HygieneView({ allData, onRunHygiene, loading, accessToken }) {
  const [filterBrand, setFilterBrand] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')

  const rows = filterBrand === 'ALL'
    ? [...allData.MM.map(r => ({ ...r, brand: 'MM' })),
    ...allData.BB.map(r => ({ ...r, brand: 'BB' })),
    ...allData.LJ.map(r => ({ ...r, brand: 'LJ' }))]
    : (allData[filterBrand] || []).map(r => ({ ...r, brand: filterBrand }))

  const hygieneRows = rows.filter(r => r.hygieneStatus)
  const filtered = filterStatus === 'ALL' ? hygieneRows
    : hygieneRows.filter(r => r.hygieneStatus === filterStatus)

  const summary = getHygieneSummary(hygieneRows)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ð§¹ Data Hygiene</h2>
          <p className="text-sm text-gray-500 mt-1">Identifies invalid (red) and duplicate (yellow) complaints</p>
        </div>
        <button
          onClick={onRunHygiene}
          disabled={loading || !accessToken || rows.length === 0}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'â³ Runningâ¦' : 'â¶ Run Hygiene Pass'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Rows', value: summary.total, color: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' },
          { label: 'â Clean', value: summary.clean, color: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
          { label: 'ð´ Red (Invalid)', value: summary.red, color: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
          { label: 'ð¡ Yellow (Duplicate)', value: summary.yellow, color: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
        ].map(s => (
          <div key={s.label} className={`${s.color} border ${s.border} rounded-xl p-4`}>
            <div className={`text-3xl font-bold ${s.text}`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            {s.value > 0 && summary.total > 0 && (
              <div className="text-xs text-gray-400 mt-0.5">
                {((s.value / summary.total) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ALL">All Brands</option>
          {BRANDS.map(b => <option key={b} value={b}>{b} â {BRAND_FULL[b]}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ALL">All Status</option>
          <option value="clean">â Clean</option>
          <option value="red">ð´ Red</option>
          <option value="yellow">ð¡ Yellow</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} rows shown</span>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
        <div className="font-semibold text-gray-700 mb-2">Hygiene Rules:</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded bg-red-200 flex-shrink-0 mt-0.5" />
            <div><strong>Red:</strong> No image evidence (Google Drive link) AND no valid batch number. These are unverifiable and excluded from reports.</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 rounded bg-yellow-200 flex-shrink-0 mt-0.5" />
            <div><strong>Yellow:</strong> Duplicate Order ID â same order logged more than once in the same sheet. Only the first entry is valid.</div>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Brand</th>
                  <th>Timestamp</th>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>VOC (preview)</th>
                  <th>Batch #</th>
                  <th>Image?</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((row, i) => (
                  <tr key={i} className={row.hygieneStatus === 'red' ? 'row-red' : row.hygieneStatus === 'yellow' ? 'row-yellow' : ''}>
                    <td>
                      <span className={`badge ${row.hygieneStatus === 'red' ? 'badge-red' : row.hygieneStatus === 'yellow' ? 'badge-yellow' : 'badge-green'}`}>
                        {row.hygieneStatus === 'red' ? 'ð´ Red' : row.hygieneStatus === 'yellow' ? 'ð¡ Dupe' : 'â Clean'}
                      </span>
                    </td>
                    <td><span className="badge badge-blue">{row.brand}</span></td>
                    <td className="text-xs">{row.timestamp?.slice(0, 10)}</td>
                    <td className="font-mono text-xs">{row.orderId}</td>
                    <td className="max-w-xs truncate text-xs">{row.selectProduct}</td>
                    <td className="max-w-xs truncate text-xs text-gray-500">{row.detailedVOC?.slice(0, 80)}</td>
                    <td className="text-xs font-mono">{row.batchNumber || 'â'}</td>
                    <td className="text-center">{[row.uploadImagesVideos, row.image1, row.image2].some(v => v?.includes('drive.google')) ? 'â' : 'â'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <div className="p-4 text-center text-sm text-gray-400">
              Showing 200 of {filtered.length} rows
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          {rows.length === 0 ? 'Load data first, then run hygiene pass.' : 'No rows match the selected filter.'}
        </div>
      )}
    </div>
  )
}

// ââ BUCKETING VIEW ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function BucketingView({ allData, onRunBucketing, loading, accessToken }) {
  const [filterBrand, setFilterBrand] = useState('ALL')

  const rows = filterBrand === 'ALL'
    ? [...allData.MM, ...allData.BB, ...allData.LJ]
    : (allData[filterBrand] || [])

  const processed = rows.filter(r => r.status === 'Processed')
  const unprocessed = rows.filter(r => r.status !== 'Processed')

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ð§  VOC Bucketing</h2>
          <p className="text-sm text-gray-500 mt-1">
            Classify complaints into 7 buckets & 32 sub-buckets. Extract Product, Packaging, Flavour.
          </p>
        </div>
        <button
          onClick={onRunBucketing}
          disabled={loading || !accessToken || unprocessed.length === 0}
          className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'â³ Processingâ¦' : `â¶ Process ${unprocessed.length} Unprocessed Rows`}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-3xl font-bold text-gray-800">{rows.length}</div>
          <div className="text-sm text-gray-500 mt-1">Total Rows</div>
        </div>
        <div className="stat-card">
          <div className="text-3xl font-bold text-green-600">{processed.length}</div>
          <div className="text-sm text-gray-500 mt-1">Processed</div>
          <div className="text-xs text-gray-400">{rows.length > 0 ? ((processed.length / rows.length) * 100).toFixed(0) : 0}% complete</div>
        </div>
        <div className="stat-card">
          <div className="text-3xl font-bold text-orange-500">{unprocessed.length}</div>
          <div className="text-sm text-gray-500 mt-1">Pending</div>
        </div>
      </div>

      {/* Filter + sample preview */}
      <div className="flex gap-3">
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="ALL">All Brands</option>
          {BRANDS.map(b => <option key={b} value={b}>{b} â {BRAND_FULL[b]}</option>)}
        </select>
      </div>

      {/* Processed rows preview */}
      {processed.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Processed Complaints (Sample)</h3>
            <span className="text-xs text-gray-400">Showing first 150</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Timestamp</th>
                  <th>Order ID</th>
                  <th>Issue Bucket</th>
                  <th>Sub-Bucket</th>
                  <th>Product</th>
                  <th>Packaging</th>
                  <th>Flavour</th>
                  <th>Accept/Reject</th>
                </tr>
              </thead>
              <tbody>
                {processed.slice(0, 150).map((row, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-blue" style={{ background: BRAND_COLORS[row.brand] + '20', color: BRAND_COLORS[row.brand] }}>{row.brand}</span></td>
                    <td className="text-xs">{row.timestamp?.slice(0, 10)}</td>
                    <td className="font-mono text-xs">{row.orderId}</td>
                    <td>
                      <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: (BUCKET_COLORS[row.issueBucket] || '#9ca3af') + '20', color: BUCKET_COLORS[row.issueBucket] || '#9ca3af' }}>
                        {row.issueBucket}
                      </span>
                    </td>
                    <td className="text-xs text-gray-600">{row.issueSubBucket}</td>
                    <td className="text-xs max-w-xs truncate">{row.product}</td>
                    <td className="text-xs">{row.packaging}</td>
                    <td className="text-xs">{row.flavour}</td>
                    <td>
                      <span className={`badge ${row.acceptReject === 'Accept' ? 'badge-green' : 'badge-red'}`}>
                        {row.acceptReject}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ââ REPORTS VIEW ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function ReportsView({
  allData, salesLookup, reportType, setReportType, reportBrand, setReportBrand,
  reportView, setReportView, selectedWeek, setSelectedWeek, selectedMonth, setSelectedMonth,
  availableWeeks, availableMonths, getReportData, getAllRows
}) {
  const reportData = getReportData()

  const getDateRangeLabel = () => {
    if (reportType === 'weekly' && selectedWeek) {
      return `Week ${selectedWeek.weekNum || '?'} (${formatDate(selectedWeek.startDate)} â ${formatDate(selectedWeek.endDate)})`
    }
    if (reportType === 'monthly' && selectedMonth) {
      return `${selectedMonth.label}`
    }
    return 'Last 30 Days'
  }

  // Prev period for comparison
  const getPrevPeriodData = () => {
    try {
      let prevRange
      if (reportType === 'weekly' && selectedWeek) {
        const prevWeekNum = selectedWeek.weekNum > 1 ? selectedWeek.weekNum - 1 : 52
        const prevYear = selectedWeek.weekNum > 1 ? selectedWeek.year : selectedWeek.year - 1
        const { startDate, endDate } = getLastCompletedWeek()
        // simplified: get last week
        prevRange = { startDate: new Date(selectedWeek.startDate - 7 * 86400000), endDate: new Date(selectedWeek.startDate - 1) }
      } else if (reportType === 'monthly' && selectedMonth) {
        const prevEnd = new Date(selectedMonth.startDate - 1)
        const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1)
        prevRange = { startDate: prevStart, endDate: prevEnd }
      } else {
        prevRange = getLastNDays(30, new Date(getLastNDays(30).startDate))
        return null
      }

      const rows = getAllRows(reportBrand)
      return aggregateComplaints(rows, prevRange.startDate, prevRange.endDate)
    } catch { return null }
  }

  const prevData = getPrevPeriodData()

  return (
    <div className="space-y-5">
      {/* Report controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Period type */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Period</label>
            <div className="flex gap-1">
              {['weekly', 'monthly', 'last30'].map(t => (
                <button key={t} onClick={() => setReportType(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t === 'weekly' ? 'Weekly' : t === 'monthly' ? 'Monthly' : 'Last 30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Date selector */}
          {reportType === 'weekly' && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Week</label>
              <select
                value={selectedWeek ? `${selectedWeek.year}-${selectedWeek.weekNum}` : ''}
                onChange={e => {
                  const [year, weekNum] = e.target.value.split('-').map(Number)
                  const w = availableWeeks.find(w => w.year === year && w.weekNum === weekNum)
                  if (w) setSelectedWeek(w)
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                {availableWeeks.map(w => (
                  <option key={`${w.year}-${w.weekNum}`} value={`${w.year}-${w.weekNum}`}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'monthly' && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Month</label>
              <select
                value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ''}
                onChange={e => {
                  const [year, month] = e.target.value.split('-').map(Number)
                  const m = availableMonths.find(m => m.year === year && m.month === month)
                  if (m) setSelectedMonth(m)
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                {availableMonths.map(m => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Brand */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Brand</label>
            <div className="flex gap-1">
              {['ALL', 'MM', 'BB', 'LJ'].map(b => (
                <button key={b} onClick={() => setReportBrand(b)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportBrand === b ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={reportBrand === b ? { background: b === 'ALL' ? '#1a56db' : BRAND_COLORS[b] } : {}}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* View type */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Report Type</label>
            <div className="flex gap-1">
              <button onClick={() => setReportView('product')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportView === 'product' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                ð¦ Product Issues
              </button>
              <button onClick={() => setReportView('delivery')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportView === 'delivery' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                ð Delivery Issues
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report header */}
      <div className="rounded-xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #6d28d9 100%)' }}>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-blue-200 text-sm mb-1">
              {reportView === 'delivery' ? 'ð Delivery Issue Report' : 'ð¦ Product Issue Report (Excl. Delivery)'}
            </div>
            <h2 className="text-xl font-bold">{getDateRangeLabel()}</h2>
            <p className="text-blue-200 text-sm mt-1">
              Brand: {reportBrand === 'ALL' ? 'All Brands Combined' : `${BRAND_FULL[reportBrand]} (${reportBrand})`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">
              {reportView === 'delivery'
                ? (reportData.byBucket['Delivery Issue'] || 0)
                : reportData.accepted - (reportData.byBucket['Delivery Issue'] || 0)
              }
            </div>
            <div className="text-blue-200 text-sm">
              {reportView === 'delivery' ? 'Delivery Complaints' : 'Product Complaints'}
            </div>
          </div>
        </div>
      </div>

      {/* Brand summary (if ALL selected) */}
      {reportBrand === 'ALL' && (
        <BrandPerformanceTable allData={allData} reportData={reportData} prevData={prevData} reportView={reportView} />
      )}

      {/* Issue Category Breakdown */}
      <BucketBreakdown reportData={reportData} prevData={prevData} reportView={reportView} />

      {/* SKU Performance */}
      <SKUPerformance reportData={reportData} prevData={prevData} reportView={reportView} />

      {/* Charts */}
      <div className="grid grid-cols-2 gap-5">
        <div className="chart-container">
          <h3 className="font-bold text-gray-900 mb-4">Issue Category Distribution</h3>
          <ComplaintBarChart reportData={reportData} reportView={reportView} />
        </div>
        <div className="chart-container">
          <h3 className="font-bold text-gray-900 mb-4">Brand Breakdown</h3>
          <DonutChart
            data={BRANDS.map(b => {
              const bRows = getAllRows(b)
              const bData = aggregateComplaints(bRows,
                reportData.dateRange?.startDate || new Date(0),
                reportData.dateRange?.endDate || new Date())
              return reportView === 'delivery'
                ? (bData.byBucket['Delivery Issue'] || 0)
                : bData.accepted - (bData.byBucket['Delivery Issue'] || 0)
            })}
            labels={BRANDS.map(b => `${b} â ${BRAND_FULL[b]}`)}
            colors={BRANDS.map(b => BRAND_COLORS[b])}
          />
        </div>
      </div>
    </div>
  )
}

function BrandPerformanceTable({ allData, reportData, prevData, reportView }) {
  const getCount = (data, view) => {
    if (!data) return 0
    return view === 'delivery'
      ? (data.byBucket['Delivery Issue'] || 0)
      : data.accepted - (data.byBucket['Delivery Issue'] || 0)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">Brand Performance Overview</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th>This Period</th>
            <th>Previous Period</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {BRANDS.map(brand => {
            const bRows = allData[brand]
            const bData = reportData.dateRange ? aggregateComplaints(bRows, reportData.dateRange.startDate, reportData.dateRange.endDate) : null
            const curr = getCount(bData, reportView)
            const prev = prevData ? getCount(
              aggregateComplaints(bRows, prevData.dateRange?.startDate || new Date(0), prevData.dateRange?.endDate || new Date()),
              reportView
            ) : null
            const change = prev !== null && prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : null

            return (
              <tr key={brand}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: BRAND_COLORS[brand] }} />
                    <span className="font-medium">{brand} â {BRAND_FULL[brand]}</span>
                  </div>
                </td>
                <td className="font-bold text-gray-900">{curr}</td>
                <td className="text-gray-500">{prev !== null ? prev : 'â'}</td>
                <td>
                  {change !== null ? (
                    <span className={parseFloat(change) > 0 ? 'change-up' : parseFloat(change) < 0 ? 'change-down' : 'text-gray-500'}>
                      {parseFloat(change) > 0 ? 'â²' : 'â¼'} {Math.abs(parseFloat(change))}%
                    </span>
                  ) : 'â'}
                </td>
              </tr>
            )
          })}
          <tr className="font-bold bg-gray-50">
            <td>Total (All Brands)</td>
            <td>{getCount(reportData, reportView)}</td>
            <td>{prevData ? getCount(prevData, reportView) : 'â'}</td>
            <td>
              {prevData && getCount(prevData, reportView) > 0 ? (
                <span className={getCount(reportData, reportView) > getCount(prevData, reportView) ? 'change-up' : 'change-down'}>
                  {getCount(reportData, reportView) > getCount(prevData, reportView) ? 'â²' : 'â¼'}{' '}
                  {Math.abs(((getCount(reportData, reportView) - getCount(prevData, reportView)) / getCount(prevData, reportView)) * 100).toFixed(1)}%
                </span>
              ) : 'â'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function BucketBreakdown({ reportData, prevData, reportView }) {
  const { byBucket, bySubBucket } = reportData

  const DELIVERY_BUCKET = 'Delivery Issue'
  const bucketsToShow = reportView === 'delivery'
    ? Object.entries(byBucket).filter(([k]) => k === DELIVERY_BUCKET)
    : Object.entries(byBucket).filter(([k]) => k !== DELIVERY_BUCKET)

  if (bucketsToShow.length === 0) {
    return <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No data for selected period</div>
  }

  const totalForView = bucketsToShow.reduce((s, [, v]) => s + v, 0)

  const BUCKET_BORDER_COLORS = {
    'Delivery Issue': '#3b82f6',
    'Primary Packaging Issue': '#f59e0b',
    'Secondary Packaging Issue': '#8b5cf6',
    'Product Quality Issue': '#ef4444',
    'Infestation': '#dc2626',
    'Product Performance': '#06b6d4',
    'Technical Issue': '#64748b',
    'Other': '#9ca3af'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">Issue Category Analysis</h3>
        <p className="text-xs text-gray-400 mt-0.5">Book-index style â buckets with sub-bucket breakdown</p>
      </div>
      <div className="p-5 space-y-5">
        {bucketsToShow.sort((a, b) => b[1] - a[1]).map(([bucket, count]) => {
          const prevCount = prevData?.byBucket?.[bucket] || 0
          const change = prevCount > 0 ? ((count - prevCount) / prevCount * 100).toFixed(1) : null
          const pct = totalForView > 0 ? ((count / totalForView) * 100).toFixed(1) : '0'
          const color = BUCKET_BORDER_COLORS[bucket] || '#9ca3af'

          // Sub-buckets for this bucket
          const subEntries = Object.entries(bySubBucket || {})
            .filter(([key]) => key.startsWith(bucket + ' > '))
            .map(([key, val]) => [key.replace(bucket + ' > ', ''), val])
            .sort((a, b) => b[1] - a[1])

          return (
            <div key={bucket} className="bucket-section" style={{ borderColor: color }}>
              <div className="flex items-center justify-between mb-3">
                <div className="bucket-header flex items-center gap-2">
                  <span className="text-xl font-bold" style={{ color }}>{count}</span>
                  <span>{bucket}</span>
                  <span className="text-xs text-gray-400 font-normal">({pct}% of total)</span>
                </div>
                {change !== null && (
                  <span className={parseFloat(change) > 0 ? 'change-up text-sm' : 'change-down text-sm'}>
                    {parseFloat(change) > 0 ? 'â²' : 'â¼'} {Math.abs(parseFloat(change))}%
                    <span className="text-gray-400 font-normal ml-1">vs prev</span>
                  </span>
                )}
              </div>

              {subEntries.length > 0 && (
                <div className="space-y-1">
                  {subEntries.map(([sub, cnt]) => (
                    <div key={sub} className="subbucket-row">
                      <span className="text-gray-600">â³ {sub}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-1.5 rounded-full" style={{ width: `${(cnt / count) * 100}%`, background: color }} />
                        </div>
                        <span className="font-bold text-gray-800 text-sm w-6 text-right">{cnt}</span>
                        <span className="text-gray-400 text-xs w-10 text-right">{count > 0 ? ((cnt / count) * 100).toFixed(0) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div className="border-t border-gray-200 pt-3 flex justify-between items-center font-bold text-gray-900">
          <span>TOTAL</span>
          <span>{totalForView}</span>
        </div>
      </div>
    </div>
  )
}

function SKUPerformance({ reportData, prevData, reportView }) {
  const rows = (reportData.rows || []).filter(r => {
    if (reportView === 'delivery') return r.issueBucket === 'Delivery Issue'
    return r.issueBucket !== 'Delivery Issue' && r.acceptReject === 'Accept'
  })

  const productCounts = {}
  for (const row of rows) {
    const key = row.product || row.selectProduct || 'Unknown'
    productCounts[key] = productCounts[key] || { product: key, count: 0, brand: row.brand }
    productCounts[key].count++
  }

  const ranked = Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 10)
  if (ranked.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">SKU Performance (Top 10)</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>Rank</th><th>Product</th><th>Brand</th><th>Count</th><th>% of Total</th></tr>
        </thead>
        <tbody>
          {ranked.map((item, i) => (
            <tr key={item.product}>
              <td className="font-bold text-gray-400">#{i + 1}</td>
              <td className="font-medium text-gray-900">{item.product}</td>
              <td>
                <span className="badge" style={{ background: BRAND_COLORS[item.brand] + '20', color: BRAND_COLORS[item.brand] }}>
                  {item.brand}
                </span>
              </td>
              <td className="font-bold">{item.count}</td>
              <td>{rows.length > 0 ? ((item.count / rows.length) * 100).toFixed(1) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ââ PPM VIEW ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function PPMView({ allData, salesLookup, selectedWeek, selectedMonth, availableWeeks, availableMonths, setSelectedWeek, setSelectedMonth }) {
  const [ppmPeriod, setPpmPeriod] = useState('weekly')
  const [ppmBrand, setPpmBrand] = useState('ALL')
  const [ppmData, setPpmData] = useState([])

  useEffect(() => {
    if (!salesLookup) return

    const allRows = ppmBrand === 'ALL'
      ? [...allData.MM, ...allData.BB, ...allData.LJ]
      : (allData[ppmBrand] || [])

    let results = []
    if (ppmPeriod === 'weekly' && selectedWeek) {
      results = calculatePPMWeekly(allRows, salesLookup, selectedWeek.year, selectedWeek.weekNum)
    } else if (ppmPeriod === 'monthly' && selectedMonth) {
      results = calculatePPMMonthly(allRows, salesLookup, selectedMonth.year, selectedMonth.month)
    }
    setPpmData(results)
  }, [ppmPeriod, ppmBrand, selectedWeek, selectedMonth, allData, salesLookup])

  const getPPMClass = (ppm) => {
    if (ppm === null || ppm === undefined) return 'text-gray-400'
    if (ppm >= 10000) return 'ppm-critical'
    if (ppm >= 5000) return 'ppm-high'
    if (ppm >= 1000) return 'ppm-medium'
    return 'ppm-low'
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">ð PPM Analysis</h2>
        <p className="text-sm text-gray-500 mt-1">Parts Per Million = (Complaints Ã· Units Sold) Ã 1,000,000</p>
      </div>

      {!salesLookup && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          â ï¸ Load data first to build the sales lookup. PPM requires both complaint data and Live Sales Data.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Period</label>
            <div className="flex gap-1">
              {['weekly', 'monthly'].map(t => (
                <button key={t} onClick={() => setPpmPeriod(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${ppmPeriod === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t === 'weekly', ? 'Weekly  : 'Monthly'}
              </button>
                ))}
            </div>
          </div>
          </button>
              ))}
            </div>
          </div>

          {ppmPeriod === 'weekly' && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Week</label>
              <select value={selectedWeek ? `${selectedWeek.year}-${selectedWeek.weekNum}` : ''}
                onChange={e => {
                  const [year, weekNum] = e.target.value.split('-').map(Number)
                  const w = availableWeeks.find(w => w.year === year && w.weekNum === weekNum)
                  if (w) setSelectedWeek(w)
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
                {availableWeeks.map(w => (
                  <option key={`${w.year}-${w.weekNum}`} value={`${w.year}-${w.weekNum}`}>{w.label}</option>
                ))}
              </select>
            </div>
          )}

          {ppmPeriod === 'monthly' && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Month</label>
              <select value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ''}
                onChange={e => {
                  const [year, month] = e.target.value.split('-').map(Number)
                  const m = availableMonths.find(m => m.year === year && m.month === month)
                  if (m) setSelectedMonth(m)
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white">
                {availableMonths.map(m => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase block mb-1">Brand</label>
            <div className="flex gap-1">
              {['ALL', 'MM', 'BB', 'LJ'].map(b => (
                <button key={b} onClick={() => setPpmBrand(b)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${ppmBrand === b ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  style={ppmBrand === b ? { background: b === 'ALL' ? '#1a56db' : BRAND_COLORS[b] } : {}}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PPM Table */}
      {ppmData.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900">PPM by Product â Ranked (High to Low)</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="ppm-critical">â </span> â¥10,000 Critical &nbsp;
                <span className="ppm-high">â </span> 5,000â9,999 High &nbsp;
                <span className="ppm-medium">â </span> 1,000â4,999 Medium &nbsp;
                <span className="ppm-low">â </span> &lt;1,000 Low
              </p>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product</th>
                <th>Packaging</th>
                <th>Flavour</th>
                <th>Complaints</th>
                <th>Units Sold</th>
                <th>PPM</th>
                <th>Top Issue</th>
              </tr>
            </thead>
            <tbody>
              {ppmData.map((item, i) => {
                const topIssue = Object.entries(item.issueBreakdown || {}).sort((a, b) => b[1] - a[1])[0]
                return (
                  <tr key={i}>
                    <td className="font-bold text-gray-400">#{i + 1}</td>
                    <td className="font-medium text-gray-900 max-w-xs truncate">{item.product || item.selectProduct}</td>
                    <td className="text-xs text-gray-500">{item.packaging}</td>
                    <td className="text-xs text-gray-500">{item.flavour}</td>
                    <td className="font-bold">{item.complaints}</td>
                    <td className="text-gray-600">{item.unitsSold.toLocaleString()}</td>
                    <td className={`font-bold text-lg ${getPPMClass(item.ppm)}`}>
                      {item.ppm !== null ? item.ppm.toLocaleString() : 'N/A'}
                    </td>
                    <td>
                      {topIssue && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: (BUCKET_COLORS[topIssue[0]] || '#9ca3af') + '20', color: BUCKET_COLORS[topIssue[0]] || '#9ca3af' }}>
                          {topIssue[0]} ({topIssue[1]})
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          {!salesLookup ? 'Load data first.' : 'No PPM data for selected period.'}
        </div>
      )}

      {/* PPM Chart */}
      {ppmData.filter(d => d.ppm !== null).length > 0 && (
        <div className="chart-container">
          <h3 className="font-bold text-gray-900 mb-4">PPM Distribution (Top 15 Products)</h3>
          <PPMLineChart ppmData={ppmData.filter(d => d.ppm !== null).slice(0, 15)} />
        </div>
      )}
    </div>
  )
}

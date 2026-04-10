/**
 * PPM CALCULATOR - Parts Per Million
 * PPM = (Complaints / Units Sold) x 1,000,000
 */

import { normalizeProductForMatching } from './product-parser.js'
import { getWeekNumber, isInRange, parseDate } from './week-calculator.js'

function normKey(str) {
  return normalizeProductForMatching(str).replace(/\s+/g, '')
}

export function buildSalesLookup(salesRows) {
  const byProductWeek = {}
  const byProductMonth = {}

  for (const row of salesRows) {
    if (!row.orderDate || !row.productName) continue
    const date = parseDate(row.orderDate)
    if (!date) continue
    const year = date.getFullYear()
    const week = getWeekNumber(date)
    const month = date.getMonth() + 1
    const units = parseFloat(row.unitsSold) || 0
    if (units <= 0) continue
    const rawKey = [row.product || '', row.packaging || '', row.flavour || ''].filter(Boolean).join('_')
    const productKey = normKey(rawKey || row.productName)
    const weekKey = `${productKey}|W${week}|${year}`
    byProductWeek[weekKey] = (byProductWeek[weekKey] || 0) + units
    const monthKey = `${productKey}|M${month}|${year}`
    byProductMonth[monthKey] = (byProductMonth[monthKey] || 0) + units
  }

  return { byProductWeek, byProductMonth }
}

export function calculatePPMWeekly(complaintRows, salesLookup, year, weekNum) {
  const { byProductWeek } = salesLookup
  const complaintsByProduct = {}

  for (const row of complaintRows) {
    const date = parseDate(row.timestamp)
    if (!date) continue
    if (getWeekNumber(date) !== weekNum || date.getFullYear() !== year) continue
    if (row.hygieneStatus === 'red' || row.hygieneStatus === 'yellow') continue
    const key = normKey([row.product, row.packaging, row.flavour].filter(Boolean).join('_') || row.selectProduct)
    if (!key) continue
    complaintsByProduct[key] = complaintsByProduct[key] || {
      product: row.product, packaging: row.packaging, flavour: row.flavour,
      selectProduct: row.selectProduct, complaints: 0, issueBreakdown: {}
    }
    complaintsByProduct[key].complaints += 1
    const bucket = row.issueBucket || 'Other'
    complaintsByProduct[key].issueBreakdown[bucket] = (complaintsByProduct[key].issueBreakdown[bucket] || 0) + 1
  }

  const results = []
  for (const [productKey, data] of Object.entries(complaintsByProduct)) {
    const salesKey = `${productKey}|W${weekNum}|${year}`
    const unitsSold = byProductWeek[salesKey] || 0
    const ppm = unitsSold > 0 ? ((data.complaints / unitsSold) * 1000000) : null
    results.push({ ...data, unitsSold, ppm: ppm !== null ? parseFloat(ppm.toFixed(2)) : null, weekNum, year })
  }
  return results.sort((a, b) => (b.ppm || 0) - (a.ppm || 0))
}

export function calculatePPMMonthly(complaintRows, salesLookup, year, month) {
  const { byProductMonth } = salesLookup
  const complaintsByProduct = {}

  for (const row of complaintRows) {
    const date = parseDate(row.timestamp)
    if (!date) continue
    if (date.getMonth() + 1 !== month || date.getFullYear() !== year) continue
    if (row.hygieneStatus === 'red' || row.hygieneStatus === 'yellow') continue
    const key = normKey([row.product, row.packaging, row.flavour].filter(Boolean).join('_') || row.selectProduct)
    if (!key) continue
    complaintsByProduct[key] = complaintsByProduct[key] || {
      product: row.product, packaging: row.packaging, flavour: row.flavour,
      complaints: 0, issueBreakdown: {}
    }
    complaintsByProduct[key].complaints += 1
    const bucket = row.issueBucket || 'Other'
    complaintsByProduct[key].issueBreakdown[bucket] = (complaintsByProduct[key].issueBreakdown[bucket] || 0) + 1
  }

  const results = []
  for (const [productKey, data] of Object.entries(complaintsByProduct)) {
    const salesKey = `${productKey}|M${month}|${year}`
    const unitsSold = byProductMonth[salesKey] || 0
    const ppm = unitsSold > 0 ? parseFloat(((data.complaints / unitsSold) * 1000000).toFixed(2)) : null
    results.push({ ...data, unitsSold, ppm, month, year })
  }
  return results.sort((a, b) => (b.ppm || 0) - (a.ppm || 0))
}

export function calculatePPMTrend(complaintRows, salesLookup, year, weeksBack = 8) {
  const today = new Date()
  const currentWeek = getWeekNumber(today)
  const lastCompleted = currentWeek > 1 ? currentWeek - 1 : 52
  const weekResults = []
  for (let i = weeksBack - 1; i >= 0; i--) {
    let w = lastCompleted - i
    let y = year
    if (w < 1) { w += 52; y -= 1 }
    weekResults.push({ weekNum: w, year: y, data: calculatePPMWeekly(complaintRows, salesLookup, y, w) })
  }
  return weekResults
}

export function aggregateComplaints(rows, startDate, endDate) {
  const filtered = rows.filter(row => {
    const date = parseDate(row.timestamp)
    if (!date) return false
    return isInRange(date, startDate, endDate)
  })

  const total = filtered.length
  const accepted = filtered.filter(r => r.acceptReject === 'Accept').length
  const rejected = total - accepted
  const byBucket = {}
  const byBrand = { MM: 0, BB: 0, LJ: 0 }
  const byProduct = {}
  const bySubBucket = {}

  for (const row of filtered) {
    if (row.acceptReject !== 'Accept') continue
    const bucket = row.issueBucket || 'Other'
    byBucket[bucket] = (byBucket[bucket] || 0) + 1
    const sub = row.issueSubBucket || 'Other'
    const subKey = `${bucket} > ${sub}`
    bySubBucket[subKey] = (bySubBucket[subKey] || 0) + 1
    if (row.brand && byBrand[row.brand] !== undefined) byBrand[row.brand] += 1
    const productKey = row.product || row.selectProduct || 'Unknown'
    byProduct[productKey] = (byProduct[productKey] || 0) + 1
  }

  const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
  return { total, accepted, rejected, byBucket, bySubBucket, byBrand, topProducts, rows: filtered }
      }

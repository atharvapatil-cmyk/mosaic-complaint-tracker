/**
 * HYGIENE ENGINE — Mosaic Wellness Complaint Tracker
 * Identifies RED (no evidence) and YELLOW (duplicate order) rows
 */

// ─── GOOGLE DRIVE LINK DETECTION ─────────────────────────────────────────
export function isValidGoogleDriveLink(value) {
  if (!value || typeof value !== 'string') return false
  const v = value.trim().toLowerCase()
  return (
    v.includes('drive.google.com') ||
    v.includes('docs.google.com') ||
    v.includes('googleapis.com') ||
    v.startsWith('https://drive') ||
    v.startsWith('http://drive')
  )
}

export function hasImageEvidence(row) {
  const imageCols = [row.uploadImagesVideos, row.image1, row.image2, row.image3, row.image4, row.image5]
  return imageCols.some(isValidGoogleDriveLink)
}

export function isValidBatchNumber(value) {
  if (!value || typeof value !== 'string') return false
  const v = value.trim()
  const invalidPlaceholders = ['', 'n/a', 'na', 'n.a', 'n.a.', 'nil', 'none', 'no', '-', '--', '---','not applicable', 'not available', 'no batch', 'no batch number','no batch no', 'batch not mentioned', 'batch number not mentioned','batch not visible', 'not mentioned', 'not provided', 'unknown','pending', 'n', 'image attached', 'no batch number mentioned','not able to check', 'cant check', 'unable to check']
  if (invalidPlaceholders.includes(v.toLowerCase())) return false
  const hasLetter = /[a-zA-Z]/.test(v)
  const hasDigit = /\d/.test(v)
  return hasLetter && hasDigit
}

export function findDuplicateOrderRows(rows) {
  const seenOrderIds = new Map()
  const duplicateIndices = new Set()
  rows.forEach((row, idx) => {
    const orderId = String(row.orderId || '').trim()
    if (!orderId || orderId === '') return
    if (seenOrderIds.has(orderId)) { duplicateIndices.add(idx) } else { seenOrderIds.set(orderId, idx) }
  })
  return duplicateIndices
}

export function classifyRowHygiene(row, isDuplicate) {
  if (isDuplicate) return 'yellow'
  const hasImage = hasImageEvidence(row)
  const hasBatch = isValidBatchNumber(row.batchNumber)
  if (!hasImage && !hasBatch) return 'red'
  return 'clean'
}

export function runHygienePass(rows) {
  const duplicateIndices = findDuplicateOrderRows(rows)
  return rows.map((row, idx) => {
    const isDuplicate = duplicateIndices.has(idx)
    const hygieneStatus = classifyRowHygiene(row, isDuplicate)
    return { ...row, hygieneStatus, acceptReject: hygieneStatus === 'clean' ? 'Accept' : 'Reject' }
  })
}

export const HYGIENE_COLORS = {
  red: { red: 1, green: 0.8, blue: 0.8 },
  yellow: { red: 1, green: 0.949, blue: 0.8 },
  clean: null
}

export function getHexColor(status) {
  if (status === 'red') return '#ffcccc'
  if (status === 'yellow') return '#fff2cc'
  return null
}

export function getHygieneSummary(processedRows) {
  const total = processedRows.length
  const red = processedRows.filter(r => r.hygieneStatus === 'red').length
  const yellow = processedRows.filter(r => r.hygieneStatus === 'yellow').length
  const clean = processedRows.filter(r => r.hygieneStatus === 'clean').length
  return { total, red, yellow, clean, redPct: total > 0 ? ((red/total)*100).toFixed(1) : '0', yellowPct: total > 0 ? ((yellow/total)*100).toFixed(1) : '0', cleanPct: total > 0 ? ((clean/total)*100).toFixed(1) : '0' }
    }

/**
 * GOOGLE SHEETS SERVICE
 * Handles read/write operations with Google Sheets API v4
 */

export const SPREADSHEET_ID = '1D2cR7PylAvoXB-wex4h9CgvPzt-s7GAVCho95H2hV5A'

export const SHEET_NAMES = {
  MM: 'MM',
  BB: 'BB',
  LJ: 'LJ',
  SALES: 'Live Sales Data'
}

export const COMPLAINT_COLS = {
  TIMESTAMP: 0, ORDER_ID: 1, SELECT_PRODUCT: 2, UPLOAD_IMAGES: 3,
  DETAILED_VOC: 4, BATCH_NUMBER: 5, IMAGE1: 6, IMAGE2: 7, IMAGE3: 8,
  IMAGE4: 9, IMAGE5: 10,
  ISSUE_BUCKET: 11, ISSUE_SUBBUCKET: 12, PRODUCT: 13,
  PACKAGING: 14, FLAVOUR: 15, STATUS: 16, ACCEPT_REJECT: 17
}

export const SALES_COLS = {
  ORDER_DATE: 0, CHILD_SKU: 1, PRODUCT_NAME: 2, CHANNEL_NAME: 3,
  UNITS_SOLD: 4, PRODUCT: 5, PACKAGING: 6, FLAVOUR: 7
}

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'

async function sheetsGet(path, accessToken) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets API error: ${res.status}`)
  }
  return res.json()
}

async function sheetsPost(path, body, accessToken) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Sheets API error: ${res.status}`)
  }
  return res.json()
}

export async function readSheet(sheetName, accessToken, range = null) {
  const r = range || `${encodeURIComponent(sheetName)}!A1:S5000`
  const data = await sheetsGet(
    `${SPREADSHEET_ID}/values/${r}?valueRenderOption=UNFORMATTED_VALUE`,
    accessToken
  )
  return data.values || []
}

export function parseComplaintRows(rawValues, brand) {
  if (!rawValues || rawValues.length < 2) return []
  const rows = []
  for (let i = 1; i < rawValues.length; i++) {
    const row = rawValues[i]
    if (!row || row.length === 0) continue
    const get = (colIdx) => String(row[colIdx] || '').trim()
    rows.push({
      rowIndex: i, brand,
      timestamp: get(COMPLAINT_COLS.TIMESTAMP),
      orderId: get(COMPLAINT_COLS.ORDER_ID),
      selectProduct: get(COMPLAINT_COLS.SELECT_PRODUCT),
      uploadImagesVideos: get(COMPLAINT_COLS.UPLOAD_IMAGES),
      detailedVOC: get(COMPLAINT_COLS.DETAILED_VOC),
      batchNumber: get(COMPLAINT_COLS.BATCH_NUMBER),
      image1: get(COMPLAINT_COLS.IMAGE1),
      image2: get(COMPLAINT_COLS.IMAGE2),
      image3: get(COMPLAINT_COLS.IMAGE3),
      image4: get(COMPLAINT_COLS.IMAGE4),
      image5: get(COMPLAINT_COLS.IMAGE5),
      issueBucket: get(COMPLAINT_COLS.ISSUE_BUCKET),
      issueSubBucket: get(COMPLAINT_COLS.ISSUE_SUBBUCKET),
      product: get(COMPLAINT_COLS.PRODUCT),
      packaging: get(COMPLAINT_COLS.PACKAGING),
      flavour: get(COMPLAINT_COLS.FLAVOUR),
      status: get(COMPLAINT_COLS.STATUS),
      acceptReject: get(COMPLAINT_COLS.ACCEPT_REJECT),
    })
  }
  return rows
}

export function parseSalesRows(rawValues) {
  if (!rawValues || rawValues.length < 2) return []
  const rows = []
  for (let i = 1; i < rawValues.length; i++) {
    const row = rawValues[i]
    if (!row || row.length === 0) continue
    const get = (idx) => String(row[idx] || '').trim()
    rows.push({
      rowIndex: i,
      orderDate: get(SALES_COLS.ORDER_DATE),
      childSku: get(SALES_COLS.CHILD_SKU),
      productName: get(SALES_COLS.PRODUCT_NAME),
      channelName: get(SALES_COLS.CHANNEL_NAME),
      unitsSold: parseFloat(get(SALES_COLS.UNITS_SOLD)) || 0,
      product: get(SALES_COLS.PRODUCT),
      packaging: get(SALES_COLS.PACKAGING),
      flavour: get(SALES_COLS.FLAVOUR),
    })
  }
  return rows
}

export async function writeAnalysisColumns(sheetName, processedRows, accessToken) {
  if (!processedRows || processedRows.length === 0) return
  const requests = []
  for (const row of processedRows) {
    if (row.status === 'Processed') continue
    const sheetRowNum = row.rowIndex + 1
    const range = `${sheetName}!L${sheetRowNum}:R${sheetRowNum}`
    requests.push({
      range,
      values: [[
        row.issueBucket || '', row.issueSubBucket || '',
        row.product || '', row.packaging || '', row.flavour || '',
        'Processed', row.acceptReject || ''
      ]]
    })
  }
  if (requests.length === 0) return
  await sheetsPost(`${SPREADSHEET_ID}/values:batchUpdate`, { valueInputOption: 'RAW', data: requests }, accessToken)
}

export async function writeHygieneColors(sheetName, processedRows, sheetId, accessToken) {
  const COLOR_RED = { red: 1, green: 0.8, blue: 0.8, alpha: 1 }
  const COLOR_YELLOW = { red: 1, green: 0.949, blue: 0.8, alpha: 1 }
  const COLOR_WHITE = { red: 1, green: 1, blue: 1, alpha: 1 }
  const requests = []
  for (const row of processedRows) {
    const rowIdx = row.rowIndex
    let color = row.hygieneStatus === 'red' ? COLOR_RED : row.hygieneStatus === 'yellow' ? COLOR_YELLOW : COLOR_WHITE
    requests.push({ repeatCell: { range: { sheetId, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 11 }, cell: { userEnteredFormat: { backgroundColor: color } }, fields: 'userEnteredFormat.backgroundColor' } })
  }
  if (requests.length === 0) return
  const CHUNK_SIZE = 500
  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    await sheetsPost(`${SPREADSHEET_ID}:batchUpdate`, { requests: requests.slice(i, i + CHUNK_SIZE) }, accessToken)
  }
}

export async function getSheetMetadata(accessToken) {
  const data = await sheetsGet(`${SPREADSHEET_ID}?fields=sheets(properties(sheetId,title))`, accessToken)
  const sheetMap = {}
  for (const sheet of (data.sheets || [])) sheetMap[sheet.properties.title] = sheet.properties.sheetId
  return sheetMap
}

export async function ensureAnalysisHeaders(sheetName, accessToken) {
  const headerRange = `${sheetName}!L1:R1`
  const existing = await sheetsGet(`${SPREADSHEET_ID}/values/${encodeURIComponent(headerRange)}`, accessToken)
  const existingVals = existing.values?.[0] || []
  if (existingVals[0] === 'Issue (Bucket)') return
  await sheetsPost(`${SPREADSHEET_ID}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: [{ range: headerRange, values: [['Issue (Bucket)', 'Issue (Sub-Bucket)', 'Product', 'Packaging', 'Flavour', 'Status', 'Accept/Reject']] }]
  }, accessToken)
}

export async function ensureSalesHeaders(accessToken) {
  const headerRange = 'Live Sales Data!F1:H1'
  const existing = await sheetsGet(`${SPREADSHEET_ID}/values/${encodeURIComponent(headerRange)}`, accessToken)
  const existingVals = existing.values?.[0] || []
  if (existingVals[0] === 'Product') return
  await sheetsPost(`${SPREADSHEET_ID}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: [{ range: headerRange, values: [['Product', 'Packaging', 'Flavour']] }]
  }, accessToken)
}

export async function writeSalesParsedColumns(parsedSalesRows, accessToken) {
  const requests = parsedSalesRows
    .filter(r => r.product && r.rowIndex)
    .map(r => ({
      range: `Live Sales Data!F${r.rowIndex + 1}:H${r.rowIndex + 1}`,
      values: [[r.product || '', r.packaging || '', r.flavour || '']]
    }))
  if (requests.length === 0) return
  const CHUNK = 500
  for (let i = 0; i < requests.length; i += CHUNK) {
    await sheetsPost(`${SPREADSHEET_ID}/values:batchUpdate`, { valueInputOption: 'RAW', data: requests.slice(i, i + CHUNK) }, accessToken)
  }
}

/**
 * PRODUCT PARSER - Extracts Product Name, Packaging, and Flavour
 */

const PACKAGING_PATTERNS = [
  /(\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|gram|grams))/gi,
  /(\d+(?:\.\d+)?\s*(?:ml|mL|l|L|litre|liter))/gi,
  /(\d+(?:\.\d+)?\s*(?:mg|mcg|iu))/gi,
  /(\d+\s*(?:capsules?|caps?|tablets?|tabs?|gummies?|sachets?|strips?))/gi,
  /(\d+\s*(?:count|ct|pcs|pieces?|units?))/gi,
  /(\d+\s*(?:s|N)\b)/gi,
  /(\d+\s*(?:pack|packs?|combo|kit))/gi,
  /(\b\d{2,4}\s*(?:ml|g|gm|kg|l)\b)/gi,
]

const FLAVOUR_KEYWORDS = [
  'chocolate', 'choco', 'dark chocolate', 'milk chocolate', 'hazelnut',
  'vanilla', 'vanilla cream', 'french vanilla', 'double vanilla',
  'strawberry', 'mixed berry', 'berry', 'mango', 'alphonso mango',
  'banana', 'butterscotch', 'caramel', 'coffee', 'mocha',
  'cookies cream', 'cookies and cream', 'peanut butter',
  'raspberry', 'blueberry', 'mixed fruit', 'orange', 'lemon', 'lime', 'citrus',
  'pineapple', 'coconut', 'unflavoured', 'unflavored', 'plain', 'original',
  'no fragrance', 'fragrance free', 'unscented', 'floral', 'rose', 'lavender',
  'mint', 'peppermint', 'lemongrass', 'eucalyptus', 'tea tree', 'aloe vera',
  'tomato', 'peri peri', 'cheese', 'cream onion', 'masala', 'spicy', 'natural'
]

const BRAND_PREFIXES = ['MM ', 'BB ', 'LJ ', 'Man Matters ', 'Be Bodywise ', 'Little Joys ']

function extractPackaging(text) {
  if (!text) return ''
  const found = []
  for (const pattern of PACKAGING_PATTERNS) {
    const matches = [...text.matchAll(pattern)]
    for (const m of matches) {
      const val = m[1].replace(/\s+/g, '').toLowerCase()
      if (!found.includes(val)) found.push(m[1].trim())
    }
  }
  const bracketMatch = text.match(/\((\d+\s*(?:g|gm|kg|ml|mL|l|mg|mcg|iu|s|N|caps?|tabs?))\)/i)
  if (bracketMatch) {
    const val = bracketMatch[1]
    if (!found.some(f => f.toLowerCase() === val.toLowerCase())) found.unshift(val)
  }
  return found.length > 0 ? found.join(' + ') : ''
}

function extractFlavour(text) {
  if (!text) return ''
  const lower = text.toLowerCase()
  for (const flavour of FLAVOUR_KEYWORDS) {
    if (lower.includes(flavour.toLowerCase())) {
      const idx = lower.indexOf(flavour.toLowerCase())
      return text.substring(idx, idx + flavour.length)
    }
  }
  const dashParts = text.split(' - ')
  if (dashParts.length > 1) {
    const lastPart = dashParts[dashParts.length - 1].trim()
    if (!/^\d/.test(lastPart) && lastPart.length > 1 && lastPart.length < 40) return lastPart
  }
  return ''
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanProductName(text, packaging, flavour) {
  if (!text) return ''
  let cleaned = text
  const pipeIdx = cleaned.indexOf('|')
  if (pipeIdx > -1) cleaned = cleaned.substring(0, pipeIdx)
  for (const prefix of BRAND_PREFIXES) {
    if (cleaned.startsWith(prefix)) { cleaned = cleaned.substring(prefix.length); break }
  }
  if (flavour) {
    const flavourRegex = new RegExp('[-\u2013\u2014]?\\s*' + escapeRegex(flavour) + '\\s*[-\u2013\u2014]?', 'gi')
    cleaned = cleaned.replace(flavourRegex, '')
  }
  cleaned = cleaned
    .replace(/\([^)]*(?:g|gm|kg|ml|l|mg|mcg|iu|s|N|caps?|tabs?|count|ct)[^)]*\)/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|gm|kg|ml|mL|l|mg|mcg|iu)\b/gi, '')
    .replace(/\b\d+\s*(?:capsules?|caps?|tablets?|tabs?|gummies?|sachets?)\b/gi, '')
    .replace(/\b\d+\s*(?:s|N)\b/gi, '')
    .replace(/[-\u2013\u2014:]+$/g, '')
    .replace(/^[-\u2013\u2014:]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim()
  return cleaned
}

export function parseProduct(selectProductValue) {
  if (!selectProductValue || String(selectProductValue).trim() === '') return { product: '', packaging: '', flavour: '' }
  const raw = String(selectProductValue).trim()
  const packaging = extractPackaging(raw)
  const flavour = extractFlavour(raw)
  const product = cleanProductName(raw, packaging, flavour)
  return { product, packaging, flavour }
}

export function parseSalesProduct(productName) {
  if (!productName) return { brand: '', product: '', packaging: '', flavour: '' }
  const raw = String(productName).trim()
  let brand = ''
  let withoutBrand = raw
  for (const prefix of BRAND_PREFIXES) {
    if (raw.startsWith(prefix)) { brand = prefix.trim(); withoutBrand = raw.substring(prefix.length); break }
  }
  const parsed = parseProduct(withoutBrand)
  return { brand, product: parsed.product, packaging: parsed.packaging, flavour: parsed.flavour, fullName: raw }
}

export function normalizeProductForMatching(productStr) {
  return String(productStr || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s+%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
          }

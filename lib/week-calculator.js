/**
 * WEEK & MONTH CALCULATOR
 * Week 1 = Jan 1-7, Week 2 = Jan 8-14, ..., Week 52 = Dec 22-31 (last week always 52)
 */

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function getDayOfYear(date) {
  const d = new Date(date)
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d - start) / 86400000) + 1
}

export function getWeekNumber(date) {
  const doy = getDayOfYear(new Date(date))
  return Math.min(52, Math.ceil(doy / 7))
}

export function getWeekRange(year, weekNum) {
  const daysInYear = isLeapYear(year) ? 366 : 365
  const startDoy = (weekNum - 1) * 7 + 1
  const endDoy = weekNum < 52 ? weekNum * 7 : daysInYear

  const startDate = new Date(year, 0, startDoy)
  const endDate = new Date(year, 0, endDoy)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate, weekNum, year }
}

export function getLastCompletedWeek(today = new Date()) {
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)
  const currentWeek = getWeekNumber(d)
  const currentYear = d.getFullYear()

  if (currentWeek > 1) {
    return getWeekRange(currentYear, currentWeek - 1)
  } else {
    return getWeekRange(currentYear - 1, 52)
  }
}

export function getLastCompletedMonth(today = new Date()) {
  const d = new Date(today)
  const month = d.getMonth()
  const year = d.getFullYear()

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year

  const startDate = new Date(prevYear, prevMonth, 1)
  const endDate = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999)

  return {
    startDate,
    endDate,
    month: prevMonth + 1,
    year: prevYear,
    label: startDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  }
}

export function getLastNDays(n = 30, today = new Date()) {
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() - 1)
  endDate.setHours(23, 59, 59, 999)

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (n - 1))
  startDate.setHours(0, 0, 0, 0)

  return { startDate, endDate, days: n }
}

export function isInRange(date, startDate, endDate) {
  const d = new Date(date)
  return d >= startDate && d <= endDate
}

export function parseDate(dateStr) {
  if (!dateStr) return null
  if (dateStr instanceof Date) return dateStr

  const s = String(dateStr).trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d)) return d
  }

  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/)
  if (ddmmyyyy) {
    const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = ddmmyyyy
    return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd),
      parseInt(hh), parseInt(min), parseInt(ss))
  }

  const ddmmyyyy2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (ddmmyyyy2) {
    const [, dd, mm, yyyy] = ddmmyyyy2
    return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
  }

  const d = new Date(s)
  return isNaN(d) ? null : d
}

export function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatWeekLabel(year, weekNum) {
  const range = getWeekRange(year, weekNum)
  return `Week ${weekNum} (${formatDate(range.startDate)} - ${formatDate(range.endDate)})`
}

export function getMonthName(monthNum) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[(monthNum - 1) % 12]
}

export function getWeeksForYear(year) {
  const weeks = []
  for (let w = 1; w <= 52; w++) {
    const range = getWeekRange(year, w)
    weeks.push({
      weekNum: w,
      year,
      label: `Week ${w} - ${formatDate(range.startDate)} - ${formatDate(range.endDate)}`,
      startDate: range.startDate,
      endDate: range.endDate
    })
  }
  return weeks
}

export function getMonthsForYear(year) {
  const months = []
  const names = ['January','February','March','April','May','June',
    'July','August','September','October','November','December']
  for (let m = 0; m < 12; m++) {
    months.push({
      month: m + 1,
      year,
      label: `${names[m]} ${year}`,
      startDate: new Date(year, m, 1),
      endDate: new Date(year, m + 1, 0, 23, 59, 59, 999)
    })
  }
  return months
    }

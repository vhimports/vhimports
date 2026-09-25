function localDate(year, monthIndex, day) {
  const date = new Date(0)
  date.setHours(0, 0, 0, 0)
  date.setFullYear(year, monthIndex, day)
  return date
}

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

function saoPauloCalendarDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type) => Number(parts.find((item) => item.type === type)?.value)
  return localDate(part('year'), part('month') - 1, part('day'))
}

export function upcomingBirthday(birthDate, referenceDate = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate || ''))) return null
  const [, monthText, dayText] = birthDate.split('-')
  const month = Number(monthText) - 1
  const day = Number(dayText)
  const monthCheck = localDate(2000, month, day)
  if (monthCheck.getMonth() !== month || monthCheck.getDate() !== day) return null

  const today = saoPauloCalendarDate(referenceDate)
  let year = today.getFullYear()
  let occurrence = birthdayForYear(year, month, day)
  if (dayNumber(occurrence) < dayNumber(today)) occurrence = birthdayForYear(++year, month, day)
  return { date: occurrence, daysUntil: dayNumber(occurrence) - dayNumber(today) }
}

function birthdayForYear(year, month, day) {
  // Em anos sem 29 de fevereiro, o aviso ocorre em 1º de março.
  if (month === 1 && day === 29 && !isLeapYear(year)) return localDate(year, 2, 1)
  return localDate(year, month, day)
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function birthdayList(customers, referenceDate = new Date(), daysAhead = 30) {
  return (customers || [])
    .map((customer) => {
      const birthday = upcomingBirthday(customer.birth_date, referenceDate)
      return birthday ? { ...customer, nextBirthday: birthday.date, daysUntil: birthday.daysUntil } : null
    })
    .filter((customer) => customer && customer.daysUntil <= daysAhead)
    .sort((left, right) => left.daysUntil - right.daysUntil || left.name.localeCompare(right.name, 'pt-BR'))
}

export function birthdayDateLabel(date) {
  const stableDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12))
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' }).format(stableDate)
}


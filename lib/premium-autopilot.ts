const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const weekday = parts.find((part) => part.type === "weekday")?.value || "Monday"
  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0")

  return { weekday, hour, minute }
}

export function normalizeScheduleTimezone(value: string | null | undefined) {
  const candidate = (value || "").trim()
  if (!candidate) return "UTC"

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate })
    return candidate
  } catch {
    return "UTC"
  }
}

export function computeNextRunAtIso(params: {
  scheduleWeekday: number
  scheduleHour: number
  scheduleTimezone: string
  fromDate?: Date
}) {
  const scheduleWeekday = Math.max(0, Math.min(6, Math.floor(params.scheduleWeekday)))
  const scheduleHour = Math.max(0, Math.min(23, Math.floor(params.scheduleHour)))
  const scheduleTimezone = normalizeScheduleTimezone(params.scheduleTimezone)
  const fromDate = params.fromDate ?? new Date()

  const probe = new Date(fromDate)
  probe.setUTCMinutes(0, 0, 0)
  if (probe.getTime() <= fromDate.getTime()) {
    probe.setUTCHours(probe.getUTCHours() + 1)
  }

  const maxHoursToCheck = 24 * 16
  for (let i = 0; i < maxHoursToCheck; i += 1) {
    const localParts = getDatePartsInTimeZone(probe, scheduleTimezone)
    const localWeekdayIndex = weekdayNames.indexOf(localParts.weekday as (typeof weekdayNames)[number])
    if (localWeekdayIndex === scheduleWeekday && localParts.hour === scheduleHour && localParts.minute === 0) {
      return probe.toISOString()
    }
    probe.setUTCHours(probe.getUTCHours() + 1)
  }

  const fallback = new Date(fromDate)
  fallback.setUTCDate(fallback.getUTCDate() + 7)
  fallback.setUTCMinutes(0, 0, 0)
  fallback.setUTCHours(scheduleHour)
  return fallback.toISOString()
}

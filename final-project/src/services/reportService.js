function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizeDateFromDateObj(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

// Важливо: парсимо як локальний час, щоб не було зсувів дня
function parseLocalDateTime(isoOrText) {
  if (!isoOrText) return null;

  // якщо формат "YYYY-MM-DD" -> додаємо час
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrText)) {
    return new Date(`${isoOrText}T00:00:00`);
  }

  // якщо є "Z" або "+03:00" - Date() буде UTC/offset, це може зсунути день,
  // але для ЛБ лишаємо: просто парсимо як є.
  return new Date(isoOrText);
}

function normalizeDate(isoString) {
  const d = parseLocalDateTime(isoString);
  if (!d || isNaN(d.getTime())) return null;
  return normalizeDateFromDateObj(d);
}

function groupEntriesByDay(entries) {
  const map = {};
  for (const e of entries || []) {
    const day = normalizeDate(e.StartTime);
    if (!day) continue;
    if (!map[day]) map[day] = [];
    map[day].push(e);
  }

  for (const day in map) {
    map[day].sort((a, b) => parseLocalDateTime(a.StartTime) - parseLocalDateTime(b.StartTime));
  }
  return map;
}

function isWorkingDay(dateStr, schedule) {
  if (!schedule || !schedule.WorkingDaysMask) return true; // fallback
  const d = parseLocalDateTime(`${dateStr}T00:00:00`);
  let day = d.getDay(); // 0=Sun..6=Sat
  day = (day + 6) % 7;  // 0=Mon..6=Sun
  const mask = String(schedule.WorkingDaysMask);
  return mask[day] === '1';
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getPlannedMinutesForDay(dateStr, schedule) {
  if (!schedule || !schedule.StartWork || !schedule.EndWork) return 0;
  if (!isWorkingDay(dateStr, schedule)) return 0;

  const start = parseTimeToMinutes(schedule.StartWork);
  const end = parseTimeToMinutes(schedule.EndWork);
  const total = Math.max(0, end - start);
  const breakMin = Number(schedule.BreakMinutes || 0);

  return Math.max(0, total - breakMin);
}

// Підрахунок фактичної перерви по подіях у хронологічному порядку
function calcBreakMinutesFromEntries(entries, startWorkDate, endWorkDate) {
  let breakStart = null;
  let total = 0;

  for (const e of entries) {
    const t = parseLocalDateTime(e.StartTime);
    if (!t || isNaN(t.getTime())) continue;

    if (e.EntryType === 'StartBreak') {
      // якщо вже в перерві — ігноруємо зайвий StartBreak
      if (!breakStart) breakStart = t;
    } else if (e.EntryType === 'EndBreak') {
      // якщо не було StartBreak — ігноруємо зайвий EndBreak
      if (breakStart) {
        const diff = (t - breakStart) / 60000;
        if (diff > 0) total += diff;
        breakStart = null;
      }
    }
  }

  // Якщо перерва не закрилась — закриваємо кінцем роботи
  if (breakStart) {
    const diff = (endWorkDate - breakStart) / 60000;
    if (diff > 0) total += diff;
  }

  // Обмежимо перерву, щоб не перевищувала весь інтервал
  const maxPossible = Math.max(0, (endWorkDate - startWorkDate) / 60000);
  total = Math.min(total, maxPossible);

  return Math.round(total);
}

function calculateDailyFromEntries(dateStr, entries, schedule, absencesForDay) {
  const hasAbsence = !!(absencesForDay && absencesForDay.length > 0);

  let plannedMinutes = getPlannedMinutesForDay(dateStr, schedule);
  if (hasAbsence) {
    plannedMinutes = 0;
  }

  if (!entries || entries.length === 0) {
    return {
      date: dateStr,
      plannedMinutes,
      workedMinutes: 0,
      overtimeMinutes: 0,
      undertimeMinutes: 0,
      isLate: false,
      lateMinutes: 0,
      hasAbsence
    };
  }

  const startWork = entries.find(e => e.EntryType === 'StartWork');
  const endWork = [...entries].reverse().find(e => e.EntryType === 'EndWork');

  let workedMinutes = 0;
  let lateMinutes = 0;
  let isLate = false;

  if (startWork && endWork) {
    const startDate = parseLocalDateTime(startWork.StartTime);
    const endDate = parseLocalDateTime(endWork.StartTime);

    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate > startDate) {
      const totalMinutes = Math.round((endDate - startDate) / 60000);

      const breakMinutes = calcBreakMinutesFromEntries(entries, startDate, endDate);
      workedMinutes = Math.max(0, totalMinutes - breakMinutes);

      // Late рахуємо тільки якщо це робочий день і plannedMinutes > 0
      if (plannedMinutes > 0 && schedule && schedule.StartWork) {
        const plannedStart = parseLocalDateTime(`${dateStr}T${schedule.StartWork}:00`);
        if (plannedStart && startDate > plannedStart) {
          isLate = true;
          lateMinutes = Math.round((startDate - plannedStart) / 60000);
        }
      }
    }
  }

  const overtimeMinutes = plannedMinutes > 0 ? Math.max(0, workedMinutes - plannedMinutes) : 0;
  const undertimeMinutes = plannedMinutes > 0 ? Math.max(0, plannedMinutes - workedMinutes) : 0;

  return {
    date: dateStr,
    plannedMinutes,
    workedMinutes,
    overtimeMinutes,
    undertimeMinutes,
    isLate,
    lateMinutes,
    hasAbsence
  };
}

function calculateSummary(from, to, entries, schedule, absences) {
  const dayMs = 24 * 60 * 60 * 1000;

  const fromDate = parseLocalDateTime(`${from}T00:00:00`);
  const toDate = parseLocalDateTime(`${to}T00:00:00`);
  if (!fromDate || !toDate || isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return {
      from,
      to,
      days: [],
      totals: {
        totalPlannedMinutes: 0,
        totalWorkedMinutes: 0,
        totalOvertimeMinutes: 0,
        totalUndertimeMinutes: 0,
        totalLateMinutes: 0,
        lateDaysCount: 0,
        daysWithAbsence: 0
      }
    };
  }

  const entriesByDay = groupEntriesByDay(entries || []);

  function getAbsencesForDay(dateStr) {
    if (!absences) return [];
    const d = parseLocalDateTime(`${dateStr}T00:00:00`);
    if (!d || isNaN(d.getTime())) return [];
    return absences.filter(a => {
      const start = parseLocalDateTime(a.DateStart);
      const end = parseLocalDateTime(a.DateEnd);
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      return start <= d && end >= d;
    });
  }

  const days = [];
  const totals = {
    totalPlannedMinutes: 0,
    totalWorkedMinutes: 0,
    totalOvertimeMinutes: 0,
    totalUndertimeMinutes: 0,
    totalLateMinutes: 0,
    lateDaysCount: 0,
    daysWithAbsence: 0
  };

  for (let ts = fromDate.getTime(); ts <= toDate.getTime(); ts += dayMs) {
    const d = new Date(ts);
    const dateStr = normalizeDateFromDateObj(d);

    const dayEntries = entriesByDay[dateStr] || [];
    const dayAbsences = getAbsencesForDay(dateStr);

    const daily = calculateDailyFromEntries(dateStr, dayEntries, schedule, dayAbsences);
    days.push(daily);

    totals.totalPlannedMinutes += daily.plannedMinutes;
    totals.totalWorkedMinutes += daily.workedMinutes;
    totals.totalOvertimeMinutes += daily.overtimeMinutes;
    totals.totalUndertimeMinutes += daily.undertimeMinutes;
    totals.totalLateMinutes += daily.lateMinutes;
    if (daily.isLate) totals.lateDaysCount += 1;
    if (daily.hasAbsence) totals.daysWithAbsence += 1;
  }

  return { from, to, days, totals };
}

module.exports = {
  calculateSummary,
  calculateDailyFromEntries
};

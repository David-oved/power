import { state } from "../state.js";
import { SafeStorage } from "../utils/storage.js";
import { triggerLocalNotification, showAuraToast, safeFormatDate } from "../utils/helpers.js";
import { getAllExercises, saveAllExercises, GYM_EXERCISES, PARK_EXERCISES, openEditModal } from "../workouts/workouts.js";

// DOM Elements & Configurations
const HEBREW_QUOTES = [
  "אין קיצורי דרך למקומות ששווה להגיע אליהם! 🔥",
  "כל חזרה מקרבת אותך לגרסה הטובה ביותר של עצמך. 💪",
  "הכאב של היום הוא הכוח של מחר! ⚡",
  "אל תפסיק כשזה קשה, תפסיק כשסיימת. 🏆",
  "המשמעת העצמית שלך היא המפתח לברזל! 🏋️‍♂️",
  "אתה נלחם נגד עצמך של אתמול, לא נגד אף אחד אחר. 🌟",
  "הפוך את התירוצים שלך לתוצאות בקצה הברזל! 🔥",
  "המנוחה מכינה אותך לסט המושלם הבא. תתרכז! 🎯"
];

// Helper to check for notifications permission
export async function requestNotificationPermissionSafely() {
  if ('Notification' in window && typeof Notification !== 'undefined') {
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log("Notification permission state:", permission);
      } catch (err) {
        console.warn("Could not request notification permission:", err);
      }
    }
  }
}

// Future Workouts LocalStorage Handlers
export function getFutureWorkouts() {
  if (!state.currentUser) return [];
  const key = `aura-future-workouts_${state.currentUser.uid}`;
  try {
    const data = SafeStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading future workouts", e);
    return [];
  }
}

export function saveFutureWorkouts(workouts) {
  if (!state.currentUser) return;
  const key = `aura-future-workouts_${state.currentUser.uid}`;
  try {
    SafeStorage.setItem(key, JSON.stringify(workouts));
  } catch (e) {
    console.error("Error saving future workouts", e);
  }
}

// Start periodic background reminder checking
export function startFutureWorkoutReminderChecker() {
  console.log("Starting periodic background checker for scheduled workouts...");
  setInterval(() => {
    if (!state.currentUser) return;
    const futureWorkouts = getFutureWorkouts();
    let updated = false;

    futureWorkouts.forEach(workout => {
      if (workout.reminderSent) return;

      const targetDateTimeStr = `${workout.date}T${workout.time}:00`;
      const targetTimeMs = new Date(targetDateTimeStr).getTime();
      if (isNaN(targetTimeMs)) return;

      const thresholdTimeMs = targetTimeMs - (workout.reminderMinutes * 60 * 1000);
      const nowMs = Date.now();

      if (nowMs >= thresholdTimeMs && nowMs < targetTimeMs + 60 * 60 * 1000) {
        workout.reminderSent = true;
        updated = true;

        const displayLoc = workout.location === 'gym' ? 'חדר כושר' : (workout.location === 'park' ? 'פארק' : workout.location);
        const title = `תזכורת לאימון: אימון ${displayLoc} מתוזמן לשעה ${workout.time}! 🏋️‍♂️`;
        const body = "אימון עתידי בפתח! 🏋️‍♂️";

        triggerLocalNotification(title, body, true);
        console.log(`Notification sent for future workout ${workout.id}`);
      } else if (nowMs >= targetTimeMs + 60 * 60 * 1000) {
        workout.reminderSent = true;
        updated = true;
      }
    });

    if (updated) {
      saveFutureWorkouts(futureWorkouts);
      if (state.activeSubTab === 'calendar') {
        renderCalendarView();
      }
    }
  }, 15000);
}

// History Filters Manager
export function getFilteredHistory(ignoreFilters = false) {
  if (ignoreFilters) {
    return [...state.workoutHistory].sort((a, b) => b.date - a.date);
  }
  let result = [...state.workoutHistory];

  const now = new Date();
  if (state.filterTimeSelection === '7') {
    const limit = new Date();
    limit.setDate(now.getDate() - 7);
    result = result.filter(w => new Date(w.date) >= limit);
  } else if (state.filterTimeSelection === '30') {
    const limit = new Date();
    limit.setDate(now.getDate() - 30);
    result = result.filter(w => new Date(w.date) >= limit);
  } else if (state.filterTimeSelection === 'custom') {
    if (state.filterStartDate) {
      result = result.filter(w => new Date(w.date) >= state.filterStartDate);
    }
    if (state.filterEndDate) {
      const endLimit = new Date(state.filterEndDate);
      endLimit.setHours(23, 59, 59, 999);
      result = result.filter(w => new Date(w.date) <= endLimit);
    }
  }

  if (state.filterLocation !== 'all') {
    result = result.filter(w => w.location === state.filterLocation);
  }

  if (state.filterMuscleGroup !== 'all') {
    result = result.filter(w => {
      return w.exercises && w.exercises.some(ex => {
        let cat = 'אחר';
        const matched = getAllExercises().find(x => x.name === ex.name);
        if (matched) cat = matched.category || 'אחר';
        return cat === state.filterMuscleGroup;
      });
    });
  }

  return result.sort((a, b) => b.date - a.date);
}

// Draw Bezier curves progression SVG graph
export function renderExerciseAnalyticsDashboard() {
  if (!state.selectedAnalyticsExercise) return;

  const filteredHistory = getFilteredHistory();
  const exerciseSessions = [];
  const chronological = [...filteredHistory].sort((a, b) => a.date - b.date);

  chronological.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === state.selectedAnalyticsExercise);
    if (ex && ex.sets && ex.sets.some(s => s.completed)) {
      exerciseSessions.push({
        date: new Date(w.date),
        sets: ex.sets.filter(s => s.completed),
        metricType: ex.metricType || 'both'
      });
    }
  });

  const chartSvg = document.getElementById('bezier-chart-svg');
  const noDataEl = document.getElementById('chart-no-data');
  const prEl = document.getElementById('dashboard-pr-value');
  const rmEl = document.getElementById('dashboard-1rm-value');
  const volEl = document.getElementById('dashboard-vol-value');

  if (!chartSvg) return;

  if (exerciseSessions.length === 0) {
    if (noDataEl) noDataEl.style.display = 'flex';
    if (prEl) prEl.textContent = '--';
    if (rmEl) rmEl.textContent = '--';
    if (volEl) volEl.textContent = '--';
    
    const areaPath = document.getElementById('chart-area-path');
    const linePath = document.getElementById('chart-line-path');
    const pointsGroup = document.getElementById('chart-points-group');
    const gridlines = document.getElementById('chart-gridlines');
    if (areaPath) areaPath.setAttribute('d', '');
    if (linePath) linePath.setAttribute('d', '');
    if (pointsGroup) pointsGroup.innerHTML = '';
    if (gridlines) gridlines.innerHTML = '';
    return;
  }

  if (noDataEl) noDataEl.style.display = 'none';

  let maxWeight = 0;
  let max1RM = 0;
  let totalVolume = 0;
  const points = [];

  exerciseSessions.forEach(session => {
    let sessionMaxWeight = 0;
    let sessionMax1RM = 0;
    let sessionVolume = 0;

    session.sets.forEach(s => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;

      if (w > sessionMaxWeight) sessionMaxWeight = w;
      const oneRM = r === 1 ? w : w * (1 + r / 30);
      if (oneRM > sessionMax1RM) sessionMax1RM = oneRM;
      sessionVolume += (w * r);
    });

    totalVolume += sessionVolume;
    if (sessionMaxWeight > maxWeight) maxWeight = sessionMaxWeight;
    if (sessionMax1RM > max1RM) max1RM = sessionMax1RM;

    let yValue = 0;
    if (state.activeChartType === '1rm') {
      yValue = sessionMax1RM;
    } else if (state.activeChartType === 'weight') {
      yValue = sessionMaxWeight;
    } else {
      yValue = sessionVolume;
    }

    points.push({
      date: session.date,
      value: yValue
    });
  });

  if (prEl) prEl.textContent = `${maxWeight} ק״ג`;
  if (rmEl) rmEl.textContent = `${Math.round(max1RM)} ק״ג`;
  if (volEl) volEl.textContent = `${totalVolume.toLocaleString()} ק״ג`;

  const width = chartSvg.clientWidth || 320;
  const height = chartSvg.clientHeight || 160;

  const paddingX = 30;
  const paddingY = 20;

  const minVal = Math.min(...points.map(p => p.value)) * 0.9;
  const maxVal = Math.max(...points.map(p => p.value)) * 1.1 || 100;
  const valRange = (maxVal - minVal) || 1;

  const svgCoords = points.map((p, idx) => {
    const x = points.length > 1 
      ? paddingX + (idx / (points.length - 1)) * (width - 2 * paddingX)
      : width / 2;
    const y = height - paddingY - ((p.value - minVal) / valRange) * (height - 2 * paddingY);
    return { x, y, val: p.value, date: p.date };
  });

  let dLine = '';
  let dArea = '';

  if (svgCoords.length === 1) {
    const c = svgCoords[0];
    dLine = `M ${c.x - 10} ${c.y} L ${c.x + 10} ${c.y}`;
    dArea = `M ${c.x - 10} ${c.y} L ${c.x + 10} ${c.y} L ${c.x + 10} ${height} L ${c.x - 10} ${height} Z`;
  } else {
    dLine = `M ${svgCoords[0].x} ${svgCoords[0].y}`;
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const curr = svgCoords[i];
      const next = svgCoords[i + 1];
      const cpX1 = curr.x + (next.x - curr.x) / 3;
      const cpY1 = curr.y;
      const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
      const cpY2 = next.y;
      dLine += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    dArea = dLine + ` L ${svgCoords[svgCoords.length - 1].x} ${height} L ${svgCoords[0].x} ${height} Z`;
  }

  const areaPath = document.getElementById('chart-area-path');
  const linePath = document.getElementById('chart-line-path');
  const pointsGroup = document.getElementById('chart-points-group');
  const gridlines = document.getElementById('chart-gridlines');

  if (areaPath) areaPath.setAttribute('d', dArea);
  if (linePath) {
    linePath.setAttribute('d', dLine);
    linePath.style.stroke = 'var(--electric-blue-light)';
    linePath.style.strokeWidth = '3';
    linePath.style.fill = 'none';
  }

  if (gridlines) {
    gridlines.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const y = paddingY + (i / 2) * (height - 2 * paddingY);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', y);
      line.setAttribute('x2', width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
      line.setAttribute('stroke-dasharray', '4, 4');
      gridlines.appendChild(line);
    }
  }

  if (pointsGroup) {
    pointsGroup.innerHTML = '';
    svgCoords.forEach(c => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', c.x);
      circle.setAttribute('cy', c.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', '#ffffff');
      circle.setAttribute('stroke', 'var(--color-danger)');
      circle.setAttribute('stroke-width', '2.5');
      circle.style.cursor = 'pointer';

      circle.addEventListener('mouseover', () => {
        circle.setAttribute('r', '7');
        const dateStr = c.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        circle.title = `${dateStr}: ${Math.round(c.val)} ק״ג`;
      });
      circle.addEventListener('mouseout', () => {
        circle.setAttribute('r', '5');
      });
      pointsGroup.appendChild(circle);
    });
  }
}

// Calendar View
export function renderCalendarView() {
  const container = document.getElementById('calendar-days-grid');
  const monthLabel = document.getElementById('calendar-month-label');

  if (!container || !monthLabel) return;

  container.innerHTML = '';
  const year = state.currentCalendarDate.getFullYear();
  const month = state.currentCalendarDate.getMonth();

  const monthsHebrew = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  monthLabel.textContent = `${monthsHebrew[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const filtered = getFilteredHistory(true);
  const workoutsByDay = {};

  filtered.forEach(w => {
    const d = new Date(w.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const dayNum = d.getDate();
      if (!workoutsByDay[dayNum]) workoutsByDay[dayNum] = [];
      workoutsByDay[dayNum].push(w);
    }
  });

  const futureWorkouts = getFutureWorkouts();
  const futureWorkoutsByDay = {};

  futureWorkouts.forEach(w => {
    const parts = w.date.split('-');
    if (parts.length === 3) {
      const wYear = parseInt(parts[0], 10);
      const wMonth = parseInt(parts[1], 10) - 1;
      const wDay = parseInt(parts[2], 10);

      if (wYear === year && wMonth === month) {
        if (!futureWorkoutsByDay[wDay]) futureWorkoutsByDay[wDay] = [];
        futureWorkoutsByDay[wDay].push(w);
      }
    }
  });

  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day-empty';
    container.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day-cell';
    dayCell.textContent = day;

    const today = new Date();
    if (today.getDate() === day && today.getMonth() === month && today.getFullYear() === year) {
      dayCell.classList.add('today');
    }

    const sessions = workoutsByDay[day] || [];
    const futures = futureWorkoutsByDay[day] || [];

    const dotsContainer = document.createElement('div');
    dotsContainer.style.cssText = 'display: flex; gap: 3px; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); justify-content: center; width: 100%;';
    dayCell.appendChild(dotsContainer);

    if (sessions.length > 0) {
      dayCell.classList.add('has-workout');
      sessions.forEach(w => {
        const dot = document.createElement('span');
        const loc = (w.location || '').toLowerCase();
        let dotClass = 'workout-dot gym';
        if (loc === 'park') dotClass = 'workout-dot park';
        else if (loc === 'home') dotClass = 'workout-dot home';
        dot.className = dotClass;
        dotsContainer.appendChild(dot);
      });
    }

    if (futures.length > 0) {
      dayCell.classList.add('has-future-workout');
      futures.forEach(f => {
        const dot = document.createElement('span');
        const loc = (f.location || '').toLowerCase();
        let dotClass = 'workout-dot gym';
        if (loc === 'park') dotClass = 'workout-dot park';
        else if (loc === 'home') dotClass = 'workout-dot home';
        dot.className = dotClass;
        dot.style.border = '1px solid rgba(255, 255, 255, 0.4)';
        dotsContainer.appendChild(dot);
      });
    }

    if (sessions.length > 0 || futures.length > 0) {
      dayCell.addEventListener('click', (e) => {
        e.stopPropagation();
        
        let detailsHtml = '';

        if (sessions.length > 0) {
          sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
          detailsHtml += `<h5 style="color: #fca5a5; text-align: right; margin: 4px 0 8px 0; font-size: 0.9rem; font-weight: 700;">אימוני עבר:</h5>`;
          detailsHtml += sessions.map(w => {
            const duration = w.duration ? Math.round(w.duration / 60) : 0;
            const wDate = new Date(w.date);
            const timeStr = wDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            return `
              <div style="padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 8px; direction: rtl; text-align: right;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff;">
                  <span>${w.locationEmoji || '🏋️'} ${w.locationName || 'אימון'}</span>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">${timeStr} • ${duration} דק׳</span>
                </div>
                <button class="btn btn-secondary edit-past-workout-btn" data-id="${w.id}" style="width: 100%; margin-top: 8px; padding: 6px !important; font-size: 0.75rem !important;">🛠️ ערוך אימון</button>
              </div>
            `;
          }).join('');
        }

        if (futures.length > 0) {
          futures.sort((a, b) => a.time.localeCompare(b.time));
          detailsHtml += `<h5 style="color: #fdba74; text-align: right; margin: 12px 0 8px 0; font-size: 0.9rem; font-weight: 700;">אימונים עתידיים מתוכננים:</h5>`;
          detailsHtml += futures.map(f => {
            const displayLoc = f.location === 'gym' ? 'חדר כושר 🏋️‍♂️' : (f.location === 'park' ? 'פארק 🌳' : f.location);
            return `
              <div class="future-workout-card">
                <div class="future-header">
                  <span>📅 אימון עתידי</span>
                  <span class="future-badge">${f.time}</span>
                </div>
                <div style="color: #e2e8f0; font-size: 0.85rem; margin-top: 4px;">
                  מיקום: <strong>${displayLoc}</strong>
                </div>
                <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 2px;">
                  תזכורת: ${f.reminderMinutes === 0 ? 'בדיוק בזמן' : (f.reminderMinutes === 60 ? 'שעה לפני' : (f.reminderMinutes === 180 ? '3 שעות לפני' : f.reminderMinutes + ' דקות לפני'))}
                </div>
                <button class="btn btn-secondary cancel-future-btn" data-id="${f.id}" style="width: 100%; margin-top: 8px; padding: 6px !important; font-size: 0.75rem !important; background: rgba(220,38,38,0.1) !important; border-color: rgba(220,38,38,0.2) !important; color: #fca5a5 !important;">❌ ביטול אימון</button>
              </div>
            `;
          }).join('');
        }

        const summaryAlert = document.createElement('div');
        summaryAlert.className = 'custom-calendar-alert-overlay';
        summaryAlert.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1600;';
        summaryAlert.innerHTML = `
          <div class="workout-modal-card glass-modal-card" style="max-width: 320px; width: 90%; border-radius: 20px; padding: 1.2rem; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
            <h4 style="margin: 0 0 12px 0; font-size: 1.1rem; color: #fff; direction: rtl;">אימונים ב-${day}/${month + 1}/${year}</h4>
            <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
              ${detailsHtml}
            </div>
            <button class="btn btn-primary close-calendar-alert" style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 10px;">סגור</button>
          </div>
        `;

        summaryAlert.querySelector('.close-calendar-alert').addEventListener('click', () => {
          summaryAlert.remove();
        });

        summaryAlert.querySelectorAll('.edit-past-workout-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const wId = btn.dataset.id;
            openEditModal(wId);
            summaryAlert.remove();
          });
        });

        summaryAlert.querySelectorAll('.cancel-future-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const fId = btn.dataset.id;
            let currentFutures = getFutureWorkouts();
            currentFutures = currentFutures.filter(x => x.id !== fId);
            saveFutureWorkouts(currentFutures);
            summaryAlert.remove();
            renderCalendarView();
          });
        });

        document.body.appendChild(summaryAlert);
      });
    }
    container.appendChild(dayCell);
  }
}

// GitHub Style Heatmap
export function renderHeatmapView() {
  const svg = document.getElementById('heatmap-svg');
  if (!svg) return;

  svg.innerHTML = '';

  const filtered = getFilteredHistory(true);
  const workoutsByDateStr = {};

  filtered.forEach(w => {
    const d = new Date(w.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!workoutsByDateStr[dateStr]) workoutsByDateStr[dateStr] = 0;
    workoutsByDateStr[dateStr]++;
  });

  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - 364);

  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDay);

  const rectSize = 10;
  const gap = 3;

  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (week * 7) + day);

      if (currentDate > now) continue;

      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const count = workoutsByDateStr[dateStr] || 0;

      let color = 'rgba(255, 255, 255, 0.05)';
      if (count === 1) color = '#fca5a5';
      else if (count === 2) color = '#f87171';
      else if (count >= 3) color = '#dc2626';

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(week * (rectSize + gap)));
      rect.setAttribute('y', String(day * (rectSize + gap)));
      rect.setAttribute('width', String(rectSize));
      rect.setAttribute('height', String(rectSize));
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', color);
      
      const formattedDate = currentDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      rect.setAttribute('title', `${formattedDate}: ${count} אימונים`);

      rect.addEventListener('mouseover', () => {
        rect.setAttribute('stroke', '#ffffff');
        rect.setAttribute('stroke-width', '1');
      });
      rect.addEventListener('mouseout', () => {
        rect.removeAttribute('stroke');
      });

      svg.appendChild(rect);
    }
  }
}

// Muscle Splits Bar Graph
export function renderMuscleSplitView() {
  const container = document.getElementById('muscle-splits-container');
  const adviceEl = document.getElementById('muscle-recommendation-box');

  if (!container || !adviceEl) return;

  container.innerHTML = '';

  const filtered = getFilteredHistory(true);
  const volumeByMuscle = {
    'חזה': 0, 'גב': 0, 'כתפיים': 0, 'רגליים': 0, 'ידיים': 0, 'בטן': 0, 'אירובי': 0, 'ליבה': 0, 'אחר': 0
  };

  let totalOverallVolume = 0;

  filtered.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      let cat = 'אחר';
      const matched = getAllExercises().find(x => x.name === ex.name);
      if (matched) cat = matched.category || 'אחר';

      ex.sets.forEach(s => {
        if (s.completed) {
          const w = parseFloat(s.weight) || 0;
          const r = parseInt(s.reps, 10) || 0;
          const vol = w * r;

          if (volumeByMuscle[cat] !== undefined) {
            volumeByMuscle[cat] += vol;
            totalOverallVolume += vol;
          } else {
            volumeByMuscle['אחר'] += vol;
            totalOverallVolume += vol;
          }
        }
      });
    });
  });

  if (totalOverallVolume === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.9rem;">אין נתוני נפח שרירים מסוננים עדיין.</div>';
    adviceEl.textContent = 'בצע אימונים ורשום סטים כדי לקבל המלצות לאיזון שרירי.';
    return;
  }

  Object.keys(volumeByMuscle).forEach(muscle => {
    const vol = volumeByMuscle[muscle];
    if (vol === 0) return;

    const pct = Math.round((vol / totalOverallVolume) * 100);
    const barRow = document.createElement('div');
    barRow.className = 'muscle-split-row';
    barRow.style.cssText = 'margin-bottom: 12px;';

    barRow.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 4px; direction: rtl;">
        <span>${muscle}</span>
        <span>${pct}% (${vol.toLocaleString()} ק״ג)</span>
      </div>
      <div class="progress-bar-track" style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
        <div class="progress-bar-fill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); box-shadow: 0 0 8px rgba(220, 38, 38, 0.4); border-radius: 4px;"></div>
      </div>
    `;
    container.appendChild(barRow);
  });

  const legsPct = (volumeByMuscle['רגליים'] / totalOverallVolume) * 100;
  const chestPct = (volumeByMuscle['חזה'] / totalOverallVolume) * 100;
  const backPct = (volumeByMuscle['גב'] / totalOverallVolume) * 100;

  if (legsPct < 15) {
    adviceEl.innerHTML = `⚠️ <strong>הנחיית איזון:</strong> נפח אימוני הרגליים שלך נמוך יחסית לתא המותניים (${Math.round(legsPct)}%). מומלץ להוסיף סקוואט או מכרעים כדי למנוע חוסר איזון פיזיולוגי! 🦵`;
  } else if (Math.abs(chestPct - backPct) > 20) {
    adviceEl.innerHTML = '⚠️ <strong>הנחיית איזון:</strong> יש פער משמעותי בין נפח החזה לגב. הקפד על יחס שווה של לחיצות ומשיכות למניעת פציעות כתפיים ויציבה כפופה! 🦅🍒';
  } else {
    adviceEl.innerHTML = '✨ <strong>הנחיית איזון:</strong> כל הכבוד! חלוקת העומסים והנפח שלך מאוזנת ומקצועית ביותר. המשך ככה! 🏋️‍♂️🏆';
  }
}

// Helper to format exercise sets text nicely depending on metricType
function formatExerciseSetsText(ex) {
  const type = ex.metricType || 'both';
  return ex.sets.map(s => {
    if (type === 'reps') {
      return `${s.reps} חזרות`;
    } else if (type === 'weight') {
      return `${s.weight} ק״ג`;
    } else {
      return `${s.weight}ק״ג×${s.reps}`;
    }
  }).join(', ');
}

// Historical workouts accordion list view
export function renderAccordionHistoryView() {
  const container = document.getElementById('accordion-history-container');
  if (!container) return;

  container.innerHTML = '';
  const filtered = getFilteredHistory();

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.9rem; direction: rtl;">לא נמצאו אימונים התואמים את המסננים שבחרת.</div>';
    return;
  }

  filtered.forEach(w => {
    const card = document.createElement('div');
    card.className = 'history-accordion-card';
    card.style.cssText = 'background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; margin-bottom: 12px; padding: 12px 16px; cursor: pointer; transition: all 0.25s ease;';

    const duration = w.duration ? Math.round(w.duration / 60) : 0;
    const dateObj = new Date(w.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

    let totalVolume = 0;
    let totalSets = 0;

    w.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        if (s.completed) {
          totalSets++;
          totalVolume += (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0);
        }
      });
    });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; direction: rtl;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.4rem;">${w.locationEmoji || '🏋️'}</span>
          <div>
            <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: #fff;">${w.locationName || 'אימון'}</h4>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${dateStr} • ${duration} דקות</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.82rem; font-weight: 700; color: var(--electric-blue-light);">${totalVolume.toLocaleString()} ק״ג</span>
          <span class="accordion-arrow" style="font-size: 0.9rem; transition: transform 0.2s ease;">▼</span>
        </div>
      </div>
      <div class="accordion-details hide" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); direction: rtl;">
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
          ${w.exercises.map(ex => {
            const exSetsText = formatExerciseSetsText(ex);
            return `
              <div style="font-size: 0.85rem; color: #e2e8f0; display: flex; justify-content: space-between;">
                <span style="font-weight: 700;">• ${ex.name}</span>
                <span style="color: var(--text-muted); font-size: 0.8rem; direction: ltr;">[${exSetsText}]</span>
              </div>
            `;
          }).join('')}
        </div>
        <button class="btn btn-secondary edit-w-accordion-btn" style="width: 100%; padding: 8px !important; font-size: 0.8rem !important; border-radius: 10px;">🛠️ ערוך פרטי אימון</button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.edit-w-accordion-btn')) return;

      const details = card.querySelector('.accordion-details');
      const arrow = card.querySelector('.accordion-arrow');

      if (details) {
        if (details.classList.contains('hide')) {
          details.classList.remove('hide');
          if (arrow) arrow.style.transform = 'rotate(180deg)';
          card.style.background = 'rgba(255,255,255,0.04)';
        } else {
          details.classList.add('hide');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          card.style.background = 'rgba(255,255,255,0.02)';
        }
      }
    });

    const editBtn = card.querySelector('.edit-w-accordion-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(w.id);
      });
    }

    container.appendChild(card);
  });
}

// Workouts Chronological Card list
export function renderWorkoutsLog() {
  const container = document.getElementById('workouts-log-container');
  if (!container) return;

  container.innerHTML = '';

  let filtered = getFilteredHistory();

  const maxWeights = {};
  state.workoutHistory.forEach(w => {
    if (!w.exercises) return;
    w.exercises.forEach(ex => {
      if (!ex.sets) return;
      ex.sets.forEach(s => {
        if (s.completed) {
          const weight = parseFloat(s.weight) || 0;
          if (!maxWeights[ex.name] || weight > maxWeights[ex.name]) {
            maxWeights[ex.name] = weight;
          }
        }
      });
    });
  });

  const workoutMetrics = filtered.map(w => {
    let totalVolume = 0;
    let totalSets = 0;
    let prCount = 0;

    if (w.exercises) {
      w.exercises.forEach(ex => {
        const maxW = maxWeights[ex.name] || 0;
        let exerciseHasPR = false;

        ex.sets.forEach(s => {
          if (s.completed) {
            totalSets++;
            const wVal = parseFloat(s.weight) || 0;
            totalVolume += wVal * (parseInt(s.reps, 10) || 0);

            if (maxW > 0 && wVal === maxW) {
              exerciseHasPR = true;
            }
          }
        });
        if (exerciseHasPR) prCount++;
      });
    }

    return {
      workout: w,
      totalVolume,
      totalSets,
      prCount
    };
  });

  if (state.filterSortSelection === 'volume-desc') {
    workoutMetrics.sort((a, b) => {
      if (b.totalVolume !== a.totalVolume) {
        return b.totalVolume - a.totalVolume;
      }
      return b.workout.date - a.workout.date;
    });
  } else if (state.filterSortSelection === 'prs-first') {
    workoutMetrics.sort((a, b) => {
      if (b.prCount !== a.prCount) {
        return b.prCount - a.prCount;
      }
      return b.workout.date - a.workout.date;
    });
  } else {
    workoutMetrics.sort((a, b) => b.workout.date - a.workout.date);
  }

  if (workoutMetrics.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 30px; font-size: 0.95rem; direction: rtl;">לא נמצאו אימונים התואמים את סינוני החיפוש.</div>';
    return;
  }

  workoutMetrics.forEach(item => {
    const w = item.workout;
    const duration = w.duration ? Math.round(w.duration / 60) : 0;
    const dateObj = new Date(w.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

    const card = document.createElement('div');
    card.className = 'workout-log-card';

    const prBadgeHtml = item.prCount > 0 ? `<span class="workout-log-pr-badge">🏆 שיא אישי x${item.prCount}</span>` : '';
    const dispName = w.locationName || (w.location === 'gym' ? 'חדר כושר' : 'פארק');
    const dispEmoji = w.locationEmoji || (w.location === 'gym' ? '🏋️‍♂️' : '🌳');

    card.innerHTML = `
      <div class="workout-log-header">
        <div class="workout-log-location">
          <span class="workout-log-emoji">${dispEmoji}</span>
          <div>
            <h4 class="workout-log-name">${dispName}</h4>
            <span class="workout-log-date">${dateStr} • ${duration} דק׳</span>
          </div>
        </div>
        <div class="workout-log-stats">
          <span class="workout-log-volume">${item.totalVolume.toLocaleString()} ק״ג</span>
          ${prBadgeHtml}
        </div>
      </div>
      <div class="workout-log-exercises">
        ${w.exercises.map(ex => {
          const exSetsText = formatExerciseSetsText(ex);
          return `
            <div class="workout-log-exercise-item">
              <span class="workout-log-exercise-name">• ${ex.name}</span>
              <span class="workout-log-exercise-sets">[${exSetsText}]</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    card.addEventListener('click', () => {
      openEditModal(w.id);
    });

    container.appendChild(card);
  });
}

// Compute individual stats for exercises leaderboards
export function getExerciseStats(exerciseName) {
  let timesPerformed = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let max1RM = 0;
  let peakVolume = 0;

  state.workoutHistory.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets) {
      const completedSets = ex.sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        timesPerformed++;
        totalSets += completedSets.length;
        
        let sessionVolume = 0;
        completedSets.forEach(s => {
          const wVal = parseFloat(s.weight) || 0;
          const rVal = parseInt(s.reps, 10) || 0;

          if (wVal > maxWeight) maxWeight = wVal;
          const oneRM = rVal === 1 ? wVal : wVal * (1 + rVal / 30);
          if (oneRM > max1RM) max1RM = oneRM;
          sessionVolume += (wVal * rVal);
        });

        if (sessionVolume > peakVolume) peakVolume = sessionVolume;
      }
    }
  });

  return { timesPerformed, totalSets, maxWeight, max1RM, peakVolume };
}

// Exercises Top 3 Leaderboard Widget
export function renderExercisesLeaderboard() {
  const container = document.getElementById('exercises-leaderboard-container');
  if (!container) return;

  const allExs = getAllExercises();
  const listWithStats = allExs.map(ex => {
    const stats = getExerciseStats(ex.name);
    return { ex, stats };
  }).filter(item => item.stats.timesPerformed > 0);

  listWithStats.sort((a, b) => {
    if (b.stats.timesPerformed !== a.stats.timesPerformed) {
      return b.stats.timesPerformed - a.stats.timesPerformed;
    }
    return b.stats.totalSets - a.stats.totalSets;
  });

  if (listWithStats.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '';

  const top3 = listWithStats.slice(0, 3);
  const maxPerformed = top3[0].stats.timesPerformed || 1;

  const ranks = ['🥇', '🥈', '🥉'];
  const gradientClasses = ['gold-gradient', 'silver-gradient', 'bronze-gradient'];
  const tierClasses = ['gold-tier', 'silver-tier', 'bronze-tier'];

  const header = document.createElement('div');
  header.className = 'leaderboard-header';
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; direction: rtl;';
  header.innerHTML = `
    <h3 class="leaderboard-title" style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #fff;">🏆 תרגילים מובילים שלי</h3>
    <span class="leaderboard-badge" style="font-size: 0.72rem; background: rgba(0, 240, 255, 0.1); color: #00F0FF; padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(0, 240, 255, 0.2); font-weight: 700;">התמדה מירבית</span>
  `;
  container.appendChild(header);

  const listContainer = document.createElement('div');
  listContainer.className = 'leaderboard-list';
  listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px; direction: rtl; text-align: right;';
  
  top3.forEach((item, idx) => {
    const pct = Math.round((item.stats.timesPerformed / maxPerformed) * 100);
    const emojiStr = item.ex.emoji ? `<span style="font-size: 1.2rem; margin-left: 6px;">${item.ex.emoji}</span>` : '💪';
    
    const leaderItem = document.createElement('div');
    leaderItem.className = `leader-item ${tierClasses[idx]}`;
    leaderItem.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.03); transition: all 0.3s ease; cursor: pointer;';
    
    leaderItem.innerHTML = `
      <div class="leader-rank" style="font-size: 1.4rem;">${ranks[idx]}</div>
      <div class="leader-info" style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
        <span class="leader-name" style="font-size: 0.95rem; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 4px;">
          ${emojiStr} ${item.ex.name}
        </span>
        <span class="leader-sub" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
          בוצע ${item.stats.timesPerformed} פעמים | ${item.stats.totalSets} סטים | שיא: ${item.stats.maxWeight > 0 ? item.stats.maxWeight + ' ק״ג' : '--'}
        </span>
        <div class="progress-bar-container" style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.06); border-radius: 3px; overflow: hidden; margin-top: 4px;">
          <div class="progress-bar-fill ${gradientClasses[idx]}" style="width: ${pct}%; height: 100%; border-radius: 3px; transition: width 1s ease-in-out;"></div>
        </div>
      </div>
    `;

    leaderItem.addEventListener('click', () => {
      openExerciseInspector(item.ex.name);
    });

    listContainer.appendChild(leaderItem);
  });

  container.appendChild(listContainer);
}

// Exercises List Manager inside Analytics Subtab
const categoryColorsTab3 = {
  'חזה':      { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'גב':       { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  'כתפיים':    { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
  'רגליים':    { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  'ידיים':    { bg: 'rgba(251,146,60,0.15)',  color: '#fb923c' },
  'בטן':      { bg: 'rgba(234,179,8,0.15)',   color: '#facc15' },
  'אירובי':    { bg: 'rgba(20,184,166,0.15)',  color: '#2dd4bf' },
  'ליבה':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'מתח':      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'דחיפה':    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  'ליבה ואירובי': { bg: 'rgba(20,184,166,0.15)', color: '#2dd4bf' },
  'מותאם אישית': { bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' }
};

export function renderExercisesManager() {
  renderExercisesLeaderboard();

  const gridContainer = document.getElementById('exercises-list-grid-tab3');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  const searchInput = document.getElementById('exercises-search-input-tab3');
  const muscleFilter = document.getElementById('exercises-muscle-filter-tab3');
  const typeFilter = document.getElementById('exercises-type-filter-tab3');
  const usageFilter = document.getElementById('exercises-usage-filter-tab3');
  const favoriteFilter = document.getElementById('exercises-favorite-filter-tab3');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedMuscle = muscleFilter ? muscleFilter.value : 'all';
  const selectedType = typeFilter ? typeFilter.value : 'all';
  const selectedUsage = usageFilter ? usageFilter.value : 'all';
  const selectedFavorite = favoriteFilter ? favoriteFilter.value : 'all';

  let allExs = getAllExercises();

  if (query) {
    allExs = allExs.filter(ex => ex.name.toLowerCase().includes(query));
  }
  if (selectedMuscle !== 'all') {
    allExs = allExs.filter(ex => ex.category === selectedMuscle);
  }
  if (selectedType !== 'all') {
    const standardNames = new Set([...GYM_EXERCISES, ...PARK_EXERCISES].map(e => e.name.trim().toLowerCase()));
    if (selectedType === 'standard') {
      allExs = allExs.filter(ex => standardNames.has(ex.name.trim().toLowerCase()));
    } else if (selectedType === 'custom') {
      allExs = allExs.filter(ex => !standardNames.has(ex.name.trim().toLowerCase()));
    }
  }

  if (selectedFavorite === 'favorites') {
    allExs = allExs.filter(ex => state.favoriteExercises.includes(ex.name));
  }

  if (selectedUsage !== 'all') {
    if (selectedUsage === 'used') {
      allExs = allExs.filter(ex => {
        const stats = getExerciseStats(ex.name);
        return stats.timesPerformed > 0;
      });
    } else if (selectedUsage === 'unused') {
      allExs = allExs.filter(ex => {
        const stats = getExerciseStats(ex.name);
        return stats.timesPerformed === 0;
      });
    } else if (selectedUsage === 'recent') {
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      
      allExs = allExs.filter(ex => {
        return state.workoutHistory.some(w => {
          if (new Date(w.date) < limitDate) return false;
          if (!w.exercises) return false;
          return w.exercises.some(e => {
            if (e.name !== ex.name) return false;
            return e.sets && e.sets.some(s => s.completed);
          });
        });
      });
    }
  }

  if (allExs.length === 0) {
    gridContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px; direction: rtl;">אין תרגילים העונים על סינון זה</div>';
    return;
  }

  allExs.forEach(ex => {
    const stats = getExerciseStats(ex.name);
    
    const card = document.createElement('div');
    card.className = 'exercise-manage-card-tab3';
    
    const catStyle = categoryColorsTab3[ex.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    const emojiStr = ex.emoji ? `<span class="ex-card-emoji-tab3">${ex.emoji}</span>` : '💪';
    const isFav = state.favoriteExercises.includes(ex.name);
    
    card.innerHTML = `
      <div class="ex-card-info-tab3" style="text-align: right; direction: rtl; flex: 1;">
        <div class="ex-card-title-row">
          ${emojiStr}
          <span class="ex-card-name-tab3">${ex.name}</span>
        </div>
        <div class="ex-card-stats-tab3" style="margin-top: 4px;">
          בוצע ${stats.timesPerformed} פעמים • ${stats.totalSets} סטים
        </div>
      </div>
      <div class="ex-card-actions-tab3" style="display: flex; align-items: center; gap: 10px;">
        <span class="ex-card-badge-tab3" style="background: ${catStyle.bg}; color: ${catStyle.color}; margin-left: 4px;">${ex.category || 'אחר'}</span>
      </div>
    `;

    const actionsContainer = card.querySelector('.ex-card-actions-tab3');
    const starBtn = document.createElement('button');
    starBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    starBtn.style.cssText = 'width: 32px !important; height: 32px !important; font-size: 0.95rem !important; margin: 0 !important; border: 1.5px solid rgba(255, 255, 255, 0.07) !important;';
    starBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    starBtn.innerHTML = isFav ? '⭐' : '☆';
    
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = state.favoriteExercises.indexOf(ex.name);
      if (idx > -1) {
        state.favoriteExercises.splice(idx, 1);
        starBtn.innerHTML = '☆';
        starBtn.classList.remove('active');
        starBtn.title = 'הוסף למועדפים';
      } else {
        state.favoriteExercises.push(ex.name);
        starBtn.innerHTML = '⭐';
        starBtn.classList.add('active');
        starBtn.title = 'הסר ממועדפים';
      }
      if (state.currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
      }
      renderExercisesManager();
      if (typeof renderExercisePickerList === 'function') renderExercisePickerList();
    });
    
    actionsContainer.appendChild(starBtn);

    card.addEventListener('click', () => {
      openExerciseInspector(ex.name);
    });

    gridContainer.appendChild(card);
  });
}

// Open exercise detailed overlay (Inspector)
export function openExerciseInspector(exerciseName) {
  state.currentInspectorExercise = exerciseName;
  
  const allExs = getAllExercises();
  const exDetails = allExs.find(ex => ex.name === exerciseName) || { name: exerciseName, category: 'אחר', emoji: '💪' };

  const nameEl = document.getElementById('inspector-exercise-name');
  const catBadge = document.getElementById('inspector-exercise-category');
  const inspectorFavBtn = document.getElementById('inspector-exercise-fav-btn');
  
  if (nameEl) {
    nameEl.textContent = (exDetails.emoji ? `${exDetails.emoji} ` : '') + exDetails.name;
  }
  
  if (catBadge) {
    catBadge.textContent = exDetails.category || 'אחר';
    const catStyle = categoryColorsTab3[exDetails.category] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' };
    catBadge.style.cssText = `background: ${catStyle.bg}; color: ${catStyle.color}; margin-top: 4px; display: inline-block;`;
  }

  if (inspectorFavBtn) {
    const isFav = state.favoriteExercises.includes(exerciseName);
    inspectorFavBtn.className = `ex-fav-star-btn ${isFav ? 'active' : ''}`;
    inspectorFavBtn.title = isFav ? 'הסר ממועדפים' : 'הוסף למועדפים';
    inspectorFavBtn.innerHTML = isFav ? '⭐' : '☆';
  }

  const stats = getExerciseStats(exerciseName);
  
  const prVal = document.getElementById('inspector-pr-val');
  const rmVal = document.getElementById('inspector-1rm-val');
  const volVal = document.getElementById('inspector-vol-val');
  const performedVal = document.getElementById('inspector-performed-val');

  if (prVal) prVal.textContent = stats.maxWeight > 0 ? `${stats.maxWeight} ק״ג` : '--';
  if (rmVal) rmVal.textContent = stats.max1RM > 0 ? `${Math.round(stats.max1RM)} ק״ג` : '--';
  if (volVal) volVal.textContent = stats.peakVolume > 0 ? `${stats.peakVolume} ק״ג` : '--';
  if (performedVal) performedVal.textContent = `${stats.timesPerformed} פעמים • ${stats.totalSets} סטים`;

  // History timeline PRs breaker
  const timelineContainer = document.getElementById('pr-history-timeline-tab3');
  if (timelineContainer) {
    timelineContainer.innerHTML = '';
    
    const chronological = [...state.workoutHistory]
      .filter(w => w.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningMaxWeight = 0;
    const brokenPRs = [];

    chronological.forEach(w => {
      if (!w.exercises) return;
      const ex = w.exercises.find(e => e.name === exerciseName);
      if (ex && ex.sets) {
        const completedSets = ex.sets.filter(s => s.completed);
        if (completedSets.length > 0) {
          const sessionMaxWeight = Math.max(...completedSets.map(s => parseFloat(s.weight) || 0));
          if (sessionMaxWeight > runningMaxWeight) {
            runningMaxWeight = sessionMaxWeight;
            brokenPRs.push({
              date: new Date(w.date),
              weight: sessionMaxWeight
            });
          }
        }
      }
    });

    if (brokenPRs.length === 0) {
      timelineContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 10px;">לא נרשמו שיאים אישיים עדיין</div>';
    } else {
      [...brokenPRs].reverse().forEach(pr => {
        const item = document.createElement('div');
        item.className = 'pr-timeline-item';
        const dateStr = pr.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="pr-timeline-badge">PR שבור!</span>
            <span class="pr-timeline-val">${pr.weight} ק״ג</span>
          </div>
          <span class="pr-timeline-date">${dateStr}</span>
        `;
        timelineContainer.appendChild(item);
      });
    }
  }

  state.activeChartTypeTab3 = '1rm';
  const tabs = document.querySelectorAll('[data-chart-tab3]');
  tabs.forEach(t => {
    t.classList.remove('active');
    if (t.dataset.chartTab3 === '1rm') t.classList.add('active');
  });

  renderExerciseInspectorChart();

  const modal = document.getElementById('exercise-inspector-modal');
  if (modal) modal.classList.remove('hide');
}

export function renderExerciseInspectorChart() {
  const exerciseName = state.currentInspectorExercise;
  if (!exerciseName) return;

  const noDataEl = document.getElementById('chart-no-data-tab3');
  const fillPath = document.getElementById('gauge-fill');
  const valueDisplay = document.getElementById('gauge-value-display');
  const subtextDisplay = document.getElementById('gauge-subtext-display');
  const limitLeft = document.getElementById('gauge-limit-left');
  const limitRight = document.getElementById('gauge-limit-right');

  const exerciseSessions = [];
  const chronological = [...state.workoutHistory]
    .filter(w => w.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  chronological.forEach(w => {
    if (!w.exercises) return;
    const ex = w.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets && ex.sets.some(s => s.completed)) {
      exerciseSessions.push({
        date: new Date(w.date),
        sets: ex.sets.filter(s => s.completed)
      });
    }
  });

  if (exerciseSessions.length === 0) {
    if (noDataEl) noDataEl.style.display = 'flex';
    if (fillPath) fillPath.setAttribute('stroke-dashoffset', '251.3');
    if (valueDisplay) valueDisplay.textContent = '--';
    if (subtextDisplay) subtextDisplay.textContent = 'אין נתונים';
    if (limitLeft) limitLeft.textContent = 'בסיס: --';
    if (limitRight) limitRight.textContent = 'שיא: --';
    return;
  }

  if (noDataEl) noDataEl.style.display = 'none';

  const values = [];
  exerciseSessions.forEach(session => {
    let sessionMaxWeight = 0;
    let sessionMax1RM = 0;
    let sessionVolume = 0;

    session.sets.forEach(s => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;

      if (w > sessionMaxWeight) sessionMaxWeight = w;
      const oneRM = r === 1 ? w : w * (1 + r / 30);
      if (oneRM > sessionMax1RM) sessionMax1RM = oneRM;
      sessionVolume += (w * r);
    });

    let yValue = 0;
    if (state.activeChartTypeTab3 === '1rm') {
      yValue = sessionMax1RM;
    } else if (state.activeChartTypeTab3 === 'weight') {
      yValue = sessionMaxWeight;
    } else {
      yValue = sessionVolume;
    }
    values.push(yValue);
  });

  const baseVal = Math.round(values[0]);
  const maxVal = Math.round(Math.max(...values));
  const currentVal = Math.round(values[values.length - 1]);

  const percentage = maxVal > 0 ? (currentVal / maxVal) : 0;
  const strokeDashoffset = 251.3 * (1 - percentage);

  if (fillPath) {
    fillPath.setAttribute('stroke-dashoffset', strokeDashoffset.toFixed(1));
  }

  const unit = state.activeChartTypeTab3 === 'volume' ? ' ק״ג' : ' ק״ג';
  if (valueDisplay) {
    valueDisplay.textContent = `${currentVal}${unit}`;
  }

  if (subtextDisplay) {
    const diffVal = currentVal - baseVal;
    const diffPct = baseVal > 0 ? ((diffVal / baseVal) * 100) : 0;
    if (diffVal >= 0) {
      subtextDisplay.textContent = `+${diffPct.toFixed(1)}% מתחילת הדרך 📈`;
      subtextDisplay.style.color = '#00ff87';
    } else {
      subtextDisplay.textContent = `${diffPct.toFixed(1)}% מתחילת הדרך 📉`;
      subtextDisplay.style.color = '#ea580c';
    }
  }

  if (limitLeft) {
    limitLeft.textContent = `בסיס: ${baseVal} ק״ג`;
  }
  if (limitRight) {
    limitRight.textContent = `שיא אישי: ${maxVal} ק״ג`;
  }
}

export function deleteGlobalExercise(exerciseName) {
  if (!confirm(`האם אתה בטוח שברצונך למחוק את "${exerciseName}" לצמיתות?\nפעולה זו תסיר את התרגיל מרשימות הבחירה בעתיד, אך תשמור אותו בהיסטוריית האימונים הישנים שלך כדי לשמור על הסטטיסטיקות.`)) {
    return;
  }

  let allExs = getAllExercises();
  allExs = allExs.filter(ex => ex.name.trim().toLowerCase() !== exerciseName.trim().toLowerCase());
  saveAllExercises(allExs);

  if (state.currentUser) {
    state.customExercises = state.customExercises.filter(ex => ex.name.trim().toLowerCase() !== exerciseName.trim().toLowerCase());
    SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
  }

  const modal = document.getElementById('exercise-inspector-modal');
  if (modal) modal.classList.add('hide');

  renderExercisesManager();
  if (typeof renderExercisePickerList === 'function') renderExercisePickerList();
  
  alert(`התרגיל "${exerciseName}" נמחק לנצח! 🗑️`);
}

export function addGlobalExercise() {
  const nameInput = document.getElementById('new-global-exercise-name');
  const muscleSelect = document.getElementById('new-global-exercise-muscle');
  const emojiInput = document.getElementById('new-global-exercise-emoji');

  if (!nameInput || !nameInput.value.trim()) {
    alert('אנא הזן שם לתרגיל החדש.');
    if (nameInput) nameInput.focus();
    return;
  }

  const name = nameInput.value.trim();
  const category = muscleSelect ? muscleSelect.value : 'אחר';
  const emoji = emojiInput ? emojiInput.value.trim() : '';

  let allExs = getAllExercises();

  if (allExs.some(ex => ex.name.trim().toLowerCase() === name.toLowerCase())) {
    alert('תרגיל בשם זה כבר קיים במערכת!');
    return;
  }

  const newEx = {
    name,
    category,
    emoji: emoji || '💪'
  };

  allExs.push(newEx);
  saveAllExercises(allExs);

  if (state.currentUser) {
    state.customExercises.push(newEx);
    SafeStorage.setItem(`aura-custom-exercises_${state.currentUser.uid}`, JSON.stringify(state.customExercises));
  }

  nameInput.value = '';
  if (emojiInput) emojiInput.value = '';

  const modal = document.getElementById('add-global-exercise-modal');
  if (modal) modal.classList.add('hide');

  renderExercisesManager();
  if (typeof renderExercisePickerList === 'function') renderExercisePickerList();

  alert(`התרגיל "${name}" נוסף לנצח בהצלחה! ✨`);
}

// Orchestrator for subtab rendering
export function renderAnalytics() {
  console.log("Refreshing Analytics view with active filters...", state.activeSubTab);
  
  if (state.activeSubTab === 'workouts') {
    renderWorkoutsLog();
  } else if (state.activeSubTab === 'calendar') {
    renderCalendarView();
    renderMuscleSplitView();
  } else if (state.activeSubTab === 'exercises') {
    renderExercisesManager();
  } else if (state.activeSubTab === 'ai') {
    console.log("Aura AI Coach segment active.");
  }
}

// coming soon Coach Orb Card interactions
export function initAICoach() {
  const card = document.querySelector('#sub-tab-ai .aura-ai-card');
  if (!card) return;

  card.addEventListener('click', (e) => {
    e.preventDefault();

    const ripple = document.createElement('span');
    ripple.className = 'ai-ripple';

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    card.appendChild(ripple);

    if (navigator.vibrate) {
      navigator.vibrate(15);
    }

    showAuraToast("המאמן האישי שלך בהכנה... 🤖🔥");

    setTimeout(() => {
      ripple.remove();
    }, 800);
  });
}

// Setup Analytics Event Binders on DOM ready
export function initAnalyticsTab() {
  // Collapsible Filters Panel
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const collapsibleFiltersContainer = document.getElementById('collapsible-filters-container');
  if (toggleFiltersBtn && collapsibleFiltersContainer) {
    toggleFiltersBtn.addEventListener('click', () => {
      const isExpanded = collapsibleFiltersContainer.classList.toggle('expanded');
      toggleFiltersBtn.classList.toggle('expanded', isExpanded);
    });
  }

  // Metrics Sub-Navigation Bar Tab Switcher
  const subNavTabs = document.querySelectorAll('#metrics-sub-nav .nav-tab[data-sub-tab]');
  subNavTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const subTab = tab.dataset.subTab;
      if (!subTab) return;

      state.activeSubTab = subTab;

      // Update active class on sub-nav tabs
      subNavTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active sub-tab panes and adjust inline display styles
      const subPanes = document.querySelectorAll('#tab-analytics .sub-tab-pane');
      subPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `sub-tab-${subTab}`) {
          pane.classList.add('active');
          pane.style.display = 'flex';
        } else {
          pane.style.display = 'none';
        }
      });

      console.log(`Switched to metrics sub-tab: ${subTab}`);
      renderAnalytics();
    });
  });

  // Metrics Sub-Navigation Back Button Handler
  const subNavBackBtn = document.getElementById('sub-nav-back-btn');
  if (subNavBackBtn) {
    subNavBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mainNav = document.querySelector('.ios-bottom-nav');
      const subNav = document.getElementById('metrics-sub-nav');
      if (subNav) subNav.classList.add('nav-hidden');
      if (mainNav) mainNav.classList.remove('nav-hidden');

      // Return to the last active main navigation tab
      const targetTab = state.lastActiveMainTab || 'settings';
      const mainTabBtn = document.querySelector(`.ios-bottom-nav .nav-tab[data-tab="${targetTab}"]`);
      if (mainTabBtn) {
        mainTabBtn.click();
      }
    });
  }

  // Log book switcher
  const logsSwitchBtns = document.querySelectorAll('#tab-analytics .logs-switch-btn');
  logsSwitchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      logsSwitchBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--text-muted)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--electric-blue-light)';
      btn.style.color = '#fff';

      const subview = btn.dataset.subview;
      state.activeLogsSubView = subview;

      const calendarView = document.getElementById('analytics-calendar-view');
      const historyListView = document.getElementById('analytics-history-list-view');

      if (subview === 'calendar') {
        if (calendarView) calendarView.classList.remove('hide');
        if (historyListView) historyListView.classList.add('hide');
        renderCalendarView();
      } else {
        if (calendarView) calendarView.classList.add('hide');
        if (historyListView) historyListView.classList.remove('hide');
        renderAccordionHistoryView();
      }
    });
  });

  // Time filter chips
  const chips = document.querySelectorAll('#tab-analytics .filter-chip');
  const customDateInputs = document.getElementById('custom-date-inputs');

  chips.forEach(c => {
    c.addEventListener('click', () => {
      chips.forEach(x => x.classList.remove('active'));
      c.classList.add('active');

      state.filterTimeSelection = c.dataset.time;

      if (state.filterTimeSelection === 'custom') {
        if (customDateInputs) customDateInputs.style.display = 'flex';
      } else {
        if (customDateInputs) customDateInputs.style.display = 'none';
      }

      renderAnalytics();
    });
  });

  const startD = document.getElementById('filter-start-date');
  const endD = document.getElementById('filter-end-date');

  const onDateChange = () => {
    state.filterStartDate = startD && startD.value ? new Date(startD.value) : null;
    state.filterEndDate = endD && endD.value ? new Date(endD.value) : null;
    renderAnalytics();
  };

  if (startD) startD.addEventListener('change', onDateChange);
  if (endD) endD.addEventListener('change', onDateChange);

  // Dropdowns filters
  const locationSelect = document.getElementById('filter-location-select');
  const muscleSelect = document.getElementById('filter-muscle-select');

  if (locationSelect) {
    locationSelect.addEventListener('change', () => {
      state.filterLocation = locationSelect.value;
      renderAnalytics();
    });
  }

  if (muscleSelect) {
    muscleSelect.addEventListener('change', () => {
      state.filterMuscleGroup = muscleSelect.value;
      renderAnalytics();
    });
  }

  // Suggestions search picker
  const searchInput = document.getElementById('analytics-exercise-search');
  const dropdown = document.getElementById('analytics-suggestions-dropdown');
  const clearBtn = document.getElementById('clear-dashboard-btn');

  if (searchInput && dropdown) {
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim().toLowerCase();
      if (!val) {
        dropdown.classList.add('hide');
        return;
      }

      const set = new Set();
      getAllExercises().forEach(e => set.add(e.name));
      state.workoutHistory.forEach(w => {
        if (w.exercises) w.exercises.forEach(e => set.add(e.name));
      });

      const matches = Array.from(set).filter(name => name.toLowerCase().includes(val));

      if (matches.length === 0) {
        dropdown.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.85rem; text-align: right; direction: rtl;">לא נמצאו תרגילים מתאימים</div>';
      } else {
        dropdown.innerHTML = '';
        matches.slice(0, 5).forEach(name => {
          const item = document.createElement('div');
          item.className = 'suggestion-item';
          item.style.cssText = 'padding: 10px 14px; color: #fff; font-size: 0.9rem; font-weight: 600; cursor: pointer; text-align: right; direction: rtl; border-bottom: 1px solid rgba(255,255,255,0.03);';
          item.textContent = name;
          item.addEventListener('click', () => {
            state.selectedAnalyticsExercise = name;
            searchInput.value = name;
            dropdown.classList.add('hide');

            const db = document.getElementById('analytics-exercise-dashboard');
            const dbName = document.getElementById('dashboard-exercise-name');
            if (db) db.classList.remove('hide');
            if (dbName) dbName.textContent = name;

            renderExerciseAnalyticsDashboard();
          });
          dropdown.appendChild(item);
        });
      }
      dropdown.classList.remove('hide');
    });

    document.addEventListener('click', (e) => {
      if (e.target !== searchInput && e.target !== dropdown) {
        dropdown.classList.add('hide');
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.selectedAnalyticsExercise = null;
      if (searchInput) searchInput.value = '';
      const db = document.getElementById('analytics-exercise-dashboard');
      if (db) db.classList.add('hide');
    });
  }

  // Dashboard Chart Tabs Switcher
  const chartTabs = document.querySelectorAll('#tab-analytics .chart-tab');
  chartTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chartTabs.forEach(x => x.classList.remove('active'));
      tab.classList.add('active');

      state.activeChartType = tab.dataset.chart;
      renderExerciseAnalyticsDashboard();
    });
  });

  // Calendar monthly navigations
  const prevMonthBtn = document.getElementById('calendar-prev-month');
  const nextMonthBtn = document.getElementById('calendar-next-month');

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
      renderCalendarView();
    });
  }
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
      renderCalendarView();
    });
  }

  // Future scheduling system
  const scheduleTriggerBtn = document.getElementById('schedule-workout-trigger-btn');
  const scheduleModal = document.getElementById('schedule-workout-modal');
  const closeScheduleBtn = document.getElementById('close-schedule-workout-btn');
  const scheduleForm = document.getElementById('schedule-workout-form');
  const scheduleLocationSelect = document.getElementById('schedule-location-select');
  const scheduleCustomLocation = document.getElementById('schedule-custom-location');

  if (scheduleTriggerBtn && scheduleModal) {
    scheduleTriggerBtn.addEventListener('click', () => {
      requestNotificationPermissionSafely();
      
      scheduleModal.classList.remove('hide');
      scheduleModal.style.display = 'flex';
      
      const todayStr = new Date().toISOString().split('T')[0];
      const dateInput = document.getElementById('schedule-date');
      if (dateInput) dateInput.value = todayStr;
    });
  }

  if (closeScheduleBtn && scheduleModal) {
    closeScheduleBtn.addEventListener('click', () => {
      scheduleModal.classList.add('hide');
      scheduleModal.style.display = 'none';
    });
  }

  if (scheduleLocationSelect && scheduleCustomLocation) {
    scheduleLocationSelect.addEventListener('change', () => {
      if (scheduleLocationSelect.value === 'custom') {
        scheduleCustomLocation.style.display = 'block';
        scheduleCustomLocation.setAttribute('required', 'true');
      } else {
        scheduleCustomLocation.style.display = 'none';
        scheduleCustomLocation.removeAttribute('required');
      }
    });
  }

  if (scheduleForm && scheduleModal) {
    scheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const locVal = scheduleLocationSelect.value;
      let finalLoc = '';
      let emoji = '🏋️‍♂️';

      if (locVal === 'custom') {
        finalLoc = scheduleCustomLocation.value.trim();
        emoji = '✨';
      } else if (locVal === 'gym') {
        finalLoc = 'חדר כושר';
        emoji = '🏋️‍♂️';
      } else if (locVal === 'park') {
        finalLoc = 'פארק';
        emoji = '🌳';
      } else {
        const matched = state.customLocations.find(l => l.id === locVal);
        if (matched) {
          finalLoc = matched.name;
          emoji = matched.emoji || '💪';
        }
      }

      const dateVal = document.getElementById('schedule-date').value;
      const timeVal = document.getElementById('schedule-time').value;
      const reminderSelect = document.getElementById('schedule-reminder-select');
      const reminderMinutes = parseInt(reminderSelect.value, 10);

      if (!finalLoc || !dateVal || !timeVal) {
        alert("נא למלא את כל השדות החיוניים");
        return;
      }

      const newFutureWorkout = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        location: finalLoc,
        locationEmoji: emoji,
        date: dateVal,
        time: timeVal,
        reminderMinutes: reminderMinutes,
        reminderSent: false
      };

      const currentFutures = getFutureWorkouts();
      currentFutures.push(newFutureWorkout);
      saveFutureWorkouts(currentFutures);

      scheduleModal.classList.add('hide');
      scheduleModal.style.display = 'none';

      scheduleForm.reset();
      if (scheduleCustomLocation) {
        scheduleCustomLocation.style.display = 'none';
        scheduleCustomLocation.removeAttribute('required');
      }

      requestNotificationPermissionSafely();
      renderCalendarView();

      alert(`אימון עתידי מסוג "${finalLoc}" מתוזמן בהצלחה! 🏋️‍♂️`);
    });
  }

  // EXERCISES MANAGER SUBTAB EVENTS BINDINGS
  const addExGlobalBtn = document.getElementById('add-new-global-exercise-btn');
  const addExGlobalModal = document.getElementById('add-global-exercise-modal');
  const closeAddExGlobalModalBtn = document.getElementById('close-add-global-exercise-modal-btn');
  
  if (addExGlobalBtn && addExGlobalModal) {
    addExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addExGlobalModal.classList.remove('hide');
    });
  }

  if (closeAddExGlobalModalBtn && addExGlobalModal) {
    closeAddExGlobalModalBtn.addEventListener('click', () => {
      addExGlobalModal.classList.add('hide');
    });
    addExGlobalModal.addEventListener('click', (e) => {
      if (e.target === addExGlobalModal) addExGlobalModal.classList.add('hide');
    });
  }

  const saveExGlobalBtn = document.getElementById('save-new-global-exercise-btn');
  if (saveExGlobalBtn) {
    saveExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addGlobalExercise();
    });
  }

  const closeInspectorBtn = document.getElementById('close-exercise-inspector-btn');
  const inspectorModal = document.getElementById('exercise-inspector-modal');
  
  if (closeInspectorBtn && inspectorModal) {
    closeInspectorBtn.addEventListener('click', () => {
      inspectorModal.classList.add('hide');
    });
    inspectorModal.addEventListener('click', (e) => {
      if (e.target === inspectorModal) inspectorModal.classList.add('hide');
    });
  }

  const deleteExGlobalBtn = document.getElementById('delete-global-exercise-btn');
  if (deleteExGlobalBtn) {
    deleteExGlobalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentInspectorExercise) {
        deleteGlobalExercise(state.currentInspectorExercise);
      }
    });
  }

  const searchInputTab3 = document.getElementById('exercises-search-input-tab3');
  if (searchInputTab3) {
    searchInputTab3.addEventListener('input', renderExercisesManager);
  }

  const muscleFilterTab3 = document.getElementById('exercises-muscle-filter-tab3');
  if (muscleFilterTab3) {
    muscleFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const typeFilterTab3 = document.getElementById('exercises-type-filter-tab3');
  if (typeFilterTab3) {
    typeFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const usageFilterTab3 = document.getElementById('exercises-usage-filter-tab3');
  if (usageFilterTab3) {
    usageFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const favoriteFilterTab3 = document.getElementById('exercises-favorite-filter-tab3');
  if (favoriteFilterTab3) {
    favoriteFilterTab3.addEventListener('change', renderExercisesManager);
  }

  const inspectorFavBtn = document.getElementById('inspector-exercise-fav-btn');
  if (inspectorFavBtn) {
    inspectorFavBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.currentInspectorExercise) return;
      const exName = state.currentInspectorExercise;
      const idx = state.favoriteExercises.indexOf(exName);
      if (idx > -1) {
        state.favoriteExercises.splice(idx, 1);
        inspectorFavBtn.innerHTML = '☆';
        inspectorFavBtn.classList.remove('active');
        inspectorFavBtn.title = 'הוסף למועדפים';
      } else {
        state.favoriteExercises.push(exName);
        inspectorFavBtn.innerHTML = '⭐';
        inspectorFavBtn.classList.add('active');
        inspectorFavBtn.title = 'הסר ממועדפים';
      }
      if (state.currentUser) {
        SafeStorage.setItem(`aura-favorite-exercises_${state.currentUser.uid}`, JSON.stringify(state.favoriteExercises));
      }
      renderExercisesManager();
      if (typeof renderExercisePickerList === 'function') renderExercisePickerList();
    });
  }

  const chartTabsTab3 = document.querySelectorAll('[data-chart-tab3]');
  chartTabsTab3.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetChartType = tab.getAttribute('data-chart-tab3');
      if (!targetChartType) return;

      state.activeChartTypeTab3 = targetChartType;

      chartTabsTab3.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      renderExerciseInspectorChart();
    });
  });

  window.addEventListener('resize', () => {
    if (inspectorModal && !inspectorModal.classList.contains('hide')) {
      renderExerciseInspectorChart();
    }
  });

  // Start periodic reminders checker
  startFutureWorkoutReminderChecker();

  // Initialize Coming soon coach
  initAICoach();
}

// Hook into global compatibility mappings
export function initAnalyticsModule() {
  window.renderWorkoutHistory = renderWorkoutHistory;
  window.renderAnalytics = renderAnalytics;
  window.checkAndShowPreviousPerformance = checkAndShowPreviousPerformance;
  window.renderExercisesManager = renderExercisesManager;
  window.renderAccordionHistoryView = renderAccordionHistoryView;
  window.renderWorkoutsLog = renderWorkoutsLog;
}

// Helper compatibility functions
function renderWorkoutHistory() {
  renderAnalytics();
}

function checkAndShowPreviousPerformance(exerciseName) {
  if (!state.workoutHistory || state.workoutHistory.length === 0) return;

  const sorted = [...state.workoutHistory].sort((a, b) => b.date - a.date);
  const prevWorkout = sorted.find(w => w.exercises && w.exercises.some(ex => ex.name === exerciseName && ex.sets && ex.sets.some(s => s.completed)));
  if (!prevWorkout) return;

  const prevEx = prevWorkout.exercises.find(ex => ex.name === exerciseName);
  if (!prevEx) return;

  const completedSets = prevEx.sets.filter(s => s.completed);
  if (completedSets.length === 0) return;

  const titleEl = document.getElementById('prev-workout-alert-title');
  const dateEl = document.getElementById('prev-workout-alert-date');
  const container = document.getElementById('prev-workout-alert-sets');

  if (titleEl) titleEl.textContent = exerciseName;
  if (dateEl) {
    const dateObj = new Date(prevWorkout.date);
    const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const locationStr = prevWorkout.locationName || (prevWorkout.location === 'gym' ? 'חדר כושר' : 'פארק');
    const emoji = prevWorkout.locationEmoji || (prevWorkout.location === 'gym' ? '🏋️‍♂️' : '🌳');
    dateEl.textContent = `אימון אחרון (${emoji} ${locationStr}): ${dateStr}`;
  }

  if (container) {
    container.innerHTML = '';
    completedSets.forEach((s, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 6px; font-size: 0.9rem; color: #ffffff;';
      
      let valText = '';
      if (prevEx.metricType === 'both') {
        valText = `<strong>${s.weight} ק״ג</strong> × <strong>${s.reps} חזרות</strong>`;
      } else if (prevEx.metricType === 'weight') {
        valText = `<strong>${s.weight} ק״ג</strong>`;
      } else {
        valText = `<strong>${s.reps} חזרות</strong>`;
      }

      row.innerHTML = `
        <span style="font-weight: 700; color: #ef4444;">סט ${idx + 1}</span>
        <span style="direction: ltr;">${valText}</span>
      `;
      container.appendChild(row);
    });
  }

  const modal = document.getElementById('prev-workout-alert-modal');
  if (modal) modal.classList.remove('hide');
}

// Bind Prev Alert dismiss
onDOMReady(() => {
  const modal = document.getElementById('prev-workout-alert-modal');
  const closeBtn = document.getElementById('close-prev-workout-alert-btn');
  const okBtn = document.getElementById('prev-workout-alert-ok-btn');

  const dismiss = () => {
    if (modal) modal.classList.add('hide');
  };

  if (closeBtn) closeBtn.addEventListener('click', dismiss);
  if (okBtn) okBtn.addEventListener('click', dismiss);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) dismiss();
    });
  }
});

function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

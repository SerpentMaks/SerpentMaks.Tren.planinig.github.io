(() => {
  const STORAGE_KEY = "dnevnik_tren_v1";
  const MUSCLES = [
    { id: "chest", name: "Грудь" },
    { id: "back", name: "Спина" },
    { id: "legs", name: "Ноги" },
    { id: "shoulders", name: "Плечи" },
    { id: "arms", name: "Руки" },
    { id: "core", name: "Кор" }
  ];

  const DEFAULT_EXERCISES = [
    ["Жим штанги лёжа", "chest"],
    ["Жим гантелей лёжа", "chest"],
    ["Жим на наклонной скамье", "chest"],
    ["Разведения гантелей", "chest"],
    ["Отжимания на брусьях", "chest"],
    ["Кроссовер", "chest"],
    ["Тяга штанги в наклоне", "back"],
    ["Подтягивания", "back"],
    ["Тяга верхнего блока", "back"],
    ["Тяга горизонтального блока", "back"],
    ["Становая тяга", "back"],
    ["Тяга гантели в наклоне", "back"],
    ["Гиперэкстензия", "back"],
    ["Приседания со штангой", "legs"],
    ["Жим ногами", "legs"],
    ["Выпады", "legs"],
    ["Румынская тяга", "legs"],
    ["Разгибания ног", "legs"],
    ["Сгибания ног", "legs"],
    ["Подъёмы на носки", "legs"],
    ["Жим штанги стоя", "shoulders"],
    ["Жим гантелей сидя", "shoulders"],
    ["Махи в стороны", "shoulders"],
    ["Махи в наклоне", "shoulders"],
    ["Тяга к подбородку", "shoulders"],
    ["Подъём штанги на бицепс", "arms"],
    ["Молотковые сгибания", "arms"],
    ["Французский жим", "arms"],
    ["Разгибания на блоке", "arms"],
    ["Отжимания от скамьи", "arms"],
    ["Скручивания", "core"],
    ["Планка", "core"],
    ["Подъёмы ног в висе", "core"],
    ["Русские скручивания", "core"]
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const state = {
    tab: "home",
    cal: new Date(),
    selectedDay: todayISO(),
    muscleFilter: "all",
    search: "",
    keypad: null,
    rest: { active: false, left: 0, total: 90, timer: null },
    durationTimer: null,
    pickMode: null
  };

  function seed() {
    const exercises = DEFAULT_EXERCISES.map(([name, muscle]) => ({
      id: uid(), name, muscle, custom: false
    }));
    const byName = (n) => exercises.find((e) => e.name === n).id;
    return {
      settings: { theme: "dark", restSeconds: 90, units: "kg" },
      exercises,
      templates: [
        {
          id: uid(),
          name: "Грудь и трицепс",
          exerciseIds: ["Жим штанги лёжа", "Жим гантелей лёжа", "Разведения гантелей", "Французский жим", "Разгибания на блоке"].map(byName)
        },
        {
          id: uid(),
          name: "Спина и бицепс",
          exerciseIds: ["Подтягивания", "Тяга штанги в наклоне", "Тяга горизонтального блока", "Подъём штанги на бицепс", "Молотковые сгибания"].map(byName)
        },
        {
          id: uid(),
          name: "День ног",
          exerciseIds: ["Приседания со штангой", "Жим ногами", "Румынская тяга", "Выпады", "Подъёмы на носки"].map(byName)
        }
      ],
      workouts: [],
      activeWorkout: null,
      metrics: []
    };
  }

  let db = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seed();
      const parsed = JSON.parse(raw);
      parsed.settings = { theme: "dark", restSeconds: 90, units: "kg", ...parsed.settings };
      parsed.exercises ||= [];
      parsed.templates ||= [];
      parsed.workouts ||= [];
      parsed.metrics ||= [];
      return parsed;
    } catch {
      return seed();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function applyTheme() {
    const theme = db.settings.theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f3f1ec" : "#121316");
  }

  function unitLabel() {
    return db.settings.units === "lbs" ? "фунты" : "кг";
  }

  function toDisplayWeight(kg) {
    if (kg === "" || kg == null || Number.isNaN(Number(kg))) return "";
    const n = Number(kg);
    return db.settings.units === "lbs" ? round(n * 2.20462262, 1) : round(n, 2);
  }

  function fromDisplayWeight(val) {
    if (val === "" || val == null) return "";
    const n = Number(String(val).replace(",", "."));
    if (Number.isNaN(n)) return "";
    return db.settings.units === "lbs" ? n / 2.20462262 : n;
  }

  function round(n, d = 2) {
    const p = 10 ** d;
    return Math.round(n * p) / p;
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  }

  function startOfWeek(d = new Date()) {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return date;
  }

  function workoutsThisWeek() {
    const from = startOfWeek().getTime();
    return db.workouts.filter((w) => new Date(w.finishedAt).getTime() >= from).length;
  }

  function volumeOf(workout) {
    return workout.exercises.reduce((sum, ex) => {
      return sum + ex.sets.reduce((s, set) => {
        if (!set.done || set.weight === "" || set.reps === "") return s;
        return s + Number(set.weight) * Number(set.reps);
      }, 0);
    }, 0);
  }

  function lastPerformance(exerciseId, beforeTs) {
    const list = db.workouts
      .filter((w) => !beforeTs || new Date(w.finishedAt).getTime() < beforeTs)
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    for (const w of list) {
      const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
      if (!ex) continue;
      const done = ex.sets.filter((s) => s.done && s.weight !== "" && s.reps !== "");
      if (done.length) return done;
    }
    return [];
  }

  function lastSetSuggestion(exerciseId) {
    const sets = lastPerformance(exerciseId);
    return sets[sets.length - 1] || null;
  }

  function muscleName(id) {
    return MUSCLES.find((m) => m.id === id)?.name || id;
  }

  function exerciseById(id) {
    return db.exercises.find((e) => e.id === id);
  }

  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  function openSheet(html) {
    const el = $("#sheet");
    el.innerHTML = `<div class="sheet__panel"><div class="sheet__grab"></div>${html}</div>`;
    el.classList.remove("hidden");
    el.onclick = (e) => { if (e.target === el) closeSheet(); };
  }

  function closeSheet() {
    $("#sheet").classList.add("hidden");
    $("#sheet").innerHTML = "";
    state.pickMode = null;
  }

  function setTab(tab) {
    state.tab = tab;
    $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.tab === tab));
    document.querySelectorAll(".tabbar__item").forEach((b) => b.classList.toggle("active", b.dataset.nav === tab));
    render();
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  function startRest() {
    stopRest();
    const total = Number(db.settings.restSeconds) || 90;
    state.rest = { active: true, left: total, total, timer: null };
    const tick = () => {
      state.rest.left -= 1;
      updateRestBar();
      if (state.rest.left <= 0) {
        stopRest();
        beep();
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        toast("Отдых закончен");
      }
    };
    state.rest.timer = setInterval(tick, 1000);
    updateRestBar();
  }

  function stopRest() {
    if (state.rest.timer) clearInterval(state.rest.timer);
    state.rest.active = false;
    state.rest.timer = null;
    updateRestBar();
  }

  function updateRestBar() {
    const bar = $("#rest-bar");
    if (!bar) return;
    if (!state.rest.active) {
      bar.classList.add("hidden");
      return;
    }
    bar.classList.remove("hidden");
    $("#rest-time").textContent = fmtTime(state.rest.left);
    const pct = Math.max(0, (state.rest.left / state.rest.total) * 100);
    $("#rest-fill").style.width = `${pct}%`;
  }

  function startDurationClock() {
    if (state.durationTimer) clearInterval(state.durationTimer);
    state.durationTimer = setInterval(() => {
      if (db.activeWorkout && state.tab === "workout") {
        const el = $("#workout-duration");
        if (el) el.textContent = fmtTime((Date.now() - db.activeWorkout.startedAt) / 1000);
      }
      updateWorkoutBadge();
    }, 1000);
  }

  function updateWorkoutBadge() {
    const badge = $("#workout-badge");
    if (badge) badge.classList.toggle("live", Boolean(db.activeWorkout));
  }

  function ensureWorkout() {
    if (db.activeWorkout) return db.activeWorkout;
    db.activeWorkout = {
      id: uid(),
      name: "Тренировка",
      startedAt: Date.now(),
      exercises: []
    };
    save();
    return db.activeWorkout;
  }

  function startEmptyWorkout() {
    if (db.activeWorkout) {
      setTab("workout");
      toast("Тренировка уже идёт");
      return;
    }
    ensureWorkout();
    setTab("workout");
  }

  function startTemplate(templateId) {
    if (db.activeWorkout) {
      setTab("workout");
      toast("Сначала завершите текущую тренировку");
      return;
    }
    const tpl = db.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const w = ensureWorkout();
    w.name = tpl.name;
    w.exercises = tpl.exerciseIds.map((id) => makeWorkoutExercise(id)).filter(Boolean);
    save();
    setTab("workout");
  }

  function makeWorkoutExercise(exerciseId) {
    const meta = exerciseById(exerciseId);
    if (!meta) return null;
    const prev = lastSetSuggestion(exerciseId);
    const weight = prev ? prev.weight : "";
    const reps = prev ? prev.reps : "";
    return {
      id: uid(),
      exerciseId,
      name: meta.name,
      sets: [1, 2, 3].map((n) => ({ id: uid(), n, weight, reps, done: false }))
    };
  }

  function addExerciseToWorkout(exerciseId) {
    const w = ensureWorkout();
    if (w.exercises.some((e) => e.exerciseId === exerciseId)) {
      toast("Упражнение уже добавлено");
      return;
    }
    const block = makeWorkoutExercise(exerciseId);
    if (!block) return;
    w.exercises.push(block);
    save();
    closeSheet();
    setTab("workout");
    toast("Упражнение добавлено");
  }

  function finishWorkout() {
    const w = db.activeWorkout;
    if (!w) return;
    const finished = {
      ...w,
      finishedAt: Date.now(),
      durationSec: Math.round((Date.now() - w.startedAt) / 1000)
    };
    db.workouts.unshift(finished);
    db.activeWorkout = null;
    stopRest();
    save();
    closeSheet();
    showSummary(finished);
    toast("Тренировка сохранена");
  }

  function showSummary(w) {
    const vol = round(toDisplayWeight(volumeOf(w)) || 0, 0);
    openSheet(`
      <h2>Итоги</h2>
      <p class="sub">${w.name} · ${fmtTime(w.durationSec)} · ${vol} ${unitLabel()}</p>
      <div class="summary-list">
        ${w.exercises.map((ex) => `
          <div class="card">
            <h3>${escapeHtml(ex.name)}</h3>
            <div class="muted">${ex.sets.filter((s) => s.done).map((s) => `${toDisplayWeight(s.weight) || "—"} × ${s.reps || "—"}`).join(" · ") || "Нет подходов"}</div>
          </div>
        `).join("")}
      </div>
      <div class="row-btns" style="margin-top:14px">
        <button class="btn btn--ghost" data-act="save-template" data-id="${w.id}">Сохранить как шаблон</button>
        <button class="btn btn--primary" data-act="close-sheet">Готово</button>
      </div>
    `);
  }

  function saveWorkoutAsTemplate(workoutId) {
    const w = db.workouts.find((x) => x.id === workoutId);
    if (!w) return;
    db.templates.unshift({
      id: uid(),
      name: w.name || "Шаблон",
      exerciseIds: w.exercises.map((e) => e.exerciseId)
    });
    save();
    closeSheet();
    toast("Шаблон сохранён");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    applyTheme();
    updateWorkoutBadge();
    updateRestBar();
    if (state.tab === "home") renderHome();
    if (state.tab === "history") renderHistory();
    if (state.tab === "workout") renderWorkout();
    if (state.tab === "exercises") renderExercises();
    if (state.tab === "profile") renderProfile();
  }

  function renderHome() {
    const count = workoutsThisWeek();
    const weeklyGoal = 3;
    const progress = Math.min(100, Math.round((count / weeklyGoal) * 100));
    const last = db.workouts[0];
    const lastVolume = last ? round(toDisplayWeight(volumeOf(last)) || 0, 0) : 0;
    const lastSets = last ? last.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0) : 0;
    const metric = db.metrics[db.metrics.length - 1];
    const active = db.activeWorkout;

    $("#screen-home").innerHTML = `
      <div class="home-hero">
        <div>
          <span class="eyebrow">ДНЕВНИК · СЕГОДНЯ</span>
          <h1>${greeting()}</h1>
          <p class="sub">${active ? "Тренировка уже начата — продолжим?" : "Готов записать следующую тренировку?"}</p>
        </div>
        <div class="home-avatar">Т</div>
      </div>

      <div class="hero-action">
        <div>
          <span class="hero-action__eyebrow">${active ? "В ПРОЦЕССЕ" : "СЛЕДУЮЩИЙ ШАГ"}</span>
          <h2>${active ? escapeHtml(active.name || "Тренировка") : "Начать тренировку"}</h2>
          <p>${active ? "Продолжить с того места, где остановился" : "Отметь подходы, отдых и прогресс автоматически"}</p>
        </div>
        <button class="hero-action__button" data-act="start-empty" aria-label="${active ? "Продолжить" : "Начать"}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>

      <div class="dashboard-grid">
        <div class="dashboard-card dashboard-card--wide">
          <div class="dashboard-card__top"><span>Эта неделя</span><b>${count}/${weeklyGoal}</b></div>
          <div class="progress-track"><span style="width:${progress}%"></span></div>
          <p>${count >= weeklyGoal ? "Цель выполнена. Сохраняй ритм." : `Ещё ${weeklyGoal - count} до цели`}</p>
        </div>
        <div class="dashboard-card">
          <span>Подходы</span><strong>${lastSets || "—"}</strong><small>в последней</small>
        </div>
        <div class="dashboard-card">
          <span>Вес</span><strong>${metric ? toDisplayWeight(metric.weight) : "—"}</strong><small>${metric ? unitLabel() : "добавь замер"}</small>
        </div>
      </div>

      <div class="section-title">
        <span>Быстрый старт</span>
        <button class="link" data-act="new-template">Новый план</button>
      </div>
      <div class="carousel">
        ${db.templates.length ? db.templates.map((t) => `
          <button class="template-card" data-act="start-template" data-id="${t.id}">
            <span class="template-card__tag">ПЛАН</span>
            <h3>${escapeHtml(t.name)}</h3>
            <p>${t.exerciseIds.length} упражнений</p>
          </button>
        `).join("") : `<div class="empty">Создай первый план тренировки</div>`}
      </div>

      <div class="section-title"><span>Последняя тренировка</span></div>
      ${last ? `
        <button class="last-workout" data-act="open-workout" data-id="${last.id}">
          <div class="last-workout__icon">↗</div>
          <div class="last-workout__main">
            <b>${escapeHtml(last.name || "Тренировка")}</b>
            <span>${new Date(last.finishedAt).toLocaleDateString("ru-RU", { day:"numeric", month:"long" })} · ${fmtTime(last.durationSec || 0)}</span>
          </div>
          <strong>${lastVolume ? lastVolume + " " + unitLabel() : "→"}</strong>
        </button>
      ` : `
        <div class="empty-card">
          <b>Здесь появится твой прогресс</b>
          <span>Заверши первую тренировку — и приложение начнёт показывать динамику.</span>
        </div>
      `}
    `;
  }

  function plural(n, a, b, c) {
    const v = Math.abs(n) % 100;
    const v1 = v % 10;
    if (v > 10 && v < 20) return c;
    if (v1 > 1 && v1 < 5) return b;
    if (v1 === 1) return a;
    return c;
  }

  function renderHistory() {
    const y = state.cal.getFullYear();
    const m = state.cal.getMonth();
    const first = new Date(y, m, 1);
    const start = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysPrev = new Date(y, m, 0).getDate();
    const monthName = first.toLocaleDateString("ru-RU", { month: "long" });
    const monthTitle = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}`;
    const dots = new Set(db.workouts.map((w) => new Date(w.finishedAt).toISOString().slice(0, 10)));
    const cells = [];
    for (let i = 0; i < start; i++) cells.push({ d: daysPrev - start + i + 1, muted: true, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ d, muted: false, iso });
    }
    let nextDay = 1;
    while (cells.length % 7) cells.push({ d: nextDay++, muted: true, iso: null });

    const list = db.workouts.filter((w) => new Date(w.finishedAt).toISOString().slice(0, 10) === state.selectedDay);

    $("#screen-history").innerHTML = `
      <div class="page-header"><h1>История</h1></div>
      <div class="calendar">
        <div class="cal-head">
          <button class="icon-btn" data-act="cal-prev" aria-label="Предыдущий месяц">${chevLeft()}</button>
          <span>${monthTitle}</span>
          <button class="icon-btn" data-act="cal-next" aria-label="Следующий месяц">${chevRight()}</button>
        </div>
        <div class="cal-grid">
          ${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d) => `<div class="cal-dow">${d}</div>`).join("")}
          ${cells.map((c) => `
            <button class="cal-day ${c.muted ? "muted" : ""} ${c.iso === state.selectedDay ? "selected" : ""} ${c.iso && dots.has(c.iso) ? "has-dot" : ""}"
              data-act="pick-day" data-iso="${c.iso || ""}" ${c.muted ? "disabled" : ""}>${c.d}</button>
          `).join("")}
        </div>
      </div>
      ${list.length ? list.map((w) => historyCard(w)).join("") : `<div class="empty">Нет тренировок в этот день</div>`}
      <div class="section-title" style="margin-top:18px"><span>Все записи</span></div>
      ${db.workouts.slice(0, 20).map(historyCard).join("") || `<div class="empty">История пуста</div>`}
    `;
  }

  function historyCard(w) {
    const date = new Date(w.finishedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    const vol = round(toDisplayWeight(volumeOf(w)) || 0, 0);
    return `
      <button class="history-item" data-act="open-workout" data-id="${w.id}">
        <h3>${escapeHtml(w.name)}</h3>
        <p>${date} · ${fmtTime(w.durationSec || 0)} · ${vol} ${unitLabel()}</p>
      </button>
    `;
  }

  function openWorkoutDetail(id) {
    const w = db.workouts.find((x) => x.id === id);
    if (!w) return;
    const vol = round(toDisplayWeight(volumeOf(w)) || 0, 0);
    openSheet(`
      <h2>${escapeHtml(w.name)}</h2>
      <p class="sub">${new Date(w.finishedAt).toLocaleString("ru-RU")} · ${fmtTime(w.durationSec || 0)} · ${vol} ${unitLabel()}</p>
      ${w.exercises.map((ex) => `
        <div class="card" style="margin-bottom:8px">
          <h3>${escapeHtml(ex.name)}</h3>
          ${ex.sets.map((s) => `<div class="muted">${s.n}. ${toDisplayWeight(s.weight) || "—"} × ${s.reps || "—"} ${s.done ? "✓" : ""}</div>`).join("")}
        </div>
      `).join("")}
      <button class="btn btn--primary" data-act="close-sheet">Закрыть</button>
    `);
  }

  function renderWorkout() {
    const w = db.activeWorkout;
    if (!w) {
      $("#screen-workout").innerHTML = `
        <div class="page-header"><h1>Тренировка</h1></div>
        <div class="empty">Нет активной тренировки</div>
        <button class="btn btn--primary" data-act="start-empty">Начать пустую тренировку</button>
      `;
      return;
    }
    $("#screen-workout").innerHTML = `
      <div class="workout-head">
        <input class="workout-name" id="workout-name" value="${escapeHtml(w.name)}" />
        <div class="timer" id="workout-duration">${fmtTime((Date.now() - w.startedAt) / 1000)}</div>
      </div>
      ${w.exercises.map(exerciseCard).join("") || `<div class="empty">Добавьте первое упражнение</div>`}
      <div class="fab-space"></div>
      <div class="workout-actions">
        <button class="btn btn--ghost" data-act="add-exercise">Добавить упражнение</button>
        <button class="btn btn--primary" data-act="ask-finish">Завершить тренировку</button>
      </div>
    `;
    bindSwipe();
  }

  function exerciseCard(ex) {
    const prev = lastPerformance(ex.exerciseId, db.activeWorkout?.startedAt);
    const prevText = prev.length
      ? `Прошлый раз: ${prev.map((s) => `${toDisplayWeight(s.weight)}×${s.reps}`).join(", ")}`
      : "Нет предыдущих данных";
    return `
      <div class="ex-card" data-ex="${ex.id}">
        <button class="ex-card__delete" data-act="delete-ex" data-id="${ex.id}">Удалить</button>
        <div class="ex-card__inner">
          <div class="ex-card__top">
            <h3>${escapeHtml(ex.name)}</h3>
            <button class="link" data-act="ex-history" data-eid="${ex.exerciseId}">История</button>
          </div>
          <div class="prev">${prevText}</div>
          <div class="set-table-head"><span>#</span><span>Вес</span><span>Повт.</span><span></span></div>
          ${ex.sets.map((s) => `
            <div class="set-wrap" data-set="${s.id}">
              <button class="set-row__delete" data-act="delete-set" data-ex="${ex.id}" data-id="${s.id}">Удалить</button>
              <div class="set-row">
                <div class="set-num">${s.n}</div>
                <input inputmode="decimal" readonly data-k="weight" data-ex="${ex.id}" data-id="${s.id}" value="${s.weight === "" ? "" : toDisplayWeight(s.weight)}" placeholder="—" />
                <input inputmode="numeric" readonly data-k="reps" data-ex="${ex.id}" data-id="${s.id}" value="${s.reps}" placeholder="—" />
                <button class="check-btn ${s.done ? "done" : ""}" data-act="toggle-set" data-ex="${ex.id}" data-id="${s.id}" aria-label="Подход выполнен">
                  <svg viewBox="0 0 24 24"><path d="M5 12.5 10 17l9-10"/></svg>
                </button>
              </div>
            </div>
          `).join("")}
          <button class="add-set" data-act="add-set" data-id="${ex.id}">+ Подход</button>
        </div>
      </div>
    `;
  }

  function bindSwipe() {
    $$(".ex-card").forEach((card) => enableSwipe(card, ".ex-card__inner", 88));
    $$(".set-wrap").forEach((row) => enableSwipe(row, ".set-row", 88));
  }

  function enableSwipe(root, innerSel, width) {
    const inner = $(innerSel, root);
    let x0 = 0;
    let dx = 0;
    let dragging = false;
    root.addEventListener("touchstart", (e) => {
      dragging = true;
      x0 = e.touches[0].clientX;
      dx = 0;
      inner.style.transition = "none";
    }, { passive: true });
    root.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      dx = Math.min(0, e.touches[0].clientX - x0);
      inner.style.transform = `translateX(${Math.max(dx, -width)}px)`;
    }, { passive: true });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      inner.style.transition = "";
      inner.style.transform = dx < -width / 2 ? `translateX(-${width}px)` : "translateX(0)";
    };
    root.addEventListener("touchend", end);
    root.addEventListener("touchcancel", end);
  }

  function renderExercises() {
    const q = state.search.trim().toLowerCase();
    const items = db.exercises
      .filter((e) => state.muscleFilter === "all" || e.muscle === state.muscleFilter)
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    $("#screen-exercises").innerHTML = `
      <div class="page-header">
        <h1>Упражнения</h1>
        <button class="icon-btn" data-act="new-exercise" aria-label="Добавить">${plusIcon()}</button>
      </div>
      <input class="search" id="ex-search" placeholder="Поиск упражнения" value="${escapeHtml(state.search)}" />
      <div class="chips">
        <button class="chip ${state.muscleFilter === "all" ? "active" : ""}" data-act="filter" data-id="all">Все</button>
        ${MUSCLES.map((m) => `<button class="chip ${state.muscleFilter === m.id ? "active" : ""}" data-act="filter" data-id="${m.id}">${m.name}</button>`).join("")}
      </div>
      <div class="ex-list">
        ${items.map((e) => `
          <button class="ex-item" data-act="pick-ex" data-id="${e.id}">
            <div>
              <b>${escapeHtml(e.name)}</b><br>
              <small>${muscleName(e.muscle)}${e.custom ? " · своё" : ""}</small>
            </div>
          </button>
        `).join("") || `<div class="empty">Ничего не найдено</div>`}
      </div>
    `;
    const search = $("#ex-search");
    search?.addEventListener("input", (e) => {
      state.search = e.target.value;
      const pos = e.target.selectionStart;
      renderExercises();
      const next = $("#ex-search");
      if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
      }
    });
  }

  function renderProfile() {
    const last = db.metrics[db.metrics.length - 1];
    $("#screen-profile").innerHTML = `
      <div class="page-header"><h1>Профиль</h1></div>
      <div class="section-title"><span>Вес тела</span></div>
      <div class="field">
        <label>Текущий вес (${unitLabel()})</label>
        <input id="body-weight" inputmode="decimal" value="${last ? toDisplayWeight(last.weight) : ""}" placeholder="0" />
      </div>
      <div class="stats-row">
        <div class="field" style="margin:0">
          <label>Талия, см</label>
          <input id="body-waist" inputmode="decimal" value="${last?.waist || ""}" placeholder="0" />
        </div>
        <div class="field" style="margin:0">
          <label>Грудь, см</label>
          <input id="body-chest" inputmode="decimal" value="${last?.chest || ""}" placeholder="0" />
        </div>
      </div>
      <button class="btn btn--primary" data-act="save-weight" style="margin-top:10px">Сохранить замеры</button>
      ${weightChart()}
      <div class="section-title"><span>Настройки</span></div>
      <div class="field">
        <label>Тема</label>
        <select id="theme-sel">
          <option value="dark" ${db.settings.theme === "dark" ? "selected" : ""}>Тёмная</option>
          <option value="light" ${db.settings.theme === "light" ? "selected" : ""}>Светлая</option>
        </select>
      </div>
      <div class="field">
        <label>Отдых между подходами (сек)</label>
        <input id="rest-sec" inputmode="numeric" value="${db.settings.restSeconds}" />
      </div>
      <div class="field">
        <label>Единицы веса</label>
        <select id="unit-sel">
          <option value="kg" ${db.settings.units === "kg" ? "selected" : ""}>Килограммы</option>
          <option value="lbs" ${db.settings.units === "lbs" ? "selected" : ""}>Фунты</option>
        </select>
      </div>
      <button class="btn btn--ghost" data-act="save-settings">Сохранить настройки</button>
      <div class="section-title"><span>Данные</span></div>
      <div class="row-btns">
        <button class="btn btn--ghost" data-act="export">Экспортировать данные</button>
        <button class="btn btn--ghost" data-act="import">Импортировать данные</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
      </div>
    `;
  }

  function weightChart() {
    if (db.metrics.length < 2) {
      return `<svg class="chart" viewBox="0 0 300 160"><text x="150" y="85" text-anchor="middle" fill="currentColor" font-size="13">Нужно минимум 2 записи</text></svg>`;
    }
    const vals = db.metrics.map((m) => Number(toDisplayWeight(m.weight)));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const pts = vals.map((v, i) => {
      const x = 16 + (i / (vals.length - 1)) * 268;
      const y = 130 - ((v - min) / span) * 100;
      return `${x},${y}`;
    }).join(" ");
    return `<svg class="chart" viewBox="0 0 300 160">
      <polyline fill="none" stroke="currentColor" stroke-width="3" points="${pts}" />
    </svg>
    <p class="sub" style="margin-top:-8px">Динамика веса · ${db.metrics.length} записей</p>`;
  }

  function plusIcon() {
    return `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`;
  }
  function chevLeft() {
    return `<svg viewBox="0 0 24 24"><path d="M15 6 9 12l6 6"/></svg>`;
  }
  function chevRight() {
    return `<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>`;
  }

  function findSet(exId, setId) {
    const ex = db.activeWorkout?.exercises.find((e) => e.id === exId);
    const set = ex?.sets.find((s) => s.id === setId);
    return { ex, set };
  }

  function openKeypad(exId, setId, kind) {
    const { set } = findSet(exId, setId);
    if (!set) return;
    const current = kind === "weight" ? (set.weight === "" ? "" : String(toDisplayWeight(set.weight))) : String(set.reps || "");
    state.keypad = { exId, setId, kind, value: current };
    $("#keypad").classList.remove("hidden");
    drawKeypad();
  }

  function drawKeypad() {
    const k = state.keypad;
    if (!k) return;
    const title = k.kind === "weight" ? `Вес, ${unitLabel()}` : "Повторения";
    $("#keypad").innerHTML = `
      <div class="keypad__top"><span>${title}</span><strong>${k.value || "0"}</strong></div>
      <div class="keypad__grid">
        ${[1,2,3,4,5,6,7,8,9,".",0,"⌫"].map((x) => `<button class="key" data-key="${x}">${x}</button>`).join("")}
        <button class="key key--ok" data-key="ok">Готово</button>
      </div>
    `;
  }

  function applyKey(key) {
    const k = state.keypad;
    if (!k) return;
    if (key === "ok") {
      const { set } = findSet(k.exId, k.setId);
      if (set) {
        if (k.kind === "weight") set.weight = fromDisplayWeight(k.value);
        else set.reps = k.value === "" ? "" : Number(k.value.replace(",", "."));
        save();
      }
      state.keypad = null;
      $("#keypad").classList.add("hidden");
      renderWorkout();
      return;
    }
    if (key === "⌫") k.value = k.value.slice(0, -1);
    else if (key === ".") {
      if (k.kind === "reps") return;
      if (!k.value.includes(".")) k.value += k.value ? "." : "0.";
    } else {
      if (k.value === "0") k.value = String(key);
      else k.value += String(key);
    }
    drawKeypad();
  }

  function askFinish() {
    if (!db.activeWorkout) return;
    openSheet(`
      <h2>Завершить тренировку?</h2>
      <p class="sub">Данные сохранятся на этом устройстве.</p>
      <div class="row-btns">
        <button class="btn btn--primary" data-act="finish">Завершить</button>
        <button class="btn btn--ghost" data-act="close-sheet">Продолжить</button>
      </div>
    `);
  }

  function showAddExerciseSheet() {
    state.pickMode = "workout";
    const items = [...db.exercises].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    openSheet(`
      <h2>Добавить упражнение</h2>
      <input class="search" id="sheet-search" placeholder="Поиск" />
      <div class="ex-list" id="sheet-list" style="margin-top:10px">
        ${items.map(exPickRow).join("")}
      </div>
    `);
    $("#sheet-search").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      $("#sheet-list").innerHTML = items.filter((x) => x.name.toLowerCase().includes(q)).map(exPickRow).join("");
    });
  }

  function exPickRow(e) {
    return `<button class="ex-item" data-act="add-ex-id" data-id="${e.id}"><div><b>${escapeHtml(e.name)}</b><br><small>${muscleName(e.muscle)}</small></div></button>`;
  }

  function showNewExercise() {
    openSheet(`
      <h2>Новое упражнение</h2>
      <div class="field"><label>Название</label><input id="new-ex-name" placeholder="Например, жим в хаммере" /></div>
      <div class="field"><label>Мышечная группа</label>
        <select id="new-ex-muscle">${MUSCLES.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}</select>
      </div>
      <button class="btn btn--primary" data-act="create-ex">Сохранить</button>
    `);
  }

  function createExercise() {
    const name = $("#new-ex-name")?.value.trim();
    const muscle = $("#new-ex-muscle")?.value;
    if (!name) { toast("Введите название"); return; }
    db.exercises.push({ id: uid(), name, muscle, custom: true });
    save();
    closeSheet();
    toast("Упражнение создано");
    render();
  }

  function showNewTemplate() {
    const selected = new Set();
    openSheet(`
      <h2>Новый шаблон</h2>
      <div class="field"><label>Название</label><input id="tpl-name" placeholder="Например, Push" /></div>
      <p class="sub">Выберите упражнения</p>
      <div class="ex-list" id="tpl-list">
        ${[...db.exercises].sort((a,b)=>a.name.localeCompare(b.name,"ru")).map((e) => `
          <button class="ex-item" data-act="toggle-tpl-ex" data-id="${e.id}">
            <div><b>${escapeHtml(e.name)}</b><br><small>${muscleName(e.muscle)}</small></div>
            <span class="muted" data-mark="${e.id}"></span>
          </button>
        `).join("")}
      </div>
      <button class="btn btn--primary" style="margin-top:12px" data-act="create-tpl">Сохранить шаблон</button>
    `);
    $("#sheet")._selected = selected;
  }

  function showExHistory(exerciseId) {
    const meta = exerciseById(exerciseId);
    const rows = db.workouts.filter((w) => w.exercises.some((e) => e.exerciseId === exerciseId)).slice(0, 8);
    openSheet(`
      <h2>${escapeHtml(meta?.name || "История")}</h2>
      ${rows.length ? rows.map((w) => {
        const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
        return `<div class="card" style="margin-bottom:8px">
          <b>${new Date(w.finishedAt).toLocaleDateString("ru-RU")}</b>
          <div class="muted">${ex.sets.filter(s=>s.done).map(s => `${toDisplayWeight(s.weight)}×${s.reps}`).join(" · ") || "—"}</div>
        </div>`;
      }).join("") : `<div class="empty">Пока нет истории</div>`}
      <button class="btn btn--primary" data-act="close-sheet">Закрыть</button>
    `);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dnevnik-trenirovok-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Файл экспорта готов");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") throw new Error("bad");
        db = {
          settings: { theme: "dark", restSeconds: 90, units: "kg", ...parsed.settings },
          exercises: parsed.exercises || seed().exercises,
          templates: parsed.templates || [],
          workouts: parsed.workouts || [],
          activeWorkout: parsed.activeWorkout || null,
          metrics: parsed.metrics || []
        };
        save();
        render();
        toast("Данные импортированы");
      } catch {
        toast("Не удалось прочитать файл");
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      setTab(nav.dataset.nav);
      return;
    }
    const key = e.target.closest("[data-key]");
    if (key) { applyKey(key.dataset.key); return; }

    const act = e.target.closest("[data-act]");
    if (!act) return;
    const a = act.dataset.act;
    if (a === "start-empty") startEmptyWorkout();
    if (a === "start-template") startTemplate(act.dataset.id);
    if (a === "add-exercise") showAddExerciseSheet();
    if (a === "add-ex-id") addExerciseToWorkout(act.dataset.id);
    if (a === "ask-finish") askFinish();
    if (a === "finish") finishWorkout();
    if (a === "close-sheet") closeSheet();
    if (a === "save-template") saveWorkoutAsTemplate(act.dataset.id);
    if (a === "cal-prev") { state.cal.setMonth(state.cal.getMonth() - 1); renderHistory(); }
    if (a === "cal-next") { state.cal.setMonth(state.cal.getMonth() + 1); renderHistory(); }
    if (a === "pick-day" && act.dataset.iso) { state.selectedDay = act.dataset.iso; renderHistory(); }
    if (a === "open-workout") openWorkoutDetail(act.dataset.id);
    if (a === "filter") { state.muscleFilter = act.dataset.id; renderExercises(); }
    if (a === "new-exercise") showNewExercise();
    if (a === "create-ex") createExercise();
    if (a === "new-template") showNewTemplate();
    if (a === "pick-ex") {
      if (db.activeWorkout) addExerciseToWorkout(act.dataset.id);
      else showExHistory(act.dataset.id);
    }
    if (a === "ex-history") showExHistory(act.dataset.eid);
    if (a === "add-set") {
      const ex = db.activeWorkout?.exercises.find((x) => x.id === act.dataset.id);
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({ id: uid(), n: ex.sets.length + 1, weight: last?.weight ?? "", reps: last?.reps ?? "", done: false });
      save();
      renderWorkout();
    }
    if (a === "toggle-set") {
      const { set } = findSet(act.dataset.ex, act.dataset.id);
      if (!set) return;
      set.done = !set.done;
      save();
      if (set.done) {
        if (navigator.vibrate) navigator.vibrate(12);
        startRest();
      }
      renderWorkout();
    }
    if (a === "delete-ex") {
      db.activeWorkout.exercises = db.activeWorkout.exercises.filter((x) => x.id !== act.dataset.id);
      save();
      renderWorkout();
    }
    if (a === "delete-set") {
      const ex = db.activeWorkout.exercises.find((x) => x.id === act.dataset.ex);
      if (!ex) return;
      ex.sets = ex.sets.filter((s) => s.id !== act.dataset.id).map((s, i) => ({ ...s, n: i + 1 }));
      save();
      renderWorkout();
    }
    if (a === "save-weight") {
      const raw = $("#body-weight").value;
      const kg = fromDisplayWeight(raw);
      if (kg === "") { toast("Введите вес"); return; }
      const num = (id) => {
        const v = $(id).value.replace(",", ".");
        return v === "" ? "" : Number(v);
      };
      db.metrics.push({ date: todayISO(), weight: kg, waist: num("#body-waist"), chest: num("#body-chest") });
      save();
      toast("Замеры сохранены");
      renderProfile();
    }
    if (a === "save-settings") {
      db.settings.theme = $("#theme-sel").value;
      db.settings.restSeconds = Math.max(15, Number($("#rest-sec").value) || 90);
      db.settings.units = $("#unit-sel").value;
      save();
      applyTheme();
      toast("Настройки сохранены");
      renderProfile();
    }
    if (a === "export") exportData();
    if (a === "import") $("#import-file").click();
    if (a === "toggle-tpl-ex") {
      const selected = $("#sheet")._selected;
      if (!selected) return;
      if (selected.has(act.dataset.id)) selected.delete(act.dataset.id);
      else selected.add(act.dataset.id);
      const mark = document.querySelector(`[data-mark="${act.dataset.id}"]`);
      if (mark) mark.textContent = selected.has(act.dataset.id) ? "✓" : "";
    }
    if (a === "create-tpl") {
      const name = $("#tpl-name")?.value.trim();
      const selected = [...($("#sheet")._selected || [])];
      if (!name) { toast("Введите название"); return; }
      if (!selected.length) { toast("Выберите упражнения"); return; }
      db.templates.unshift({ id: uid(), name, exerciseIds: selected });
      save();
      closeSheet();
      toast("Шаблон создан");
      renderHome();
    }
  });

  document.addEventListener("focusin", (e) => {
    const input = e.target.closest("input[data-k]");
    if (!input) return;
    e.preventDefault();
    input.blur();
    openKeypad(input.dataset.ex, input.dataset.id, input.dataset.k);
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "import-file" && e.target.files[0]) importData(e.target.files[0]);
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "workout-name" && db.activeWorkout) {
      db.activeWorkout.name = e.target.value;
      save();
    }
  });

  const restSkip = $("#rest-skip");
  if (restSkip) restSkip.addEventListener("click", stopRest);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  applyTheme();
  startDurationClock();
  setTab("home");
})();

(() => {
  "use strict";

  const KEY = "dnevnik_tren_v1";
  const MUSCLES = [
    ["chest","Грудь"],["back","Спина"],["legs","Ноги"],
    ["shoulders","Плечи"],["arms","Руки"],["core","Кор"]
  ];
  const DEFAULTS = [
    ["Жим штанги лёжа","chest"],["Жим гантелей лёжа","chest"],["Жим на наклонной скамье","chest"],
    ["Разведения гантелей","chest"],["Отжимания на брусьях","chest"],["Кроссовер","chest"],
    ["Тяга штанги в наклоне","back"],["Подтягивания","back"],["Тяга верхнего блока","back"],
    ["Тяга горизонтального блока","back"],["Становая тяга","back"],["Тяга гантели в наклоне","back"],
    ["Гиперэкстензия","back"],["Приседания со штангой","legs"],["Жим ногами","legs"],
    ["Выпады","legs"],["Румынская тяга","legs"],["Разгибания ног","legs"],["Сгибания ног","legs"],
    ["Подъёмы на носки","legs"],["Жим штанги стоя","shoulders"],["Жим гантелей сидя","shoulders"],
    ["Махи в стороны","shoulders"],["Махи в наклоне","shoulders"],["Тяга к подбородку","shoulders"],
    ["Подъём штанги на бицепс","arms"],["Молотковые сгибания","arms"],["Французский жим","arms"],
    ["Разгибания на блоке","arms"],["Отжимания от скамьи","arms"],["Скручивания","core"],
    ["Планка","core"],["Подъёмы ног в висе","core"],["Русские скручивания","core"]
  ];

  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
  const today = () => new Date().toISOString().slice(0,10);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const muscle = id => MUSCLES.find(x => x[0] === id)?.[1] || id;
  const fmtTime = sec => {
    let s=Math.max(0,Math.floor(Number(sec)||0)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), r=s%60;
    return h ? h+":"+String(m).padStart(2,"0")+":"+String(r).padStart(2,"0") : m+":"+String(r).padStart(2,"0");
  };
  const fmtDate = ts => new Date(ts).toLocaleDateString("ru-RU",{day:"numeric",month:"short"});
  const round = (n,d=1) => Math.round(n*10**d)/10;
  const plural = (n,a,b,c) => {
    const v=Math.abs(n)%100, x=v%10;
    return v>10&&v<20?c:x===1?a:(x>1&&x<5?b:c);
  };

  function createSeed(){
    const exercises=DEFAULTS.map(([name,m])=>({id:uid(),name,muscle:m,custom:false,description:""}));
    const id=n=>exercises.find(e=>e.name===n)?.id;
    return {
      settings:{theme:"dark",restSeconds:90,units:"kg",weeklyGoal:3,soundEnabled:true,vibrationEnabled:true,schedule:{mode:"interval",intervalDays:2,intervalOrder:[],intervalStart:today()}},
      exercises,
      templates:[
        {id:uid(),name:"Грудь + трицепс",exerciseIds:["Жим штанги лёжа","Жим гантелей лёжа","Разведения гантелей","Французский жим","Разгибания на блоке"].map(id)},
        {id:uid(),name:"Спина + бицепс",exerciseIds:["Подтягивания","Тяга штанги в наклоне","Тяга горизонтального блока","Подъём штанги на бицепс","Молотковые сгибания"].map(id)},
        {id:uid(),name:"Ноги",exerciseIds:["Приседания со штангой","Жим ногами","Румынская тяга","Выпады","Подъёмы на носки"].map(id)}
      ],
      workouts:[],activeWorkout:null,metrics:[]
    };
  }

  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw) return createSeed();
      const d=JSON.parse(raw);
      d.settings={theme:"dark",restSeconds:90,units:"kg",weeklyGoal:3,soundEnabled:true,vibrationEnabled:true,schedule:{mode:"weekly",weekly:{},intervalDays:2,intervalOrder:[],intervalStart:today()},...(d.settings||{})}; d.settings.schedule={mode:"interval",intervalDays:2,intervalOrder:[],intervalStart:today(),...(d.settings.schedule||{})}; if(d.settings.schedule.mode==="weekly")d.settings.schedule.mode="interval";
      d.exercises=Array.isArray(d.exercises)&&d.exercises.length?d.exercises:createSeed().exercises;
      d.templates=Array.isArray(d.templates)?d.templates:[];
      d.workouts=Array.isArray(d.workouts)?d.workouts:[];
      d.metrics=Array.isArray(d.metrics)?d.metrics:[];
      d.activeWorkout=d.activeWorkout||null;
      return d;
    }catch(e){ return createSeed(); }
  }

  let db=load();
  const state={tab:"home",search:"",filter:"all",month:new Date(),selectedDay:today(),sheet:null,restTimer:null,restLeft:0,restTotal:90};

  function save(){ localStorage.setItem(KEY,JSON.stringify(db)); }
  function applyTheme(){
    const t=db.settings.theme==="light"?"light":"dark";
    document.documentElement.dataset.theme=t;
    const m=$('meta[name="theme-color"]');
    if(m)m.content=t==="light"?"#f4f6f8":"#090c10";
  }
  function toast(msg){
    const el=$("#toast"); if(!el)return;
    el.textContent=msg; el.classList.remove("is-hidden");
    clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.add("is-hidden"),2200);
  }
  function openSheet(html){
    const el=$("#sheet"); if(!el)return;
    el.innerHTML='<div class="sheet__panel"><div class="sheet__grab"></div>'+html+"</div>";
    el.classList.remove("is-hidden"); el.classList.toggle("is-rest-timer",html.includes("rest-timer-sheet")); el.setAttribute("aria-hidden","false");
  }
  function closeSheet(){
    const el=$("#sheet"); if(!el)return;
    el.classList.add("is-hidden"); el.classList.remove("is-rest-timer"); el.innerHTML=""; el.setAttribute("aria-hidden","true"); state.sheet=null;
  }
  function setTab(tab){
    state.tab=tab;
    $$(".screen").forEach(s=>s.classList.toggle("active",s.dataset.tab===tab));
    $$(".tabbar__item").forEach(b=>b.classList.toggle("active",b.dataset.nav===tab));
    render();
  }
  function greeting(){
    const h=new Date().getHours();
    return h<6?"Доброй ночи":h<12?"Доброе утро":h<18?"Добрый день":"Добрый вечер";
  }
  function startWeek(d=new Date()){
    const x=new Date(d), day=(x.getDay()+6)%7;
    x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x;
  }
  function weekWorkouts(){ const from=startWeek().getTime(); return db.workouts.filter(w=>w.finishedAt>=from).length; }
  function weightLabel(){ return db.settings.units==="lbs"?"lb":"кг"; }
  function toDisplayWeight(v){
    if(v===""||v==null) return "";
    const n=Number(v); return Number.isNaN(n)?"":db.settings.units==="lbs"?round(n*2.20462262,1):round(n,2);
  }
  function fromDisplayWeight(v){
    if(v===""||v==null) return "";
    let raw=String(v).trim().replace(/\s/g,"");
    if(raw.includes(",")&&raw.includes(".")){raw=raw.lastIndexOf(",")>raw.lastIndexOf(".")?raw.replace(/\./g,"").replace(",","."):raw.replace(/,/g,"");}
    else raw=raw.replace(",",".");
    const n=Number(raw); if(!Number.isFinite(n))return "";
    return db.settings.units==="lbs"?n/2.20462262:n;
  }
  function volume(w){
    return (w?.exercises||[]).reduce((sum,ex)=>sum+(ex.sets||[]).reduce((s,set)=>set.done&&set.weight!==""&&set.reps!==""?s+Number(set.weight)*Number(set.reps):s,0),0);
  }
  function doneSets(w){ return (w?.exercises||[]).reduce((n,e)=>n+(e.sets||[]).filter(s=>s.done).length,0); }
  function findExercise(id){return db.exercises.find(e=>e.id===id)}
  function lastSets(exerciseId,before){
    const arr=[...db.workouts].filter(w=>!before||w.finishedAt<before).sort((a,b)=>b.finishedAt-a.finishedAt);
    for(const w of arr){const ex=w.exercises?.find(x=>x.exerciseId===exerciseId); const done=ex?.sets?.filter(s=>s.done&&s.weight!==""&&s.reps!==""); if(done?.length)return done;}
    return [];
  }
  function makeWorkoutExercise(exerciseId, config=null){
    const e=findExercise(exerciseId); if(!e)return null;
    const prev=lastSets(exerciseId)[0]||null;
    const count=Math.max(1,Math.min(20,Number(config?.sets)||3));
    const baseWeight=config?.weight!==""&&config?.weight!=null?fromDisplayWeight(config.weight):(prev?.weight??"");
    const baseReps=config?.reps!==""&&config?.reps!=null?Number(config.reps):(prev?.reps??"");
    return {id:uid(),exerciseId,name:e.name,weightProgression:config?.weightProgression||"",repsProgression:config?.repsProgression||"",sets:Array.from({length:count},(_,i)=>({id:uid(),n:i+1,weight:baseWeight,reps:baseReps,done:false}))};
  }
  function ensureWorkout(){
    if(db.activeWorkout)return db.activeWorkout;
    db.activeWorkout={id:uid(),name:"Тренировка",startedAt:Date.now(),exercises:[]};
    save(); return db.activeWorkout;
  }
  function scheduledTemplateFor(date=new Date()){ const s=db.settings.schedule||{}; if(s.mode==="interval" && s.intervalOrder?.length){ const start=new Date((s.intervalStart||today())+"T12:00:00"), cur=new Date(date); cur.setHours(12,0,0,0); const diff=Math.floor((cur-start)/86400000), every=Math.max(1,Number(s.intervalDays)||2); if(diff>=0 && diff%every===0) return db.templates.find(t=>t.id===s.intervalOrder[(Math.floor(diff/every))%s.intervalOrder.length])||null; return null; } const dow=(new Date(date).getDay()+6)%7; return db.templates.find(t=>t.id===s.weekly?.[dow])||null; } function startScheduled(){ const t=scheduledTemplateFor(); if(t){startTemplate(t.id);return} showSchedulePicker(); } function startTemplate(id){
    closeSheet();
    if(db.activeWorkout){setTab("workout");toast("Сначала заверши текущую тренировку");return}
    const t=db.templates.find(x=>x.id===id); if(!t)return;
    const w=ensureWorkout(); w.name=t.name; w.exercises=t.exerciseIds.map(id=>makeWorkoutExercise(id,t.exerciseConfig?.[id]||null)).filter(Boolean);
    save(); setTab("workout");
  }
  function addExercise(id){
    const w=ensureWorkout(); if(w.exercises.some(e=>e.exerciseId===id)){toast("Упражнение уже добавлено");return}
    const block=makeWorkoutExercise(id); if(!block)return;
    w.exercises.push(block); save(); closeSheet(); setTab("workout"); toast("Добавлено");
  }
  function finishWorkout(){
    if(!db.activeWorkout)return;
    const w={...db.activeWorkout,finishedAt:Date.now(),durationSec:Math.round((Date.now()-db.activeWorkout.startedAt)/1000)};
    db.workouts.unshift(w); db.activeWorkout=null; stopRest(); save(); closeSheet(); setTab("progress"); toast("Тренировка сохранена");
  }
  function primeRestAudio(){try{if(db.settings.soundEnabled===false)return;const C=window.AudioContext||window.webkitAudioContext;if(C){const ctx=window.__trainerAudio||(window.__trainerAudio=new C());if(ctx.state==="suspended")ctx.resume();}}catch(e){}}
  function startRest(){
    stopRest(); primeRestAudio();
    state.restTotal=Number(db.settings.restSeconds)||90; state.restLeft=state.restTotal;
    const tick=()=>{state.restLeft--; renderRest(); if(state.restLeft<=0){stopRest();notifyRestEnd();toast("Отдых закончен");}};
    state.restTimer=setInterval(tick,1000); renderRest(); showRestTimer();
  }
  function notifyRestEnd(){
    if(db.settings.soundEnabled!==false){try{const ctx=window.__trainerAudio;if(ctx){if(ctx.state==="suspended")ctx.resume();const now=ctx.currentTime;[0,0.16,0.32].forEach((delay,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=[660,880,1046][i];g.gain.setValueAtTime(.0001,now+delay);g.gain.exponentialRampToValueAtTime(.5,now+delay+.02);g.gain.exponentialRampToValueAtTime(.0001,now+delay+.3);o.connect(g);g.connect(ctx.destination);o.start(now+delay);o.stop(now+delay+.31);});}}catch(e){}}
    if(db.settings.vibrationEnabled!==false&&navigator.vibrate)navigator.vibrate([220,90,220,90,320]);
    closeRestTimer();
  }
  function stopRest(){
    if(state.restTimer)clearInterval(state.restTimer);
    state.restTimer=null; state.restLeft=0; renderRest(); closeRestTimer();
  }
  function showRestTimer(){const left=Math.max(0,state.restLeft),total=Math.max(1,state.restTotal);openSheet('<div class="rest-timer-sheet"><div class="kicker">ОТДЫХ МЕЖДУ ПОДХОДАМИ</div><div class="rest-timer-value" id="rest-modal-value">'+fmtTime(left)+'</div><div class="rest-timer-progress"><span id="rest-modal-progress" style="width:'+Math.max(0,Math.min(100,(left/total)*100))+'%"></span></div><p>Следующий подход — когда будешь готов.</p><button class="button button--primary rest-skip" data-act="skip-rest">Пропустить отдых</button></div>');}
  function closeRestTimer(){const el=$("#sheet");if(el?.classList.contains("is-rest-timer"))closeSheet();}
  function renderRest(){
    const pill=$("#active-pill");
    if(pill){
      if(state.restLeft>0){pill.textContent="Отдых "+fmtTime(state.restLeft);pill.classList.remove("is-hidden")}
      else if(db.activeWorkout){pill.textContent="Тренировка "+fmtTime((Date.now()-db.activeWorkout.startedAt)/1000);pill.classList.remove("is-hidden")}
      else pill.classList.add("is-hidden");
    }
    const modalVal=$("#rest-modal-value")||$("#rest-modal-val");
    if(modalVal) modalVal.textContent=fmtTime(state.restLeft);
    const progress=$("#rest-modal-progress");
    if(progress) progress.style.width=Math.max(0,Math.min(100,(state.restLeft/Math.max(1,state.restTotal))*100))+"%";
  }

  function render(){
    applyTheme(); renderRest();
    if(state.tab==="home")renderHome();
    if(state.tab==="progress")renderProgress();
    if(state.tab==="workout")renderWorkout();
    if(state.tab==="exercises")renderExercises();
    if(state.tab==="profile")renderProfile();
  }

  function renderHome(){
    const count=weekWorkouts(), goal=Math.max(1,Number(db.settings.weeklyGoal)||3), pct=Math.min(100,Math.round(count/goal*100));
    const last=db.workouts[0], active=db.activeWorkout, metric=db.metrics.at(-1);
    $("#screen-home").innerHTML=`
      <div class="container">
        <div class="hero">
          <div class="hero__row">
            <div><div class="kicker">Сегодня</div><h1 class="hero__title">${greeting()}</h1><p class="subtitle hero__sub">${active?"Тренировка уже идёт.":"Готов к следующей?"}</p></div>
            <div class="hero__mark">Т</div>
          </div>
        </div>
        <button class="card hero-cta" data-act="${active?"continue-workout":"start-scheduled"}">
          <div class="hero-cta__copy">
            <div class="kicker">${active?"В ПРОЦЕССЕ":"СЕГОДНЯ ПО ПЛАНУ"}</div>
            <h2>${active?esc(active.name):"Начать тренировку"}</h2>
            <p>${active?esc(active.name):esc(scheduledTemplateFor()?.name||"Выбери шаблон тренировки")}</p>
          </div>
          <span class="hero-cta__button">→</span>
        </button>

        <div class="stats">
          <div class="card stat"><span class="stat__label">Тренировки</span><strong class="stat__value">${count}</strong><span class="stat__hint">за неделю</span></div>
          <div class="card stat"><span class="stat__label">Подходы</span><strong class="stat__value">${last?doneSets(last):"—"}</strong><span class="stat__hint">в последней</span></div>
          <div class="card stat"><span class="stat__label">Вес</span><strong class="stat__value">${metric?toDisplayWeight(metric.weight):"—"}</strong><span class="stat__hint">${metric?weightLabel():"профиль"} </span></div>
        </div>

        <div class="card progress-card">
          <div class="progress-card__head"><span>Ритм недели</span><b>${count}/${goal}</b></div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="progress-card__foot">${count>=goal?"Цель выполнена":"Ещё "+(goal-count)+" "+plural(goal-count,"тренировка","тренировки","тренировок")}</div>
        </div>

        <div class="section-head"><h2>Планы</h2><button class="link" data-act="manage-templates">Управлять</button></div>
        <div class="plans">
          ${db.templates.map(t=>`<button class="plan" data-act="start-template" data-id="${t.id}"><span class="plan__tag">ПЛАН</span><h3>${esc(t.name)}</h3><p>${t.exerciseIds.length} упражнений · открыть</p></button>`).join("")}
        </div>

        <div class="section-head"><h2>Последняя тренировка</h2><button class="link" data-nav="progress">Все</button></div>
        ${last?`<button class="card list-card workout-preview" data-act="open-workout" data-id="${last.id}">
          <span class="workout-preview__icon">↗</span><span class="workout-preview__main"><b>${esc(last.name)}</b><span>${fmtDate(last.finishedAt)} · ${fmtTime(last.durationSec||0)} · ${round(toDisplayWeight(volume(last)),0)||0} ${weightLabel()}</span></span><span>›</span>
        </button>`:`<div class="empty-state"><b>История пока пустая</b>Заверши первую тренировку, чтобы увидеть здесь результат.</div>`}
      </div>`;
  }

  function renderProgress(){
    const d=new Date(state.month), y=d.getFullYear(), m=d.getMonth();
    const first=new Date(y,m,1), offset=(first.getDay()+6)%7, days=new Date(y,m+1,0).getDate();
    const workoutDays=new Set(db.workouts.map(w=>new Date(w.finishedAt).toISOString().slice(0,10)));
    const cells=[];
    for(let i=0;i<offset;i++)cells.push({n:new Date(y,m,0).getDate()-offset+i+1,muted:true});
    for(let n=1;n<=days;n++){const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`;cells.push({n,iso,muted:false,done:workoutDays.has(iso),selected:iso===state.selectedDay})}
    while(cells.length%7)cells.push({n:cells.length-offset-days+1,muted:true});
    const selected=db.workouts.filter(w=>new Date(w.finishedAt).toISOString().slice(0,10)===state.selectedDay);
    const recent=db.workouts.slice(0,12);
    const totalVolume=db.workouts.reduce((s,w)=>s+volume(w),0);
    $("#screen-progress").innerHTML=`
      <div class="container">
        <div class="screen-title"><div class="kicker">Аналитика</div><h1>Прогресс</h1><p class="subtitle" style="margin-top:7px">Тренировки, объём и регулярность.</p></div>
        <div class="stats">
          <div class="card stat"><span class="stat__label">Всего</span><strong class="stat__value">${db.workouts.length}</strong><span class="stat__hint">тренировок</span></div>
          <div class="card stat"><span class="stat__label">Объём</span><strong class="stat__value">${round(toDisplayWeight(totalVolume),0)||0}</strong><span class="stat__hint">${weightLabel()}</span></div>
          <div class="card stat"><span class="stat__label">Неделя</span><strong class="stat__value">${weekWorkouts()}</strong><span class="stat__hint">сейчас</span></div>
        </div>
        <div class="section-head"><h2>Календарь</h2></div>
        <div class="card calendar">
          <div class="calendar__head"><button class="calendar__nav" data-act="month-prev">‹</button><span class="calendar__month">${first.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</span><button class="calendar__nav" data-act="month-next">›</button></div>
          <div class="calendar__grid">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>`<div class="calendar__dow">${x}</div>`).join("")}${cells.map(c=>`<button class="day ${c.muted?"muted":""} ${c.selected?"selected":""} ${c.done?"done":""}" ${c.muted?"disabled":""} data-act="pick-day" data-iso="${c.iso||""}">${c.n}</button>`).join("")}</div>
        </div>
        <div class="section-head"><h2>${new Date(state.selectedDay+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"})}</h2></div>
        ${selected.length?selected.map(historyItem).join(""):`<div class="empty-state">Нет тренировки в этот день.</div>`}
        <div class="section-head"><h2>Последние</h2></div>
        <div class="recent-grid">${recent.length?recent.map(historyItem).join(""):`<div class="empty-state">Пока нет записей.</div>`}</div>
      </div>`;
  }

  function historyItem(w){
    return `<button class="recent-item" data-act="open-workout" data-id="${w.id}"><b>${esc(w.name)}</b><span>${fmtDate(w.finishedAt)} · ${fmtTime(w.durationSec||0)} · ${doneSets(w)} подходов · ${round(toDisplayWeight(volume(w)),0)||0} ${weightLabel()}</span></button>`;
  }

  function renderWorkout(){
    const w=db.activeWorkout;
    if(!w){
      $("#screen-workout").innerHTML=`
        <div class="container">
          <div class="screen-title"><div class="kicker">Рабочий экран</div><h1>Тренировка</h1><p class="subtitle" style="margin-top:7px">Здесь проходит вся тренировка — без лишних экранов.</p></div>
          <div class="stack">
            <button class="button button--primary" data-act="start-scheduled">Выбрать шаблон</button>
            ${db.templates.slice(0,3).map(t=>`<button class="card list-card workout-preview" data-act="start-template" data-id="${t.id}"><span class="workout-preview__icon">＋</span><span class="workout-preview__main"><b>${esc(t.name)}</b><span>${t.exerciseIds.length} упражнений</span></span><span>›</span></button>`).join("")}
          </div>
          <div class="section-head"><h2>Что получаетшся</h2></div>
          <div class="notice">После каждого подхода приложение запустит таймер отдыха. В новых тренировках автоматически подставится прошлый рабочий вес и количество повторений.</div>
        </div>`;
      return;
    }
    const total=w.exercises.reduce((s,e)=>s+e.sets.length,0), completed=doneSets(w), vol=volume(w);
    $("#screen-workout").innerHTML=`
      <div class="container">
        <div class="screen-title">
          <div class="row row--between"><div style="min-width:0"><input id="workout-name" value="${esc(w.name)}" style="width:100%;border:0;background:none;outline:none;font-size:30px;font-weight:900;letter-spacing:-1.4px"></div><span style="color:var(--accent);font-weight:900;font-size:13px" id="duration">${fmtTime((Date.now()-w.startedAt)/1000)}</span></div>
          <p class="subtitle" style="margin-top:7px">${completed}/${total} подходов выполнено · ${round(toDisplayWeight(vol),0)||0} ${weightLabel()}</p>
        </div>
        <div class="stack">
          ${w.exercises.length?w.exercises.map(exerciseBlock).join(""):`<div class="empty-state"><b>Добавь первое упражнение</b>Начни с кнопки ниже.</div>`}
        </div>
        <div class="workout-bottom">
          <button class="button button--secondary" data-act="add-exercise">＋ Добавить упражнение</button>
          <button class="button button--primary" data-act="finish-workout">Завершить тренировку</button>
        </div>
      </div>`;
  }

  function exerciseBlock(ex){
    const prev=lastSets(ex.exerciseId,db.activeWorkout?.startedAt);
    const prevText=prev.length?"Прошлый раз: "+prev.map(s=>`${toDisplayWeight(s.weight)}×${s.reps}`).join(" · "):"Нет прошлых данных";
    return `<div class="card detail" data-ex="${ex.id}">
      <div class="detail__head"><div><div class="detail__name">${esc(ex.name)}</div><div class="detail__meta">${prevText}</div>${findExercise(ex.exerciseId)?.description?`<div class="exercise-description exercise-description--compact"><p>${esc(findExercise(ex.exerciseId).description)}</p></div>`:""}</div><button class="link" data-act="exercise-history" data-eid="${ex.exerciseId}">История</button></div>
      <div class="set-table"><div class="set-head"><span>#</span><span>Вес</span><span>Повт.</span><span></span></div>
      ${ex.sets.map(s=>`<div class="set-row"><div class="set-num">${s.n}</div>
        <input type="number" step="0.5" min="0" inputmode="decimal" data-kind="weight" data-ex="${ex.id}" data-set="${s.id}" value="${s.weight===""?"":toDisplayWeight(s.weight)}" placeholder="—">
        <input type="number" min="0" inputmode="numeric" data-kind="reps" data-ex="${ex.id}" data-set="${s.id}" value="${s.reps===""?"":s.reps}" placeholder="—">
        <button class="set-check ${s.done?"done":""}" data-act="toggle-set" data-ex="${ex.id}" data-set="${s.id}">${s.done?"✓":"○"}</button>
      </div>`).join("")}</div>
      <button class="add-set" data-act="add-set" data-ex="${ex.id}">＋ Подход</button>
      </div>`;
  }

  function renderExercises(){
    const q=state.search.trim().toLowerCase();
    const items=db.exercises.filter(e=>(state.filter==="all"||e.muscle===state.filter)&&(!q||e.name.toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
    $("#screen-exercises").innerHTML=`
      <div class="container">
        <div class="screen-title"><div class="row row--between"><div><div class="kicker">Библиотека</div><h1>Упражнения</h1></div><button class="button button--small" data-act="new-exercise">＋ Добавить</button></div></div>
        <div class="exercise-tools"><button class="button button--secondary button--small" data-act="export-exercises">Экспортировать</button><button class="button button--secondary button--small" data-act="import-exercises">Импортировать</button><input id="exercise-import-file" type="file" accept=".json,application/json" hidden></div><input id="exercise-search" class="search" placeholder="Поиск упражнения" value="${esc(state.search)}">
        <div class="chips"><button class="chip ${state.filter==="all"?"active":""}" data-act="filter" data-filter="all">Все</button>${MUSCLES.map(m=>`<button class="chip ${state.filter===m[0]?"active":""}" data-act="filter" data-filter="${m[0]}">${m[1]}</button>`).join("")}</div>
        <div class="exercise-list">${items.map(e=>`<button class="exercise-item" data-act="exercise-info" data-id="${e.id}"><span class="exercise-item__main"><b>${esc(e.name)}</b><span>${muscle(e.muscle)}${e.custom?" · своё":""}</span></span><span class="exercise-item__chev">›</span></button>`).join("")||`<div class="empty-state">Ничего не найдено.</div>`}</div>
      </div>`;
    const s=$("#exercise-search"); if(s){s.addEventListener("input",e=>{state.search=e.target.value;renderExercises();const n=$("#exercise-search");n?.focus();if(n)n.setSelectionRange(n.value.length,n.value.length);});}
  }

  function renderProfile(){
    const last=db.metrics.at(-1);
    $("#screen-profile").innerHTML=`
      <div class="container">
        <div class="screen-title"><div class="kicker">Настройки</div><h1>Профиль</h1><p class="subtitle" style="margin-top:7px">Данные тела, таймер отдыха и копия дневника.</p></div>
        <div class="section-head"><h2>Замеры</h2></div>
        <div class="form-grid">
          <div class="field"><label>Вес (${weightLabel()})</label><input id="body-weight" inputmode="decimal" value="${last?toDisplayWeight(last.weight):""}" placeholder="—"></div>
          <div class="field"><label>Рост (см)</label><input id="body-height" inputmode="numeric" value="${last?.height??""}" placeholder="—"></div>
        </div>
        <button class="button button--primary" data-act="save-metrics" style="margin-top:9px">Сохранить замеры</button>

        <div class="section-head"><h2>Расписание тренировок</h2></div>
        <div class="schedule-editor card">
          <div class="schedule-mode-badge">ЧЕРЕЗ ИНТЕРВАЛ</div>
          ${(db.settings.schedule?.mode||"weekly")==="weekly"?`<div class="schedule-list">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d,i)=>`<div class="schedule-row"><span class="schedule-day">${d}</span><select data-schedule-day="${i}"><option value="">Отдых</option>${db.templates.map(t=>`<option value="${t.id}" ${db.settings.schedule?.weekly?.[i]===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>`).join("")}</div><p class="schedule-note">Назначь отдельный шаблон на каждый день. Пустой день остаётся днём отдыха.</p>`:`<div class="interval-settings"><div class="field field--compact"><label>Интервал</label><select id="interval-days">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${Number(db.settings.schedule?.intervalDays||2)===n?"selected":""}>Каждые ${n} ${plural(n,"день","дня","дней")}</option>`).join("")}</select></div><div class="field field--compact"><label>Начало цикла</label><input id="interval-start" type="date" value="${db.settings.schedule?.intervalStart||today()}"></div></div><div class="section-head section-head--inner"><h2>Порядок чередования</h2></div><div class="schedule-list">${[0,1,2,3].map(i=>`<div class="schedule-row"><span class="schedule-day">${i+1}</span><select data-interval-order="${i}"><option value="">—</option>${db.templates.map(t=>`<option value="${t.id}" ${db.settings.schedule?.intervalOrder?.[i]===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>`).join("")}</div><p class="schedule-note">Например: Грудь + спина → Ноги → Плечи. Цикл повторяется по кругу.</p>`}
          <button class="button button--secondary" data-act="save-schedule">Сохранить расписание</button>
        </div>
        <div class="section-head"><h2>Настройки</h2></div>
        <div class="stack">
          <div class="field"><label>Тема</label><select id="theme"><option value="dark" ${db.settings.theme==="dark"?"selected":""}>Тёмная</option><option value="light" ${db.settings.theme==="light"?"selected":""}>Светлая</option></select></div>
          <div class="field"><label>Отдых между подходами, сек</label><input id="rest-sec" inputmode="numeric" value="${db.settings.restSeconds}"></div>
          <div class="field"><label>Цель тренировок в неделю</label><input id="weekly-goal" inputmode="numeric" value="${db.settings.weeklyGoal}"></div><div class="settings-toggle"><label><span><b>Звук окончания отдыха</b><small>Короткий сигнал, когда таймер закончился</small></span><input id="sound-enabled" type="checkbox" ${db.settings.soundEnabled!==false?"checked":""}></label><label><span><b>Вибрация окончания отдыха</b><small>Вибросигнал на поддерживаемых устройствах</small></span><input id="vibration-enabled" type="checkbox" ${db.settings.vibrationEnabled!==false?"checked":""}></label></div>
          <button class="button button--secondary" data-act="save-settings">Сохранить настройки</button>
        </div>

        <div class="section-head"><h2>Данные</h2></div>
        <div class="stack">
          <button class="button button--secondary" data-act="export">Экспортировать дневник</button>
          <button class="button button--secondary" data-act="import">Импортировать дневник</button>
          <input id="import-file" type="file" accept=".json,application/json" hidden>
        </div>
      </div>`;
  }

  function showExerciseInfo(id){
    const e=findExercise(id); if(!e)return;
    const rows=db.workouts.filter(w=>w.exercises?.some(x=>x.exerciseId===id)).slice(0,8);
    openSheet(`
      <div class="sheet__title">${esc(e.name)}</div>
      <div class="subtitle">${muscle(e.muscle)} · ${e.custom?"своё упражнение":"базовое"}</div>${e.description?`<div class="exercise-description"><div class="kicker">Техника</div><p>${esc(e.description)}</p></div>`:`<div class="empty-state" style="margin-top:12px">Описание техники пока не добавлено.</div>`}<div class="stack" style="margin-top:10px"><button class="button button--secondary" data-act="edit-exercise-description" data-id="${id}">Изменить описание</button></div>
      <div class="section-head" style="margin-top:18px"><h2>История</h2></div>
      ${rows.length?rows.map(w=>{const ex=w.exercises.find(x=>x.exerciseId===id);return `<div class="rec-card" style="margin-bottom:8px"><b>${fmtDate(w.finishedAt)}</b><span>${ex.sets.filter(s=>s.done).map(s=>`${toDisplayWeight(s.weight)} × ${s.reps}`).join(" · ")||"Нет выполненных подходов"}</span></div>`}).join(""):`<div class="empty-state">Истории ещё нет.</div>`}
      <div class="stack" style="margin-top:12px">
        <button class="button button--primary" data-act="use-exercise" data-id="${id}">${db.activeWorkout?"Добавить в текущую":"Начать с этого упражнения"}</button>
        <button class="button button--secondary" data-act="close-sheet">Закрыть</button>
      </div>`);
  }

    function editExerciseDescription(id){
    const e=findExercise(id); if(!e)return;
    openSheet(`<div class="sheet__title">Описание упражнения</div><div class="subtitle">${esc(e.name)}</div><div class="field" style="margin-top:12px"><label>Как выполнять</label><textarea id="exercise-description" rows="7" placeholder="Опиши технику и важные нюансы…">${esc(e.description||"")}</textarea></div><div class="stack" style="margin-top:10px"><button class="button button--primary" data-act="save-exercise-description" data-id="${id}">Сохранить</button><button class="button button--secondary" data-act="close-sheet">Отмена</button></div>`);
  }

  function showAddExercise(){
    const items=[...db.exercises].sort((a,b)=>a.name.localeCompare(b.name,"ru"));
    openSheet(`
      <div class="sheet__title">Добавить упражнение</div>
      <input id="sheet-search" class="search" placeholder="Найти упражнение">
      <div class="exercise-list" id="sheet-list" style="margin-top:10px">${items.map(e=>`<button class="exercise-item" data-act="add-ex" data-id="${e.id}"><span class="exercise-item__main"><b>${esc(e.name)}</b><span>${muscle(e.muscle)}</span></span><span>＋</span></button>`).join("")}</div>`);
    const s=$("#sheet-search"); s?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#sheet-list").innerHTML=items.filter(x=>x.name.toLowerCase().includes(q)).map(e=>`<button class="exercise-item" data-act="add-ex" data-id="${e.id}"><span class="exercise-item__main"><b>${esc(e.name)}</b><span>${muscle(e.muscle)}</span></span><span>＋</span></button>`).join("")});
  }

  function showNewExercise(){
    openSheet(`
      <div class="sheet__title">Новое упражнение</div>
      <div class="field" style="margin-top:10px"><label>Название</label><input id="new-ex-name" placeholder="Например, жим в хаммере"></div>
      <div class="field" style="margin-top:9px"><label>Мышечная группа</label><select id="new-ex-muscle">${MUSCLES.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join("")}</select></div><div class="field" style="margin-top:9px"><label>Как выполнять</label><textarea id="new-ex-description" rows="4" placeholder="Техника, дыхание, положение корпуса, важные нюансы…"></textarea></div>
      <button class="button button--primary" style="margin-top:10px" data-act="create-exercise">Сохранить</button>`);
  }

  function showNewTemplate(){ showTemplateEditor(); return; }
  function showNewTemplateLegacy(){
    openSheet(`
      <div class="sheet__title">Новый план</div>
      <div class="field" style="margin-top:10px"><label>Название</label><input id="template-name" placeholder="Например, Push"></div>
      <div class="section-head"><h2>Упражнения</h2></div>
      <div class="exercise-list" id="template-picks">${[...db.exercises].sort((a,b)=>a.name.localeCompare(b.name,"ru")).map(e=>`<button class="exercise-item" data-act="toggle-template-ex" data-id="${e.id}"><span class="exercise-item__main"><b>${esc(e.name)}</b><span>${muscle(e.muscle)}</span></span><span data-mark="${e.id}" style="font-weight:900"></span></button>`).join("")}</div>
      <button class="button button--primary" style="margin-top:10px" data-act="create-template">Создать план</button>`);
    $("#sheet")._selected=new Set();
  }

  function showTemplateManager(){
    openSheet(`
      <div class="sheet__title">Шаблоны тренировок</div>
      <div class="subtitle">Создание, редактирование и управление готовыми тренировками.</div>
      <div class="template-manager">${db.templates.map(t=>`<div class="template-row"><div class="template-row__icon">${esc((t.name||"Т").slice(0,1).toUpperCase())}</div><div class="template-row__main"><b>${esc(t.name)}</b><span>${t.exerciseIds.length} упражнений</span></div><button class="icon-button" data-act="edit-template" data-id="${t.id}">✎</button><button class="icon-button icon-button--danger" data-act="delete-template" data-id="${t.id}">×</button></div>`).join("")}</div>
      <div class="stack" style="margin-top:14px"><button class="button button--primary" data-act="new-template">＋ Создать шаблон</button><button class="button button--secondary" data-act="close-sheet">Готово</button></div>`);
  }
  function showTemplateEditor(templateId=null){
    const t=templateId?db.templates.find(x=>x.id===templateId):null, selected=new Set(t?.exerciseIds||[]);
    openSheet(`
      <div class="sheet__title">${t?"Редактировать шаблон":"Новый шаблон"}</div>
      <div class="field" style="margin-top:10px"><label>Название тренировки</label><input id="template-name" placeholder="Например, Грудь + спина" value="${esc(t?.name||"")}"></div>
      <div class="section-head section-head--inner"><h2>Упражнения</h2><span class="count-badge" id="template-count">${selected.size}</span></div>
      <div class="exercise-list template-picks">${[...db.exercises].sort((a,b)=>a.name.localeCompare(b.name,"ru")).map(e=>{const cfg=t?.exerciseConfig?.[e.id]||{};return `<div class="template-exercise-wrap"><button class="exercise-item template-pick ${selected.has(e.id)?"is-picked":""}" data-act="toggle-template-ex" data-id="${e.id}"><span class="exercise-item__main"><b>${esc(e.name)}</b><span>${muscle(e.muscle)}</span></span><span class="pick-mark" data-mark="${e.id}">${selected.has(e.id)?"✓":"+"}</span></button>${selected.has(e.id)?`<div class="template-config"><div class="template-config__grid"><label>Подходы<input type="number" min="1" max="20" value="${cfg.sets||3}" data-tcfg-id="${e.id}" data-tcfg="sets"></label><label>Вес, кг<input inputmode="decimal" value="${cfg.weight??""}" placeholder="—" data-tcfg-id="${e.id}" data-tcfg="weight"></label><label>Повторы<input type="number" min="1" max="100" value="${cfg.reps??""}" placeholder="—" data-tcfg-id="${e.id}" data-tcfg="reps"></label></div><div class="template-config__progress"><label>Прогрессия веса<input value="${esc(cfg.weightProgression||"")}" placeholder="+2.5 кг / —" data-tcfg-id="${e.id}" data-tcfg="weightProgression"></label><label>Прогрессия повторов<input value="${esc(cfg.repsProgression||"")}" placeholder="+1 / —" data-tcfg-id="${e.id}" data-tcfg="repsProgression"></label></div></div>`: ""}</div>`}).join("")}</div>
      <div class="stack" style="margin-top:12px"><button class="button button--primary" data-act="save-template" data-id="${templateId||""}">${t?"Сохранить изменения":"Создать шаблон"}</button><button class="button button--secondary" data-act="close-sheet">Отмена</button></div>`);
    $("#sheet")._selected=selected; $("#sheet")._templateId=templateId;
  }
  function showTemplateEditorFromSelection(selected){
    const currentName=$("#template-name")?.value||"";
    const configs={};
    $("[data-tcfg-id]").forEach(el=>{const id=el.dataset.tcfgId;configs[id]=configs[id]||{};configs[id][el.dataset.tcfg]=el.value;});
    const temp={id:$("#sheet")._templateId||"",name:currentName,exerciseIds:[...selected],exerciseConfig:configs};
    openSheet(`
      <div class="sheet__title">Редактировать шаблон</div>
      <div class="field" style="margin-top:10px"><label>Название тренировки</label><input id="template-name" placeholder="Например, Грудь + спина" value="${esc(currentName)}"></div>
      <div class="section-head section-head--inner"><h2>Упражнения и план</h2><span class="count-badge" id="template-count">${selected.size}</span></div>
      <div class="exercise-list template-picks">${[...db.exercises].sort((a,b)=>a.name.localeCompare(b.name,"ru")).map(e=>{const cfg=temp.exerciseConfig?.[e.id]||{};return `<div class="template-exercise-wrap"><button class="exercise-item template-pick ${selected.has(e.id)?"is-picked":""}" data-act="toggle-template-ex" data-id="${e.id}"><span class="exercise-item__main"><b>${esc(e.name)}</b><span>${muscle(e.muscle)}</span></span><span class="pick-mark" data-mark="${e.id}">${selected.has(e.id)?"✓":"+"}</span></button>${selected.has(e.id)?`<div class="template-config"><div class="template-config__grid"><label>Подходы<input type="number" min="1" max="20" value="${cfg.sets||3}" data-tcfg-id="${e.id}" data-tcfg="sets"></label><label>Вес, кг<input inputmode="decimal" value="${cfg.weight??""}" placeholder="—" data-tcfg-id="${e.id}" data-tcfg="weight"></label><label>Повторы<input type="number" min="1" max="100" value="${cfg.reps??""}" placeholder="—" data-tcfg-id="${e.id}" data-tcfg="reps"></label></div><div class="template-config__progress"><label>Прогрессия веса<input value="${esc(cfg.weightProgression||"")}" placeholder="+2.5 кг / —" data-tcfg-id="${e.id}" data-tcfg="weightProgression"></label><label>Прогрессия повторов<input value="${esc(cfg.repsProgression||"")}" placeholder="+1 / —" data-tcfg-id="${e.id}" data-tcfg="repsProgression"></label></div></div>`:""}</div>`}).join("")}</div>
      <div class="stack" style="margin-top:12px"><button class="button button--primary" data-act="save-template" data-id="${temp.id}">${temp.id?"Сохранить изменения":"Создать шаблон"}</button><button class="button button--secondary" data-act="close-sheet">Отмена</button></div>`);
    $("#sheet")._selected=selected; $("#sheet")._templateId=temp.id; $("#sheet")._draftConfig=configs;
  }

  function showSchedulePicker(){
    openSheet(`<div class="sheet__title">На сегодня нет плана</div><div class="subtitle">Выбери шаблон сейчас или настрой постоянное расписание в профиле.</div><div class="stack" style="margin-top:14px">${db.templates.map(t=>`<button class="card list-card workout-preview" data-act="start-template" data-id="${t.id}"><span class="workout-preview__icon">↗</span><span class="workout-preview__main"><b>${esc(t.name)}</b><span>${t.exerciseIds.length} упражнений</span></span><span>›</span></button>`).join("")}</div><button class="button button--secondary" style="margin-top:10px" data-act="open-profile-schedule">Настроить расписание</button>`);
  }
  function saveTemplate(templateId){
    const name=$("#template-name")?.value?.trim(), selected=[...($("#sheet")._selected||[])];
    if(!name||!selected.length){toast(!name?"Введи название":"Добавь хотя бы одно упражнение");return}
    const exerciseConfig={};
    selected.forEach(exId=>{
      const get=kind=>document.querySelector(`[data-tcfg-id="${exId}"][data-tcfg="${kind}"]`)?.value??"";
      exerciseConfig[exId]={sets:Math.max(1,Math.min(20,Number(get("sets"))||3)),weight:get("weight"),reps:get("reps"),weightProgression:get("weightProgression").trim(),repsProgression:get("repsProgression").trim()};
    });
    if(templateId){const t=db.templates.find(x=>x.id===templateId);if(t){t.name=name;t.exerciseIds=selected;t.exerciseConfig=exerciseConfig;}}
    else db.templates.unshift({id:uid(),name,exerciseIds:selected,exerciseConfig});
    save();showTemplateManager();toast(templateId?"Шаблон обновлён":"Шаблон создан");
  }
  function saveSchedule(){
    const s=db.settings.schedule||{};
    s.mode="interval";
    s.intervalDays=Math.max(1,Math.min(14,Number($("#interval-days")?.value)||2));
    s.intervalStart=$("#interval-start")?.value||today();
    s.intervalOrder=[0,1,2,3].map(i=>$('[data-interval-order="'+i+'"]')?.value||"").filter(Boolean);
    if(!s.intervalOrder.length){toast("Добавь шаблон в цикл");return}
    db.settings.schedule=s;save();renderProfile();toast("Расписание сохранено");
  }
  function showWorkoutDetail(id){
    const w=db.workouts.find(x=>x.id===id); if(!w)return;
    openSheet(`
      <div class="sheet__title">${esc(w.name)}</div>
      <div class="subtitle">${new Date(w.finishedAt).toLocaleString("ru-RU")} · ${fmtTime(w.durationSec||0)} · ${round(toDisplayWeight(volume(w)),0)||0} ${weightLabel()}</div>
      <div class="section-head"><h2>Упражнения</h2></div>
      <div class="stack">${w.exercises.map(ex=>`<div class="rec-card"><b>${esc(ex.name)}</b>${(ex.weightProgression||ex.repsProgression)?`<span class="exercise-plan-note">План: ${esc(ex.weightProgression||"—")} вес · ${esc(ex.repsProgression||"—")} повт.</span>`:""}<span>${ex.sets.filter(s=>s.done).map(s=>`${toDisplayWeight(s.weight)} × ${s.reps}`).join(" · ")||"Нет выполненных подходов"}</span></div>`).join("")}</div>
      <button class="button button--secondary" style="margin-top:12px" data-act="close-sheet">Закрыть</button>`);
  }

  function saveMetrics(){
    const raw=String($("#body-weight")?.value??"").trim().replace(/,/g,".");
    const parsed=raw===""?NaN:Number.parseFloat(raw);
    if(!Number.isFinite(parsed)||parsed<=0){toast("Введи корректный вес");return}
    const weight=db.settings.units==="lbs"?parsed/2.20462262:parsed;
    const heightRaw=String($("#body-height")?.value??"").trim().replace(/,/g,".");
    const height=heightRaw===""?"":Number.parseFloat(heightRaw);
    const metric={date:today(),weight:Number(weight),height:Number.isFinite(height)?height:""};
    const existing=db.metrics.findIndex(m=>m.date===today());
    if(existing>=0) db.metrics[existing]=metric; else db.metrics.push(metric);
    save(); toast("Замеры сохранены"); renderProfile();
  }
  function saveSettings(){
    db.settings.theme=$("#theme").value;
    db.settings.restSeconds=Math.max(15,Number($("#rest-sec").value)||90);
    db.settings.weeklyGoal=Math.max(1,Math.min(14,Number($("#weekly-goal").value)||3)); db.settings.soundEnabled=$("#sound-enabled").checked; db.settings.vibrationEnabled=$("#vibration-enabled").checked;
    save(); applyTheme(); toast("Настройки сохранены"); render();
  }
  function createExercise(){
    const name=$("#new-ex-name")?.value?.trim(), m=$("#new-ex-muscle")?.value;
    if(!name){toast("Введи название");return}
    db.exercises.push({id:uid(),name,muscle:m,custom:true,description:$("#new-ex-description")?.value?.trim()||""});save();closeSheet();toast("Упражнение создано");renderExercises();
  }
  function createTemplate(){
    const name=$("#template-name")?.value?.trim(), selected=[...($("#sheet")._selected||[])];
    if(!name){toast("Введи название");return}
    if(!selected.length){toast("Выбери хотя бы одно упражнение");return}
    db.templates.unshift({id:uid(),name,exerciseIds:selected});save();closeSheet();toast("План создан");renderHome();
  }
    function exportExercises(){const payload={format:"trainer-exercises-v1",exercises:db.exercises.map(e=>({name:e.name,muscle:e.muscle,description:e.description||""}))};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="trainer-exercises.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast("Упражнения экспортированы");}
  function importExercises(file){const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(reader.result);if(!Array.isArray(p.exercises))throw new Error();let added=0; p.exercises.forEach(x=>{if(!x?.name||!x?.muscle)return;const name=String(x.name).trim();if(db.exercises.some(y=>y.name.toLowerCase()===name.toLowerCase()))return;db.exercises.push({id:uid(),name,muscle:String(x.muscle),description:String(x.description||""),custom:true});added++;});save();renderExercises();toast("Добавлено упражнений: "+added);}catch{toast("Не удалось импортировать упражнения")}};reader.readAsText(file);}
  function exportData(){
    const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dnevnik-trenirovok.json";a.click();URL.revokeObjectURL(a.href);
  }
  function importData(file){
    const reader=new FileReader();
    reader.onload=()=>{try{const p=JSON.parse(reader.result);db={...createSeed(),...p,settings:{...createSeed().settings,...(p.settings||{})}};save();render();toast("Дневник импортирован")}catch{toast("Не удалось импортировать файл")}};
    reader.readAsText(file);
  }

  document.addEventListener("click",e=>{
    const nav=e.target.closest("[data-nav]"); if(nav){setTab(nav.dataset.nav);return}
    const act=e.target.closest("[data-act]"); if(!act)return;
    const a=act.dataset.act, id=act.dataset.id;

    if(a==="start-scheduled"){startScheduled();return} if(a==="continue-workout"){setTab("workout");return}
    if(a==="start-template"){startTemplate(id);return}
    if(a==="open-workout"){showWorkoutDetail(id);return}
    if(a==="manage-templates"){showTemplateManager();return} if(a==="new-template"){showTemplateEditor();return} if(a==="edit-template"){showTemplateEditor(id);return} if(a==="delete-template"){db.templates=db.templates.filter(t=>t.id!==id);save();showTemplateManager();toast("Шаблон удалён");return}
    if(a==="close-sheet"){closeSheet();return} if(a==="skip-rest"){stopRest();closeRestTimer();toast("Отдых пропущен");return}
    if(a==="add-exercise"){showAddExercise();return}
    if(a==="add-ex"){addExercise(id);return}
    if(a==="exercise-info"){showExerciseInfo(id);return} if(a==="edit-exercise-description"){editExerciseDescription(id);return} if(a==="save-exercise-description"){const e=findExercise(id);if(e){e.description=$("#exercise-description")?.value?.trim()||"";save();showExerciseInfo(id);toast("Описание сохранено")}return}
    if(a==="exercise-history"){showExerciseInfo(act.dataset.eid);return}
    if(a==="use-exercise"){ if(db.activeWorkout)addExercise(id);else{closeSheet();ensureWorkout();addExercise(id)} return}
    if(a==="new-exercise"){showNewExercise();return}
    if(a==="create-exercise"){createExercise();return}
    if(a==="toggle-template-ex"){const set=$("#sheet")._selected;if(!set)return;set.has(id)?set.delete(id):set.add(id);showTemplateEditorFromSelection(set);return} if(a==="save-template"){saveTemplate(id||null);return} if(a==="schedule-mode"){return} if(a==="save-schedule"){saveSchedule();return} if(a==="open-profile-schedule"){closeSheet();setTab("profile");return}
    if(a==="create-template"){createTemplate();return}
    if(a==="toggle-set"){
      const ex=db.activeWorkout?.exercises.find(x=>x.id===act.dataset.ex), s=ex?.sets.find(x=>x.id===act.dataset.set); if(!s)return;
      s.done=!s.done;save();if(s.done){if(db.settings.vibrationEnabled!==false&&navigator.vibrate)navigator.vibrate(10);startRest()}else stopRest();renderWorkout();return;
    }
    if(a==="add-set"){
      const ex=db.activeWorkout?.exercises.find(x=>x.id===id);if(!ex)return;const last=ex.sets.at(-1);ex.sets.push({id:uid(),n:ex.sets.length+1,weight:last?.weight??"",reps:last?.reps??"",done:false});save();renderWorkout();return;
    }
    if(a==="finish-workout"){openSheet(`<div class="sheet__title">Завершить тренировку?</div><div class="subtitle">Все сохранится на этом устройстве.</div><div class="stack" style="margin-top:14px"><button class="button button--primary" data-act="confirm-finish">Завершить</button><button class="button button--secondary" data-act="close-sheet">Продолжить</button></div>`);return}
    if(a==="confirm-finish"){finishWorkout();return}
    if(a==="month-prev"){state.month.setMonth(state.month.getMonth()-1);renderProgress();return}
    if(a==="month-next"){state.month.setMonth(state.month.getMonth()+1);renderProgress();return}
    if(a==="pick-day"){state.selectedDay=act.dataset.iso;renderProgress();return}
    if(a==="filter"){state.filter=act.dataset.filter;renderExercises();return}
    if(a==="save-metrics"){saveMetrics();return}
    if(a==="save-settings"){saveSettings();return}
    if(a==="export"){exportData();toast("Файл готов");return}
    if(a==="import"){$("#import-file")?.click();return} if(a==="export-exercises"){exportExercises();return} if(a==="import-exercises"){$("#exercise-import-file")?.click();return}
  });

  document.addEventListener("input",e=>{
    const t=e.target;
    if(t.matches("#workout-name")&&db.activeWorkout){db.activeWorkout.name=t.value;save();return}
    const exId=t.dataset.ex, setId=t.dataset.set, kind=t.dataset.kind;
    if(exId&&setId&&kind){
      const ex=db.activeWorkout?.exercises.find(x=>x.id===exId), s=ex?.sets.find(x=>x.id===setId); if(!s)return;
      if(kind==="weight")s.weight=fromDisplayWeight(t.value); else s.reps=t.value===""?"":Number(t.value);
      save(); return;
    }
  });

  document.addEventListener("change",e=>{
    if(e.target.id==="import-file"&&e.target.files?.[0])importData(e.target.files[0]); if(e.target.id==="exercise-import-file"&&e.target.files?.[0])importExercises(e.target.files[0]);
  });

  window.setInterval(()=>{
    renderRest();
    if(db.activeWorkout&&state.tab==="workout"){
      const el=$("#duration"); if(el)el.textContent=fmtTime((Date.now()-db.activeWorkout.startedAt)/1000);
    }
  },1000);

  $("#sheet")?.addEventListener("click",e=>{if(e.target.id==="sheet")closeSheet()});
  applyTheme(); setTab("home");
})();
/* Пробуждение: navigation and device-local UI preference only.
   Never writes game documents, simulates task completion or claims rewards. */
(function () {
  'use strict';
  var prefix = window.PLAN_CONFIG && window.PLAN_CONFIG.testMode ? 'plan.android-test.' : 'plan.';
  var key = prefix + 'awakening.v1', state = null, existing = true, storageOK = true;
  try {
    existing = localStorage.getItem(prefix + 'store.v1') !== null || Object.keys(window.PlanSync._docs()).length > 0;
    state = JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_) { storageOK = false; }
  var steps = [
    ['overview', 'Пробуждение', '.citadel-shell-dock [data-section="wardrobe"], #wopen', 'Спящий, ты пробудился. Этот замок связан с твоими настоящими делами. Начни с героя: кнопка «Профиль» открывает его одежду. Заклятие покажет путь; записи ты вносишь сам.'],
    ['wardrobe', 'Твой герой', '#wd-outer button, #wardrobe-equipped', 'Это твой общий персонаж. Дела и привычки развивают ранг, записи веса меняют облик, одежда выбирается здесь. Посмотреть ранг и путь можно в панелях Цитадели.'],
    ['today', 'Дела дня', '#d-today', 'В «Заданиях» живут ежедневные дела и привычки. «Сегодня» возвращает к текущему дню. Отмечай только сделанное; Заклятие применяет обычные правила. Для обучения ничего выполнять не нужно.'],
    ['money', 'Финансы', '.citadel-finance-nav [data-finance="wheel"], #amt', 'Записывай настоящие доходы и расходы в «Деньгах». Нажми подсвеченное «Колесо», чтобы увидеть распределение личных трат. Переключатель разделов остаётся над журналом.'],
    ['diet', 'Прогресс тела', '#kg, #diet input', 'Здесь записи веса, график и привычки питания. Вноси фактические значения. Герой использует эти же записи: отдельного игрового веса нет.'],
    ['today', 'Испытания Заклятия', '#trialbox .trial, #d-today', 'Если Заклятие назначило Испытание, оно появится над делами дня с таймером и действующими правилами. Если сейчас там тихо — продолжай свой путь. Обучение не назначает и не выполняет Испытания.'],
    ['overview', 'Цитадель Спящего', '.citadel-shell-dock button:last-child, #citadel-focus', 'Перед тобой твоя Цитадель. Нажимай на доступные комнаты для входа; в «Разделах» есть «Управление замком» и «Комната и жители». Неизведанное откроется своим чередом. Осмотр не требует оплаты.'],
    ['achievements', 'Следы пути', '#trophy-x', 'Здесь коллекция и уже доступные отметины. Полученное можно рассмотреть в обычном интерфейсе. Закрытые тайны Заклятие не раскрывает. Крестик возвращает к Цитадели.'],
    ['settings', 'Сохрани свой путь', '#data-management', 'Прогресс сохраняется на устройстве автоматически. Подсвеченная кнопка открывает данные: скачай резервную копию перед обновлением. Для обновления используй штатную кнопку, сохрани данные сайта. Восстановление заменяет записи — проверяй копию на отдельном тестовом профиле.'],
    ['overview', 'Ты пробудился', '.citadel-shell-dock [data-section="today"], #d-today', 'Теперь путь за тобой. Делай реальные дела, записывай их и возвращайся в Цитадель. «Пробуждение» всегда доступно в настройках: можно пройти его снова.']
  ];
  function valid(s) { return s && s.version === 1 && Number.isInteger(s.step) && s.step >= 0 && s.step < steps.length && ['active','paused','skipped','done'].indexOf(s.status) >= 0; }
  if (!valid(state)) state = null;
  var navigate, card, title, text, count, next, back, skip, again, target, previousFocus, ready = false, started = false;
  function persist() {
    try { localStorage.setItem(key, JSON.stringify(state)); storageOK = true; }
    catch (_) { storageOK = false; }
    updateSettings();
  }
  function updateSettings() {
    var b = document.getElementById('awakening-start'), r = document.getElementById('awakening-restart');
    if (b) b.textContent = state && (state.status === 'paused' || state.status === 'active') ? 'ПРОДОЛЖИТЬ ОБУЧЕНИЕ' : 'НАЧАТЬ ОБУЧЕНИЕ';
    if (r) r.hidden = !state;
  }
  function clearTarget() { if (target) target.classList.remove('awakening-target'); target = null; }
  function place() {
    if (!card || card.hidden) return;
    var modal = document.querySelector('dialog[open]'), setup = document.getElementById('setup'), trophy = document.getElementById('trophy');
    var host = modal || (setup && !setup.hidden ? setup.querySelector('.sbox') : trophy && !trophy.hidden ? trophy.querySelector('.sbox') : document.body);
    if (!host) host = document.body;
    // Keep the coach within the native modal's top layer and focus boundary.
    if (card.parentNode !== host) {
      if(host === document.body || host === modal)host.appendChild(card);
      else host.insertBefore(card,host.querySelector('.shead').nextSibling);
    }
    card.classList.toggle('awakening-floating', host === document.body);
  }
  function highlight() {
    clearTarget();
    var candidates = document.querySelectorAll(steps[state.step][2]);
    target = Array.from(candidates).find(function(n){return n.getClientRects().length;});
    if (target) target.classList.add('awakening-target');
  }
  function show() {
    var step = steps[state.step];
    clearTarget(); card.hidden = false;
    navigate(step[0], step[1]);
    title.textContent = step[1]; text.textContent = step[3];
    count.textContent = 'ЗАКЛЯТИЕ · ПРОБУЖДЕНИЕ' + ' · ' + (state.step + 1) + ' / ' + steps.length;
    back.disabled = state.step === 0;
    next.textContent = state.step === steps.length - 1 ? 'ЗАВЕРШИТЬ' : 'ДАЛЬШЕ';
    place(); highlight();
    var warning = card.querySelector('.awakening-warning');
    warning.hidden = storageOK; warning.textContent = 'Шаг не сохранён: хранилище недоступно. Оставь приложение открытым или повтори позже.';
    title.focus({preventScroll:true});
    // Scroll only in the opened panel, never move the Citadel camera.
    if (card.parentNode !== document.body) card.scrollIntoView({block:'start',behavior:'instant'});
  }
  function begin(restart) {
    if (!ready || !navigate) return;
    previousFocus = document.activeElement;
    state = {version:1,step:restart || !state || state.status === 'done' || state.status === 'skipped' ? 0 : state.step,status:'active'};
    persist(); show();
  }
  function stop(status) {
    if (!state || state.status !== 'active') return;
    state.status = status; persist(); clearTarget(); card.hidden = true;
    if (previousFocus && previousFocus.isConnected && previousFocus.getClientRects().length) previousFocus.focus({preventScroll:true});
  }
  // Back closes the real UI through its existing handlers; only pause the coach.
  window.addEventListener('popstate', function(){stop('paused');}, true);
  window.addEventListener('storage', function(e){
    if(e.key !== key) return;
    if(card && !card.hidden){clearTarget();card.hidden=true;}
    try{var incoming=JSON.parse(e.newValue);state=valid(incoming)?incoming:null;}catch(_){state=null;}
    updateSettings();
  });
  function maybeStart() {
    if (!ready || !navigate || started) return;
    started = true;
    if (state && state.status === 'active') { begin(false); return; }
    if (!state && !existing && storageOK) begin(true);
  }
  window.VkachAwakening = Object.freeze({
    ready:function(){ready=true;maybeStart();},
    init:function(nav){
      navigate=nav;
      card=document.createElement('section');card.id='awakening-coach';card.hidden=true;card.setAttribute('role','region');card.setAttribute('aria-label','Пробуждение: обучение');
      card.innerHTML='<div class="awakening-count"></div><h2 tabindex="-1"></h2><p class="awakening-copy"></p><p class="awakening-warning" role="status" hidden></p><nav aria-label="Управление обучением"><button type="button" data-coach="back">НАЗАД</button><button type="button" data-coach="next">ДАЛЬШЕ</button><button type="button" data-coach="pause">ПОЗЖЕ</button><button type="button" data-coach="skip">ПРОПУСТИТЬ</button></nav>';
      document.body.appendChild(card);title=card.querySelector('h2');text=card.querySelector('.awakening-copy');count=card.querySelector('.awakening-count');next=card.querySelector('[data-coach="next"]');back=card.querySelector('[data-coach="back"]');skip=card.querySelector('[data-coach="skip"]');again=document.getElementById('awakening-restart');
      next.onclick=function(){if(state.step===steps.length-1){stop('done');return;}state.step++;persist();show();};
      back.onclick=function(){if(state.step>0){state.step--;persist();show();}};
      skip.onclick=function(){stop('skipped');};card.querySelector('[data-coach="pause"]').onclick=function(){stop('paused');};
      document.getElementById('awakening-start').onclick=function(){begin(false);};again.onclick=function(){begin(true);};
      document.addEventListener('keydown',function(e){if(e.key==='Escape')stop('paused');},true);
      // Reparent after the player uses real navigation, keep highlight in sync
      // with finance tabs and rendering without intercepting any game action.
      new MutationObserver(function(){if(state&&state.status==='active'&&!card.hidden){var owner=card.parentNode,overlay=owner.closest&&owner.closest('.setup');if(owner.tagName==='DIALOG'&&!owner.open||overlay&&overlay.hidden){stop('paused');return;}place();highlight();}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden','data-ui-view']});
      updateSettings();maybeStart();
    }
  });
})();

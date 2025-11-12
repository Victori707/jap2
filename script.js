// script.js

let daysData = [];
let tripDataRaw = null;
let isDevMode = false;

function formatRub(n) {
  const num = Number(n || 0);
  return num.toLocaleString('ru-RU');
}
function coerceExpense(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  // Извлекаем цифры из строки, игнорируем текст типа "руб", "к" и т.д.
  const digits = String(v).replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

// --- Devmode helpers ---
function loadData() {
  // сначала проверяем встроенные данные (для сохраненного HTML)
  if (window.embeddedData) {
    return Promise.resolve(window.embeddedData);
  }
  // затем из localStorage
  const ls = localStorage.getItem('jp_itin_v1');
  if (ls) return Promise.resolve(JSON.parse(ls));
  // иначе из json
  return fetch('data/itinerary.json').then(res=>res.json());
}
function saveData(data) {
  localStorage.setItem('jp_itin_v1', JSON.stringify(data));
}
function setDevMode(state) {
  isDevMode = !!state;
  document.body.classList.toggle('devmode', isDevMode);
  const btn = document.getElementById('devmode-toggle');
  if (btn) {
    btn.classList.toggle('dev', isDevMode);
    btn.textContent = isDevMode ? 'Выйти из режима разработчика' : 'Войти в режим разработчика';
  }
  // Добавляем кнопку сохранения HTML в режиме разработчика
  const devBar = document.getElementById('devmode-bar');
  if (devBar) {
    let saveBtn = document.getElementById('save-html-btn');
    if (isDevMode && !saveBtn) {
      saveBtn = document.createElement('button');
      saveBtn.id = 'save-html-btn';
      saveBtn.textContent = '💾 Сохранить HTML';
      saveBtn.style.cssText = 'margin-left: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
      saveBtn.onclick = saveHTMLToFile;
      devBar.appendChild(saveBtn);
    } else if (!isDevMode && saveBtn) {
      saveBtn.remove();
    }
  }
  // перерисуем все UI для режима
  renderTripInfo(tripDataRaw);
  renderDayNavigation(daysData);
  renderItinerary(daysData);
}
function toggleDevMode() {
  setDevMode(!isDevMode);
  localStorage.setItem('jp_itin_devmode', isDevMode ? '1':'');
}

// Генерация полного HTML с встроенными данными, CSS и JS
async function generateFullHTML() {
  // Получаем текущие данные
  const data = tripDataRaw || {};
  
  // Загружаем CSS и JS файлы для встраивания
  let cssContent = '';
  let scriptJsContent = '';
  let mapJsContent = '';
  
  try {
    const [cssRes, scriptRes, mapRes] = await Promise.all([
      fetch('style.css').then(r => r.text()).catch(() => ''),
      fetch('script.js').then(r => r.text()).catch(() => ''),
      fetch('map.js').then(r => r.text()).catch(() => '')
    ]);
    cssContent = cssRes || '';
    scriptJsContent = scriptRes || '';
    mapJsContent = mapRes || '';
  } catch (e) {
    console.warn('Не удалось загрузить CSS/JS файлы для встраивания', e);
  }
  
  // Экранируем данные для безопасной вставки в HTML
  const escapeHtml = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  };
  
  // Генерируем HTML с встроенными данными, CSS и JS
  const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.header || 'Путешествие в Японию')}</title>
  <style>
${cssContent}
  </style>
</head>
<body>
  <div id="devmode-bar">
    <button id="devmode-toggle" onclick="toggleDevMode()">Войти в режим разработчика</button>
  </div>
  <header>
    <h1 contenteditable="false">${escapeHtml(data.header || 'Путешествие в Японию')}</h1>
    <p class="dates"><span id="trip-dates">${escapeHtml(data.dates || '')}</span></p>
  </header>
  <main>
    <nav id="day-nav" class="day-navigation"></nav>
    <section id="itinerary"></section>
  </main>
  <footer>
    <div>Создатель: <span id="author-name">${escapeHtml(data.author || 'Ваше Имя')}</span>.</div>
    <div>Общий бюджет: <span id="budget">${escapeHtml(data.budget || '')}</span></div>
  </footer>
  <script>
    // Встроенные данные
    window.embeddedData = ${JSON.stringify(data, null, 2)};
  </script>
  <script>
${mapJsContent}
  </script>
  <script>
${scriptJsContent}
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=onGoogleMapsReady"></script>
</body>
</html>`;
  
  return htmlContent;
}

// Сохранение HTML на сервер
async function saveHTMLToFile() {
  try {
    // Показываем индикатор загрузки
    const saveBtn = document.getElementById('save-html-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Сохранение...';
    }
    
    const htmlContent = await generateFullHTML();
    const formData = new FormData();
    formData.append('html', htmlContent);
    
    const response = await fetch('/save_html', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.ok) {
      alert(`✅ HTML файл успешно сохранен как ${result.filename}\n\nТеперь вы можете открыть этот файл на любом устройстве!`);
    } else {
      alert('❌ Ошибка при сохранении: ' + (result.error || 'неизвестная ошибка'));
    }
    
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Сохранить HTML';
    }
  } catch (error) {
    alert('❌ Ошибка при сохранении HTML: ' + error.message);
    const saveBtn = document.getElementById('save-html-btn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Сохранить HTML';
    }
  }
}

// ---
document.addEventListener('DOMContentLoaded', () => {
  isDevMode = !!localStorage.getItem('jp_itin_devmode');
  loadData().then(data => {
    tripDataRaw = data;
    // нормализуем расходы, если раньше сохранялись строкой
    tripDataRaw.days = (tripDataRaw.days || []).map(d => ({
      ...d,
      expenses: coerceExpense(d.expenses)
    }));
    daysData = tripDataRaw.days;
    setDevMode(isDevMode);
  });
});

function renderTripInfo(data) {
  const dates = document.getElementById('trip-dates');
  const budget = document.getElementById('budget');
  const author = document.getElementById('author-name');
  const header = document.querySelector('header h1');
  dates.textContent = data.dates || '';
  budget.textContent = data.budget || '';
  if (author) {
    author.textContent = data.author || 'Ваше Имя';
    author.contentEditable = isDevMode;
    author.oninput = () => { tripDataRaw.author = author.textContent; saveData(tripDataRaw); };
  }
  if (header) {
    header.contentEditable = isDevMode;
    header.oninput = () => { tripDataRaw.header = header.textContent; saveData(tripDataRaw); };
    if (tripDataRaw.header) header.textContent = tripDataRaw.header;
  }
  if (isDevMode) {
    dates.contentEditable = true;
    budget.contentEditable = true;
    dates.oninput = () => { tripDataRaw.dates = dates.textContent; saveData(tripDataRaw); };
    budget.oninput = () => { tripDataRaw.budget = budget.textContent; saveData(tripDataRaw); };
  } else {
    dates.contentEditable = false;
    budget.contentEditable = false;
  }
}

function renderDayNavigation(days) {
  const nav = document.getElementById('day-nav');
  nav.innerHTML = '';
  days.forEach((day, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `День ${idx + 1}`;
    btn.className = 'day-nav-btn';
    btn.dataset.dayIdx = idx;
    btn.onclick = () => {
      setActiveDay(idx);
      scrollToDay(day.id);
      if (window.showDayOnMap) window.showDayOnMap(days[idx]);
    };
    nav.appendChild(btn);
  });
  // Автоматически активируем первый день
  setActiveDay(0);
}

function setActiveDay(idx, skipMap) {
  const nav = document.getElementById('day-nav');
  const buttons = nav.querySelectorAll('button');
  buttons.forEach(b => b.classList.remove('active'));
  if (buttons[idx]) buttons[idx].classList.add('active');
  // карта для дня
  if (!skipMap && window.showDayOnMap && daysData[idx]) window.showDayOnMap(daysData[idx]);
}

// Слежение за скроллом для автоматического выделения дня
window.addEventListener('scroll', () => {
  const daySections = Array.from(document.querySelectorAll('.day'));
  let minDiff = Infinity, idxToActivate = 0;
  const scrollY = window.scrollY + 70; // сдвиг под навигацию
  daySections.forEach((sec, i) => {
    const diff = Math.abs(sec.offsetTop - scrollY);
    if (diff < minDiff) {
      minDiff = diff;
      idxToActivate = i;
    }
  });
  setActiveDay(idxToActivate, true);
});

// Улучшаю клик по событию таймлайна:
window.focusEventOnMap = function(idx) {
  if (typeof window._map_focusEventOnMap === 'function') {
    window._map_focusEventOnMap(idx);
  }
  // выделение события
  const timelineEvents = document.querySelectorAll('.timeline-list .timeline-event');
  timelineEvents.forEach(ev => ev.classList.remove('selected'));
  if (timelineEvents[idx]) {
    timelineEvents[idx].classList.add('selected');
    // если мобильный экран — скроллим к секции дня
    if (window.innerWidth < 800) {
      const section = timelineEvents[idx].closest('.day');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function scrollToDay(dayId) {
  const section = document.getElementById(`day-${dayId}`);
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderItinerary(days) {
  const root = document.getElementById('itinerary');
  root.innerHTML = '';
  days.forEach((day, idx) => {
    const daySection = document.createElement('section');
    daySection.className = 'day';
    daySection.id = `day-${day.id}`;
    daySection.setAttribute('data-day-idx', idx); // для надежного определения индекса

    // Заголовки и описания
    const titleBlock = isDevMode
      ? `<div class="day-notes" contenteditable="true" data-df="title" data-day-idx="${idx}">${day.title||''}</div>`
      : `<div class="day-notes"><strong>${day.title||''}</strong></div>`;
    const notesBlock = isDevMode
      ? `<div class="dev-daynotes" contenteditable="true" data-df="notes" data-day-idx="${idx}">${day.notes||''}</div>`
      : `<div class="dev-daynotes">${day.notes||''}</div>`;

    // Итоговые траты с выбором валюты
    const expVal = coerceExpense(day.expenses);
    const currency = day.currency || 'RUB'; // по умолчанию рубли
    const currencySymbol = currency === 'JPY' ? '¥' : '₽';
    
    const expensesBlock = isDevMode
      ? `<div class="day-summary">Итоговые траты: <input class="editable-input" type="number" min="0" step="100" value="${expVal}" data-expenses="${idx}" /> <select class="editable-input" data-currency="${idx}" style="width:80px;margin-left:4px;">
          <option value="RUB" ${currency === 'RUB' ? 'selected' : ''}>₽ (руб)</option>
          <option value="JPY" ${currency === 'JPY' ? 'selected' : ''}>¥ (иены)</option>
        </select></div>`
      : `<div class="day-summary">Итоговые траты: <b>${formatRub(expVal)} ${currencySymbol}</b></div>`;

    // Фото/карта
    let mediaBlock = '';
    if (isDevMode) {
      mediaBlock = `<input type="file" accept="image/*" class="photo-upload" data-day="${day.id}" data-day-idx="${idx}" />`+(day.photo ? `<img src="${day.photo}" class="uploaded-photo"><button class="dev-photo-delete" data-day="${day.id}" data-day-idx="${idx}">Удалить фото</button>`:'');
    } else if (day.photo) {
      mediaBlock = `<img src="${day.photo}" alt="photo" class="uploaded-photo">`;
    } else {
      mediaBlock = `<div class="map-container">Здесь будет карта...</div>`;
    }

    // Таймлайн
    let timelineHtml = '';
    day.timeline.forEach((ev, eidx) => {
      if (!isDevMode) {
        const handlerStr = ev.location && ev.location.mapsUrl ?
          `event.stopPropagation(); window._tlClickHandler && window._tlClickHandler(${eidx}, '${ev.location.mapsUrl}');` :
          `event.stopPropagation(); window._tlClickHandler && window._tlClickHandler(${eidx}, null);`;
        timelineHtml += `
<li class="timeline-event" onclick="${handlerStr}">
  <time>${ev.time||''}</time> ${ev.title||''}
  <div class="ev-note">${ev.note || ''}</div>
</li>`;
      } else {
        timelineHtml += `
<li class="timeline-event editing" data-eidx="${eidx}" data-day-idx="${idx}">
  <input class="editable-input" type="text" value="${ev.time||''}" data-ef="time" size="6" placeholder="Время">
  <input class="editable-input" type="text" value="${ev.title||''}" data-ef="title" size="18" placeholder="Название">
  <input class="editable-input" type="text" value="${(ev.location&&ev.location.mapsUrl)||''}" data-ef="mapsUrl" size="28" placeholder="Google Maps URL (опц.)">
  <input class="editable-input" type="text" value="${ev.note||''}" data-ef="note" size="28" placeholder="Примечание">
  <button class="dev-photo-delete" data-del-evt="${eidx}" data-day-idx="${idx}">–</button>
</li>`;
      }
    });
    if (isDevMode) {
      timelineHtml += `<button class="photo-upload" data-add-evt="${day.id}" data-day-idx="${idx}">+ Добавить событие</button>`;
    }

    daySection.innerHTML = `
      <h2 contenteditable="${isDevMode}" data-df="date" data-day-idx="${idx}">День ${idx+1}: ${day.date||''}</h2>
      ${titleBlock}
      ${notesBlock}
      ${expensesBlock}
      <div class="day-content">
        <div class="timeline-col">
          <ul class="timeline-list">${timelineHtml}</ul>
        </div>
        <div class="map-col">${mediaBlock}</div>
      </div>
    `;
    root.appendChild(daySection);
  });
  // Обработчики для фото и timeline в devmode
  if (isDevMode) addDevmodeHandlers();
  else window._tlClickHandler = (idx, url) => { if (window.focusEventOnMap) window.focusEventOnMap(idx); if(url) window.open(url,'_blank') };
  // Если Google Maps прогрузился — показать первый день
  if (!isDevMode && typeof window.showDayOnMap === "function" && days[0]) {
    window.showDayOnMap(days[0]);
  }
}
// Handlers for editable fields, photo uploads, timeline mutation
function addDevmodeHandlers() {
  // inline text fields - используем data-day-idx для надежности
  document.querySelectorAll('[contenteditable][data-df][data-day-idx]').forEach(el => {
    const dayIdx = Number(el.getAttribute('data-day-idx'));
    if (isNaN(dayIdx) || dayIdx < 0 || dayIdx >= daysData.length) return;
    el.oninput = () => {
      const key = el.getAttribute('data-df');
      const val = el.innerText.trim();
      if (key === 'date') {
        daysData[dayIdx].date = val.replace(/^День\s+\d+:\s*/i,'');
      } else {
        daysData[dayIdx][key] = val;
      }
      saveData(tripDataRaw);
    };
  });
  
  // expenses number inputs
  document.querySelectorAll('input[data-expenses]').forEach(inp => {
    const idx = Number(inp.getAttribute('data-expenses'));
    if (isNaN(idx) || idx < 0 || idx >= daysData.length) return;
    inp.oninput = () => {
      daysData[idx].expenses = coerceExpense(inp.value);
      saveData(tripDataRaw);
    };
  });
  
  // выбор валюты
  document.querySelectorAll('select[data-currency]').forEach(sel => {
    const idx = Number(sel.getAttribute('data-currency'));
    if (isNaN(idx) || idx < 0 || idx >= daysData.length) return;
    sel.onchange = () => {
      daysData[idx].currency = sel.value;
      saveData(tripDataRaw);
      renderItinerary(daysData); // перерисовываем для обновления символа валюты
    };
  });
  
  // timeline edits - используем data-day-idx
  document.querySelectorAll('.timeline-event.editing[data-day-idx]').forEach((li) => {
    const dayIdx = Number(li.getAttribute('data-day-idx'));
    const eidx = Number(li.getAttribute('data-eidx'));
    if (isNaN(dayIdx) || dayIdx < 0 || dayIdx >= daysData.length) return;
    if (isNaN(eidx) || eidx < 0 || eidx >= (daysData[dayIdx].timeline || []).length) return;
    
    ['time','title','mapsUrl','note'].forEach(field => {
      const inp = li.querySelector(`[data-ef="${field}"]`);
      if (!inp) return;
      inp.oninput = () => {
        const val = inp.value;
        if (field === 'mapsUrl') {
          if (!daysData[dayIdx].timeline[eidx].location) daysData[dayIdx].timeline[eidx].location = {};
          daysData[dayIdx].timeline[eidx].location.mapsUrl = val;
        } else {
          daysData[dayIdx].timeline[eidx][field] = val;
        }
        saveData(tripDataRaw);
      };
    });
    
    const del = li.querySelector('[data-del-evt]');
    if (del) del.onclick = () => {
      daysData[dayIdx].timeline.splice(eidx, 1);
      saveData(tripDataRaw);
      renderItinerary(daysData);
    };
  });
  
  // add new event - используем data-day-idx
  document.querySelectorAll('[data-add-evt][data-day-idx]').forEach(btn => {
    const dayIdx = Number(btn.getAttribute('data-day-idx'));
    if (isNaN(dayIdx) || dayIdx < 0 || dayIdx >= daysData.length) return;
    btn.onclick = () => {
      daysData[dayIdx].timeline.push({time:'',title:'',note:''});
      saveData(tripDataRaw);
      renderItinerary(daysData);
    };
  });
  
  // photo upload - используем data-day-idx
  document.querySelectorAll('input.photo-upload[type="file"][data-day-idx]').forEach(inp => {
    const dayIdx = Number(inp.getAttribute('data-day-idx'));
    if (isNaN(dayIdx) || dayIdx < 0 || dayIdx >= daysData.length) return;
    inp.onchange = (e) => {
      const file = inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        daysData[dayIdx].photo = reader.result;
        saveData(tripDataRaw);
        renderItinerary(daysData);
      };
      reader.readAsDataURL(file);
    };
  });
  
  // photo delete - используем data-day-idx
  document.querySelectorAll('button.dev-photo-delete[data-day-idx]').forEach(btn => {
    if (btn.hasAttribute('data-day')) {
      const dayIdx = Number(btn.getAttribute('data-day-idx'));
      if (isNaN(dayIdx) || dayIdx < 0 || dayIdx >= daysData.length) return;
      btn.onclick = () => {
        delete daysData[dayIdx].photo;
        saveData(tripDataRaw);
        renderItinerary(daysData);
      };
    }
  });
}

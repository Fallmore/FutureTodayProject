'use strict';

(function () {
  const slug = decodeURIComponent(location.pathname.split('/').pop());
  const isPreview = new URLSearchParams(location.search).get('preview') === '1';

  const loadingEl = document.getElementById('loading');
  const unavailableEl = document.getElementById('unavailable');
  const reasonEl = document.getElementById('unavailable-reason');
  const wrapEl = document.getElementById('form-wrap');
  const titleEl = document.getElementById('form-title');
  const descEl = document.getElementById('form-desc');
  const formEl = document.getElementById('response-form');
  const successEl = document.getElementById('success');

  // Сессия студента: один и тот же id на всех событиях этой вкладки
  const SESSION_KEY = 'fb_session';
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  let form = null;
  let started = false;
  let submitted = false;
  let lastFocusedField = null;

  // ---------- Трекинг ----------

  function track(type, field) {
    if (isPreview) return; // предпросмотр из админки не портит статистику
    const payload = { type, slug, sessionId };
    if (field) payload.field = field;
    navigator.sendBeacon
      ? navigator.sendBeacon('/api/track', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      : fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
  }

  function markStarted(fieldId) {
    if (started) return;
    started = true;
    track('start', fieldId);
  }

  // ---------- Рендер ----------

  function buildField(field) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.dataset.fieldId = field.id;

    const label = document.createElement('label');
    label.className = 'field__label';

    const labelText = document.createElement('span');
    labelText.textContent = field.label;
    label.appendChild(labelText);

    if (field.required) {
      const star = document.createElement('span');
      star.className = 'required-star';
      star.textContent = ' *';
      label.appendChild(star);
    }

    let control;

    if (field.type === 'textarea') {
      control = document.createElement('textarea');
      control.rows = 4;
      control.className = 'input';
      wrap.appendChild(label);
      wrap.appendChild(control);
    } else if (field.type === 'select') {
      control = document.createElement('select');
      control.className = 'input';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— выберите вариант —';
      placeholder.disabled = true;
      placeholder.selected = true;
      control.appendChild(placeholder);
      field.options.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        control.appendChild(option);
      });
      wrap.appendChild(label);
      wrap.appendChild(control);
    } else if (field.type === 'radio' || field.type === 'checkbox') {
      const group = document.createElement('div');
      group.className = 'group';
      control = [];
      field.options.forEach((opt, i) => {
        const optLabel = document.createElement('label');
        optLabel.className = 'group__option';
        const input = document.createElement('input');
        input.type = field.type;
        input.name = field.id;
        input.value = opt;
        if (i === 0 && field.type === 'radio') input.dataset.firstRadio = '1';
        const text = document.createElement('span');
        text.textContent = opt;
        optLabel.appendChild(input);
        optLabel.appendChild(text);
        group.appendChild(optLabel);
        control.push(input);
      });
      wrap.appendChild(label);
      wrap.appendChild(group);
    } else {
      control = document.createElement('input');
      control.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text';
      control.className = 'input';
      wrap.appendChild(label);
      wrap.appendChild(control);
    }

    if (field.help) {
      const help = document.createElement('p');
      help.className = 'field__help';
      help.textContent = field.help;
      wrap.appendChild(help);
    }

    const error = document.createElement('p');
    error.className = 'field__error';
    error.hidden = true;
    wrap.appendChild(error);

    // Студент начал взаимодействовать с полем → воронка «начали»
    wrap.addEventListener('focusin', () => {
      lastFocusedField = field.id;
      markStarted(field.id);
    });

    return { wrap, control };
  }

  function readValue(field, control) {
    if (field.type === 'radio' || field.type === 'checkbox') {
      return control.filter((input) => input.checked).map((input) => input.value);
    }
    if (field.type === 'select') return control.value;
    return control.value;
  }

  function setFieldError(wrap, message) {
    const error = wrap.querySelector('.field__error');
    error.hidden = !message;
    error.textContent = message || '';
    wrap.classList.toggle('field--invalid', !!message);
  }

  // Клиентская проверка: те же правила, что и на сервере
  function validate(fields, controls) {
    let firstInvalid = null;

    fields.forEach((field, i) => {
      const wrap = controls[i].wrap;
      const value = readValue(field, controls[i].control);
      const empty = Array.isArray(value) ? value.length === 0 : String(value).trim() === '';
      let error = '';

      if (empty) {
        if (field.required) error = field.type === 'checkbox' || field.type === 'radio' ? 'Выберите хотя бы один вариант' : 'Обязательное поле';
      } else if (typeof value === 'string') {
        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) error = 'Проверьте адрес почты';
        if (field.type === 'number' && !/^-?\d+(\.\d+)?$/.test(value)) error = 'Введите число';
      }

      setFieldError(wrap, error);
      if (error && !firstInvalid) firstInvalid = wrap;
    });

    return firstInvalid;
  }

  // ---------- Отправка ----------

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form || submitted) return;

    const firstInvalid = validate(form.fields, formEl._controls);
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = firstInvalid.querySelector('input, select, textarea');
      if (focusable) focusable.focus();
      return;
    }

    const answers = {};
    form.fields.forEach((field, i) => {
      answers[field.id] = readValue(field, formEl._controls[i].control);
    });

    const submitBtn = formEl.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';

    try {
      const res = await fetch('/api/form/' + encodeURIComponent(slug) + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, sessionId })
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить';
        if (body.details) {
          // Сервер нашёл ошибки — подсвечиваем конкретные поля
          form.fields.forEach((field, i) => {
            setFieldError(formEl._controls[i].wrap, body.details[field.id] || '');
          });
        } else {
          showError(body.error || 'Не удалось отправить форму. Попробуйте ещё раз.');
        }
        return;
      }

      submitted = true;
      track('submit');
      formEl.hidden = true;
      successEl.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (networkError) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить';
      showError('Сеть недоступна. Проверьте соединение и попробуйте ещё раз.');
    }
  });

  function showError(message) {
    const existing = formEl.querySelector('.form-error');
    if (existing) existing.remove();
    const box = document.createElement('p');
    box.className = 'form-error';
    box.textContent = message;
    formEl.prepend(box);
  }

  // ---------- Загрузка схемы ----------

  async function init() {
    const url = '/api/form/' + encodeURIComponent(slug) + (isPreview ? '?preview=1' : '');

    let data;
    try {
      const res = await fetch(url);
      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Форма недоступна');
    } catch (err) {
      loadingEl.hidden = true;
      unavailableEl.hidden = false;
      reasonEl.textContent = (data && data.error) || 'Возможно, ссылка устарела или форма ещё не опубликована.';
      return;
    }

    form = data.form;
    loadingEl.hidden = true;
    wrapEl.hidden = false;
    titleEl.textContent = form.title;
    document.title = form.title + ' — форма отклика';
    if (form.description) {
      descEl.textContent = form.description;
    } else {
      descEl.hidden = true;
    }

    const controls = [];
    form.fields.forEach((field) => {
      const built = buildField(field);
      formEl.appendChild(built.wrap);
      controls.push(built);
    });
    formEl._controls = controls;

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--submit';
    submit.textContent = 'Отправить';
    formEl.appendChild(submit);

    track('view');
    // Брошенная форма: фиксируем, на каком поле студент свернул вкладку
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !submitted && started) {
        track('abandon', lastFocusedField);
      }
    });
  }

  init();
})();

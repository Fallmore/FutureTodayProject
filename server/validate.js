'use strict';

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date'];
const OPTION_TYPES = ['select', 'radio', 'checkbox'];

/**
 * Валидация схемы формы, присланной из билдера.
 * Возвращает { ok, errors } — errors: массив понятных сообщений.
 */
function validateFormSchema(payload) {
  const errors = [];
  const p = payload || {};

  if (typeof p.title !== 'string' || !p.title.trim()) {
    errors.push('У формы должно быть название');
  } else if (p.title.trim().length > 200) {
    errors.push('Название формы — не длиннее 200 символов');
  }

  if (p.description != null && typeof p.description !== 'string') {
    errors.push('Описание должно быть текстом');
  }

  if (!Array.isArray(p.fields)) {
    errors.push('Список полей должен быть массивом');
    return { ok: false, errors };
  }

  if (p.fields.length > 50) {
    errors.push('В форме не может быть больше 50 полей');
  }

  const ids = new Set();
  p.fields.forEach((field, i) => {
    const where = `Поле №${i + 1}`;
    if (!field || typeof field !== 'object') {
      errors.push(`${where}: некорректное содержимое`);
      return;
    }
    if (typeof field.id !== 'string' || !field.id) {
      errors.push(`${where}: отсутствует идентификатор`);
    } else if (ids.has(field.id)) {
      errors.push(`${where}: повторяющийся идентификатор`);
    } else {
      ids.add(field.id);
    }

    if (!FIELD_TYPES.includes(field.type)) {
      errors.push(`${where}: неизвестный тип «${field.type}»`);
    }
    if (typeof field.label !== 'string' || !field.label.trim()) {
      errors.push(`${where}: у поля должен быть текст вопроса`);
    } else if (field.label.length > 300) {
      errors.push(`${where}: вопрос длиннее 300 символов`);
    }

    if (OPTION_TYPES.includes(field.type)) {
      const options = field.options;
      if (!Array.isArray(options) || options.length < 1) {
        errors.push(`${where}: добавьте хотя бы один вариант ответа`);
      } else if (options.length > 30) {
        errors.push(`${where}: не больше 30 вариантов`);
      } else if (options.some((o) => typeof o !== 'string' || !o.trim())) {
        errors.push(`${where}: пустой вариант ответа`);
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Серверная валидация ответов студента.
 * Форма, поле и обязательность берутся из опубликованной схемы —
 * клиенту доверяем ровно настолько, насколько его можно не слушать.
 *
 * Возвращает { ok, errors: { fieldId: сообщение } }
 */
function validateSubmission(form, answersRaw) {
  const errors = {};
  const answers = {};
  const source = (answersRaw && typeof answersRaw === 'object') ? answersRaw : {};

  for (const field of form.fields) {
    const raw = source[field.id];
    const empty =
      raw == null ||
      (typeof raw === 'string' && raw.trim() === '') ||
      (Array.isArray(raw) && raw.length === 0);

    if (empty) {
      if (field.required) errors[field.id] = 'Обязательное поле';
      answers[field.id] = Array.isArray(raw) ? [] : '';
      continue;
    }

    if (field.type === 'checkbox') {
      if (!Array.isArray(raw)) {
        errors[field.id] = 'Некорректный формат ответа';
        answers[field.id] = [];
        continue;
      }
      const cleaned = raw.filter((v) => typeof v === 'string').slice(0, 30);
      const unknown = cleaned.filter((v) => !field.options.includes(v));
      if (unknown.length) {
        errors[field.id] = 'Выбран вариант, которого нет в списке';
      }
      answers[field.id] = cleaned;
      continue;
    }

    if (typeof raw !== 'string') {
      errors[field.id] = 'Некорректный формат ответа';
      answers[field.id] = '';
      continue;
    }

    const value = raw.trim().slice(0, 2000);

    switch (field.type) {
      case 'email':
        if (!isEmail(value)) errors[field.id] = 'Проверьте адрес почты';
        break;
      case 'number':
        if (!/^-?\d+(\.\d+)?$/.test(value)) errors[field.id] = 'Введите число';
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
          errors[field.id] = 'Введите корректную дату';
        }
        break;
      case 'select':
      case 'radio':
        if (!field.options.includes(value)) errors[field.id] = 'Выберите вариант из списка';
        break;
      default:
        break; // text, textarea — достаточно длины выше
    }

    answers[field.id] = value;
  }

  return { ok: Object.keys(errors).length === 0, errors, answers };
}

module.exports = { validateFormSchema, validateSubmission, FIELD_TYPES, OPTION_TYPES };

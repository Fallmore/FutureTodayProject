'use strict';

/**
 * Аналитика воронки: просмотры → начали заполнять → отправили.
 * Плюс «точка выпадения» — поле, на котором студенты бросают форму чаще всего.
 * Это прямой ответ на проблему из ТЗ: «причина низкой конверсии остаётся неизвестной».
 */

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function isEmptyAnswer(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/**
 * @param {object} form        схема формы
 * @param {Array}  submissions отправленные ответы
 * @param {Array}  events      события view/start/abandon
 */
function buildFunnel(form, submissions, events) {
  const views = events.filter((e) => e.type === 'view').length;
  const starts = events.filter((e) => e.type === 'start').length;
  const submits = submissions.length;

  // По каждому полю: сколько отправивших его заполнили и сколько бросили именно на нём.
  const filled = Object.create(null);
  const dropped = Object.create(null);
  form.fields.forEach((f) => { filled[f.id] = 0; dropped[f.id] = 0; });

  submissions.forEach((s) => {
    form.fields.forEach((f) => {
      if (!isEmptyAnswer(s.answers[f.id])) filled[f.id]++;
    });
  });

  events.forEach((e) => {
    if (e.type === 'abandon' && e.lastField && filled[e.lastField] !== undefined) {
      dropped[e.lastField]++;
    }
  });

  const fields = form.fields.map((f, index) => ({
    index: index + 1,
    id: f.id,
    label: f.label,
    type: f.type,
    required: !!f.required,
    filled: filled[f.id],
    dropped: dropped[f.id]
  }));

  // Самое «узкое» поле — с максимальным числом бросаний (при равенстве — первое по порядку)
  const worst = fields.reduce((acc, f) => (acc == null || f.dropped > acc.dropped ? f : acc), null);

  return {
    views,
    starts,
    submits,
    conversion: pct(submits, views),
    startRate: pct(starts, views),
    finishRate: pct(submits, starts),
    fields,
    worstField: worst && worst.dropped > 0 ? worst : null
  };
}

/** Краткая статистика для карточки в списке форм */
function briefStats(submissions, events) {
  return {
    submissions: submissions.length,
    views: events.filter((e) => e.type === 'view').length
  };
}

module.exports = { buildFunnel, briefStats };

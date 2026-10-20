'use strict';

const express = require('express');
const path = require('path');
const db = require('../db');
const ids = require('../ids');
const { validateSubmission } = require('../validate');

const router = express.Router();

const FORM_HTML = path.join(__dirname, '..', '..', 'public', 'form', 'index.html');

const TRACK_TYPES = ['view', 'start', 'abandon'];

function findForm(req) {
  const form = db.getFormBySlug(req.params.slug);
  if (!form) return { error: 'Форма не найдена', status: 404 };

  // Черновик недоступен публично, но его можно посмотреть из админки по ссылке с preview=1
  const isPreview = req.query.preview === '1' || req.query.preview === 'true';
  if (form.status !== 'published' && !isPreview) {
    return { error: 'Форма ещё не опубликована', status: 404 };
  }
  return { form };
}

// Страница формы. Схему подтягивает клиентский скрипт — так одна и та же
// страница обслуживает и обычную форму, и сообщение «недоступна», и preview.
router.get('/f/:slug', (req, res) => {
  res.sendFile(FORM_HTML);
});

router.get('/api/form/:slug', (req, res) => {
  const { form, error, status } = findForm(req);
  if (error) return res.status(status).json({ error });
  res.json({
    form: {
      slug: form.slug,
      title: form.title,
      description: form.description,
      fields: form.fields
    }
  });
});

router.post('/api/form/:slug/submit', (req, res) => {
  const { form, error, status } = findForm(req);
  if (error) return res.status(status).json({ error });
  if (form.status !== 'published') {
    return res.status(404).json({ error: 'Форма ещё не опубликована' });
  }

  const check = validateSubmission(form, req.body && req.body.answers);
  if (!check.ok) return res.status(400).json({ error: 'Проверьте заполнение формы', details: check.errors });

  const submission = {
    id: ids.uuid(),
    formId: form.id,
    createdAt: new Date().toISOString(),
    answers: check.answers
  };
  db.addSubmission(submission);

  // Отправка — цель воронки: закрываем сессию, если она была открыта
  const sessionId = typeof (req.body && req.body.sessionId) === 'string' ? req.body.sessionId.slice(0, 64) : null;
  if (sessionId) {
    db.addEvent({ formId: form.id, type: 'submit', ts: submission.createdAt, sessionId });
  }

  res.status(201).json({ ok: true, id: submission.id });
});

// Аналитика: просмотры, начало заполнения, брошенные формы
router.post('/api/track', (req, res) => {
  const body = req.body || {};
  const type = body.type;
  if (!TRACK_TYPES.includes(type)) return res.status(400).json({ error: 'Неизвестное событие' });

  const form = db.getFormBySlug(String(body.slug || ''));
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });

  const sessionId = typeof body.sessionId === 'string' && body.sessionId
    ? body.sessionId.slice(0, 64)
    : ids.sessionId();

  const event = { formId: form.id, type, ts: new Date().toISOString(), sessionId };
  if (type === 'start' && typeof body.field === 'string') event.firstField = body.field.slice(0, 64);
  if (type === 'abandon' && typeof body.field === 'string') event.lastField = body.field.slice(0, 64);

  db.addEvent(event);
  res.json({ ok: true });
});

module.exports = router;

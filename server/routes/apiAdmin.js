'use strict';

const express = require('express');
const db = require('../db');
const ids = require('../ids');
const { validateFormSchema } = require('../validate');
const { buildFunnel, briefStats } = require('../analytics');

const router = express.Router();

/** Уникальный slug: из названия, при конфликте — с суффиксом */
function uniqueSlug(title) {
  const base = ids.slugify(title);
  let candidate = base;
  let n = 2;
  while (db.getFormBySlug(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

// ---------- Список форм ----------

router.get('/forms', (req, res) => {
  const forms = db.getForms().map((form) => ({
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    status: form.status,
    fieldsCount: form.fields.length,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    stats: briefStats(db.getSubmissions(form.id), db.getEvents(form.id))
  }));

  forms.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  res.json({ forms });
});

// ---------- Создание ----------

router.post('/forms', (req, res) => {
  const title = (req.body && req.body.title ? String(req.body.title) : '').trim() || 'Новая форма';

  const form = {
    id: ids.uuid(),
    slug: uniqueSlug(title),
    title,
    description: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    fields: []
  };

  db.addForm(form);
  res.status(201).json({ form });
});

// ---------- Одна форма ----------

router.get('/forms/:id', (req, res) => {
  const form = db.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });
  res.json({ form });
});

router.put('/forms/:id', (req, res) => {
  const form = db.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });

  const body = req.body || {};
  const check = validateFormSchema({
    title: body.title,
    description: body.description,
    fields: body.fields
  });
  if (!check.ok) return res.status(400).json({ error: check.errors.join('; '), details: check.errors });

  const newTitle = String(body.title).trim();
  form.title = newTitle;
  form.description = body.description != null ? String(body.description) : '';
  form.fields = body.fields.map((f) => ({
    id: f.id,
    type: f.type,
    label: String(f.label).trim(),
    help: f.help != null ? String(f.help) : '',
    required: !!f.required,
    options: Array.isArray(f.options) ? f.options.map((o) => String(o).trim()) : []
  }));
  form.updatedAt = new Date().toISOString();

  // Пока форма черновик — slug может обновляться вслед за названием
  if (form.status === 'draft') form.slug = uniqueSlug(newTitle);

  db.save();
  res.json({ form });
});

router.delete('/forms/:id', (req, res) => {
  if (!db.getForm(req.params.id)) return res.status(404).json({ error: 'Форма не найдена' });
  db.removeForm(req.params.id);
  res.json({ ok: true });
});

// ---------- Публикация ----------

router.post('/forms/:id/publish', (req, res) => {
  const form = db.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });

  const check = validateFormSchema(form);
  if (!check.ok) {
    return res.status(400).json({ error: 'Перед публикацией исправьте форму: ' + check.errors.join('; ') });
  }
  if (form.fields.length === 0) {
    return res.status(400).json({ error: 'Добавьте хотя бы одно поле' });
  }

  form.status = 'published';
  form.publishedAt = form.publishedAt || new Date().toISOString();
  form.updatedAt = new Date().toISOString();
  db.save();

  res.json({ form });
});

router.post('/forms/:id/unpublish', (req, res) => {
  const form = db.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });

  form.status = 'draft';
  form.updatedAt = new Date().toISOString();
  db.save();

  res.json({ form });
});

// ---------- Ответы и аналитика ----------

router.get('/forms/:id/submissions', (req, res) => {
  const form = db.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });

  const submissions = db.getSubmissions(form.id).slice().sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  res.json({
    form,
    funnel: buildFunnel(form, submissions, db.getEvents(form.id)),
    submissions
  });
});

// ---------- Экспорт в CSV ----------

router.get('/forms/:id/export.csv', (req, res) => {
  const form = db.getForm(req.params.id);
  if (!form) return res.status(404).json({ error: 'Форма не найдена' });

  const submissions = db.getSubmissions(form.id).slice().sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );

  const escape = (value) => {
    let cell = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
    if (typeof value === 'string' && /^[=+\-@]/.test(cell)) cell = "'" + cell; // защита от формул в Excel
    return '"' + cell.replace(/"/g, '""') + '"';
  };

  const header = ['Дата отправки', 'ID ответа'].concat(form.fields.map((f) => f.label));
  const lines = [header.map(escape).join(',')];

  submissions.forEach((s) => {
    const row = [new Date(s.createdAt).toLocaleString('ru-RU'), s.id]
      .concat(form.fields.map((f) => s.answers[f.id] ?? ''));
    lines.push(row.map(escape).join(','));
  });

  const filename = `${form.slug}-responses.csv`;
  // BOM нужен, чтобы Excel корректно открыл кириллицу
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + lines.join('\r\n'));
});

module.exports = router;

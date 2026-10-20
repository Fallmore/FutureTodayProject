'use strict';

const fs = require('fs');
const path = require('path');
const { seed } = require('./seed');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let data = null;
let timer = null;

/** Первая загрузка: читаем файл или создаём с демонстрационными данными */
function load() {
  if (data) return data;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      throw new Error('Файл data/db.json повреждён: ' + err.message);
    }
  } else {
    data = seed();
    flushSync();
  }

  // страховка на случай рукописного редактирования файла
  data.forms = data.forms || [];
  data.submissions = data.submissions || [];
  data.events = data.events || [];
  return data;
}

function get() {
  return load();
}

/** Атомарная запись: временный файл + rename, чтобы не потерять данные при сбое */
function flushSync() {
  if (!data) return;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

/** Отложенная запись: аналитика может слать события пачками, диск не дёргаем */
function save() {
  load();
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flushSync();
  }, 50);
}

process.on('exit', () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    flushSync();
  }
});

// ---------- Доступ к сущностям ----------

function getForm(id) {
  return load().forms.find((f) => f.id === id) || null;
}

function getFormBySlug(slug) {
  return load().forms.find((f) => f.slug === slug) || null;
}

function getForms() {
  return load().forms;
}

function getSubmissions(formId) {
  return load().submissions.filter((s) => s.formId === formId);
}

function getEvents(formId) {
  return load().events.filter((e) => e.formId === formId);
}

function addForm(form) {
  load().forms.push(form);
  save();
  return form;
}

function removeForm(id) {
  const db = load();
  db.forms = db.forms.filter((f) => f.id !== id);
  db.submissions = db.submissions.filter((s) => s.formId !== id);
  db.events = db.events.filter((e) => e.formId !== id);
  save();
}

function addSubmission(submission) {
  load().submissions.push(submission);
  save();
  return submission;
}

function addEvent(event) {
  load().events.push(event);
  save();
  return event;
}

module.exports = {
  load, save, flushSync,
  getForm, getFormBySlug, getForms,
  getSubmissions, getEvents,
  addForm, removeForm, addSubmission, addEvent
};

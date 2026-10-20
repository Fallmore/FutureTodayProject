'use strict';

const path = require('path');
const express = require('express');

const db = require('./db');
const adminPages = require('./routes/adminPages');
const apiAdmin = require('./routes/apiAdmin');
const publicForm = require('./routes/publicForm');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Статика (админка и публичная форма). Маршруты регистрируются после неё,
// поэтому /admin и /f/:slug никогда не перехватываются файлами.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

app.use('/', adminPages);
app.use('/api/admin', apiAdmin);
app.use('/', publicForm);

app.get('/', (req, res) => res.redirect('/admin'));

// Одностраничное сообщение вместо заглушек
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Страница не найдена' });
  }
  res.status(404).send(
    '<!doctype html><html lang="ru"><meta charset="utf-8">' +
    '<title>404 — не найдено</title>' +
    '<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;text-align:center">' +
    '<h1>404</h1><p>Такой страницы нет. <a href="/admin">Перейти в админку</a></p></body></html>'
  );
});

// Ошибки валидации JSON и прочие исключения — не роняем процесс и не светим стеком
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const isBodyError = err && err.type === 'entity.parse.failed';
  const message = isBodyError ? 'Некорректный JSON в запросе' : 'Внутренняя ошибка сервера';
  if (!isBodyError) console.error(err);
  res.status(isBodyError ? 400 : 500).json({ error: message });
});

const PORT = Number(process.env.PORT) || 3000;

db.load(); // поднимаем хранилище до старта, чтобы первая команда не тормозила первый запрос

app.listen(PORT, () => {
  console.log('');
  console.log('  Form Builder запущен');
  console.log('  Админка:        http://localhost:' + PORT + '/admin');
  console.log('  Данные:         data/db.json');
  console.log('');
});

'use strict';

const crypto = require('crypto');

/** Уникальный идентификатор */
function uuid() {
  return crypto.randomUUID();
}

/** Короткий идентификатор поля формы */
function shortId() {
  return 'f_' + crypto.randomBytes(4).toString('hex');
}

/** Идентификатор сессии студента (используется для аналитики) */
function sessionId() {
  return 's_' + crypto.randomBytes(8).toString('hex');
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

/** Человекочитаемый slug из произвольной строки */
function slugify(text, fallback = 'form') {
  const src = String(text || '').toLowerCase().split('').map((ch) => {
    if (TRANSLIT[ch] !== undefined) return TRANSLIT[ch];
    if (/[a-z0-9]/.test(ch)) return ch;
    return ' ';
  }).join('');

  const slug = src.split(/\s+/).filter(Boolean).join('-').replace(/-+/g, '-').slice(0, 60);
  return slug || fallback;
}

module.exports = { uuid, shortId, sessionId, slugify };

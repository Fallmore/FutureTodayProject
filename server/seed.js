'use strict';

const { uuid, shortId } = require('./ids');

/**
 * Демонстрационные данные при первом запуске.
 * Проверяющий сразу видит заполненную админку и наполненную аналитику.
 */
function seed() {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();

  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  const fName = shortId();
  const fEmail = shortId();
  const fPhone = shortId();
  const fUni = shortId();
  const fGrad = shortId();
  const fStack = shortId();
  const fExp = shortId();
  const fStart = shortId();

  const formId = uuid();

  const form = {
    id: formId,
    slug: 'backend-internship-summer-2026',
    title: 'Стажировка Backend-разработчик, лето 2026',
    description:
      'Ищем стажёров в команду серверной разработки. Заполните форму — мы ответим в течение трёх рабочих дней.',
    status: 'published',
    createdAt: iso(7 * DAY),
    updatedAt: iso(6 * DAY),
    publishedAt: iso(6 * DAY),
    fields: [
      { id: fName, type: 'text', label: 'ФИО', help: 'Как в паспорте', required: true, options: [] },
      { id: fEmail, type: 'email', label: 'Email', help: 'На него пришлём приглашение', required: true, options: [] },
      { id: fPhone, type: 'text', label: 'Телефон', help: '', required: false, options: [] },
      { id: fUni, type: 'text', label: 'Университет и факультет', help: '', required: true, options: [] },
      { id: fGrad, type: 'number', label: 'Год выпуска', help: '', required: true, options: [] },
      {
        id: fStack, type: 'checkbox', label: 'Знакомые технологии',
        help: 'Можно выбрать несколько', required: true,
        options: ['Node.js', 'Python', 'Go', 'PostgreSQL', 'Docker', 'Kubernetes']
      },
      { id: fExp, type: 'textarea', label: 'Опишите свой опыт', help: 'Ссылки на GitHub приветствуются', required: true, options: [] },
      { id: fStart, type: 'date', label: 'Когда можете начать?', help: '', required: false, options: [] }
    ]
  };

  // Черновик — чтобы в списке форм была видна разница статусов
  const draftId = uuid();
  const draft = {
    id: draftId,
    slug: 'hr-workshop-registration',
    title: 'Воркшоп «Как пройти собеседование»',
    description: '',
    status: 'draft',
    createdAt: iso(2 * DAY),
    updatedAt: iso(2 * DAY),
    publishedAt: null,
    fields: [
      { id: shortId(), type: 'text', label: 'ФИО', help: '', required: true, options: [] },
      { id: shortId(), type: 'email', label: 'Email', help: '', required: true, options: [] }
    ]
  };

  // --- Демо-ответы и события аналитики для опубликованной формы ---
  const submissions = [];
  const events = [];

  const names = ['Анна Смирнова', 'Иван Петров', 'Мария Ковалёва', 'Дмитрий Сидоров', 'Ольга Никитина', 'Павел Морозов'];
  const unis = 'МГУ, ВШЭ, МФТИ, СПбГУ, ИТМО, КФУ'.split(', ');
  const experiences = [
    'Учился на курсах по backend, делал учебный чат-сервис на Express + PostgreSQL.',
    'Год писал хендлеры на Python (FastAPI), стажировался в студии разработки.',
    'Есть pet-проект: сервис сбора метрик на Node.js, Docker Compose.',
    'Писал ботов для Telegram, знаю основы SQL и REST.',
    'Прошёл курс по алгоритмам, решал задачи на Codeforces.',
    'Участвовал в хакатоне, делал API на Go.'
  ];

  // 6 отправленных заявок
  for (let i = 0; i < names.length; i++) {
    submissions.push({
      id: uuid(),
      formId,
      createdAt: iso((i + 1) * 9 * HOUR),
      answers: {
        [fName]: names[i],
        [fEmail]: `student${i + 1}@example.com`,
        [fPhone]: i % 2 === 0 ? `+7 900 000-00-${10 + i}` : '',
        [fUni]: unis[i] + ', прикладная информатика',
        [fGrad]: String(2026 + (i % 3)),
        [fStack]: [['Node.js', 'PostgreSQL'], ['Python'], ['Go', 'Docker'], ['Node.js'], ['Python', 'PostgreSQL'], ['Go']][i],
        [fExp]: experiences[i],
        [fStart]: i % 2 === 0 ? '2026-06-01' : ''
      }
    });
  }

  // 14 просмотров, 11 начали, 6 отправили → видна воронка
  for (let i = 0; i < 14; i++) {
    events.push({ formId, type: 'view', ts: iso((i + 1) * 5 * HOUR), sessionId: 'seed_s' + i });
  }
  const startFields = [fName, fName, fName, fName, fName, fName, fName, fName, fName, fName, fName];
  for (let i = 0; i < 11; i++) {
    events.push({ formId, type: 'start', ts: iso((i + 1) * 5 * HOUR + MIN), sessionId: 'seed_s' + i, firstField: startFields[i] });
  }
  // 5 брошенных: точки выпадения разные, таблица будет наглядной
  const dropPoints = [fEmail, fGrad, fStack, fStack, fExp];
  for (let i = 0; i < dropPoints.length; i++) {
    events.push({
      formId, type: 'abandon', ts: iso((i + 1) * 5 * HOUR + 3 * MIN),
      sessionId: 'seed_s' + (i + 6), lastField: dropPoints[i]
    });
  }

  return { forms: [form, draft], submissions, events };
}

module.exports = { seed };

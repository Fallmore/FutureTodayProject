'use strict';

(function () {
  const formId = new URLSearchParams(location.search).get('id') || location.pathname.split('/').pop();

  const titleEl = document.getElementById('form-title');
  const backLink = document.getElementById('back-link');
  const exportBtn = document.getElementById('export-btn');
  const insightEl = document.getElementById('insight');
  const dropTableBody = document.querySelector('#drop-table tbody');
  const answersTable = document.getElementById('answers-table');
  const noAnswersEl = document.getElementById('no-answers');

  function showError(message) {
    insightEl.hidden = false;
    insightEl.textContent = message;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date)) return '—';
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function cellText(value) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
    return Array.isArray(value) ? value.join(', ') : String(value);
  }

  // ---------- Воронка ----------

  function renderFunnel(funnel) {
    document.getElementById('stat-views').textContent = funnel.views;
    document.getElementById('stat-starts').textContent = funnel.starts;
    document.getElementById('stat-submits').textContent = funnel.submits;
    document.getElementById('stat-conversion').textContent = funnel.conversion + '%';

    if (funnel.worstField) {
      insightEl.hidden = false;
      insightEl.textContent =
        `Больше всего студентов останавливаются на вопросе «${funnel.worstField.label}» — ` +
        `${funnel.worstField.dropped} ${plural(funnel.worstField.dropped, 'человек', 'человека', 'человек')} не дожали «Отправить» именно на нём. ` +
        `Попробуйте сократить вопрос или сделать его необязательным.`;
    }

    dropTableBody.textContent = '';
    funnel.fields.forEach((field) => {
      const tr = document.createElement('tr');

      const num = document.createElement('td');
      num.textContent = field.index;
      tr.appendChild(num);

      const label = document.createElement('td');
      label.textContent = field.label + (field.required ? '' : ' (необяз.)');
      tr.appendChild(label);

      const filled = document.createElement('td');
      filled.textContent = field.filled;
      tr.appendChild(filled);

      const dropped = document.createElement('td');
      dropped.textContent = field.dropped;
      if (field.dropped > 0) dropped.className = 'cell-dropped';
      tr.appendChild(dropped);

      dropTableBody.appendChild(tr);
    });
  }

  // ---------- Таблица ответов ----------

  function renderAnswers(form, submissions) {
    noAnswersEl.hidden = submissions.length > 0;
    answersTable.hidden = submissions.length === 0;
    if (submissions.length === 0) return;

    const thead = answersTable.querySelector('thead');
    const tbody = answersTable.querySelector('tbody');
    thead.textContent = '';
    tbody.textContent = '';

    const headRow = document.createElement('tr');
    ['№', 'Дата отправки'].concat(form.fields.map((f) => f.label)).forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    submissions.forEach((submission, index) => {
      const tr = document.createElement('tr');

      const num = document.createElement('td');
      num.textContent = index + 1;
      tr.appendChild(num);

      const date = document.createElement('td');
      date.textContent = formatDate(submission.createdAt);
      tr.appendChild(date);

      form.fields.forEach((field) => {
        const td = document.createElement('td');
        const text = cellText(submission.answers[field.id]);
        if (text == null) {
          td.textContent = '—';
          td.className = 'empty-cell';
        } else {
          td.textContent = text;
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  async function load() {
    const result = await AdminAPI.getSubmissions(formId);
    if (!result.ok) return showError(result.error);

    const { form, funnel, submissions } = result.data;
    titleEl.textContent = 'Ответы: ' + form.title;
    backLink.href = '/admin/edit/' + encodeURIComponent(form.id);
    exportBtn.disabled = false;
    exportBtn.onclick = () => { location.href = AdminAPI.exportUrl(form.id); };

    renderFunnel(funnel);
    renderAnswers(form, submissions);
  }

  exportBtn.disabled = true;
  load();
})();

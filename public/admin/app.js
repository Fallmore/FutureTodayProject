'use strict';

(function () {
  const listEl = document.getElementById('forms-list');
  const emptyEl = document.getElementById('empty-state');
  const createBtn = document.getElementById('create-btn');
  const cardTemplate = document.getElementById('card-template');

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function render(forms) {
    listEl.textContent = '';
    emptyEl.hidden = forms.length > 0;

    forms.forEach((form) => {
      const node = cardTemplate.content.cloneNode(true);

      node.querySelector('.card__title').textContent = form.title;
      node.querySelector('.card__desc').textContent = form.description || 'Без описания';

      const badge = node.querySelector('.badge');
      badge.textContent = form.status === 'published' ? 'Опубликована' : 'Черновик';
      badge.classList.add(form.status === 'published' ? 'badge--published' : 'badge--draft');

      node.querySelector('.card__stats').textContent =
        `${form.fieldsCount} ${plural(form.fieldsCount, 'вопрос', 'вопроса', 'вопросов')} · ` +
        `${form.stats.submissions} ${plural(form.stats.submissions, 'ответ', 'ответа', 'ответов')} · ` +
        `изменена ${formatDate(form.updatedAt)}`;

      const editLink = node.querySelector('.edit-link');
      editLink.href = '/admin/edit/' + encodeURIComponent(form.id);

      const responsesLink = node.querySelector('.responses-link');
      responsesLink.href = '/admin/responses/' + encodeURIComponent(form.id);
      responsesLink.textContent = 'Ответы (' + form.stats.submissions + ')';

      const publicUrl = AdminAPI.publicUrl(form.slug);
      const absoluteUrl = location.origin + publicUrl;

      const publishBtn = node.querySelector('.publish-btn');
      publishBtn.textContent = form.status === 'published' ? 'Снять с публикации' : 'Опубликовать';
      publishBtn.addEventListener('click', async () => {
        publishBtn.disabled = true;
        const method = form.status === 'published' ? 'unpublish' : 'publish';
        const result = await AdminAPI[method + 'Form'](form.id);
        publishBtn.disabled = false;
        if (!result.ok) return showError(result.error);
        load();
      });

      const copyBtn = node.querySelector('.copy-btn');
      const linkBox = node.querySelector('.card__link');
      if (form.status === 'published') {
        linkBox.hidden = false;
        linkBox.textContent = absoluteUrl;
      } else {
        copyBtn.disabled = true;
        copyBtn.title = 'Опубликуйте форму, чтобы получить ссылку';
      }
      copyBtn.addEventListener('click', async () => {
        const copied = await copyToClipboard(absoluteUrl);
        copyBtn.textContent = copied ? 'Скопировано ✓' : 'Не удалось скопировать';
        setTimeout(() => { copyBtn.textContent = 'Копировать ссылку'; }, 1600);
      });

      const deleteBtn = node.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', async () => {
        const confirmed = confirm(
          `Удалить форму «${form.title}»?\nВместе с ней удалятся все ответы студентов. Это необратимо.`
        );
        if (!confirmed) return;
        const result = await AdminAPI.deleteForm(form.id);
        if (!result.ok) return showError(result.error);
        load();
      });

      listEl.appendChild(node);
    });
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function showError(message) {
    alert(message);
  }

  async function load() {
    const result = await AdminAPI.listForms();
    if (!result.ok) return showError(result.error);
    render(result.data.forms);
  }

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    const result = await AdminAPI.createForm('Новая форма');
    createBtn.disabled = false;
    if (!result.ok) return showError(result.error);
    location.href = '/admin/edit/' + encodeURIComponent(result.data.form.id);
  });

  load();
})();

'use strict';

(function () {
  const TYPE_NAMES = {
    text: 'Короткий ответ',
    textarea: 'Развёрнутый ответ',
    email: 'Email',
    number: 'Число',
    date: 'Дата',
    select: 'Выпадающий список',
    radio: 'Один из списка',
    checkbox: 'Несколько из списка'
  };
  const OPTION_TYPES = ['select', 'radio', 'checkbox'];

  const formId = new URLSearchParams(location.search).get('id') || location.pathname.split('/').pop();

  const titleEl = document.getElementById('form-title');
  const descEl = document.getElementById('form-desc');
  const linkEl = document.getElementById('form-link');
  const statusEl = document.getElementById('form-status');
  const saveBtn = document.getElementById('save-btn');
  const saveHint = document.getElementById('save-hint');
  const publishBtn = document.getElementById('publish-btn');
  const previewLink = document.getElementById('preview-link');
  const addTypeEl = document.getElementById('add-type');
  const addFieldBtn = document.getElementById('add-field-btn');
  const fieldsListEl = document.getElementById('fields-list');
  const noFieldsEl = document.getElementById('no-fields');
  const errorBox = document.getElementById('error-box');
  const fieldTemplate = document.getElementById('field-template');

  const dialog = document.getElementById('field-dialog');
  const dLabel = document.getElementById('d-label');
  const dHelp = document.getElementById('d-help');
  const dRequired = document.getElementById('d-required');
  const dOptionsWrap = document.getElementById('d-options-wrap');
  const dOptions = document.getElementById('d-options');
  const dSave = document.getElementById('d-save');
  const dCancel = document.getElementById('d-cancel');

  let form = null;
  let dirty = false;
  let editingIndex = -1;

  // ---------- Вспомогательные ----------

  function showError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || '';
  }

  function markDirty() {
    dirty = true;
    saveHint.hidden = false;
  }

  function newFieldId() {
    return 'f_' + Math.random().toString(36).slice(2, 10);
  }

  // ---------- Отрисовка ----------

  function renderHeader() {
    const isPublished = form.status === 'published';
    statusEl.textContent = isPublished ? 'Опубликована' : 'Черновик';
    publishBtn.textContent = isPublished ? 'Снять с публикации' : 'Опубликовать';

    const url = location.origin + AdminAPI.publicUrl(form.slug);
    previewLink.href = isPublished ? url : url + '?preview=1';
    previewLink.textContent = isPublished ? 'Открыть как студент' : 'Предпросмотр (черновик)';

    linkEl.textContent = isPublished ? url : 'Появится после публикации';
  }

  function renderFields() {
    fieldsListEl.textContent = '';
    noFieldsEl.hidden = form.fields.length > 0;

    form.fields.forEach((field, index) => {
      const node = fieldTemplate.content.cloneNode(true);

      node.querySelector('.field-row__type').textContent = TYPE_NAMES[field.type] || field.type;

      const labelEl = node.querySelector('.field-row__label');
      labelEl.textContent = field.label;
      if (!field.required) labelEl.classList.add('field-row__label--optional');

      const optionsEl = node.querySelector('.field-row__options');
      if (OPTION_TYPES.includes(field.type)) {
        optionsEl.textContent = 'Варианты: ' + field.options.join(' · ');
      } else if (field.help) {
        optionsEl.textContent = 'Подсказка: ' + field.help;
      }

      const up = node.querySelector('.move-up');
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        const prev = form.fields[index - 1];
        form.fields[index - 1] = field;
        form.fields[index] = prev;
        markDirty();
        renderFields();
      });

      const down = node.querySelector('.move-down');
      down.disabled = index === form.fields.length - 1;
      down.addEventListener('click', () => {
        const next = form.fields[index + 1];
        form.fields[index + 1] = field;
        form.fields[index] = next;
        markDirty();
        renderFields();
      });

      node.querySelector('.edit').addEventListener('click', () => openDialog(index));

      node.querySelector('.delete').addEventListener('click', () => {
        if (!confirm(`Удалить вопрос «${field.label}»?`)) return;
        form.fields.splice(index, 1);
        markDirty();
        renderFields();
      });

      fieldsListEl.appendChild(node);
    });
  }

  // ---------- Диалог редактирования поля ----------

  function openDialog(index) {
    editingIndex = index;
    const field = index === -1
      ? { id: newFieldId(), type: addTypeEl.value, label: '', help: '', required: false, options: [] }
      : form.fields[index];

    document.getElementById('dialog-title').textContent =
      index === -1 ? 'Новый вопрос' : `Вопрос: ${TYPE_NAMES[field.type]}`;

    dLabel.value = field.label;
    dHelp.value = field.help || '';
    dRequired.checked = !!field.required;

    const isOption = OPTION_TYPES.includes(field.type);
    dOptionsWrap.hidden = !isOption;
    dOptions.value = isOption ? field.options.join('\n') : '';
    dOptions.required = isOption;

    dialog.dataset.fieldId = field.id;
    dialog.dataset.fieldType = field.type;
    dialog.showModal();
    dLabel.focus();
  }

  function closeDialog() {
    dialog.close();
    editingIndex = -1;
  }

  function saveDialog() {
    const label = dLabel.value.trim();
    if (!label) {
      dLabel.focus();
      return;
    }

    const type = dialog.dataset.fieldType;
    let options = [];
    if (OPTION_TYPES.includes(type)) {
      options = dOptions.value.split('\n').map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) {
        dOptions.focus();
        return;
      }
    }

    const field = {
      id: dialog.dataset.fieldId,
      type,
      label,
      help: dHelp.value.trim(),
      required: dRequired.checked,
      options
    };

    if (editingIndex === -1) form.fields.push(field);
    else form.fields[editingIndex] = field;

    markDirty();
    closeDialog();
    renderFields();
  }

  // ---------- Загрузка и сохранение ----------

  async function load() {
    const result = await AdminAPI.getForm(formId);
    if (!result.ok) {
      showError(result.error + '. Вернитесь к списку форм.');
      saveBtn.disabled = true;
      publishBtn.disabled = true;
      return;
    }
    form = result.data.form;
    titleEl.value = form.title;
    descEl.value = form.description || '';
    renderHeader();
    renderFields();
  }

  async function save() {
    showError('');
    saveBtn.disabled = true;
    const payload = {
      title: titleEl.value.trim(),
      description: descEl.value.trim(),
      fields: form.fields
    };
    const result = await AdminAPI.saveForm(formId, payload);
    saveBtn.disabled = false;

    if (!result.ok) return showError(result.error);

    form = result.data.form;
    dirty = false;
    saveHint.hidden = true;
    renderHeader();
  }

  publishBtn.addEventListener('click', async () => {
    showError('');
    // Публикуем всегда актуальное состояние, а не то, что лежит в памяти с прошлого раза
    if (dirty) {
      const saved = await save();
      if (errorBox.hidden === false) return;
    }

    publishBtn.disabled = true;
    const method = form.status === 'published' ? 'unpublishForm' : 'publishForm';
    const result = await AdminAPI[method](formId);
    publishBtn.disabled = false;

    if (!result.ok) return showError(result.error);
    form = result.data.form;
    renderHeader();
  });

  saveBtn.addEventListener('click', save);
  addFieldBtn.addEventListener('click', () => openDialog(-1));
  dSave.addEventListener('click', saveDialog);
  dCancel.addEventListener('click', closeDialog);
  titleEl.addEventListener('input', markDirty);
  descEl.addEventListener('input', markDirty);

  // Ctrl/Cmd+S — сохранить
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });

  // Предупреждение при уходе со страницы с несохранёнными изменениями
  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  load();
})();

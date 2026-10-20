'use strict';

const express = require('express');
const path = require('path');

const router = express.Router();

const ADMIN_DIR = path.join(__dirname, '..', '..', 'public', 'admin');

router.get('/admin', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});

router.get('/admin/edit/:id', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'edit.html'));
});

router.get('/admin/responses/:id', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'responses.html'));
});

module.exports = router;

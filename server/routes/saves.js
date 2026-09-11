import express from 'express';
import * as savesService from '../services/savesService.js';

const router = express.Router();

router.get('/saves', async (req, res) => {
  try {
    const saves = await savesService.list(req.user.login);
    res.json({ saves });
  } catch (err) {
    console.error('List saves error:', err.message);
    res.status(500).json({ error: 'Failed to load saved analyses' });
  }
});

router.post('/saves', async (req, res) => {
  try {
    const save = await savesService.create(req.user.login, req.body);
    res.json({ save });
  } catch (err) {
    console.error('Create save error:', err.message);
    res.status(500).json({ error: 'Failed to save analysis' });
  }
});

router.patch('/saves/:id', async (req, res) => {
  try {
    const save = await savesService.update(req.user.login, req.params.id, req.body);
    res.json({ save });
  } catch (err) {
    console.error('Update save error:', err.message);
    res.status(500).json({ error: 'Failed to update saved analysis' });
  }
});

router.delete('/saves/:id', async (req, res) => {
  try {
    await savesService.remove(req.user.login, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete save error:', err.message);
    res.status(500).json({ error: 'Failed to delete saved analysis' });
  }
});

export default router;

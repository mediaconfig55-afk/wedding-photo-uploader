const express = require('express');
const router = express.Router();
const { getFiles } = require('../services/googleDrive');

router.get('/gallery', async (req, res) => {
  try {
    const { folderId } = req.query;

    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Klasör ID eksik.' });
    }

    const files = await getFiles(folderId);

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error(`[Gallery] ❌ Hata: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

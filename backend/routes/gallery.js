const express = require('express');
const router = express.Router();
const axios = require('axios');

const GAS_URL = process.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbykvcr7ZYcC4ysTgAeeyMcls-ZUep_KnDSMJ7HsyvNGyGoHryPTKFZn_kmcKSAbf781/exec';

router.get('/gallery', async (req, res) => {
  try {
    const { folderId } = req.query;

    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Klasör ID eksik.' });
    }

    console.log(`[Gallery Proxy] Dosyalar isteniyor: ${folderId}`);

    const response = await axios.get(`${GAS_URL}?action=getGallery&folderId=${folderId}`, {
      maxRedirects: 5
    });

    res.json({
      success: true,
      data: response.data.success ? response.data.data : []
    });

  } catch (error) {
    console.error(`[Gallery Proxy] ❌ Hata:`, error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

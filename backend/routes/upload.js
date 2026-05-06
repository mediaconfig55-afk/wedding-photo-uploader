const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');

// GAS URL'si
const GAS_URL = process.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbykvcr7ZYcC4ysTgAeeyMcls-ZUep_KnDSMJ7HsyvNGyGoHryPTKFZn_kmcKSAbf781/exec';

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB 
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'Fotoğraf gönderilmedi.' });
    }

    const { folderId, name, comment } = req.body;
    
    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Klasör ID eksik.' });
    }

    console.log(`[Upload Proxy] Yeni dosya alınıyor: ${file.originalname} (${file.size} bytes)`);

    // Base64 kodlamasına çevir
    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    console.log(`[Upload Proxy] Google Apps Script'e yönlendiriliyor...`);

    // Google Apps Script'e yönlendir
    const response = await axios.post(GAS_URL, JSON.stringify({
      file: base64Data,
      filename: file.originalname,
      mimeType: file.mimetype,
      folderId: folderId,
      name: name || 'Anonim Misafir',
      comment: comment || ''
    }), {
      headers: {
        'Content-Type': 'text/plain' // GAS bu raw body'yi sever
      },
      maxRedirects: 5 // 302 yönlendirmelerini otomatik takip et
    });

    if (response.data && response.data.success) {
        console.log(`[Upload Proxy] ✅ Başarılı: ${response.data.fileId}`);
        res.json({
          success: true,
          fileId: response.data.fileId,
          url: response.data.url
        });
    } else {
        throw new Error(response.data.error || 'Bilinmeyen bir hata oluştu');
    }

  } catch (error) {
    console.error(`[Upload Proxy] ❌ Hata:`, error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, error: error.message || 'Yükleme sırasında sunucu hatası.' });
  }
});

module.exports = router;

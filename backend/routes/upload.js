const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile } = require('../services/googleDrive');

// Dosyaları disk yerine doğrudan hafızaya (RAM) yükle
const storage = multer.memoryStorage();

// Boyut limitini 15MB olarak belirledik (çok daha hızlı ve özgür yükleme)
const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } 
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

    console.log(`[Upload] Yeni dosya yükleniyor: ${file.originalname} (${file.size} bytes)`);

    const result = await uploadFile(
      file.buffer, 
      file.originalname, 
      file.mimetype, 
      folderId, 
      name || 'Anonim Misafir', 
      comment || ''
    );

    console.log(`[Upload] ✅ Başarılı: ${result.id}`);
    
    res.json({
      success: true,
      fileId: result.id,
      url: result.webViewLink
    });

  } catch (error) {
    console.error(`[Upload] ❌ Hata: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

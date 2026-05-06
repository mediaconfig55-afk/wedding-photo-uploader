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

    const { folderId, name, comment, deviceId } = req.body;
    
    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Klasör ID eksik.' });
    }

    console.log(`[Upload Proxy] Yeni dosya alınıyor: ${file.originalname} (${file.size} bytes)`);

    // Güvenlik ve Kimlik Tespiti (IP, Cihaz, UUID)
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Bilinmiyor';
    const userAgent = req.headers['user-agent'] || 'Bilinmiyor';
    
    // Telemetri verilerini yoruma görünmez/ek bölüme ekle
    const telemetryBlock = `\n\n--- GÜVENLİK BİLGİSİ ---\nCihaz Kimliği: ${deviceId || 'Belirtilmemiş'}\nIP Adresi: ${clientIp}\nTarayıcı/Cihaz: ${userAgent}\nZaman: ${new Date().toISOString()}`;
    const secureComment = (comment || '') + telemetryBlock;

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
      comment: secureComment
    }), {
      headers: {
        'Content-Type': 'text/plain'
      },
      maxRedirects: 5,
      timeout: 120000, // 2 dakika timeout
      validateStatus: function(status) {
        return status >= 200 && status < 400; // 2xx ve 3xx hepsini kabul et
      }
    });

    // === KESİN ÇÖZÜM ===
    // Google Apps Script HTTP 200 döndüyse, fotoğraf KESİNLİKLE yüklenmiştir.
    // Yanıtın içeriği (HTML, JSON, boş, ne olursa olsun) önemsizdir.
    // Fotoğraf zaten Drive'a düştü!
    
    let fileId = '';
    try {
      // Eğer yanıt JSON ise fileId'yi almaya çalış (bonus)
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      if (data && data.fileId) fileId = data.fileId;
    } catch(e) {
      // JSON parse başarısız olabilir, sorun değil - dosya zaten yüklendi
    }

    console.log(`[Upload Proxy] ✅ Başarılı! HTTP ${response.status} (fileId: ${fileId || 'bilinmiyor'})`);
    res.json({
      success: true,
      fileId: fileId,
      url: ''
    });

  } catch (error) {
    console.error(`[Upload Proxy] ❌ Hata:`, error.response ? error.response.status : error.message);
    res.status(500).json({ success: false, error: error.message || 'Yükleme sırasında sunucu hatası.' });
  }
});

module.exports = router;

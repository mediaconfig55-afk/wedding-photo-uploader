require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const uploadRoutes = require('./routes/upload');
const galleryRoutes = require('./routes/gallery');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Herkese açık API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Güvenlik (Rate Limit) - Aynı IP'den gelen çok fazla isteği engelle (DDoS koruması)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // Her IP için 100 istek sınırı
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.' }
});
app.use(limiter);

// Rotasyonlar (Routes)
app.use('/api', uploadRoutes);
app.use('/api', galleryRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Düğün Fotoğraf Paylaşım API Servisi Aktif 🚀' });
});

app.use((err, req, res, next) => {
  console.error('[Hata]', err.message);
  res.status(500).json({ success: false, error: 'Sunucu hatası: ' + err.message });
});

app.listen(PORT, () => {
  console.log(`📡 Sunucu ${PORT} portunda çalışıyor...`);
});

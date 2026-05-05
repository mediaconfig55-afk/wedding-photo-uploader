# 🎊 Düğün Fotoğraf Paylaşım Sistemi

Düğün organizasyonlarında misafirlerin QR kod okutarak, giriş yapmadan fotoğraf yükleyebildiği, tüm paylaşılan fotoğrafları görebildiği web uygulaması.

## ✨ Özellikler

- 📱 **Evrensel Cihaz Uyumluluğu** — iOS Safari, Chrome, Android, Samsung Internet
- 🔒 **Anonim Kullanım** — Giriş veya hesap gerektirmez
- 📸 **HEIC/HEIF Desteği** — iPhone fotoğrafları otomatik dönüştürülür
- 🗜️ **Otomatik Sıkıştırma** — Büyük fotoğraflar client-side optimize edilir
- ☁️ **Google Drive Depolama** — Fotoğraflar Drive'da güvenle saklanır
- 🌙 **Dark Mode** — Gece düğünleri için karanlık tema
- 🖼️ **Galeri + Lightbox** — Tüm fotoğrafları grid ve tam ekran görüntüleme
- 📊 **Progress Bar** — Yükleme durumu gerçek zamanlı görünür
- 🔄 **Otomatik Retry** — Bağlantı kesilirse 3 kere tekrar dener

---

## 🚀 Kurulum

### 1. Google Cloud Console Hazırlığı

#### 1.1. Proje Oluşturma
1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin
2. Üst menüden **"Select a project"** → **"New Project"** tıklayın
3. Proje adı: `wedding-photo-app` → **Create**

#### 1.2. Google Drive API'yi Aktif Etme
1. Sol menüden **"APIs & Services"** → **"Library"** tıklayın
2. **"Google Drive API"** aratın → seçin → **"Enable"** tıklayın

#### 1.3. Service Account Oluşturma
1. Sol menüden **"APIs & Services"** → **"Credentials"** tıklayın
2. **"Create Credentials"** → **"Service Account"** seçin
3. İsim: `wedding-photo-uploader` → **Create and Continue**
4. Role olarak **"Editor"** seçin → **Done**
5. Oluşan Service Account'a tıklayın → **"Keys"** sekmesi
6. **"Add Key"** → **"Create new key"** → **JSON** → **Create**
7. JSON dosyası otomatik indirilecek — bu dosyayı saklayın!

#### 1.4. Drive Klasörü Hazırlama
1. [Google Drive](https://drive.google.com) adresine gidin
2. Yeni bir klasör oluşturun (örn: "Ayşe & Mehmet Düğün Fotoğrafları")
3. Klasörün URL'sinden **ID'yi** kopyalayın:
   ```
   https://drive.google.com/drive/folders/BURASI_KLASOR_ID
   ```
4. Klasöre sağ tıklayın → **"Paylaş"**
5. Service Account e-posta adresini ekleyin (JSON dosyasındaki `client_email`)
6. **"Düzenleyici"** rolü verin

---

### 2. Proje Kurulumu

```bash
# Projeyi klonlayın veya klasöre gidin
cd wedding-photo-app

# Backend bağımlılıklarını yükleyin
cd backend
npm install

# QR kod bağımlılığını yükleyin
npm install qrcode
```

### 3. Ortam Değişkenlerini Ayarlama

```bash
# .env.example dosyasını kopyalayın
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```env
# JSON key dosyasının İÇERİĞİNİ tek satır olarak yapıştırın
# VEYA dosya yolunu yazın: ./service-account-key.json
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Drive klasörünün ID'si
GOOGLE_DRIVE_FOLDER_ID=1abc123def456ghi789

# Düğün bilgileri
WEDDING_NAME=Ayşe & Mehmet
WEDDING_DATE=2026-06-15

# Uygulama URL'si (deploy sonrası güncelleyin)
APP_URL=https://your-app.onrender.com

# Sunucu portu
PORT=3000
```

### 4. Uygulamayı Başlatma

```bash
cd backend
npm start
```

Tarayıcıda açın: `http://localhost:3000`

### 5. QR Kod Oluşturma

```bash
cd backend
npm run qr
```

`qr-generator/output/` klasöründe 3 dosya oluşur:
- `dugün-qr-kod.png` — PNG format
- `dugün-qr-kod.svg` — SVG format (düğün adı ile)
- `dugün-qr-kod-yazdir.html` — Yazdırılabilir sayfa

---

## 📱 Test Etme

### iOS Safari'de Test
1. iPhone ve bilgisayar aynı Wi-Fi ağında olmalı
2. Bilgisayarın **yerel IP adresini** öğrenin: `ipconfig` (Windows)
3. iPhone Safari'de: `http://192.168.X.X:3000` adresine gidin
4. **"Galeriden Seç"** butonunu test edin → Fotoğraf Kütüphanesi açılmalı
5. **"Fotoğraf Çek"** butonunu test edin → Kamera açılmalı
6. HEIC formatlı fotoğraf yükleyin → Otomatik JPEG'e dönüşmeli

> ⚠️ **Not:** HTTPS olmadan kamera izni çalışmaz. Yerel test için `http` yeterlidir, ama QR kodla erişimde `https` şarttır.

### Android Chrome'da Test
1. Aynı Wi-Fi ağından `http://192.168.X.X:3000` adresine gidin
2. Galeri ve kamera butonlarını test edin
3. Farklı boyut/formatlarda fotoğraflar yükleyin

---

## 🌐 Deploy (Ücretsiz)

### Render.com ile Deploy

1. [Render.com](https://render.com) hesabı oluşturun
2. GitHub'a projeyi push edin
3. **"New Web Service"** tıklayın → Repo'yu seçin
4. Ayarlar:
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Root Directory:** boş bırakın
5. Environment Variables bölümüne `.env` değerlerini ekleyin
6. **Deploy** tıklayın

Deploy sonrası `.env`'deki `APP_URL` değerini Render URL'si ile güncelleyip QR kodları yeniden oluşturun.

---

## 📁 Proje Yapısı

```
wedding-photo-app/
├── backend/
│   ├── server.js              # Express sunucu
│   ├── package.json           # Bağımlılıklar
│   ├── .env.example           # Ortam değişkenleri şablonu
│   ├── routes/
│   │   ├── upload.js          # POST /upload
│   │   └── photos.js          # GET /photos
│   ├── services/
│   │   └── googleDrive.js     # Google Drive API
│   └── middleware/
│       └── rateLimiter.js     # Rate limiting
├── frontend/
│   ├── index.html             # Ana sayfa
│   ├── style.css              # Düğün temalı CSS
│   └── app.js                 # Frontend mantığı
├── qr-generator/
│   └── generateQR.js          # QR kod üretici
└── README.md
```

## 🖨️ QR Kod Yazdırma Önerileri

- **Minimum boyut:** 5×5 cm (telefonlar rahat okumalı)
- **Önerilen boyut:** 8×8 cm
- **Kağıt:** Kalın mat kağıt (parlak kağıt yansıma yapar)
- **Konum:** Masalara, giriş kapısına, kokteyl alanına
- **Miktar:** Her 2-3 masaya 1 adet
- `dugün-qr-kod-yazdir.html` dosyasını tarayıcıda açıp Ctrl+P ile yazdırın

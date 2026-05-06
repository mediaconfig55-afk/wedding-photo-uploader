/**
 * Düğün Fotoğraf Paylaşım Sistemi — Frontend JavaScript
 * 
 * Özellikler:
 * - HEIC/HEIF → JPEG dönüşümü (heic2any)
 * - Client-side image compression (browser-image-compression)
 * - XHR ile upload + progress bar
 * - Retry mekanizması (3 deneme)
 * - Galeri yükleme + lazy loading
 * - Lightbox (tam ekran fotoğraf görüntüleme)
 * - Dark mode toggle + prefers-color-scheme algılama
 */

(function () {
  'use strict';

  // Render.com backend URL'niz:
  const API_BASE = 'https://wedding-photo-uploader-t6wg.onrender.com/api';

  // ============================================
  // URL PARAMETRELERİ (Çoklu Düğün Desteği)
  // ============================================
  const urlParams = new URLSearchParams(window.location.search);
  const URL_CONFIG = {
    isim: urlParams.get('isim') || 'Düğün Fotoğraf Sistemi',
    tarih: urlParams.get('tarih') || '',
    klasor: urlParams.get('klasor') || ''
  };

  // ============================================
  // YAPILANDIRMA
  // ============================================
  const CONFIG = {
    maxFileSize: 15 * 1024 * 1024,        // 15MB ham dosya limiti
    compressionMaxSizeMB: 5,              // Sıkıştırma sonrası max 5MB (Node.js güçlü)
    compressionMaxWidthOrHeight: 1920,    // Sıkıştırma sonrası max 1920px
    maxRetries: 3,                        // Başarısız yüklemede tekrar deneme
    retryDelay: 2000,                     // Tekrar deneme arası bekleme (ms)
    galleryRefreshInterval: 30000,        // Galeriyi yenileme süresi (30sn)
    uploadTimeout: 120000                 // Yükleme zaman aşımı (120sn)
  };

  // ============================================
  // DOM ELEMANLARI
  // ============================================
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const DOM = {
    // Dark mode
    darkModeToggle: $('#darkModeToggle'),
    toggleIcon: $('.toggle-icon'),

    // Header
    weddingTitle: $('#weddingTitle'),
    weddingDate: $('#weddingDate'),

    // Fotoğraf seçim butonları
    btnGallery: $('#btnGallery'),
    btnCamera: $('#btnCamera'),
    fileGallery: $('#fileGallery'),
    fileCamera: $('#fileCamera'),

    // Önizleme
    previewContainer: $('#previewContainer'),
    previewImage: $('#previewImage'),
    previewInfo: $('#previewInfo'),
    btnRemovePhoto: $('#btnRemovePhoto'),

    // Form
    formFields: $('#formFields'),
    guestName: $('#guestName'),
    guestComment: $('#guestComment'),
    charCount: $('#charCount'),
    btnUpload: $('#btnUpload'),

    // Progress
    progressContainer: $('#progressContainer'),
    progressText: $('#progressText'),
    progressPercent: $('#progressPercent'),
    progressFill: $('#progressFill'),
    progressDetail: $('#progressDetail'),

    // Başarı & Hata
    successMessage: $('#successMessage'),
    btnNewPhoto: $('#btnNewPhoto'),
    confettiContainer: $('#confettiContainer'),
    errorMessage: $('#errorMessage'),
    errorText: $('#errorText'),
    btnRetry: $('#btnRetry'),

    // Galeri
    galleryGrid: $('#galleryGrid'),
    emptyGallery: $('#emptyGallery'),
    galleryLoading: $('#galleryLoading'),
    photoCount: $('#photoCount'),

    // Lightbox
    lightboxModal: $('#lightboxModal'),
    lightboxOverlay: $('#lightboxOverlay'),
    lightboxImage: $('#lightboxImage'),
    lightboxClose: $('#lightboxClose'),
    lightboxPrev: $('#lightboxPrev'),
    lightboxNext: $('#lightboxNext'),
    lightboxName: $('#lightboxName'),
    lightboxComment: $('#lightboxComment'),
    lightboxTime: $('#lightboxTime')
  };

  // ============================================
  // DURUM YÖNETİMİ (STATE)
  // ============================================
  let state = {
    selectedFiles: [],           // Seçilen dosyalar (File nesneleri)
    processedFiles: [],          // İşlenmiş dosyalar (sıkıştırma sonrası)
    isUploading: false,          // Yükleme devam ediyor mu
    photos: [],                  // Galeri fotoğrafları
    currentLightboxIndex: -1,    // Lightbox'taki mevcut fotoğraf indeksi
    galleryTimer: null           // Galeri yenileme zamanlayıcısı
  };

  // ============================================
  // UYGULAMA BAŞLATMA
  // ============================================

  /** Uygulamayı başlat */
  function init() {
    loadWeddingConfig();
    initDarkMode();
    bindEvents();
    loadGallery();
    restoreGuestName();
  }

  /** Cihaz ID oluştur veya al (Telemetri için) */
  function getDeviceId() {
    var id = localStorage.getItem('wedding-device-id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
      localStorage.setItem('wedding-device-id', id);
    }
    return id;
  }

  /** Düğün bilgilerini URL parametrelerinden al */
  function loadWeddingConfig() {
    if (!URL_CONFIG.klasor) {
      showError('Hata: URL içerisinde klasör ID bulunamadı. Lütfen size verilen tam QR kodu okutun.');
      DOM.btnGallery.parentElement.style.display = 'none';
    }

    if (URL_CONFIG.isim) {
      DOM.weddingTitle.textContent = URL_CONFIG.isim.replace(/-/g, ' ');
      document.title = URL_CONFIG.isim.replace(/-/g, ' ') + ' — Fotoğraf Paylaşımı';
    }
    
    if (URL_CONFIG.tarih) {
      DOM.weddingDate.textContent = formatWeddingDate(URL_CONFIG.tarih);
    }
  }

  /** Düğün tarihini güzel formata çevir */
  function formatWeddingDate(dateStr) {
    try {
      var parts = dateStr.split('-');
      var months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      var day = parseInt(parts[2], 10);
      var monthIndex = parseInt(parts[1], 10) - 1;
      var year = parts[0];
      return day + ' ' + months[monthIndex] + ' ' + year;
    } catch (e) {
      return dateStr;
    }
  }

  // ============================================
  // DARK MODE
  // ============================================

  /** Dark mode başlangıç durumunu ayarla */
  function initDarkMode() {
    var saved = localStorage.getItem('wedding-dark-mode');
    if (saved === 'true') {
      enableDarkMode();
    } else if (saved === null && window.matchMedia) {
      // Sistem tercihini kontrol et
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        enableDarkMode();
      }
    }
  }

  /** Dark mode'u aç */
  function enableDarkMode() {
    document.documentElement.setAttribute('data-theme', 'dark');
    DOM.toggleIcon.textContent = '☀️';
    localStorage.setItem('wedding-dark-mode', 'true');
  }

  /** Dark mode'u kapat */
  function disableDarkMode() {
    document.documentElement.removeAttribute('data-theme');
    DOM.toggleIcon.textContent = '🌙';
    localStorage.setItem('wedding-dark-mode', 'false');
  }

  /** Dark mode geçiş */
  function toggleDarkMode() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      disableDarkMode();
    } else {
      enableDarkMode();
    }
  }

  // ============================================
  // EVENT BINDING
  // ============================================

  /** Tüm event listener'ları bağla */
  function bindEvents() {
    // Dark mode
    DOM.darkModeToggle.addEventListener('click', toggleDarkMode);

    // Fotoğraf seçim butonları
    DOM.btnGallery.addEventListener('click', function () {
      DOM.fileGallery.click();
    });
    DOM.btnCamera.addEventListener('click', function () {
      DOM.fileCamera.click();
    });

    // Dosya seçildiğinde
    DOM.fileGallery.addEventListener('change', handleFileSelect);
    DOM.fileCamera.addEventListener('change', handleFileSelect);

    // Fotoğrafı kaldır
    DOM.btnRemovePhoto.addEventListener('click', clearSelection);

    // Karakter sayacı
    DOM.guestComment.addEventListener('input', updateCharCount);

    // Yükleme butonu
    DOM.btnUpload.addEventListener('click', handleUpload);

    // Yeni fotoğraf butonu
    DOM.btnNewPhoto.addEventListener('click', resetUploadForm);

    // Tekrar dene butonu
    DOM.btnRetry.addEventListener('click', handleUpload);

    // Lightbox
    DOM.lightboxClose.addEventListener('click', closeLightbox);
    DOM.lightboxOverlay.addEventListener('click', closeLightbox);
    DOM.lightboxPrev.addEventListener('click', function () { navigateLightbox(-1); });
    DOM.lightboxNext.addEventListener('click', function () { navigateLightbox(1); });

    // Klavye navigasyonu
    document.addEventListener('keydown', function (e) {
      if (DOM.lightboxModal.style.display !== 'none') {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
      }
    });

    // İsim kaydetme
    DOM.guestName.addEventListener('blur', function () {
      localStorage.setItem('wedding-guest-name', DOM.guestName.value);
    });
  }

  /** Kaydedilmiş misafir ismini geri yükle */
  function restoreGuestName() {
    var saved = localStorage.getItem('wedding-guest-name');
    if (saved) {
      DOM.guestName.value = saved;
    }
  }

  // ============================================
  // FOTOĞRAF SEÇİMİ VE İŞLEME
  // ============================================

  /** Dosyalar seçildiğinde çalışır (Çoklu Seçim Desteği) */
  async function handleFileSelect(e) {
    if (!e.target.files || e.target.files.length === 0) return;

    var validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    
    state.selectedFiles = [];
    state.processedFiles = [];
    
    hideError();
    DOM.previewInfo.textContent = 'Fotoğraflar işleniyor...';
    showPreviewLoading();

    var totalBytes = 0;

    for (var i = 0; i < e.target.files.length; i++) {
        var file = e.target.files[i];
        
        if (file.size > CONFIG.maxFileSize) {
          showError(file.name + ' çok büyük (' + formatFileSize(file.size) + '). Maksimum 15MB yüklenebilir.');
          continue;
        }

        var ext = file.name.split('.').pop().toLowerCase();
        var isValidExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].indexOf(ext) > -1;

        if (validTypes.indexOf(file.type) === -1 && !isValidExt) {
          showError(file.name + ' desteklenmeyen bir formatta.');
          continue;
        }

        state.selectedFiles.push(file);

        var processedFile = file;
        var isHEIC = (file.type === 'image/heic' || file.type === 'image/heif' || ext === 'heic' || ext === 'heif');

        if (isHEIC) {
          try {
            processedFile = await convertHEIC(file);
          } catch (err) {
            console.error('HEIC hatası:', err);
            continue;
          }
        }

        try {
          processedFile = await compressImage(processedFile);
        } catch (err) {}

        state.processedFiles.push(processedFile);
        totalBytes += processedFile.size;
    }
    
    if (state.processedFiles.length === 0) {
        clearSelection();
        return;
    }

    // İlk fotoğrafı önizlemede göster
    showPreview(state.processedFiles[0]);
    
    if (state.processedFiles.length > 1) {
        DOM.previewInfo.textContent = state.processedFiles.length + ' fotoğraf seçildi (' + formatFileSize(totalBytes) + ')';
    }

    DOM.formFields.style.display = 'block';
    e.target.value = '';
  }

  /** HEIC/HEIF formatını JPEG'e dönüştür */
  async function convertHEIC(file) {
    if (typeof heic2any === 'undefined') {
      throw new Error('HEIC dönüştürücü yüklenemedi');
    }

    var result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9
    });

    // heic2any bazen array döndürebilir
    var blob = Array.isArray(result) ? result[0] : result;
    var newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');

    return new File([blob], newName, { type: 'image/jpeg' });
  }

  /** Fotoğrafı client-side sıkıştır */
  async function compressImage(file) {
    if (typeof imageCompression === 'undefined') {
      console.warn('browser-image-compression yüklenemedi, sıkıştırma atlanıyor');
      return file;
    }

    var options = {
      maxSizeMB: CONFIG.compressionMaxSizeMB,
      maxWidthOrHeight: CONFIG.compressionMaxWidthOrHeight,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };

    var compressed = await imageCompression(file, options);
    console.log('Sıkıştırma: ' + formatFileSize(file.size) + ' → ' + formatFileSize(compressed.size));
    return compressed;
  }

  /** Fotoğraf önizlemesini göster */
  function showPreview(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      DOM.previewImage.src = e.target.result;
      DOM.previewContainer.style.display = 'block';
      DOM.previewInfo.textContent = formatFileSize(file.size);
    };
    reader.onerror = function () {
      showError('Fotoğraf önizlemesi oluşturulamadı. Lütfen başka bir fotoğraf deneyin.');
    };
    reader.readAsDataURL(file);
  }

  /** Önizleme yüklenirken göster */
  function showPreviewLoading() {
    DOM.previewContainer.style.display = 'block';
    DOM.previewImage.src = '';
  }

  /** Seçimi temizle */
  function clearSelection() {
    state.selectedFiles = [];
    state.processedFiles = [];
    DOM.previewContainer.style.display = 'none';
    DOM.formFields.style.display = 'none';
    DOM.previewImage.src = '';
    DOM.fileGallery.value = '';
    DOM.fileCamera.value = '';
  }

  // ============================================
  // FOTOĞRAF YÜKLEME
  // ============================================

  /** Yükleme işlemini sıralı başlat (Retry yok - Tek seferlik, Sıralı Yükleme) */
  async function handleUpload() {
    if (state.processedFiles.length === 0) {
      showError('Lütfen önce bir fotoğraf seçin.');
      return;
    }

    if (state.isUploading) return;
    state.isUploading = true;

    hideError();
    DOM.btnUpload.disabled = true;
    showProgress();

    var successCount = 0;
    var failCount = 0;
    var totalFiles = state.processedFiles.length;

    for (var i = 0; i < totalFiles; i++) {
        var file = state.processedFiles[i];
        var prefix = totalFiles > 1 ? '(' + (i+1) + '/' + totalFiles + ') ' : '';
        
        try {
            updateProgress(0, prefix + 'Sunucu ile bağlantı kuruluyor...');
            var res = await uploadWithXHR(file, prefix);
            successCount++;
            
            // Yerel Galeriye Ekle (Sadece kendisi görecek)
            var myPhotos = JSON.parse(localStorage.getItem('wedding-my-uploads') || '[]');
            var newPhoto = {
                id: res.response.fileId || '',
                thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + (res.response.fileId || '') + '&sz=w500',
                fullUrl: 'https://drive.google.com/thumbnail?id=' + (res.response.fileId || '') + '&sz=w1920',
                guestName: DOM.guestName.value.trim() || 'Anonim Misafir',
                createdTime: new Date().toISOString()
            };
            if (newPhoto.id) {
                myPhotos.unshift(newPhoto); // En yeni üste
                localStorage.setItem('wedding-my-uploads', JSON.stringify(myPhotos));
            }

        } catch (err) {
            console.error('Yükleme hatası:', err.message);
            failCount++;
        }
    }

    state.isUploading = false;
    DOM.btnUpload.disabled = false;

    if (successCount > 0) {
        hideProgress();
        showSuccess();
        
        var messageP = DOM.successMessage.querySelector('p');
        if (failCount > 0) {
           messageP.textContent = successCount + ' fotoğraf yüklendi, ancak ' + failCount + ' tanesinde hata oluştu.';
        } else if (successCount > 1) {
           messageP.textContent = successCount + ' fotoğraf başarıyla yüklendi.';
        } else {
           messageP.textContent = 'Fotoğrafınız başarıyla yüklendi.';
        }
        
        loadGallery(); // Galeriyi yenile
    } else {
        hideProgress();
        showError('Hiçbir fotoğraf yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    }
  }

  /**
   * Yükleme Fonksiyonu — Node.js Backend (XMLHttpRequest + FormData)
   * 
   * Avantajları:
   * - Gerçek zamanlı ve kesin % ilerleme çubuğu (progress event)
   * - Orijinal dosya gönderimi (base64 dönüşümü yok, form şişmesi yok)
   * - Sıfır CORS ve Iframe sorunu (Node.js üzerinden temiz)
   */
  function uploadWithXHR(file, statusPrefix) {
    statusPrefix = statusPrefix || '';
    return new Promise(function (resolve, reject) {
      if (!URL_CONFIG.klasor) {
        reject(new Error('URL içerisinde klasör ID bulunamadı.'));
        return;
      }

      console.log('[Upload] Node.js Backend Upload başlatıldı...');
      updateProgress(0, statusPrefix + 'Sunucu ile bağlantı kuruluyor...');

      var formData = new FormData();
      formData.append('file', file, file.name || 'image.jpg');
      formData.append('folderId', URL_CONFIG.klasor);
      formData.append('name', DOM.guestName.value.trim() || 'Anonim Misafir');
      formData.append('comment', DOM.guestComment.value.trim());
      formData.append('deviceId', getDeviceId());

      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/upload', true);
      xhr.timeout = CONFIG.uploadTimeout;

      // Gerçek zamanlı Upload Progress eventi
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          // Gerçek yüzdelik dilim hesaplama
          var percentComplete = Math.floor((e.loaded / e.total) * 100);
          if (percentComplete > 98) percentComplete = 98;
          updateProgress(percentComplete, statusPrefix + 'Yükleniyor: ' + formatFileSize(e.loaded) + ' / ' + formatFileSize(e.total));
        }
      };

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var response = JSON.parse(xhr.responseText);
            if (response.success) {
              updateProgress(100, 'Tamamlandı!');
              console.log('[Upload] ✅ Başarılı:', response.fileId);
              // Küçük gecikme UI tecrübesini iyileştirir
              setTimeout(function() { resolve({ success: true, response: response }); }, 300);
            } else {
              reject(new Error(response.error || 'Sunucu işlemi tamamlayamadı.'));
            }
          } catch(err) {
            reject(new Error('Sunucu yanıtı okunamadı.'));
          }
        } else {
          try {
            var errResp = JSON.parse(xhr.responseText);
            reject(new Error(errResp.error || ('Sunucu hatası: ' + xhr.status)));
          } catch(err) {
            reject(new Error('Sunucu hatası: ' + xhr.status));
          }
        }
      };

      xhr.onerror = function() {
        reject(new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.'));
      };

      xhr.ontimeout = function() {
        reject(new Error('Yükleme zaman aşımına uğradı. Dosya boyutu çok büyük olabilir veya internetiniz yavaş.'));
      };

      xhr.send(formData);
    });
  }



  // ============================================
  // UI YARDIMCI FONKSİYONLARI
  // ============================================

  /** Progress bar'ı göster */
  function showProgress() {
    DOM.progressContainer.style.display = 'block';
    DOM.previewContainer.style.display = 'none';
    DOM.formFields.style.display = 'none';
    updateProgress(0, 'Başlatılıyor...');
  }

  /** Progress bar'ı güncelle */
  function updateProgress(percent, detail) {
    DOM.progressFill.style.width = percent + '%';
    DOM.progressPercent.textContent = percent + '%';

    if (percent < 30) {
      DOM.progressText.textContent = 'Fotoğraf yükleniyor...';
    } else if (percent < 70) {
      DOM.progressText.textContent = 'Sunucuya aktarılıyor...';
    } else if (percent < 100) {
      DOM.progressText.textContent = 'Neredeyse tamam...';
    } else {
      DOM.progressText.textContent = 'İşleniyor...';
    }

    if (detail) {
      DOM.progressDetail.textContent = detail;
    }
  }

  /** Progress bar'ı gizle */
  function hideProgress() {
    DOM.progressContainer.style.display = 'none';
  }

  /** Başarı mesajını göster */
  function showSuccess() {
    DOM.successMessage.style.display = 'block';
    DOM.progressContainer.style.display = 'none';
    DOM.previewContainer.style.display = 'none';
    DOM.formFields.style.display = 'none';

    // Butonları gizle
    DOM.btnGallery.parentElement.style.display = 'none';

    // Confetti animasyonu
    createConfetti();
  }

  /** Confetti oluştur */
  function createConfetti() {
    DOM.confettiContainer.innerHTML = '';
    var colors = ['#c9a84c', '#e8d48b', '#f5edd6', '#fce4ec', '#ffffff', '#d4af37'];

    for (var i = 0; i < 30; i++) {
      var confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 2 + 's';
      confetti.style.animationDuration = 2 + Math.random() * 2 + 's';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      confetti.style.width = 6 + Math.random() * 8 + 'px';
      confetti.style.height = 6 + Math.random() * 8 + 'px';
      DOM.confettiContainer.appendChild(confetti);
    }
  }

  /** Upload formunu sıfırla — yeni fotoğraf yükleme */
  function resetUploadForm() {
    state.selectedFile = null;
    state.processedFile = null;

    DOM.successMessage.style.display = 'none';
    DOM.errorMessage.style.display = 'none';
    DOM.previewContainer.style.display = 'none';
    DOM.formFields.style.display = 'none';
    DOM.progressContainer.style.display = 'none';

    // Butonları tekrar göster
    DOM.btnGallery.parentElement.style.display = 'grid';

    // Yorum alanını temizle (isim kalır)
    DOM.guestComment.value = '';
    DOM.charCount.textContent = '0/300';

    // File input'ları sıfırla
    DOM.fileGallery.value = '';
    DOM.fileCamera.value = '';

    // Sayfayı yukarı kaydır
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Hata mesajını göster */
  function showError(message) {
    DOM.errorText.textContent = message;
    DOM.errorMessage.style.display = 'block';
  }

  /** Hata mesajını gizle */
  function hideError() {
    DOM.errorMessage.style.display = 'none';
  }

  /** Karakter sayacını güncelle */
  function updateCharCount() {
    var count = DOM.guestComment.value.length;
    DOM.charCount.textContent = count + '/300';
  }

  // ============================================
  // GALERİ
  // ============================================

  /** Galeriyi yükle — Sadece Cihazdaki Yerel Fotoğrafları Yükler (Kişisel Galeri) */
  function loadGallery() {
    if (!URL_CONFIG.klasor) return;
    
    var myPhotos = JSON.parse(localStorage.getItem('wedding-my-uploads') || '[]');
    state.photos = myPhotos;
    
    // Küçük bir gecikme ile göster, UI tepkiseli olsun
    setTimeout(function() {
      renderGallery(myPhotos);
      console.log('[Gallery] ✅ Yerel cihazdan', myPhotos.length, 'fotoğraf yüklendi');
    }, 200);
  }

  /** Galeriyi render et */
  function renderGallery(photos) {
    DOM.galleryLoading.style.display = 'none';

    if (!photos || photos.length === 0) {
      DOM.emptyGallery.style.display = 'block';
      DOM.galleryGrid.innerHTML = '';
      DOM.photoCount.textContent = 'Henüz fotoğraf yüklenmemiş';
      return;
    }

    DOM.emptyGallery.style.display = 'none';
    DOM.photoCount.textContent = photos.length + ' fotoğraf paylaşıldı';

    var html = '';
    for (var i = 0; i < photos.length; i++) {
      var photo = photos[i];
      html += createGalleryCard(photo, i);
    }
    DOM.galleryGrid.innerHTML = html;

    // Lazy loading uygula
    initLazyLoading();
  }

  /** Galeri kartı HTML'i oluştur */
  function createGalleryCard(photo, index) {
    var name = escapeHTML(photo.guestName || 'Anonim');
    return (
      '<div class="gallery-card" data-index="' + index + '" onclick="window._openLightbox(' + index + ')">' +
        '<img data-src="' + photo.thumbnailUrl + '" alt="' + name + ' tarafından paylaşılan fotoğraf" loading="lazy">' +
        '<div class="gallery-card-info">' +
          '<div class="gallery-card-name">' + name + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /** Lazy loading — IntersectionObserver ile görüntüleri yükle */
  function initLazyLoading() {
    var images = DOM.galleryGrid.querySelectorAll('img[data-src]');

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
            observer.unobserve(img);

            // Yükleme hatası durumunda placeholder göster
            img.onerror = function () {
              img.src = '';
              img.parentElement.innerHTML = '<div class="img-placeholder">📷</div>';
            };
          }
        });
      }, { rootMargin: '200px' });

      images.forEach(function (img) { observer.observe(img); });
    } else {
      // IntersectionObserver desteklenmeyen tarayıcılar için fallback
      images.forEach(function (img) {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
    }
  }

  /** Galeri otomatik yenileme (Yerel galeride iptal edildi) */
  function startGalleryAutoRefresh() {
    // İptal edildi çünkü herkes sadece kendi yüklediğini görüyor (Refresh'e gerek yok)
  }

  // ============================================
  // LIGHTBOX
  // ============================================

  /** Lightbox'ı aç */
  function openLightbox(index) {
    if (!state.photos[index]) return;

    state.currentLightboxIndex = index;
    var photo = state.photos[index];

    DOM.lightboxImage.src = photo.fullUrl;
    DOM.lightboxName.textContent = photo.guestName || 'Anonim Misafir';
    DOM.lightboxComment.textContent = photo.comment || '';
    DOM.lightboxTime.textContent = formatDate(photo.uploadTime || photo.createdTime);

    DOM.lightboxModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Navigasyon butonlarının görünürlüğü
    DOM.lightboxPrev.style.display = index > 0 ? 'flex' : 'none';
    DOM.lightboxNext.style.display = index < state.photos.length - 1 ? 'flex' : 'none';
  }

  /** Lightbox'ı kapat */
  function closeLightbox() {
    DOM.lightboxModal.style.display = 'none';
    document.body.style.overflow = '';
    state.currentLightboxIndex = -1;
  }

  /** Lightbox navigasyonu */
  function navigateLightbox(direction) {
    var newIndex = state.currentLightboxIndex + direction;
    if (newIndex >= 0 && newIndex < state.photos.length) {
      openLightbox(newIndex);
    }
  }

  // Global erişim — HTML onclick için
  window._openLightbox = openLightbox;

  // ============================================
  // YARDIMCI FONKSİYONLAR
  // ============================================

  /** Dosya boyutunu okunabilir formata çevir */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  /** Tarih formatla */
  function formatDate(dateStr) {
    try {
      var date = new Date(dateStr);
      var months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      return date.getDate() + ' ' + months[date.getMonth()] + ' ' +
        date.getHours().toString().padStart(2, '0') + ':' +
        date.getMinutes().toString().padStart(2, '0');
    } catch (e) {
      return '';
    }
  }

  /** HTML escape — XSS koruması */
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Bekleme fonksiyonu */
  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // ============================================
  // BAŞLAT
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

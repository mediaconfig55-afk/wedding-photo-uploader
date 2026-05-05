/**
 * QR Kod Oluşturucu
 * Düğün uygulamasının URL'si için QR kod üretir.
 * PNG ve SVG formatlarında çıktı verir.
 * 
 * Kullanım: node generateQR.js
 * veya backend klasöründen: npm run qr
 */

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// ============================================
// YAPILANDIRMA
// ============================================
const BASE_APP_URL = 'https://mediaconfig55-afk.github.io/wedding-photo-uploader/';
const OUTPUT_DIR = path.join(__dirname, 'output');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/** Ana fonksiyon — QR kodları oluştur */
async function generateQRCodes() {
  console.log('');
  console.log('🎊 ============================================');
  console.log('   Yeni Düğün QR Kod Oluşturucu');
  console.log('🎊 ============================================');
  console.log('Her yeni düğün veya çift için buradan QR oluşturabilirsiniz.');
  console.log('');

  const WEDDING_NAME = await question('1. Çiftlerin İsimleri (Örn: Ayşe & Mehmet): ');
  const WEDDING_DATE = await question('2. Düğün Tarihi (İsteğe bağlı, Örn: 15 Haziran 2026): ');
  const FOLDER_ID = await question('3. Google Drive Klasör ID\'si (Zorunlu! Klasör URLsindeki ID): ');

  if (!FOLDER_ID || !WEDDING_NAME) {
    console.log('❌ Hata: İsim ve Klasör ID alanları zorunludur!');
    rl.close();
    process.exit(1);
  }

  // URL'yi dinamik olarak oluştur
  const params = new URLSearchParams({
    isim: WEDDING_NAME.replace(/ /g, '-'),
    tarih: WEDDING_DATE,
    klasor: FOLDER_ID
  });
  const APP_URL = `${BASE_APP_URL}?${params.toString()}`;

  rl.close();

  console.log('');
  console.log('🔗 Üretilen URL:', APP_URL);
  console.log('');

  // Çıktı klasörünü oluştur
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // QR kod seçenekleri
  const qrOptions = {
    errorCorrectionLevel: 'H', // Yüksek hata düzeltme seviyesi
    margin: 2,
    width: 600,                // Yüksek çözünürlük (yazdırma için)
    color: {
      dark: '#1a1a2e',        // QR kod rengi (koyu lacivert)
      light: '#ffffff'         // Arka plan rengi
    }
  };

  try {
    // 1. PNG formatında QR kod
    const pngPath = path.join(OUTPUT_DIR, 'dugün-qr-kod.png');
    await QRCode.toFile(pngPath, APP_URL, {
      ...qrOptions,
      type: 'png'
    });
    console.log('✅ PNG QR kod oluşturuldu:', pngPath);

    // 2. SVG formatında QR kod
    const svgPath = path.join(OUTPUT_DIR, 'dugün-qr-kod.svg');
    const svgString = await QRCode.toString(APP_URL, {
      ...qrOptions,
      type: 'svg'
    });

    // SVG'ye düğün bilgilerini ekle
    const svgWithText = addTextToSVG(svgString, WEDDING_NAME, WEDDING_DATE);
    fs.writeFileSync(svgPath, svgWithText, 'utf8');
    console.log('✅ SVG QR kod oluşturuldu:', svgPath);

    // 3. Yazdırılabilir HTML sayfası (QR + düğün bilgileri)
    const htmlPath = path.join(OUTPUT_DIR, 'dugün-qr-kod-yazdir.html');
    const htmlContent = createPrintableHTML(APP_URL, WEDDING_NAME, WEDDING_DATE, svgString);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log('✅ Yazdırılabilir HTML oluşturuldu:', htmlPath);

    // 4. Terminal'de QR kodu göster
    console.log('');
    console.log('📱 QR Kod (terminal):');
    const terminalQR = await QRCode.toString(APP_URL, {
      type: 'terminal',
      small: true
    });
    console.log(terminalQR);

    console.log('🎊 ============================================');
    console.log('   Tüm QR kodlar "qr-generator/output" klasöründe!');
    console.log('');
    console.log('   📋 Yazdırma ipuçları:');
    console.log('   • dugün-qr-kod-yazdir.html dosyasını tarayıcıda açın');
    console.log('   • Ctrl+P veya Cmd+P ile yazdırın');
    console.log('   • Kalın kağıda yazdırmanız önerilir');
    console.log('   • Minimum 5x5cm boyutunda olmalıdır');
    console.log('🎊 ============================================');
    console.log('');

  } catch (error) {
    console.error('❌ QR kod oluşturma hatası:', error.message);
    process.exit(1);
  }
}

/** SVG'ye düğün adı ve tarihi ekle */
function addTextToSVG(svg, name, date) {
  // SVG kapanış tag'ini bul ve metin ekle
  var textElements = '';
  textElements += '<text x="50%" y="98%" text-anchor="middle" ';
  textElements += 'font-family="Georgia, serif" font-size="18" fill="#1a1a2e" font-weight="bold">';
  textElements += escapeXML(name);
  textElements += '</text>';

  if (date) {
    textElements += '<text x="50%" y="102%" text-anchor="middle" ';
    textElements += 'font-family="Georgia, serif" font-size="14" fill="#5a5a5a">';
    textElements += escapeXML(date);
    textElements += '</text>';
  }

  // SVG viewBox'u genişlet ve metinleri ekle
  svg = svg.replace('</svg>', textElements + '</svg>');

  // viewBox yüksekliğini artır (metin için yer aç)
  svg = svg.replace(/viewBox="([^"]*)"/, function (match, viewBox) {
    var parts = viewBox.split(' ');
    if (parts.length === 4) {
      parts[3] = String(parseInt(parts[3]) + 40);
      return 'viewBox="' + parts.join(' ') + '"';
    }
    return match;
  });

  return svg;
}

/** Yazdırılabilir HTML sayfası oluştur */
function createPrintableHTML(url, name, date, svgContent) {
  return '<!DOCTYPE html>\n' +
    '<html lang="tr">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <title>' + escapeHTML(name) + ' — QR Kod</title>\n' +
    '  <style>\n' +
    '    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
    '    body {\n' +
    '      display: flex;\n' +
    '      justify-content: center;\n' +
    '      align-items: center;\n' +
    '      min-height: 100vh;\n' +
    '      font-family: Georgia, "Times New Roman", serif;\n' +
    '      background: #ffffff;\n' +
    '    }\n' +
    '    .card {\n' +
    '      text-align: center;\n' +
    '      padding: 40px;\n' +
    '      border: 3px solid #c9a84c;\n' +
    '      border-radius: 16px;\n' +
    '      max-width: 400px;\n' +
    '    }\n' +
    '    .ornament {\n' +
    '      color: #c9a84c;\n' +
    '      font-size: 24px;\n' +
    '      letter-spacing: 12px;\n' +
    '      margin: 8px 0;\n' +
    '    }\n' +
    '    h1 {\n' +
    '      font-size: 1.6rem;\n' +
    '      color: #1a1a2e;\n' +
    '      margin: 12px 0 4px;\n' +
    '    }\n' +
    '    .date {\n' +
    '      color: #5a5a5a;\n' +
    '      font-style: italic;\n' +
    '      font-size: 1.1rem;\n' +
    '      margin-bottom: 20px;\n' +
    '    }\n' +
    '    .qr-container svg {\n' +
    '      width: 250px;\n' +
    '      height: 250px;\n' +
    '    }\n' +
    '    .instructions {\n' +
    '      margin-top: 20px;\n' +
    '      color: #5a5a5a;\n' +
    '      font-size: 0.95rem;\n' +
    '      line-height: 1.5;\n' +
    '    }\n' +
    '    .url {\n' +
    '      font-size: 0.75rem;\n' +
    '      color: #8a8a8a;\n' +
    '      margin-top: 12px;\n' +
    '      word-break: break-all;\n' +
    '    }\n' +
    '    @media print {\n' +
    '      body { background: white; }\n' +
    '      .card { border: 2px solid #c9a84c; }\n' +
    '    }\n' +
    '  </style>\n' +
    '</head>\n' +
    '<body>\n' +
    '  <div class="card">\n' +
    '    <div class="ornament">✦ ✦ ✦</div>\n' +
    '    <h1>' + escapeHTML(name) + '</h1>\n' +
    (date ? '    <p class="date">' + escapeHTML(date) + '</p>\n' : '') +
    '    <div class="qr-container">' + svgContent + '</div>\n' +
    '    <p class="instructions">\n' +
    '      📸 QR kodu telefonunuzla okutun<br>\n' +
    '      ve fotoğraflarınızı paylaşın!\n' +
    '    </p>\n' +
    '    <p class="url">' + escapeHTML(url) + '</p>\n' +
    '  </div>\n' +
    '</body>\n' +
    '</html>';
}

/** HTML escape */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** XML escape (SVG için) */
function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

// ============================================
// ÇALIŞTIR
// ============================================
generateQRCodes();

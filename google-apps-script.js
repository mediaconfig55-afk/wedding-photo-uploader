/**
 * Düğün Fotoğraf Paylaşım Sistemi - Google Apps Script Backend
 * ==========================================================
 * BU KODU GOOGLE APPS SCRIPT EKRANINA YAPIŞTIRACAKSINIZ
 * ==========================================================
 * 
 * İşlev: GitHub Pages üzerinden gelen fotoğrafları (Base64)
 * Google Drive'da belirtilen klasöre kaydeder.
 */

function doPost(e) {
  try {
    var payloadStr = null;
    
    // Gelen veriyi güvenle çıkartma
    if (e.parameter && e.parameter.payload) {
      // 1. Multipart Form Data veya standart Form submission
      payloadStr = e.parameter.payload;
    } else if (e.postData && e.postData.contents) {
      // 2. Raw Body Fallback (text/plain veya application/json)
      var contents = e.postData.contents;
      if (contents.indexOf('payload=') === 0) {
        payloadStr = decodeURIComponent(contents.substring(8).replace(/\+/g, ' '));
      } else if (contents.endsWith('=')) {
        payloadStr = contents.slice(0, -1);
      } else {
        payloadStr = contents;
      }
    }
    
    if (!payloadStr) {
      throw new Error("Veri sunucuya ulaşamadı (boş payload). Fotoğraf boyutu çok yüksek olabilir.");
    }
    
    // JSON'u parse et
    var data;
    try {
      data = JSON.parse(payloadStr);
    } catch(err) {
      throw new Error("Veri formatı çözülemedi. Payload bozulmuş olabilir.");
    }
    
    // Gerekli veriler
    var base64Data = data.file;
    if (!base64Data) throw new Error("Fotoğraf verisi (base64) aktarılamadı.");
    
    var filename = data.filename || "image.jpg";
    var mimeType = data.mimeType || "image/jpeg";
    var folderId = data.folderId;  
    if (!folderId) throw new Error("Klasör ID bulunamadı.");
    
    var guestName = data.name || "Anonim Misafir";
    var guestComment = data.comment || "";
    
    // Base64 başlığını temizle
    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf(',') !== -1) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    // Blob oluştur
    var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType, filename);
    
    // Klasörü bul ve kaydet
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    
    // Metadata (Yorum ve İsim) dosya açıklamasına ekle
    var description = "Misafir: " + guestName;
    if (guestComment) {
      description += "\nYorum: " + guestComment;
    }
    file.setDescription(description);
    
    // Dosyayı herkes görebilecek şekilde ayarla (Galeri için)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Başarı dönüşü — 200 OK
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: file.getId(),
      url: file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * CORS (Cross-Origin Resource Sharing) için gerekli
 * Tarayıcıların güvenlik kısıtlamalarını aşar.
 */
function doOptions(e) {
  return ContentService.createTextOutput("{}");
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    
    if (action === "getGallery") {
      var folderId = e.parameter.folderId;
      if (!folderId) throw new Error("Folder ID eksik");
      
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      var data = [];
      
      while (files.hasNext()) {
        var file = files.next();
        // Sadece resimleri al
        if (file.getMimeType().indexOf('image/') !== -1) {
          var desc = file.getDescription() || '';
          var nameMatch = desc.match(/Misafir: (.*)\n/);
          var commentMatch = desc.match(/Yorum: (.*)/);
          var fileId = file.getId();
          
          // DriveApp'te getThumbnailUrl ve getDownloadUrl yok
          // Google Drive URL şablonları kullan
          var thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w500';
          var fullUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1920';
          var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
          
          data.push({
            id: fileId,
            name: file.getName(),
            thumbnailUrl: thumbnailUrl,
            fullUrl: fullUrl,
            downloadUrl: downloadUrl,
            createdTime: file.getDateCreated(),
            guestName: nameMatch ? nameMatch[1] : 'Anonim',
            comment: commentMatch ? commentMatch[1] : ''
          });
        }
      }
      
      // Tarihe göre yeniden eskiye sırala
      data.sort(function(a, b) {
        return b.createdTime - a.createdTime;
      });
      
      var response = { success: true, data: data };
      
      // JSONP Desteği (CORS Bypass)
      if (e.parameter.callback) {
        return ContentService.createTextOutput(e.parameter.callback + "(" + JSON.stringify(response) + ")")
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "Sunucu aktif"})).setMimeType(ContentService.MimeType.JSON);
    
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

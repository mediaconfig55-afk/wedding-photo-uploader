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
    
    // Gelen veriyi her türlü formattan kurtararak güvenle al
    if (e.postData && e.postData.contents) {
      payloadStr = e.postData.contents;
      // Eğer form URL-encoded geldiyse "payload=" prefixini kes ve decode et
      if (payloadStr.indexOf('payload=') === 0) {
        payloadStr = decodeURIComponent(payloadStr.substring(8).replace(/\+/g, ' '));
      }
    } else if (e.parameter && e.parameter.payload) {
      payloadStr = e.parameter.payload;
    }
    
    if (!payloadStr) throw new Error("Veri okunamadı");
    
    // Gelen veriyi parse et
    var data = JSON.parse(payloadStr);
    
    // Gerekli veriler
    var base64Data = data.file;
    var filename = data.filename;
    var mimeType = data.mimeType;
    var folderId = data.folderId;  // Frontend'den URL parametresi olarak gelecek
    var guestName = data.name || "Anonim Misafir";
    var guestComment = data.comment || "";
    
    // Base64 başlığını temizle
    var cleanBase64 = base64Data.split(',')[1] || base64Data;
    
    // Blob oluştur
    var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType, filename);
    
    // Klasörü bul ve kaydet
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    
    // Metadata (Yorum ve İsim) dosya açıklamasına ekle
    var description = "Misafir: " + guestName + "\nYorum: " + guestComment;
    file.setDescription(description);
    
    // Dosyayı herkes görebilecek şekilde ayarla (Galeri için)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Başarı dönüşü
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

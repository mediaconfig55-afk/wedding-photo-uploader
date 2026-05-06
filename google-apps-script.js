/**
 * Düğün Fotoğraf Paylaşım Sistemi - Google Apps Script Backend
 * ==========================================================
 * BU KODU GOOGLE APPS SCRIPT EKRANINA YAPIŞTIRACAKSINIZ
 * ==========================================================
 * 
 * İşlev: GitHub Pages üzerinden gelen fotoğrafları (Base64)
 * Google Drive'da belirtilen klasöre kaydeder.
 * 
 * Desteklenen POST formatları:
 * 1. fetch text/plain → e.postData.contents = raw JSON string
 * 2. form URL-encoded → e.parameter.payload = JSON string
 * 3. form URL-encoded → e.postData.contents = "payload=..." encoded
 */

function doPost(e) {
  try {
    var payloadStr = null;
    var contentType = (e.postData && e.postData.type) || '';
    
    // === Yöntem 1: Raw JSON body (fetch text/plain veya application/json) ===
    if (e.postData && e.postData.contents) {
      var contents = e.postData.contents;
      
      // Raw JSON denemesi — text/plain veya application/json
      if (contentType.indexOf('text/plain') !== -1 || contentType.indexOf('application/json') !== -1) {
        payloadStr = contents;
      }
      // URL-encoded form denemesi
      else if (contents.indexOf('payload=') === 0) {
        payloadStr = decodeURIComponent(contents.substring(8).replace(/\+/g, ' '));
      }
      // Bilinmeyen format — doğrudan JSON parse dene
      else {
        payloadStr = contents;
      }
    }
    
    // === Yöntem 2: URL-encoded parameter (iframe form submit) ===
    if (!payloadStr && e.parameter && e.parameter.payload) {
      payloadStr = e.parameter.payload;
    }
    
    // === Yöntem 3: Son çare — raw contents ===
    if (!payloadStr && e.postData && e.postData.contents) {
      payloadStr = e.postData.contents;
    }
    
    if (!payloadStr) {
      throw new Error("Veri sunucuya ulasamadi (bos payload). Content-Type: " + contentType);
    }
    
    // Trailing '=' temizleme (bazı URL-encoded gönderilerde oluşabilir)
    if (payloadStr.charAt(payloadStr.length - 1) === '=' && payloadStr.charAt(0) === '{') {
      // Geçerli JSON'un sonunda '=' olmaz — kaldır
    } else if (payloadStr.endsWith('=') && payloadStr.charAt(0) !== '{') {
      payloadStr = payloadStr.slice(0, -1);
    }
    
    var data;
    try {
      data = JSON.parse(payloadStr);
    } catch(err) {
      // İçerik boyutunu logla (debug için)
      var preview = payloadStr.substring(0, 200);
      throw new Error("JSON parse hatasi. Boyut: " + payloadStr.length + " byte. Onizleme: " + preview + "... Hata: " + err.message);
    }
    
    var base64Data = data.file;
    if (!base64Data) throw new Error("Fotograf verisi eksik.");
    
    var filename = data.filename || "image.jpg";
    var mimeType = data.mimeType || "image/jpeg";
    var folderId = data.folderId;  
    if (!folderId) throw new Error("Klasor ID eksik.");
    
    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf(',') !== -1) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    
    var blob;
    try {
      blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType, filename);
    } catch(err) {
      throw new Error("Base64 decode hatasi. Base64 boyut: " + cleanBase64.length + ". Hata: " + err.message);
    }
    
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    
    var guestName = data.name || "Anonim Misafir";
    var guestComment = data.comment || "";
    var description = "Misafir: " + guestName;
    if (guestComment) description += "\nYorum: " + guestComment;
    
    file.setDescription(description);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // İki tür yanıt döndür: postMessage (iframe için) + JSON (fetch için)
    var resultObj = { success: true, fileId: file.getId(), url: file.getUrl() };
    var html = "<html><body><script>try { window.top.postMessage(" + JSON.stringify(resultObj) + ", '*'); } catch(e) { try { window.parent.postMessage(" + JSON.stringify(resultObj) + ", '*'); } catch(e2) {} }</script><p>OK</p></body></html>";
    return HtmlService.createHtmlOutput(html);
    
  } catch (error) {
    var errObj = { success: false, error: error.message };
    var errHtml = "<html><body><script>try { window.top.postMessage(" + JSON.stringify(errObj) + ", '*'); } catch(e) { try { window.parent.postMessage(" + JSON.stringify(errObj) + ", '*'); } catch(e2) {} }</script><p>ERROR: " + error.message + "</p></body></html>";
    return HtmlService.createHtmlOutput(errHtml);
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

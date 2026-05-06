const { google } = require('googleapis');
const stream = require('stream');

/**
 * Google Drive İstemcisini Başlatır
 */
function initDriveClient() {
  try {
    // 1. JSON String olarak ENV'den al (Render'da en kolay yol)
    let credentialsStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!credentialsStr) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY tanımlanmamış.");
    }
    
    const credentials = JSON.parse(credentialsStr);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly']
    });

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error("Google Drive API başlatılamadı:", error.message);
    throw error;
  }
}

/**
 * Dosya Yükler
 */
async function uploadFile(buffer, filename, mimeType, folderId, guestName, comment) {
  const drive = initDriveClient();
  
  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  var description = `Misafir: ${guestName}`;
  if (comment) description += `\nYorum: ${comment}`;

  const fileMetadata = {
    name: filename,
    parents: [folderId],
    description: description
  };

  const media = {
    mimeType: mimeType,
    body: bufferStream
  };

  const res = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink'
  });

  // Dosya paylaşıma açılır
  await drive.permissions.create({
    fileId: res.data.id,
    resource: {
      type: 'anyone',
      role: 'reader',
    }
  });

  return res.data;
}

/**
 * Galeriden Fotoğrafları Getirir
 */
async function getFiles(folderId) {
  const drive = initDriveClient();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: 'files(id, name, createdTime, description)',
    orderBy: 'createdTime desc'
  });

  const files = res.data.files.map(file => {
    let guestName = 'Anonim';
    let comment = '';
    
    if (file.description) {
      const matchName = file.description.match(/Misafir:\s*(.*)/);
      if (matchName) guestName = matchName[1];
      
      const matchComment = file.description.match(/Yorum:\s*(.*)/);
      if (matchComment) comment = matchComment[1];
    }

    return {
      id: file.id,
      name: file.name,
      createdTime: file.createdTime,
      guestName,
      comment,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w500`,
      fullUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1920`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`
    };
  });

  return files;
}

module.exports = {
  uploadFile,
  getFiles
};

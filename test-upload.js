const fs = require('fs');
const path = require('path');
const { initDriveClient, uploadFile } = require('./backend/services/googleDrive');
require('dotenv').config({ path: './backend/.env' });

async function testUpload() {
  try {
    const testFilePath = path.join(__dirname, 'test-image.txt');
    fs.writeFileSync(testFilePath, 'This is a test image content');
    
    console.log('Testing upload...');
    const result = await uploadFile(testFilePath, 'test-image.txt', 'text/plain');
    console.log('Upload successful:', result);
    
    fs.unlinkSync(testFilePath);
  } catch (error) {
    console.error('Upload failed:', error.message);
  }
}

testUpload();

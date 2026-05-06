const axios = require('axios');
const fs = require('fs');

async function testUpload() {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('folderId', '1myfUq1ZwJ0LkqmzWB46gKyWcjzyMfoML');
    form.append('name', 'Bot Test');
    form.append('comment', 'Testing proxy');
    form.append('file', fs.createReadStream('test-image.txt')); // Using the small txt file

    console.log('Sending request to render...');
    const res = await axios.post('https://wedding-photo-uploader-t6wg.onrender.com/api/upload', form, {
      headers: form.getHeaders()
    });
    
    console.log('SUCCESS:', res.data);
  } catch (err) {
    console.log('ERROR STATUS:', err.response?.status);
    console.log('ERROR DATA:', err.response?.data);
    console.log('ERROR MESSAGE:', err.message);
  }
}
testUpload();

const axios = require('axios');
const fs = require('fs');

async function testGAS() {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbykvcr7ZYcC4ysTgAeeyMcls-ZUep_KnDSMJ7HsyvNGyGoHryPTKFZn_kmcKSAbf781/exec';
  const file = fs.readFileSync('test-image.txt');
  const base64Data = `data:text/plain;base64,${file.toString('base64')}`;

  console.log('Sending direct POST to GAS...');
  
  try {
    const res = await axios.post(GAS_URL, JSON.stringify({
      file: base64Data,
      filename: 'test-image.txt',
      mimeType: 'text/plain',
      folderId: '1myfUq1ZwJ0LkqmzWB46gKyWcjzyMfoML',
      name: 'Bot',
      comment: 'Test'
    }), {
      headers: {
        'Content-Type': 'text/plain'
      },
      maxRedirects: 0, // DON'T follow redirects, let's catch the 302!
      validateStatus: function (status) {
        return status >= 200 && status < 400; // default
      }
    });
    
    console.log('SURPRISE 200?:', res.status, res.data.substring(0, 200));
  } catch(err) {
    if (err.response && err.response.status === 302) {
        const redirectUrl = err.response.headers.location;
        console.log('302 Redirect Location:', redirectUrl);
        
        console.log('Following redirect manually as GET...');
        try {
            const redirectRes = await axios.get(redirectUrl);
            console.log('=== REDIRECT RESOLVED CONTENT ===');
            console.log(redirectRes.data);
            console.log('=================================');
        } catch(e) {
            console.log('Redirect FETCH ERROR:', e.message);
        }
    } else {
        console.log('POST ERROR:', err.message, err.response ? err.response.data : '');
    }
  }
}
testGAS();

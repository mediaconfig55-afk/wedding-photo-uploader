const http = require('https');
const payloadObj = {
  file: 'data:image/png;base64,' + Buffer.alloc(1500000, 'A').toString('ascii'),
  filename: 'test2.png',
  mimeType: 'image/png',
  folderId: '1nAVDz9UeMsorUkVdprspIx22FBNoNpXz',
  name: 'Test',
  comment: 'Test Huge'
};

const payloadStr = JSON.stringify(payloadObj);
const postData = 'payload=' + encodeURIComponent(payloadStr);

const req = http.request('https://script.google.com/macros/s/AKfycbykvcr7ZYcC4ysTgAeeyMcls-ZUep_KnDSMJ7HsyvNGyGoHryPTKFZn_kmcKSAbf781/exec', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  console.log('Status', res.statusCode);
  if (res.statusCode === 302) {
    const loc = res.headers.location;
    console.log('Redirecting to:', loc.substring(0, 50) + '...');
    const req2 = http.request(loc, res2 => {
        let chunks = '';
        res2.on('data', d => chunks+=d);
        res2.on('end', () => console.log('Response:', chunks));
    });
    req2.end();
  }
});
req.write(postData);
req.end();

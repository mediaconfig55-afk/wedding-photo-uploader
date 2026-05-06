const url = 'https://script.google.com/macros/s/AKfycbwWIDVGLRmYpy-XHUUzhzC33_OrnaGKxf8zczwRCGhYwbfa5t-7_GXn7yYsvQ_VABdE/exec';

const payload = {
  file: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  filename: 'test.png',
  mimeType: 'image/png',
  folderId: '1nAVDz9UeMsorUkVdprspIx22FBNoNpXz',
  name: 'Test',
  comment: 'Test'
};

async function test() {
  console.log('Sending request...');
  try {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();

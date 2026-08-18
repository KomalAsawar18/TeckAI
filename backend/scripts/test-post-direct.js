require('dotenv').config();

const run = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  // Target gemini-3.6-flash directly
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: "Hello" }] }]
  };

  console.log('Sending direct POST fetch to:', url.replace(/key=.{10}/, 'key=XXXXX'));

  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    console.log(`Finished in ${Date.now() - start}ms`);
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
};

run();

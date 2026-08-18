require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const run = async () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Testing with API Key beginning with:', apiKey ? apiKey.substring(0, 15) : 'undefined');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-pro'
    ];
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`Testing model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Hi');
        console.log(`\n🎉 SUCCESS with model "${modelName}"!`);
        console.log('Response:', result.response.text().trim());
        process.exit(0);
      } catch (err) {
        console.log(`❌ Failed for "${modelName}":`, err.message);
      }
    }
    console.log('\nAll models failed. Please verify the API key permissions.');
  } catch (err) {
    console.error('List models execution error:', err.message);
  } finally {
    process.exit(0);
  }
};

run();

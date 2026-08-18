require('dotenv').config();
const aiProvider = require('../src/ai/provider');
const promptService = require('../src/ai/promptService');

const run = async () => {
  try {
    const prompt = 'User Request: "I need a laptop under 350k for programming"';
    const systemInstruction = promptService.getQueryExtractionInstruction();
    
    console.log('Testing generateText without DB connection...');
    const start = Date.now();
    const result = await aiProvider.generateText({
      prompt,
      systemInstruction
    });
    console.log(`Success in ${Date.now() - start}ms!`);
    console.log('Result:', result);
  } catch (err) {
    console.error('Test failed:', err.message);
  }
};

run();

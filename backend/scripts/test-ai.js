require('dotenv').config();
const { connectDB } = require('../src/config/db');
const recommendationService = require('../src/ai/recommendationService');

const runTest = async () => {
  try {
    await connectDB();
    console.log('Testing AI Assistant with prompt: "I need a laptop under 350k for programming..."');

    const result = await recommendationService.getChatResponse({
      message: "I need a laptop under 350k for programming"
    });

    console.log('\n=============================================');
    console.log('1. EXTRACTED SEARCH CRITERIA:');
    console.log(JSON.stringify(result.criteria, null, 2));

    console.log('\n=============================================');
    console.log('2. GROUNDED DATABASE matches:');
    console.log(JSON.stringify(result.products, null, 2));

    console.log('\n=============================================');
    console.log('3. GEMINI GROUNDED RECOMMENDATION:');
    console.log(result.response);
    console.log('=============================================\n');

  } catch (error) {
    console.error('AI assistant test failed:', error.message);
  } finally {
    process.exit(0);
  }
};

runTest();

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const testDirect = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  console.log('Sending direct HTTP fetch to Google Generative Language API...');

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Response Status:', response.status, response.statusText);
    
    // Save output to file
    const outputPath = path.join(__dirname, 'models-list.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log('Successfully saved models list to:', outputPath);
  } catch (error) {
    console.error('Fetch error:', error.message);
  }
};

testDirect();

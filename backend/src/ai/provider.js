const logger = require('../config/logger');

class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      logger.error('GEMINI_API_KEY is not defined in the environment variables.');
    }
    this.modelName = 'gemini-2.5-flash';
  }

  /**
   * Generates a text response from Gemini using direct REST API fetch
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} [params.systemInstruction]
   * @param {Array} [params.history]
   * @returns {Promise<string>}
   */
  async generateText({ prompt, systemInstruction, history = [] }) {
    if (!this.apiKey) {
      throw new Error('AI Provider not initialized. Missing GEMINI_API_KEY.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    // Structure contents array
    const contents = [];

    // Append chat history (role must be 'user' or 'model')
    if (history && history.length > 0) {
      history.forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content || msg.text || '' }]
        });
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const payload = {
      contents
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const start = Date.now();
      const response = await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI Request timed out')), 30000))
      ]);

      const data = await response.json();
      const latency = Date.now() - start;

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP error ${response.status}`);
      }

      logger.info(`Gemini REST API call succeeded in ${latency}ms`);
      
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error('Empty response received from Gemini API');
      }

      return candidateText;
    } catch (error) {
      logger.error(`Gemini generation error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new GeminiProvider();

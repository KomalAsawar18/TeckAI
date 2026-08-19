const logger = require('../config/logger');

class OpenRouterProvider {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      logger.error('OPENROUTER_API_KEY is not defined in the environment variables.');
    }
    this.modelName = 'openai/gpt-4o-mini';
  }

  /**
   * Generates a text response from OpenRouter (GPT-4o-mini)
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} [params.systemInstruction]
   * @param {Array} [params.history]
   * @returns {Promise<string>}
   */
  async generateText({ prompt, systemInstruction, history = [] }) {
    if (!this.apiKey) {
      throw new Error('AI Provider not initialized. Missing OPENROUTER_API_KEY.');
    }

    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const messages = [];

    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: systemInstruction
      });
    }

    if (history && history.length > 0) {
      history.forEach(msg => {
        messages.push({
          role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content || msg.text || ''
        });
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    const payload = {
      model: this.modelName,
      messages: messages
    };

    try {
      const start = Date.now();
      const response = await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://teckai-backend.vercel.app',
            'X-Title': 'TeckAI Assistant'
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

      logger.info(`OpenRouter API call succeeded in ${latency}ms`);
      
      const candidateText = data.choices?.[0]?.message?.content;
      if (!candidateText) {
        throw new Error('Empty response received from OpenRouter API');
      }

      return candidateText;
    } catch (error) {
      logger.error(`OpenRouter generation error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new OpenRouterProvider();

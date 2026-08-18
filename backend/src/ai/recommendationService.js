const Product = require('../models/Product');
const Category = require('../models/Category');
const aiProvider = require('./provider');
const promptService = require('./promptService');
const logger = require('../config/logger');

class RecommendationService {
  /**
   * Processes a user chat message, queries database and returns AI response
   * @param {Object} params
   * @param {string} params.message
   * @param {Array} [params.history]
   * @returns {Promise<Object>}
   */
  async getChatResponse({ message, history = [] }) {
    try {
      // Step 1: Query Extraction from user message using Gemini
      const extractionPrompt = `User Request: "${message}"`;
      const systemInstruction = promptService.getQueryExtractionInstruction();

      let criteria = {};
      try {
        const jsonResponse = await aiProvider.generateText({
          prompt: extractionPrompt,
          systemInstruction,
        });

        // Clean json output (strip code blocks if generated)
        const cleanJson = jsonResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        criteria = JSON.parse(cleanJson);
        logger.info(`Extracted criteria: ${JSON.stringify(criteria)}`);
      } catch (err) {
        logger.error(`Failed to extract search criteria: ${err.message}. Defaulting to keyword search.`);
        // Fallback: use user message as a simple search query
        criteria = { search: message };
      }

      // Step 2: Query MongoDB Atlas based on criteria
      const query = { isActive: true };

      if (criteria.category) {
        // Find category matching the slug
        const categoryObj = await Category.findOne({ slug: criteria.category, isActive: true });
        if (categoryObj) {
          query.category = categoryObj._id;
        }
      }

      if (criteria.brand) {
        query.brand = { $regex: new RegExp(`^${criteria.brand.trim()}$`, 'i') };
      }

      if (criteria.minPrice !== undefined && criteria.minPrice !== null) {
        query.price = { ...query.price, $gte: Number(criteria.minPrice) };
      }

      if (criteria.maxPrice !== undefined && criteria.maxPrice !== null) {
        query.price = { ...query.price, $lte: Number(criteria.maxPrice) };
      }

      if (criteria.search) {
        query.$or = [
          { name: { $regex: criteria.search.trim(), $options: 'i' } },
          { description: { $regex: criteria.search.trim(), $options: 'i' } },
          { brand: { $regex: criteria.search.trim(), $options: 'i' } }
        ];
      }

      // Dynamic Specifications checking (e.g. ramGB, wireless, hasANC, mechanical)
      if (criteria.specifications) {
        Object.keys(criteria.specifications).forEach(key => {
          const val = criteria.specifications[key];
          if (val !== undefined && val !== null) {
            query[`specifications.${key}`] = val;
          }
        });
      }

      logger.info(`MongoDB AI query matching: ${JSON.stringify(query)}`);
      const matchedProducts = await Product.find(query)
        .populate('category', 'name slug')
        .limit(10)
        .lean();

      // Step 3: Format grounded products and query Gemini for final recommendation
      const groundedProductsJson = JSON.stringify(
        matchedProducts.map(p => ({
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          price: p.price,
          currency: p.currency,
          stock: p.stock,
          rating: p.rating,
          reviewCount: p.reviewCount,
          specifications: p.specifications,
          description: p.description
        })),
        null,
        2
      );

      const finalSystemInstruction = promptService.getRecommendationInstruction(groundedProductsJson);
      
      const finalResponse = await aiProvider.generateText({
        prompt: message,
        systemInstruction: finalSystemInstruction,
        history,
      });

      // Parse the structured JSON response from Gemini
      let parsedResponse = {
        message: finalResponse,
        type: matchedProducts.length > 0 ? "catalog_grounded" : "general_guidance",
        sections: [],
        comparisonTable: null
      };

      try {
        const cleanResponse = finalResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonResponse = JSON.parse(cleanResponse);

        if (jsonResponse.message) parsedResponse.message = jsonResponse.message;
        if (jsonResponse.type) parsedResponse.type = jsonResponse.type;
        if (jsonResponse.sections) parsedResponse.sections = jsonResponse.sections;
        if (jsonResponse.comparisonTable) parsedResponse.comparisonTable = jsonResponse.comparisonTable;
      } catch (err) {
        logger.error(`Failed to parse structured response from Gemini: ${err.message}. Falling back to raw response formatting.`);
        
        // If Gemini returned a raw text response, clean any raw code blocks if present
        parsedResponse.message = finalResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      }

      return {
        response: parsedResponse.message,
        sections: parsedResponse.sections,
        comparisonTable: parsedResponse.comparisonTable,
        type: parsedResponse.type,
        criteria,
        products: matchedProducts.map(p => ({
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          price: p.price,
          images: p.images,
          category: p.category?.name,
          specifications: p.specifications,
          stock: p.stock
        }))
      };

    } catch (error) {
      logger.error(`RecommendationService error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RecommendationService();

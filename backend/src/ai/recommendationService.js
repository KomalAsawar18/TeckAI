const Product = require('../models/Product');
const Category = require('../models/Category');
const CanonicalProduct = require('../models/CanonicalProduct');
const ProductOffer = require('../models/ProductOffer');
const AIConversation = require('../models/AIConversation');
const { compareOffers } = require('../commerce/compareOffers');
const aiProvider = require('./provider');
const promptService = require('./promptService');
const logger = require('../config/logger');

class RecommendationService {
  /**
   * Rehydrates a list of canonical product IDs into structured product objects
   * with current price and availability.
   * Preserves order and handles deduplication.
   */
  async rehydrateRecommendedProducts(productIds) {
    if (!productIds || productIds.length === 0) return [];
    
    // Deduplicate while preserving first occurrence order
    const uniqueIds = [...new Set(productIds.map(id => id.toString()))];
    
    const [products, offers] = await Promise.all([
      CanonicalProduct.find({ _id: { $in: uniqueIds }, isActive: true }).lean(),
      ProductOffer.find({ canonicalProduct: { $in: uniqueIds }, isActive: true }).lean()
    ]);
    
    const productsById = new Map(products.map(p => [p._id.toString(), p]));
    const offersByProductId = new Map();
    offers.forEach(offer => {
      const pid = offer.canonicalProduct.toString();
      if (!offersByProductId.has(pid)) offersByProductId.set(pid, []);
      offersByProductId.get(pid).push(offer);
    });
    
    const rehydrated = [];
    
    for (const id of uniqueIds) {
      const product = productsById.get(id);
      if (!product) continue; // Skip missing or inactive
      
      const productOffers = offersByProductId.get(id) || [];
      const comparison = compareOffers(productOffers);
      const bestOffer = comparison.bestOffer;
      if (!bestOffer) continue;
      
      rehydrated.push({
        id: product._id.toString(),
        name: product.name,
        brand: product.brand,
        model: product.model,
        category: product.category,
        specifications: product.specifications,
        price: bestOffer.price,
        seller: bestOffer.seller,
        availability: bestOffer.availability,
        offerCount: productOffers.length,
        image: product.images && product.images.length > 0 ? product.images[0].url : undefined
      });
    }
    
    return rehydrated;
  }

  /**
   * Processes a user chat message, queries database and returns AI response
   */
  async getChatResponse({ message, user, conversationId, canonicalProductId, actionIntent }) {
    try {
      let conversation = null;
      let history = [];

      // If user is authenticated, handle persistent conversation
      if (user) {
        if (conversationId) {
          conversation = await AIConversation.findOne({ _id: conversationId, user: user._id });
          if (!conversation) {
            const error = new Error('Conversation not found or unauthorized');
            error.statusCode = 404;
            throw error;
          }
          // Load bounded history (last 10 messages)
          const recentMessages = conversation.messages.slice(-10);
          history = recentMessages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            content: msg.content
          }));
        } else {
          // Generate a short title from the first message
          let title = message.trim().substring(0, 40);
          if (message.length > 40) title += '...';
          conversation = new AIConversation({
            user: user._id,
            title,
            messages: []
          });
        }
      }

      if (conversation) {
        const lastMsg = conversation.messages.length > 0 ? conversation.messages[conversation.messages.length - 1] : null;
        if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
          conversation.messages.push({
            role: 'user',
            content: message,
            actionIntent: actionIntent || 'none',
            recommendedProductIds: []
          });
          await conversation.save();
        }
      }

      let criteria = {};
      let matchedProducts = [];
      let parsedResponse = {
        message: "",
        type: "general_guidance",
        sections: [],
        comparisonTable: null
      };
      
      try {
        // If it's a contextual query on a specific canonical product
        if (canonicalProductId && actionIntent) {
          const product = await CanonicalProduct.findById(canonicalProductId).populate('category', 'name slug').lean();
          if (product) {
            const activeOffers = await ProductOffer.find({
              canonicalProduct: product._id,
              isActive: true
            }).lean();

            const comparison = compareOffers(activeOffers, { includeUnavailable: false });
            const bestOffer = comparison.bestOffer;

            if (bestOffer) {
              matchedProducts.push({
                id: product._id.toString(),
                name: product.name,
                brand: product.brand,
                model: product.model,
                category: product.category?.name,
                specifications: product.specifications,
                bestOffer: {
                  price: bestOffer.price,
                  currency: bestOffer.currency,
                  seller: bestOffer.seller?.name || bestOffer.source?.name,
                  availability: bestOffer.availability,
                  condition: bestOffer.condition
                },
                offerCount: comparison.summary.totalOffers
              });
            }
          }
        } else {
          // Step 1: Query Extraction from user message using Gemini
          const extractionPrompt = `User Request: "${message}"`;
          const systemInstruction = promptService.getQueryExtractionInstruction();

          try {
            const jsonResponse = await aiProvider.generateText({
              prompt: extractionPrompt,
              systemInstruction,
            });

            const cleanJson = jsonResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            criteria = JSON.parse(cleanJson);
            logger.info(`Extracted criteria: ${JSON.stringify(criteria)}`);
          } catch (err) {
            logger.error(`Failed to extract search criteria: ${err.message}. Defaulting to keyword search.`);
            criteria = { search: message };
          }

          // Step 2: Query DB
          let query = { isActive: true };
          if (criteria.category) {
            const cat = await Category.findOne({ slug: criteria.category.toLowerCase() }).lean();
            if (cat) query.category = cat._id;
          }
          if (criteria.brand) {
            query.brand = new RegExp(`^${criteria.brand}$`, 'i');
          }
          if (criteria.search) {
            query.$or = [
              { name: { $regex: criteria.search, $options: 'i' } },
              { model: { $regex: criteria.search, $options: 'i' } }
            ];
          }

          logger.info(`MongoDB AI query matching: ${JSON.stringify(query)}`);
          const canonicalCandidates = await CanonicalProduct.find(query).populate('category', 'name slug').lean();

          if (canonicalCandidates.length > 0) {
            const candidateIds = canonicalCandidates.map(p => p._id);
            const activeOffers = await ProductOffer.find({
              canonicalProduct: { $in: candidateIds },
              isActive: true
            }).lean();

            const offersByCanonical = new Map();
            for (const offer of activeOffers) {
              if (!offer.canonicalProduct) continue;
              const cId = offer.canonicalProduct.toString();
              if (!offersByCanonical.has(cId)) {
                offersByCanonical.set(cId, []);
              }
              offersByCanonical.get(cId).push(offer);
            }

            for (const product of canonicalCandidates) {
              const pOffers = offersByCanonical.get(product._id.toString()) || [];
              const comparison = compareOffers(pOffers, { includeUnavailable: false });
              const bestOffer = comparison.bestOffer;

              if (!bestOffer) continue;

              if (criteria.minBudget !== undefined && criteria.minBudget !== null) {
                if (bestOffer.price < Number(criteria.minBudget)) continue;
              }
              if (criteria.maxBudget !== undefined && criteria.maxBudget !== null) {
                if (bestOffer.price > Number(criteria.maxBudget)) continue;
              }

              matchedProducts.push({
                id: product._id.toString(),
                name: product.name,
                brand: product.brand,
                model: product.model,
                category: product.category?.name,
                specifications: product.specifications,
                bestOffer: {
                  price: bestOffer.price,
                  currency: bestOffer.currency,
                  seller: bestOffer.seller?.name || bestOffer.source?.name,
                  availability: bestOffer.availability,
                  condition: bestOffer.condition
                },
                offerCount: comparison.summary.totalOffers
              });
            }
            
            matchedProducts.sort((a, b) => a.bestOffer.price - b.bestOffer.price);
            matchedProducts = matchedProducts.slice(0, 10);
          }
        }

        // Step 3: Format grounded products and query Gemini for final recommendation
        const groundedProductsJson = JSON.stringify(
          matchedProducts.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            model: p.model,
            category: p.category,
            specifications: p.specifications,
            bestPrice: p.bestOffer.price,
            seller: p.bestOffer.seller,
            availability: p.bestOffer.availability,
            condition: p.bestOffer.condition,
            offerCount: p.offerCount,
            link: `/canonical-products/${p.id}`
          })),
          null,
          2
        );

        const finalSystemInstruction = promptService.getRecommendationInstruction(groundedProductsJson);
        
        const finalResponse = await aiProvider.generateText({
          prompt: message,
          systemInstruction: finalSystemInstruction,
          history, // Inject bounded history!
        });

        parsedResponse.type = matchedProducts.length > 0 ? "catalog_grounded" : "general_guidance";

        try {
          const cleanResponse = finalResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
          const jsonResponse = JSON.parse(cleanResponse);

          if (jsonResponse.message) parsedResponse.message = jsonResponse.message;
          if (jsonResponse.type) parsedResponse.type = jsonResponse.type;
          if (jsonResponse.sections) parsedResponse.sections = jsonResponse.sections;
          if (jsonResponse.comparisonTable) parsedResponse.comparisonTable = jsonResponse.comparisonTable;
        } catch (err) {
          logger.error(`Failed to parse structured response from Gemini: ${err.message}`);
          parsedResponse.message = finalResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        }

      } catch (err) {
        if (conversation) {
          err.conversationId = conversation._id.toString();
        }
        throw err;
      }

      // Format response products
      const responseProducts = matchedProducts.map(p => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        model: p.model,
        price: p.bestOffer.price,
        category: p.category,
        specifications: p.specifications,
        seller: p.bestOffer.seller,
        offerCount: p.offerCount,
        availability: p.bestOffer.availability,
        image: p.images && p.images.length > 0 ? p.images[0].url : undefined
      }));

      // Append assistant message to persistent conversation
      if (conversation) {
        conversation.messages.push({
          role: 'assistant',
          content: parsedResponse.message,
          recommendedProductIds: responseProducts.map(p => p.id)
        });

        await conversation.save();
      }

      return {
        response: parsedResponse.message,
        sections: parsedResponse.sections,
        comparisonTable: parsedResponse.comparisonTable,
        type: parsedResponse.type,
        criteria,
        conversationId: conversation ? conversation._id.toString() : null,
        products: responseProducts
      };

    } catch (error) {
      logger.error(`RecommendationService error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RecommendationService();

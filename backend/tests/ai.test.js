const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const recommendationService = require('../src/ai/recommendationService');

require('dotenv').config();

jest.setTimeout(60000);

// Avoid connecting to database if not required for mock checks, but hook into mongoose teardown
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  
  let uri = process.env.MONGODB_URI;
  if (uri) {
    if (uri.includes('?')) {
      const parts = uri.split('?');
      if (parts[0].endsWith('/')) {
        parts[0] += 'teckai_test';
      } else {
        const lastSlash = parts[0].lastIndexOf('/');
        parts[0] = parts[0].substring(0, lastSlash + 1) + 'teckai_test';
      }
      uri = parts.join('?');
    } else {
      if (uri.endsWith('/')) {
        uri += 'teckai_test';
      } else {
        const lastSlash = uri.lastIndexOf('/');
        if (lastSlash > uri.indexOf('://') + 2) {
          uri = uri.substring(0, lastSlash + 1) + 'teckai_test';
        } else {
          uri += '/teckai_test';
        }
      }
    }
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('AI Assistant Router Integration Tests', () => {
  let chatResponseSpy;

  beforeEach(() => {
    // Spy on recommendationService.getChatResponse
    chatResponseSpy = jest.spyOn(recommendationService, 'getChatResponse').mockImplementation(async () => {
      return {
        response: "Mocked AI Response message.",
        sections: [
          {
            title: "Why it fits",
            items: ["Fact 1", "Fact 2"]
          }
        ],
        comparisonTable: null,
        type: "catalog_grounded",
        products: []
      };
    });
  });

  afterEach(() => {
    chatResponseSpy.mockRestore();
  });

  describe('POST /api/ai/chat', () => {
    it('should return 200 and structured response with valid request payload', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'I need a laptop' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.response).toBe("Mocked AI Response message.");
      expect(res.body.data.type).toBe("catalog_grounded");
      expect(res.body.data.sections.length).toBe(1);
      expect(chatResponseSpy).toHaveBeenCalledTimes(1);
    });

    it('should return 400 Bad Request when message body is missing', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Message is required');
      expect(chatResponseSpy).not.toHaveBeenCalled();
    });

    it('should return 400 Bad Request when message is an empty string', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .send({ message: '   ' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Message is required');
    });

    it('should return 400 Bad Request when message exceeds 500 characters limit', async () => {
      const longMessage = 'a'.repeat(501);
      const res = await request(app)
        .post('/api/ai/chat')
        .send({ message: longMessage });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Message exceeds the maximum limit');
    });
  });
});

describe('RecommendationService Grounding Tests', () => {
  const Product = require('../src/models/Product');
  const CanonicalProduct = require('../src/models/CanonicalProduct');
  const ProductOffer = require('../src/models/ProductOffer');
  const aiProvider = require('../src/ai/provider');

  let generateTextSpy;
  let canonicalFindSpy;
  let offerFindSpy;
  let legacyProductSpy;

  beforeEach(() => {
    generateTextSpy = jest.spyOn(aiProvider, 'generateText');
    canonicalFindSpy = jest.spyOn(CanonicalProduct, 'find');
    offerFindSpy = jest.spyOn(ProductOffer, 'find');
    legacyProductSpy = jest.spyOn(Product, 'find');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never queries the legacy Product model and handles budget correctly', async () => {
    // 1st call: extraction
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({
      category: "headphones",
      minBudget: 15000,
      maxBudget: 25000
    }));
    // 2nd call: final response
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({
      message: "Here are some headphones.",
      type: "catalog_grounded",
      sections: []
    }));

    // Mock DB responses for CanonicalProduct & ProductOffer
    const mockCanonical = {
      _id: new mongoose.Types.ObjectId(),
      name: "Test Headphone",
      brand: "TestBrand",
      category: { name: "Headphones" }
    };
    canonicalFindSpy.mockReturnValue({
      populate: () => ({
        lean: async () => [mockCanonical]
      })
    });

    offerFindSpy.mockReturnValue({
      lean: async () => [
        { canonicalProduct: mockCanonical._id, price: 20000, isActive: true, availability: 'in_stock', sourceUrl: 'https://example.com/1' },
        { canonicalProduct: mockCanonical._id, price: 10000, isActive: true, availability: 'out_of_stock', sourceUrl: 'https://example.com/2' } // Cheaper but out of stock
      ]
    });

    const result = await recommendationService.getChatResponse({ message: 'gaming headset under 25k' });

    expect(legacyProductSpy).not.toHaveBeenCalled();
    expect(canonicalFindSpy).toHaveBeenCalled();
    expect(offerFindSpy).toHaveBeenCalled();
    
    expect(result.products.length).toBe(1);
    expect(result.products[0].price).toBe(20000); // Because 10000 is out_of_stock, compareOffers skips it or ranks it lower, and 20000 is the best in_stock offer!
    // We didn't actually mock compareOffers, it will run real compareOffers logic on the mocked offers array.
    
    // Check links
    expect(result.products[0].id).toBe(mockCanonical._id.toString());
  });

  it('returns empty results gracefully without hallucinating', async () => {
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({
      category: "laptops",
      minBudget: 5000,
      maxBudget: 6000
    }));
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({
      message: "No laptops found.",
      type: "general_guidance",
      sections: []
    }));

    canonicalFindSpy.mockReturnValue({
      populate: () => ({
        lean: async () => [] // Empty array
      })
    });

    const result = await recommendationService.getChatResponse({ message: 'laptops for 5k' });

    expect(result.products.length).toBe(0);
    expect(result.type).toBe('general_guidance');
  });
});

describe('Conversation Persistence & Context Tests', () => {
  const AIConversation = require('../src/models/AIConversation');
  const CanonicalProduct = require('../src/models/CanonicalProduct');
  const ProductOffer = require('../src/models/ProductOffer');
  const aiProvider = require('../src/ai/provider');

  let generateTextSpy;
  let conversationFindOneSpy;
  let conversationSaveSpy;

  beforeEach(() => {
    generateTextSpy = jest.spyOn(aiProvider, 'generateText');
    conversationFindOneSpy = jest.spyOn(AIConversation, 'findOne');
    conversationSaveSpy = jest.spyOn(AIConversation.prototype, 'save');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects chat request if conversation does not belong to user', async () => {
    const mockUser = { _id: new mongoose.Types.ObjectId() };
    
    // Simulate someone else's conversation or conversation not found
    conversationFindOneSpy.mockResolvedValue(null);

    await expect(
      recommendationService.getChatResponse({
        message: 'Hello',
        user: mockUser,
        conversationId: new mongoose.Types.ObjectId().toString()
      })
    ).rejects.toThrow('Conversation not found or unauthorized');
  });

  it('creates new conversation if user provided without conversationId', async () => {
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({ search: "test" })); // extraction
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({ message: "Reply" })); // final
    conversationSaveSpy.mockResolvedValue(true);

    const mockUser = { _id: new mongoose.Types.ObjectId() };

    const result = await recommendationService.getChatResponse({
      message: 'Test message',
      user: mockUser
    });

    expect(result.conversationId).toBeDefined();
    expect(conversationSaveSpy).toHaveBeenCalled();
  });

  it('bypasses extraction for contextual canonical queries', async () => {
    const mockCanonical = {
      _id: new mongoose.Types.ObjectId(),
      name: "Exact Product",
      specifications: {}
    };
    jest.spyOn(CanonicalProduct, 'findById').mockReturnValue({
      populate: () => ({ lean: async () => mockCanonical })
    });
    jest.spyOn(ProductOffer, 'find').mockReturnValue({
      lean: async () => [{ price: 100, isActive: true }]
    });

    generateTextSpy.mockResolvedValueOnce(JSON.stringify({ message: "Detail reply" })); // Only final generation

    await recommendationService.getChatResponse({
      message: 'Ask details about this',
      canonicalProductId: mockCanonical._id.toString(),
      actionIntent: 'ask_details'
    });

    // Generate text should only be called ONCE (final response), skipping extraction
    expect(generateTextSpy).toHaveBeenCalledTimes(1);
    expect(generateTextSpy).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Ask details about this'
    }));
  });

  it('rehydrateRecommendedProducts preserves order, deduplicates, and skips missing products', async () => {
    const id1 = new mongoose.Types.ObjectId().toString();
    const id2 = new mongoose.Types.ObjectId().toString();
    const id3 = new mongoose.Types.ObjectId().toString();
    
    // id1 exists, id2 exists, id3 is missing in DB
    const inputIds = [id3, id2, id1, id2];

    jest.spyOn(CanonicalProduct, 'find').mockReturnValue({
      lean: async () => [
        { _id: id1, name: "Product 1" },
        { _id: id2, name: "Product 2" }
      ]
    });
    
    jest.spyOn(ProductOffer, 'find').mockReturnValue({
      lean: async () => [
        { canonicalProduct: id1, price: 1500, isActive: true, availability: 'in_stock', sourceUrl: 'https://example.com' },
        { canonicalProduct: id2, price: 500, isActive: true, availability: 'pre_order', sourceUrl: 'https://example.com' }
      ]
    });

    const result = await recommendationService.rehydrateRecommendedProducts(inputIds);
    
    // Expect length 2 (id3 is skipped, id2 is deduplicated)
    expect(result.length).toBe(2);
    // Preserves first occurrence order: id2 should be first, then id1
    expect(result[0].id).toBe(id2);
    expect(result[0].availability).toBe('pre_order');
    expect(result[1].id).toBe(id1);
    expect(result[1].availability).toBe('in_stock');
  });

  it('persists user message before LLM call and retains conversationId on failure', async () => {
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({ search: "test" })); // extraction
    generateTextSpy.mockRejectedValueOnce(new Error('LLM Timeout')); // final
    
    // Track what is passed to save()
    let savedMessages = [];
    conversationSaveSpy.mockImplementation(async function() {
      savedMessages = [...this.messages];
      return true;
    });

    const mockUser = { _id: new mongoose.Types.ObjectId() };
    
    await expect(
      recommendationService.getChatResponse({
        message: 'Fail request',
        user: mockUser
      })
    ).rejects.toMatchObject({
      message: 'LLM Timeout',
      conversationId: expect.any(String) // MUST retain conversation ID
    });

    expect(conversationSaveSpy).toHaveBeenCalled();
    // User message MUST have been saved
    expect(savedMessages.length).toBe(1);
    expect(savedMessages[0].role).toBe('user');
    expect(savedMessages[0].content).toBe('Fail request');
  });

  it('does not duplicate user message if retrying the same message', async () => {
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({ search: "test" }));
    generateTextSpy.mockResolvedValueOnce(JSON.stringify({ message: "Success on retry" }));
    
    // Simulate an existing conversation that already has the user's message from a previous failed attempt
    const mockConv = {
      _id: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      messages: [{ role: 'user', content: 'Retry this' }],
      save: jest.fn().mockResolvedValue(true)
    };
    
    jest.spyOn(AIConversation, 'findOne').mockResolvedValue(mockConv);

    const result = await recommendationService.getChatResponse({
      message: 'Retry this',
      user: { _id: mockConv.user },
      conversationId: mockConv._id.toString()
    });

    // The backend should NOT have pushed a second 'Retry this' user message
    // It should only have the original user message, plus the newly generated assistant message
    expect(mockConv.messages.length).toBe(2);
    expect(mockConv.messages[0].role).toBe('user');
    expect(mockConv.messages[1].role).toBe('assistant');
  });
});

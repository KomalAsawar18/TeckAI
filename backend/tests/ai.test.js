const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const recommendationService = require('../src/ai/recommendationService');

require('dotenv').config();

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

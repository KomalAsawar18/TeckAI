require('dotenv').config();
const { connectDB } = require('../src/config/db');
const recommendationService = require('../src/ai/recommendationService');
const aiProvider = require('../src/ai/provider');

// Backup original generateText
const originalGenerateText = aiProvider.generateText;

// Mock response structures
const mockQueryExtraction = JSON.stringify({
  category: "laptops",
  minPrice: null,
  maxPrice: 350000,
  brand: null,
  search: "programming",
  specifications: {
    ramGB: 16
  }
});

const mockGroundedRecommendation = JSON.stringify({
  message: "The Dell Latitude 5440 is the strongest match for your programming needs.",
  type: "catalog_grounded",
  sections: [
    {
      title: "Why it fits",
      items: [
        "16 GB RAM handles developer tools and virtual machines easily.",
        "512 GB SSD provides fast boot times for tools like VS Code.",
        "Priced at PKR 175,000, fitting comfortably under your 350k budget."
      ]
    },
    {
      title: "Trade-offs",
      items: [
        "14-inch screen is compact, so you might need an external monitor."
      ]
    }
  ],
  comparisonTable: null
});

const runMockTest = async () => {
  console.log("Starting Recommendation Service Mock Test...");
  
  let callCount = 0;
  aiProvider.generateText = async () => {
    callCount++;
    if (callCount === 1) {
      console.log("Mocking Step 1: Query Extraction");
      return mockQueryExtraction;
    } else {
      console.log("Mocking Step 2: Grounded Recommendation");
      return mockGroundedRecommendation;
    }
  };

  try {
    await connectDB();

    const result = await recommendationService.getChatResponse({
      message: "I need a programming laptop under 350k"
    });

    console.log("\n=============================================");
    console.log("MOCK TEST SUCCESSFUL!");
    console.log("=============================================");
    console.log("1. Criteria parsed:", JSON.stringify(result.criteria, null, 2));
    console.log("2. Products found in DB:", result.products.length);
    console.log("3. Message parsed:", result.response);
    console.log("4. Type parsed:", result.type);
    console.log("5. Sections parsed:", JSON.stringify(result.sections, null, 2));
    console.log("6. Comparison Table parsed:", JSON.stringify(result.comparisonTable, null, 2));
    console.log("=============================================\n");

  } catch (err) {
    console.error("Mock test failed:", err.message);
  } finally {
    // Restore original function
    aiProvider.generateText = originalGenerateText;
    process.exit(0);
  }
};

runMockTest();

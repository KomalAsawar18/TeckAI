require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const { connectDB, disconnectDB } = require('../src/config/db');
const logger = require('../src/config/logger');

const categoriesData = [
  {
    name: 'Laptops',
    slug: 'laptops',
    description: 'High-performance workstations, ultrabooks, and daily-drive developer laptops.'
  },
  {
    name: 'Headphones',
    slug: 'headphones',
    description: 'Studio monitors, noise-canceling headphones, and wireless gear.'
  },
  {
    name: 'Keyboards',
    slug: 'keyboards',
    description: 'Mechanical and membrane keyboards for programmers and gaming enthusiasts.'
  }
];

const getProductsData = (categoryMap) => [
  // --- LAPTOPS ---
  {
    name: 'ThinkPad X1 Carbon Gen 11',
    slug: 'thinkpad-x1-carbon-gen-11',
    sku: 'LNV-X1C-G11',
    description: 'The ultimate professional business laptop. Durable carbon-fiber weave chassis, exceptional tactile keyboard, and reliable battery life. Ideal for Linux users and cloud developers.',
    price: 350000,
    originalPrice: 380000,
    stock: 12,
    images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Lenovo',
    rating: 4.8,
    reviewCount: 34,
    isFeatured: true,
    specifications: {
      ramGB: 16,
      storageSSD: '512GB PCIe NVMe',
      processor: 'Intel Core i7-1355U',
      display: '14" WUXGA IPS Anti-Glare',
      batteryHours: 12,
      weightKg: 1.12,
      operatingSystem: 'Windows 11 Pro (Linux Ready)',
      wireless: true,
      ports: ['2x USB-C Thunderbolt 4', '2x USB-A 3.2', '1x HDMI 2.1', '1x Audio Jack']
    },
    tags: ['ultrabook', 'thinkpad', 'developer', 'lightweight']
  },
  {
    name: 'MacBook Pro 14 M3 Pro',
    slug: 'macbook-pro-14-m3-pro',
    sku: 'APL-MBP14-M3P',
    description: 'Apple Silicon powered powerhouse. Incredible battery efficiency combined with blazing fast performance. Features Liquid Retina XDR screen, studio speakers, and runs macOS.',
    price: 480000,
    originalPrice: 495000,
    stock: 8,
    images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Apple',
    rating: 4.9,
    reviewCount: 52,
    isFeatured: true,
    specifications: {
      ramGB: 18,
      storageSSD: '512GB Unified SSD',
      processor: 'Apple M3 Pro (11-core CPU, 14-core GPU)',
      display: '14.2" Liquid Retina XDR',
      batteryHours: 18,
      weightKg: 1.61,
      operatingSystem: 'macOS Sonoma',
      wireless: true,
      ports: ['3x Thunderbolt 4 (USB-C)', '1x HDMI', '1x SDXC Card Slot', '1x MagSafe 3']
    },
    tags: ['macbook', 'm3', 'apple', 'designer', 'ios-developer']
  },
  {
    name: 'HP Pavilion 15',
    slug: 'hp-pavilion-15',
    sku: 'HP-PAV-15',
    description: 'Affordable, well-rounded laptop for students and office workers. Features thin bezels, dual speakers, and AMD processing.',
    price: 145000,
    originalPrice: 155000,
    stock: 25,
    images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'HP',
    rating: 4.1,
    reviewCount: 18,
    isFeatured: false,
    specifications: {
      ramGB: 8,
      storageSSD: '256GB NVMe M.2',
      processor: 'AMD Ryzen 5 5500U',
      display: '15.6" FHD IPS Micro-edge',
      batteryHours: 6,
      weightKg: 1.75,
      operatingSystem: 'Windows 11 Home',
      wireless: true,
      ports: ['1x USB-C', '2x USB-A', '1x HDMI', '1x Headphone Combo']
    },
    tags: ['budget', 'student', 'hp']
  },
  {
    name: 'Dell XPS 13 9315',
    slug: 'dell-xps-13-9315',
    sku: 'DEL-XPS13-9315',
    description: 'Stunning aluminum infinity-edge screen layout. Ultra-thin profiles, highly portable design, and brilliant screen colors. Perfect for programmers on the go.',
    price: 280000,
    originalPrice: 295000,
    stock: 5,
    images: ['https://images.unsplash.com/photo-1593642532842-98d0fd5ebc1a?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Dell',
    rating: 4.4,
    reviewCount: 22,
    isFeatured: false,
    specifications: {
      ramGB: 16,
      storageSSD: '512GB PCIe NVMe',
      processor: 'Intel Core i5-1230U',
      display: '13.4" FHD+ InfinityEdge Anti-Glare',
      batteryHours: 10,
      weightKg: 1.17,
      operatingSystem: 'Windows 11 Home',
      wireless: true,
      ports: ['2x Thunderbolt 4 (USB-C) with Power Delivery']
    },
    tags: ['xps', 'premium', 'ultrabook', 'developer']
  },
  {
    name: 'ASUS ROG Zephyrus G14',
    slug: 'asus-rog-zephyrus-g14',
    sku: 'ASU-ZEP-G14',
    description: 'Incredible compilation power mixed with modern gaming performance. Houses an active cooling system, Nvidia GeForce graphics card, and AMD processor.',
    price: 390000,
    originalPrice: 420000,
    stock: 4,
    images: ['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'ASUS',
    rating: 4.7,
    reviewCount: 45,
    isFeatured: true,
    specifications: {
      ramGB: 32,
      storageSSD: '1TB M.2 NVMe PCIe 4.0',
      processor: 'AMD Ryzen 9 7940HS',
      display: '14" QHD+ 165Hz ROG Nebula Display',
      gpu: 'Nvidia GeForce RTX 4060 8GB GDDR6',
      batteryHours: 8,
      weightKg: 1.65,
      operatingSystem: 'Windows 11 Home',
      wireless: true,
      ports: ['1x USB-C USB4', '1x USB-C 3.2', '2x USB-A 3.2', '1x HDMI 2.1', '1x Card Reader']
    },
    tags: ['gaming', 'workstation', 'high-performance', 'rtx']
  },
  {
    name: 'Acer Aspire 5',
    slug: 'acer-aspire-5',
    sku: 'ACR-ASP-5',
    description: 'An entry-level daily drive machine. Good for web development learning, office work, and general tasks.',
    price: 110000,
    originalPrice: 115000,
    stock: 0, // Out of stock to test filter availability
    images: ['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Acer',
    rating: 3.9,
    reviewCount: 14,
    isFeatured: false,
    specifications: {
      ramGB: 8,
      storageSSD: '256GB NVMe SSD',
      processor: 'Intel Core i3-1215U',
      display: '15.6" FHD ComfyView IPS',
      batteryHours: 5,
      weightKg: 1.8,
      operatingSystem: 'Windows 11 Home',
      wireless: true,
      ports: ['1x USB-C', '3x USB-A', '1x HDMI', '1x RJ-45 Ethernet']
    },
    tags: ['entry-level', 'budget', 'acer']
  },
  {
    name: 'Lenovo IdeaPad Slim 3',
    slug: 'lenovo-ideapad-slim-3',
    sku: 'LNV-IPS-3',
    description: 'Clean mid-range student workstation featuring robust AMD Ryzen 5, 16GB RAM for multitasking, and rapid charge tech.',
    price: 130000,
    originalPrice: 135000,
    stock: 15,
    images: ['https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Lenovo',
    rating: 4.2,
    reviewCount: 20,
    isFeatured: false,
    specifications: {
      ramGB: 16,
      storageSSD: '512GB PCIe 4.0 NVMe',
      processor: 'AMD Ryzen 5 7520U',
      display: '15.6" FHD IPS Anti-glare',
      batteryHours: 7,
      weightKg: 1.62,
      operatingSystem: 'Windows 11 Home',
      wireless: true,
      ports: ['1x USB-C (PD/DP)', '2x USB-A', '1x HDMI 1.4', '1x SD Card Reader']
    },
    tags: ['student', 'mid-range', 'lenovo', 'multitask']
  },
  {
    name: 'MacBook Air 13 M2',
    slug: 'macbook-air-13-m2',
    sku: 'APL-MBA13-M2',
    description: 'Remarkably thin fanless aluminum shell. Operates silently, provides excellent battery runtime, and includes beautiful Liquid Retina display.',
    price: 299000,
    originalPrice: 320000,
    stock: 9,
    images: ['https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Apple',
    rating: 4.8,
    reviewCount: 68,
    isFeatured: true,
    specifications: {
      ramGB: 8,
      storageSSD: '256GB Unified SSD',
      processor: 'Apple M2 (8-core CPU, 8-core GPU)',
      display: '13.6" Liquid Retina',
      batteryHours: 15,
      weightKg: 1.24,
      operatingSystem: 'macOS Ventura',
      wireless: true,
      ports: ['2x Thunderbolt / USB 4', '1x MagSafe 3', '1x Audio Jack']
    },
    tags: ['silent', 'macbook-air', 'apple', 'student', 'lightweight']
  },
  {
    name: 'Dell Latitude 5440',
    slug: 'dell-latitude-5440',
    sku: 'DEL-LAT-5440',
    description: 'Enterprise-grade secure developer laptop. Built for longevity, high maintenance compatibility, and standard programming tasks.',
    price: 175000,
    originalPrice: 190000,
    stock: 14,
    images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'Dell',
    rating: 4.3,
    reviewCount: 12,
    isFeatured: false,
    specifications: {
      ramGB: 16,
      storageSSD: '512GB PCIe NVMe',
      processor: 'Intel Core i5-1335U',
      display: '14" FHD IPS Anti-Glare',
      batteryHours: 8,
      weightKg: 1.39,
      operatingSystem: 'Windows 11 Pro',
      wireless: true,
      ports: ['2x USB-C Thunderbolt 4', '2x USB-A 3.2', '1x HDMI 2.0', '1x RJ-45 Ethernet']
    },
    tags: ['office', 'enterprise', 'programming', 'dell']
  },
  {
    name: 'HP ProBook 450 G10',
    slug: 'hp-probook-450-g10',
    sku: 'HP-PRO-450G10',
    description: 'Full numeric keypad workstation. High performance Intel Core i7 with robust storage capabilities and upgradability features.',
    price: 185000,
    originalPrice: 199000,
    stock: 10,
    images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['laptops'],
    brand: 'HP',
    rating: 4.4,
    reviewCount: 16,
    isFeatured: false,
    specifications: {
      ramGB: 16,
      storageSSD: '512GB PCIe Gen4x4 NVMe',
      processor: 'Intel Core i7-1355U',
      display: '15.6" FHD UWVA Anti-Glare',
      batteryHours: 7,
      weightKg: 1.79,
      operatingSystem: 'Windows 11 Pro',
      wireless: true,
      ports: ['2x USB-C 3.2', '2x USB-A 3.2', '1x HDMI 2.1', '1x RJ-45 Ethernet']
    },
    tags: ['hp', 'office', 'programming', 'workstation']
  },

  // --- HEADPHONES ---
  {
    name: 'Sony WH-1000XM5',
    slug: 'sony-wh-1000xm5',
    sku: 'SNY-WH1000XM5',
    description: 'Industry-leading wireless active noise cancellation. Redefined dual processor setup, 8 microphones, and luxurious soft fit leather headband.',
    price: 85000,
    originalPrice: 90000,
    stock: 15,
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['headphones'],
    brand: 'Sony',
    rating: 4.8,
    reviewCount: 94,
    isFeatured: true,
    specifications: {
      wireless: true,
      batteryHours: 30,
      hasANC: true,
      driverSizeMM: 30,
      connectorType: 'Bluetooth / 3.5mm Jack',
      weightGrams: 250,
      frequencyResponse: '4Hz - 40kHz'
    },
    tags: ['anc', 'wireless', 'premium', 'travel']
  },
  {
    name: 'Bose QuietComfort Ultra',
    slug: 'bose-quietcomfort-ultra',
    sku: 'BOS-QCU',
    description: 'Immersive sound space and premium comfort. World-class custom noise cancelation modes and spatial audio virtualization.',
    price: 95000,
    originalPrice: 105000,
    stock: 6,
    images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['headphones'],
    brand: 'Bose',
    rating: 4.7,
    reviewCount: 42,
    isFeatured: true,
    specifications: {
      wireless: true,
      batteryHours: 24,
      hasANC: true,
      driverSizeMM: 35,
      connectorType: 'Bluetooth / 2.5mm to 3.5mm Jack',
      weightGrams: 252,
      frequencyResponse: '10Hz - 25kHz'
    },
    tags: ['bose', 'anc', 'wireless', 'spatial-audio']
  },
  {
    name: 'Sennheiser HD 560S',
    slug: 'sennheiser-hd-560s',
    sku: 'SEN-HD560S',
    description: 'Open-back audiophile monitor headphones. Natural, analytical sound staging with wide stereo detailing. Ideal for audio editing and critical listening.',
    price: 45000,
    originalPrice: 48000,
    stock: 8,
    images: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['headphones'],
    brand: 'Sennheiser',
    rating: 4.6,
    reviewCount: 30,
    isFeatured: false,
    specifications: {
      wireless: false,
      batteryHours: 0,
      hasANC: false,
      driverSizeMM: 38,
      connectorType: '6.3mm Jack (with 3.5mm Adapter)',
      weightGrams: 240,
      frequencyResponse: '6Hz - 38kHz'
    },
    tags: ['audiophile', 'open-back', 'studio', 'wired']
  },
  {
    name: 'Audio-Technica ATH-M50x',
    slug: 'audio-technica-ath-m50x',
    sku: 'ATH-M50X',
    description: 'Legendary professional studio monitor headphones. Famous flat response, thick ear cups, and collapsible design. Used globally by programmers and producers.',
    price: 38000,
    originalPrice: 40000,
    stock: 20,
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['headphones'],
    brand: 'Audio-Technica',
    rating: 4.5,
    reviewCount: 120,
    isFeatured: false,
    specifications: {
      wireless: false,
      batteryHours: 0,
      hasANC: false,
      driverSizeMM: 45,
      connectorType: '3.5mm/6.3mm Detachable Cables',
      weightGrams: 285,
      frequencyResponse: '15Hz - 28kHz'
    },
    tags: ['studio', 'monitor', 'flat-response', 'wired']
  },
  {
    name: 'JBL Tune 720BT',
    slug: 'jbl-tune-720bt',
    sku: 'JBL-T720BT',
    description: 'Heavy bass signature wireless headphones featuring staggering 76-hour battery capacity and speed charging.',
    price: 18000,
    originalPrice: 20000,
    stock: 30,
    images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['headphones'],
    brand: 'JBL',
    rating: 4.0,
    reviewCount: 25,
    isFeatured: false,
    specifications: {
      wireless: true,
      batteryHours: 76,
      hasANC: false,
      driverSizeMM: 40,
      connectorType: 'Bluetooth 5.3 / 3.5mm Jack',
      weightGrams: 220,
      frequencyResponse: '20Hz - 20kHz'
    },
    tags: ['bass', 'long-battery', 'budget', 'wireless']
  },
  {
    name: 'Anker Soundcore Life Q30',
    slug: 'anker-soundcore-life-q30',
    sku: 'ANK-QC30',
    description: 'Unbeatable budget active noise cancelation. Custom EQ mapping in companion app, NFC pairing, and comfy memory foam cups.',
    price: 22000,
    originalPrice: 25000,
    stock: 18,
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['headphones'],
    brand: 'Anker',
    rating: 4.3,
    reviewCount: 50,
    isFeatured: false,
    specifications: {
      wireless: true,
      batteryHours: 40,
      hasANC: true,
      driverSizeMM: 40,
      connectorType: 'Bluetooth 5.0 / NFC / 3.5mm',
      weightGrams: 260,
      frequencyResponse: '16Hz - 40kHz'
    },
    tags: ['budget', 'anc', 'travel', 'wireless']
  },

  // --- KEYBOARDS ---
  {
    name: 'Keychron K2 V2 Mechanical Keyboard',
    slug: 'keychron-k2-v2',
    sku: 'KCN-K2-V2',
    description: 'Premium compact 75% tactile layout. Supports dual modes, hot-swappable switches, Mac-friendly media layouts, and gorgeous RGB lighting.',
    price: 24000,
    originalPrice: 26000,
    stock: 12,
    images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['keyboards'],
    brand: 'Keychron',
    rating: 4.7,
    reviewCount: 78,
    isFeatured: true,
    specifications: {
      mechanical: true,
      layout: '75%',
      backlighting: 'RGB',
      connectivity: ['Bluetooth 5.1', 'USB-C'],
      switchType: 'Gateron G Pro Brown (Tactile)',
      batteryCapacityMAH: 4000,
      keycapMaterial: 'Double-shot ABS'
    },
    tags: ['mechanical', '75-percent', 'keychron', 'coder-gear']
  },
  {
    name: 'Logitech MX Keys S',
    slug: 'logitech-mx-keys-s',
    sku: 'LOG-MXKS',
    description: 'Sleek low-profile silent typing experience. Fluid keys sculpted for your fingertips, smart backlighting activation, and multi-device flow switching.',
    price: 28000,
    originalPrice: 30000,
    stock: 10,
    images: ['https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['keyboards'],
    brand: 'Logitech',
    rating: 4.6,
    reviewCount: 35,
    isFeatured: true,
    specifications: {
      mechanical: false,
      layout: 'Full-size',
      backlighting: 'Smart White LED',
      connectivity: ['Bluetooth LE', 'Logi Bolt USB Receiver'],
      switchType: 'Membrane (Spherically-dished keys)',
      batteryCapacityMAH: 1500,
      keycapMaterial: 'Matte ABS'
    },
    tags: ['silent', 'office', 'productivity', 'wireless']
  },
  {
    name: 'Razer BlackWidow V4',
    slug: 'razer-blackwidow-v4',
    sku: 'RZR-BW-V4',
    description: 'High-performance mechanical gaming keyboard. Features clicky green switches, robust dial controls, dedicated macro keys, and Chroma RGB.',
    price: 36000,
    originalPrice: 39000,
    stock: 5,
    images: ['https://images.unsplash.com/photo-1595225476474-87563907a212?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['keyboards'],
    brand: 'Razer',
    rating: 4.5,
    reviewCount: 28,
    isFeatured: false,
    specifications: {
      mechanical: true,
      layout: 'Full-size',
      backlighting: 'Razer Chroma RGB (Individual Key)',
      connectivity: ['Detachable USB-C'],
      switchType: 'Razer Green (Clicky & Tactile)',
      keycapMaterial: 'Double-shot ABS'
    },
    tags: ['gaming', 'mechanical', 'razer', 'rgb']
  },
  {
    name: 'Redragon K552 Kumara',
    slug: 'redragon-k552',
    sku: 'RDG-K552',
    description: 'The standard budget mechanical keyboard. Tenkeyless layout, metal casing construction, and clicky blue equivalent switches.',
    price: 95000, // Wait, PKR 9,500! Typo safety check: PKR 9,500.
    originalPrice: 11000,
    stock: 40,
    images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['keyboards'],
    brand: 'Redragon',
    rating: 4.1,
    reviewCount: 95,
    isFeatured: false,
    specifications: {
      mechanical: true,
      layout: 'TKL (87 Keys)',
      backlighting: 'Rainbow LED',
      connectivity: ['Wired USB-A'],
      switchType: 'Outemu Blue (Clicky)',
      keycapMaterial: 'Double-shot ABS'
    },
    tags: ['budget', 'mechanical', 'tkl', 'wired']
  },
  {
    name: 'SteelSeries Apex Pro TKL (2023)',
    slug: 'steelseries-apex-pro-tkl-2023',
    sku: 'STL-AP-TKL23',
    description: 'World\'s fastest gaming keyboard. OmniPoint adjustable magnetic switches allow micro-customization of keystroke actuation depth.',
    price: 42000,
    originalPrice: 45000,
    stock: 3,
    images: ['https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=600&auto=format&fit=crop&q=60'],
    category: categoryMap['keyboards'],
    brand: 'SteelSeries',
    rating: 4.8,
    reviewCount: 19,
    isFeatured: true,
    specifications: {
      mechanical: true,
      layout: 'TKL',
      backlighting: 'Per-Key RGB',
      connectivity: ['Detachable USB-C'],
      switchType: 'OmniPoint 2.0 Adjustable HyperMagnetic',
      keycapMaterial: 'Double-shot PBT'
    },
    tags: ['magnetic-switches', 'gaming', 'mechanical', 'premium']
  }
];

const seedDatabase = async () => {
  try {
    await connectDB();

    // Clear existing data
    logger.info('Clearing old database records...');
    await Category.deleteMany({});
    await Product.deleteMany({});

    // Seed Categories
    logger.info('Inserting categories...');
    const insertedCategories = await Category.insertMany(categoriesData);
    
    // Create mapping of slug -> _id
    const categoryMap = {};
    insertedCategories.forEach(cat => {
      categoryMap[cat.slug] = cat._id;
    });

    // Seed Products
    logger.info('Inserting products...');
    const productsData = getProductsData(categoryMap);
    
    // Quick fix: check the price for Redragon K552, it should be 9500 not 95000. Let's fix that in memory.
    const redragonIndex = productsData.findIndex(p => p.sku === 'RDG-K552');
    if (redragonIndex !== -1) {
      productsData[redragonIndex].price = 9500;
    }

    await Product.insertMany(productsData);

    logger.info('Database seeded successfully!');
  } catch (error) {
    logger.error(`Error seeding database: ${error.message}`);
  } finally {
    await disconnectDB();
  }
};

// Run if script executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

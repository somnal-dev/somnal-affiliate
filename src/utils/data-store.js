require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

class DataStore {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.cache = {
      products: [],
      contents: [],
      dms: [],
      stats: {
        clicks: 0,
        conversions: 0,
        revenue: 0
      }
    };
  }

  async init() {
    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load existing data
    await this.loadAll();
  }

  async loadAll() {
    try {
      this.cache.products = await this.load('products.json');
      this.cache.contents = await this.load('contents.json');
      this.cache.dms = await this.load('dms.json');
      const stats = await this.load('stats.json');
      if (Object.keys(stats).length > 0) {
        this.cache.stats = stats;
      }
    } catch (error) {
      // Files don't exist yet, that's fine
    }
  }

  async load(filename) {
    try {
      const filepath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async save(filename, data) {
    const filepath = path.join(this.dataDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  // Products
  async addProduct(product) {
    this.cache.products.push({
      ...product,
      id: product.id || this.generateId(),
      addedAt: new Date().toISOString()
    });
    await this.save('products.json', this.cache.products);
  }

  getProducts(limit = 20) {
    return this.cache.products.slice(-limit);
  }

  // Contents
  async addContent(content) {
    this.cache.contents.push({
      ...content,
      id: content.id || this.generateId(),
      createdAt: new Date().toISOString()
    });
    await this.save('contents.json', this.cache.contents);
  }

  getContents(limit = 20) {
    return this.cache.contents.slice(-limit);
  }

  // DMs
  async addDm(dm) {
    this.cache.dms.push({
      ...dm,
      id: dm.id || this.generateId(),
      sentAt: new Date().toISOString()
    });
    await this.save('dms.json', this.cache.dms);
  }

  getDms(limit = 50) {
    return this.cache.dms.slice(-limit);
  }

  // Stats
  async updateStats(clicks = 0, conversions = 0, revenue = 0) {
    this.cache.stats.clicks += clicks;
    this.cache.stats.conversions += conversions;
    this.cache.stats.revenue += revenue;
    await this.save('stats.json', this.cache.stats);
  }

  getStats() {
    return this.cache.stats;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new DataStore();

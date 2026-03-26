require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * SHEIN 어필리에이트 API 클라이언트
 * API 문서: https://sheinaffiliate.com/
 */
class SheinClient {
  constructor() {
    this.affiliateId = process.env.SHEIN_AFFILIATE_ID;
    this.secret = process.env.SHEIN_SECRET;
    this.baseUrl = 'https://api.shein.com/v1';
    this.mockMode = !this.affiliateId || !this.secret;
    
    if (this.mockMode) {
      logger.info('SHEIN API: 모킹 모드로 동작 (API 키 없음)');
    }
  }

  async request(endpoint, params = {}) {
    if (this.mockMode) {
      return this.mockRequest(endpoint, params);
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          affiliate_id: this.affiliateId,
          ...params
        }
      });

      return response.data;
    } catch (error) {
      logger.error('SHEIN API 오류:', error.message);
      return this.mockRequest(endpoint, params);
    }
  }

  /**
   * 핫 상품 조회
   */
  async getHotProducts(categoryId = null, limit = 20, page = 1) {
    return this.request('/products/hot', {
      category_id: categoryId,
      limit,
      page
    });
  }

  /**
   * 상품 검색
   */
  async searchProducts(keyword, limit = 20, page = 1) {
    return this.request('/products/search', {
      keyword,
      limit,
      page
    });
  }

  /**
   * 카테고리별 상품 조회
   */
  async getProductsByCategory(categoryId, limit = 20, page = 1) {
    return this.request('/products/category', {
      category_id: categoryId,
      limit,
      page
    });
  }

  /**
   * 어필리에이트 링크 생성
   */
  async generateAffiliateLink(productUrl) {
    return this.request('/links/generate', {
      url: productUrl
    });
  }

  mockRequest(endpoint, params) {
    const mockProducts = [];
    const categories = ['Women', 'Men', 'Kids', 'Home', 'Beauty'];
    
    for (let i = 0; i < (params.limit || 20); i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      mockProducts.push({
        goods_id: `shein-${Date.now()}-${i}`,
        goods_name: `[MOCK] SHEIN ${category} Trending Item #${i + 1}`,
        goods_img: `https://example.com/shein-product-${i + 1}.jpg`,
        salePrice: (Math.random() * 100 + 10).toFixed(2),
        retailPrice: (Math.random() * 200 + 50).toFixed(2),
        currency: 'USD',
        goods_url: `https://www.shein.com/product-p-${Date.now() + i}.html`,
        category_name: category,
        commission_rate: (Math.random() * 0.15 + 0.05).toFixed(4),
        rating: (Math.random() * 2 + 3).toFixed(1),
        review_count: Math.floor(Math.random() * 5000)
      });
    }

    return {
      code: 0,
      message: 'success',
      data: {
        products: mockProducts,
        total: mockProducts.length
      }
    };
  }
}

module.exports = new SheinClient();

require('dotenv').config();
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * 알리익스프레스 어필리에이트 API 클라이언트
 * API 문서: https://portals.aliexpress.com/
 */
class AliExpressClient {
  constructor() {
    this.appKey = process.env.ALIEXPRESS_APP_KEY;
    this.appSecret = process.env.ALIEXPRESS_APP_SECRET;
    this.baseUrl = 'https://api-sg.aliexpress.com/sync';
    this.mockMode = !this.appKey || !this.appSecret;
    
    if (this.mockMode) {
      logger.info('알리익스프레스 API: 모킹 모드로 동작 (API 키 없음)');
    }
  }

  async request(method, params = {}) {
    if (this.mockMode) {
      return this.mockRequest(method, params);
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          method,
          app_key: this.appKey,
          timestamp: Date.now(),
          format: 'json',
          v: '2.0',
          ...params
        }
      });

      return response.data;
    } catch (error) {
      logger.error('알리익스프레스 API 오류:', error.message);
      return this.mockRequest(method, params);
    }
  }

  /**
   * 인기 상품 조회
   */
  async getHotProducts(categoryId = null, limit = 20) {
    return this.request('aliexpress.affiliate.hotproduct.query', {
      category_ids: categoryId,
      page_size: limit
    });
  }

  /**
   * 상품 검색
   */
  async searchProducts(keyword, limit = 20) {
    return this.request('aliexpress.affiliate.product.query', {
      keywords: keyword,
      page_size: limit
    });
  }

  /**
   * 어필리에이트 링크 생성
   */
  async generateAffiliateLink(productUrl) {
    return this.request('aliexpress.affiliate.link.generate', {
      source_values: productUrl
    });
  }

  mockRequest(method, params) {
    const mockProducts = [];
    
    for (let i = 0; i < (params.page_size || 20); i++) {
      mockProducts.push({
        product_id: `aliexpress-${Date.now()}-${i}`,
        product_title: `[MOCK] 알리익스프레스 인기 상품 #${i + 1}`,
        product_main_image_url: `https://example.com/aliexpress-product-${i + 1}.jpg`,
        target_sale_price: (Math.random() * 50 + 5).toFixed(2),
        target_sale_price_currency: 'USD',
        product_detail_url: `https://www.aliexpress.com/item/${Date.now() + i}.html`,
        commission_rate: (Math.random() * 0.1 + 0.03).toFixed(4),
        first_level_category_name: ['전자기기', '생활용품', '패션', '뷰티'][Math.floor(Math.random() * 4)],
        evaluate_rate: (Math.random() * 2 + 3).toFixed(1),
        lastest_volume: Math.floor(Math.random() * 5000)
      });
    }

    return {
      resp_result: {
        resp_code: 200,
        resp_msg: 'success',
        result: {
          products: mockProducts
        }
      }
    };
  }
}

module.exports = new AliExpressClient();

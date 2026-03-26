require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 쿠팡 파트너스 API 클라이언트
 * API 문서: https://partners.coupang.com/
 */
class CoupangClient {
  constructor() {
    this.accessKey = process.env.COUPANG_ACCESS_KEY;
    this.secretKey = process.env.COUPANG_SECRET_KEY;
    this.baseUrl = 'https://api-gateway.coupang.com';
    this.mockMode = !this.accessKey || !this.secretKey;
    
    if (this.mockMode) {
      logger.info('쿠팡 API: 모킹 모드로 동작 (API 키 없음)');
    }
  }

  generateSignature(method, path, timestamp) {
    if (!this.secretKey) return '';
    
    const message = `${timestamp}${method}${path}`;
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
  }

  async request(method, path, params = {}) {
    if (this.mockMode) {
      return this.mockRequest(path, params);
    }

    const timestamp = Date.now().toString();
    const signature = this.generateSignature(method, path, timestamp);

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        params,
        headers: {
          'Authorization': `CEA algorithm=sha256, access-key=${this.accessKey}, signed-date=${timestamp}, signature=${signature}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('쿠팡 API 오류:', error.message);
      return this.mockRequest(path, params);
    }
  }

  /**
   * 베스트 상품 조회
   */
  async getBestProducts(categoryId = null, limit = 20) {
    return this.request('GET', '/v2/providers/affiliate_open_api/apis/openapi/v1/products/best', {
      subId: 'somnal',
      limit
    });
  }

  /**
   * 상품 검색
   */
  async searchProducts(keyword, limit = 20) {
    return this.request('GET', '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search', {
      keyword,
      subId: 'somnal',
      limit
    });
  }

  /**
   * 카테고리별 상품 조회
   */
  async getProductsByCategory(categoryId, limit = 20) {
    return this.request('GET', '/v2/providers/affiliate_open_api/apis/openapi/v1/products/categories', {
      categoryId,
      subId: 'somnal',
      limit
    });
  }

  /**
   * 딥링크 생성
   */
  async generateDeeplink(url) {
    return this.request('POST', '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink', {
      coupangUrls: [url]
    });
  }

  mockRequest(path, params) {
    // 모킹: 가상의 상품 데이터 반환
    const mockProducts = [];
    const categories = ['생활용품', '전자기기', '뷰티', '주방용품', '펫용품'];
    
    for (let i = 0; i < (params.limit || 20); i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      mockProducts.push({
        productId: 1000000 + i,
        productName: `[MOCK] ${category} 인기 상품 #${i + 1}`,
        productImage: `https://example.com/product-${i + 1}.jpg`,
        productPrice: Math.floor(Math.random() * 100000) + 10000,
        productUrl: `https://www.coupang.com/vp/products/${1000000 + i}`,
        category,
        commissionRate: (Math.random() * 0.1 + 0.02).toFixed(4),
        isFreeShipping: Math.random() > 0.5,
        rating: (Math.random() * 2 + 3).toFixed(1),
        reviewCount: Math.floor(Math.random() * 10000)
      });
    }

    return {
      code: 'SUCCESS',
      message: 'OK',
      data: mockProducts
    };
  }
}

module.exports = new CoupangClient();

require('dotenv').config();
const coupang = require('./domestic/coupang');
const aliexpress = require('./domestic/aliexpress');
const amazon = require('./international/amazon');
const shein = require('./international/shein');
const dataStore = require('./utils/data-store');
const logger = require('./utils/logger');
const config = require('../config/settings.json');

/**
 * 상품 발굴 봇
 * 쿠팡, 알리익스프레스, 아마존, SHEIN에서 트렌딩 상품 수집
 */
class ProductHunter {
  constructor() {
    this.dailyLimit = parseInt(process.env.HUNT_DAILY_LIMIT) || 20;
    this.huntedCount = 0;
    this.lastHuntDate = null;
  }

  async init() {
    await dataStore.init();
    this.resetDailyCountIfNeeded();
  }

  resetDailyCountIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastHuntDate !== today) {
      this.huntedCount = 0;
      this.lastHuntDate = today;
    }
  }

  /**
   * 모든 플랫폼에서 상품 수집
   */
  async huntAll(keyword = null) {
    this.resetDailyCountIfNeeded();
    
    if (this.huntedCount >= this.dailyLimit) {
      logger.warn(`일일 발굴 한도(${this.dailyLimit}) 초과`);
      return [];
    }

    const products = [];

    // 병렬로 모든 플랫폼 수집
    const [coupangProducts, aliexpressProducts, amazonProducts, sheinProducts] = await Promise.allSettled([
      this.huntCoupang(keyword),
      this.huntAliexpress(keyword),
      this.huntAmazon(keyword),
      this.huntShein(keyword)
    ]);

    if (coupangProducts.status === 'fulfilled') {
      products.push(...coupangProducts.value.map(p => ({ ...p, platform: 'coupang', region: 'domestic' })));
    }
    if (aliexpressProducts.status === 'fulfilled') {
      products.push(...aliexpressProducts.value.map(p => ({ ...p, platform: 'aliexpress', region: 'domestic' })));
    }
    if (amazonProducts.status === 'fulfilled') {
      products.push(...amazonProducts.value.map(p => ({ ...p, platform: 'amazon', region: 'international' })));
    }
    if (sheinProducts.status === 'fulfilled') {
      products.push(...sheinProducts.value.map(p => ({ ...p, platform: 'shein', region: 'international' })));
    }

    // 수익률 기준 정렬
    const sortedProducts = products
      .sort((a, b) => (b.commissionRate || 0) - (a.commissionRate || 0))
      .slice(0, this.dailyLimit - this.huntedCount);

    // 데이터 저장
    for (const product of sortedProducts) {
      await dataStore.addProduct(product);
    }

    this.huntedCount += sortedProducts.length;
    logger.info(`${sortedProducts.length}개 상품 발굴 완료 (일일: ${this.huntedCount}/${this.dailyLimit})`);

    return sortedProducts;
  }

  /**
   * 쿠팡 상품 발굴
   */
  async huntCoupang(keyword = null) {
    try {
      let response;
      if (keyword) {
        response = await coupang.searchProducts(keyword, 5);
      } else {
        response = await coupang.getBestProducts(null, 5);
      }

      return this.normalizeCoupangProducts(response.data || []);
    } catch (error) {
      logger.error('쿠팡 상품 발굴 오류:', error.message);
      return [];
    }
  }

  /**
   * 알리익스프레스 상품 발굴
   */
  async huntAliexpress(keyword = null) {
    try {
      let response;
      if (keyword) {
        response = await aliexpress.searchProducts(keyword, 5);
      } else {
        response = await aliexpress.getHotProducts(null, 5);
      }

      return this.normalizeAliexpressProducts(response.resp_result?.result?.products || []);
    } catch (error) {
      logger.error('알리익스프레스 상품 발굴 오류:', error.message);
      return [];
    }
  }

  /**
   * 아마존 상품 발굴
   */
  async huntAmazon(keyword = null) {
    try {
      const response = await amazon.searchItems(keyword || 'best seller', 'All', 5);
      return this.normalizeAmazonProducts(response.SearchResult?.Items || []);
    } catch (error) {
      logger.error('아마존 상품 발굴 오류:', error.message);
      return [];
    }
  }

  /**
   * SHEIN 상품 발굴
   */
  async huntShein(keyword = null) {
    try {
      let response;
      if (keyword) {
        response = await shein.searchProducts(keyword, 5);
      } else {
        response = await shein.getHotProducts(null, 5);
      }

      return this.normalizeSheinProducts(response.data?.products || []);
    } catch (error) {
      logger.error('SHEIN 상품 발굴 오류:', error.message);
      return [];
    }
  }

  // 정규화 함수들
  normalizeCoupangProducts(products) {
    return products.map(p => ({
      id: `coupang-${p.productId}`,
      name: p.productName,
      image: p.productImage,
      price: p.productPrice,
      currency: 'KRW',
      url: p.productUrl,
      category: p.category,
      commissionRate: parseFloat(p.commissionRate) || 0.03,
      rating: parseFloat(p.rating) || 4.0,
      reviewCount: p.reviewCount || 0,
      isFreeShipping: p.isFreeShipping || false
    }));
  }

  normalizeAliexpressProducts(products) {
    return products.map(p => ({
      id: `aliexpress-${p.product_id}`,
      name: p.product_title,
      image: p.product_main_image_url,
      price: parseFloat(p.target_sale_price) * 1400, // USD to KRW (대략)
      currency: 'KRW',
      url: p.product_detail_url,
      category: p.first_level_category_name,
      commissionRate: parseFloat(p.commission_rate) || 0.05,
      rating: parseFloat(p.evaluate_rate) || 4.0,
      reviewCount: p.lastest_volume || 0
    }));
  }

  normalizeAmazonProducts(products) {
    return products.map(p => ({
      id: `amazon-${p.ASIN}`,
      name: p.ItemInfo?.Title?.DisplayValue,
      image: p.Images?.Primary?.Medium?.URL,
      price: (p.Offers?.Listings?.[0]?.Price?.Amount || 0) * 1400, // USD to KRW
      currency: 'KRW',
      url: p.DetailPageURL,
      category: p.category,
      commissionRate: parseFloat(p.commissionRate) || 0.04,
      rating: parseFloat(p.CustomerReviews?.StarRating?.DisplayValue) || 4.0,
      features: p.ItemInfo?.Features?.DisplayValues || []
    }));
  }

  normalizeSheinProducts(products) {
    return products.map(p => ({
      id: `shein-${p.goods_id}`,
      name: p.goods_name,
      image: p.goods_img,
      price: parseFloat(p.salePrice) * 1400, // USD to KRW
      originalPrice: parseFloat(p.retailPrice) * 1400,
      currency: 'KRW',
      url: p.goods_url,
      category: p.category_name,
      commissionRate: parseFloat(p.commission_rate) || 0.10,
      rating: parseFloat(p.rating) || 4.0,
      reviewCount: p.review_count || 0
    }));
  }

  /**
   * 카테고리별 발굴
   */
  async huntByCategory(categoryId) {
    const category = config.categories.find(c => c.id === categoryId);
    if (!category) {
      logger.warn(`카테고리를 찾을 수 없음: ${categoryId}`);
      return [];
    }

    const keywords = category.keywords;
    const allProducts = [];

    for (const keyword of keywords) {
      const products = await this.huntAll(keyword);
      allProducts.push(...products);
    }

    // 중복 제거
    const uniqueProducts = [...new Map(allProducts.map(p => [p.id, p])).values()];
    return uniqueProducts.slice(0, this.dailyLimit);
  }
}

module.exports = new ProductHunter();

// CLI 실행
if (require.main === module) {
  (async () => {
    const hunter = require('./product-hunter');
    await hunter.init();
    
    const keyword = process.argv[2];
    const products = await hunter.huntAll(keyword);
    
    console.log(JSON.stringify(products, null, 2));
  })();
}

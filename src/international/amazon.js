require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 아마존 어소시에이트 API 클라이언트 (Product Advertising API 5.0)
 * API 문서: https://webservices.amazon.com/paapi5/documentation/
 */
class AmazonClient {
  constructor() {
    this.accessKey = process.env.AMAZON_ACCESS_KEY;
    this.secretKey = process.env.AMAZON_SECRET_KEY;
    this.associateTag = process.env.AMAZON_ASSOCIATE_TAG;
    this.region = 'us-west-2';
    this.host = 'webservices.amazon.com';
    this.mockMode = !this.accessKey || !this.secretKey || !this.associateTag;
    
    if (this.mockMode) {
      logger.info('아마존 API: 모킹 모드로 동작 (API 키 없음)');
    }
  }

  generateSignature(stringToSign) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(stringToSign)
      .digest('base64');
  }

  async request(operation, payload) {
    if (this.mockMode) {
      return this.mockRequest(operation, payload);
    }

    try {
      const response = await axios.post(
        `https://${this.host}/paapi5/${operation.toLowerCase()}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Amz-Target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
            'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
            'Host': this.host
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('아마존 API 오류:', error.message);
      return this.mockRequest(operation, payload);
    }
  }

  /**
   * 상품 검색
   */
  async searchItems(keywords, searchIndex = 'All', itemCount = 20) {
    return this.request('SearchItems', {
      PartnerTag: this.associateTag,
      PartnerType: 'Associates',
      Keywords: keywords,
      SearchIndex: searchIndex,
      ItemCount: itemCount,
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'Images.Primary.Medium',
        'CustomerReviews.StarRating'
      ]
    });
  }

  /**
   * 베스트셀러 조회
   */
  async getBestSellers(searchIndex = 'All', itemCount = 20) {
    return this.request('GetItems', {
      PartnerTag: this.associateTag,
      PartnerType: 'Associates',
      ItemIds: ['bestsellers'],
      ItemCount: itemCount,
      Resources: [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Images.Primary.Medium'
      ]
    });
  }

  /**
   * 아이템 상세 조회
   */
  async getItem(asin) {
    return this.request('GetItems', {
      PartnerTag: this.associateTag,
      PartnerType: 'Associates',
      ItemIds: [asin],
      Resources: [
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'Images.Primary.Large',
        'CustomerReviews.StarRating'
      ]
    });
  }

  mockRequest(operation, payload) {
    const mockItems = [];
    const categories = ['Electronics', 'Beauty', 'Home', 'Kitchen', 'Pet Supplies'];
    
    for (let i = 0; i < (payload.ItemCount || 20); i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      mockItems.push({
        ASIN: `B0${Date.now().toString(36).toUpperCase()}${i}`,
        ItemInfo: {
          Title: {
            DisplayValue: `[MOCK] Amazon ${category} Best Seller #${i + 1}`
          },
          Features: {
            DisplayValues: ['Feature 1', 'Feature 2', 'Feature 3']
          }
        },
        Offers: {
          Listings: [{
            Price: {
              Amount: (Math.random() * 200 + 20).toFixed(2),
              Currency: 'USD'
            }
          }]
        },
        Images: {
          Primary: {
            Medium: {
              URL: `https://example.com/amazon-product-${i + 1}.jpg`
            }
          }
        },
        CustomerReviews: {
          StarRating: {
            DisplayValue: (Math.random() * 2 + 3).toFixed(1)
          }
        },
        DetailPageURL: `https://www.amazon.com/dp/B0${Date.now().toString(36).toUpperCase()}${i}?tag=${this.associateTag || 'somnal-20'}`,
        category,
        commissionRate: (Math.random() * 0.1 + 0.02).toFixed(4)
      });
    }

    return {
      SearchResult: {
        Items: mockItems
      },
      ItemsResult: {
        Items: mockItems
      }
    };
  }
}

module.exports = new AmazonClient();

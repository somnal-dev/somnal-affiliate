require('dotenv').config();
const glm5 = require('./utils/glm5-client');
const dataStore = require('./utils/data-store');
const logger = require('./utils/logger');
const config = require('../config/settings.json');

/**
 * 콘텐츠 생성기
 * GLM-5 API로 상품 홍보용 훅 문장, 설명, 해시태그 자동 생성
 */
class ContentGenerator {
  constructor() {
    this.variations = 3; // A/B 테스트용 버전 수
  }

  async init() {
    await dataStore.init();
  }

  /**
   * 상품에 대한 콘텐츠 생성
   */
  async generateForProduct(product) {
    try {
      const contents = [];

      for (let i = 0; i < this.variations; i++) {
        const content = await this.generateSingleContent(product, i);
        contents.push(content);
        await dataStore.addContent(content);
      }

      logger.info(`상품 [${product.name?.substring(0, 30)}] 콘텐츠 ${contents.length}개 생성 완료`);
      return contents;
    } catch (error) {
      logger.error('콘텐츠 생성 오류:', error.message);
      return [];
    }
  }

  /**
   * 단일 콘텐츠 생성
   */
  async generateSingleContent(product, variationIndex = 0) {
    const category = this.detectCategory(product);
    const styles = ['casual', 'enthusiastic', 'informative'];
    const style = styles[variationIndex % styles.length];

    const prompt = this.buildPrompt(product, category, style);
    
    const response = await glm5.generate(prompt, {
      systemPrompt: `당신은 한국 SNS 마케팅 전문가입니다. 
인스타그램 릴스와 틱톡에 올릴 짧고 강렬한 상품 홍보 문구를 만듭니다.
스타일: ${style}
- casual: 친근하고 편안한 톤
- enthusiastic: 열정적이고 감탄하는 톤
- informative: 정보 중심의 신뢰감 있는 톤`,
      temperature: 0.8,
      maxTokens: 500
    });

    try {
      // JSON 파싱 시도
      const parsed = JSON.parse(response);
      return {
        productId: product.id,
        productName: product.name,
        variation: variationIndex + 1,
        style,
        hook: parsed.hook || this.generateFallbackHook(product),
        description: parsed.description || this.generateFallbackDescription(product),
        cta: parsed.cta || "링크 댓글 남겨주시면 DM으로 보내드려요 🔗",
        hashtags: parsed.hashtags || this.generateHashtags(category),
        productUrl: product.url,
        category,
        createdAt: new Date().toISOString()
      };
    } catch {
      // JSON 파싱 실패시 텍스트에서 추출
      return this.parseTextResponse(response, product, category, style, variationIndex);
    }
  }

  /**
   * 프롬프트 구성
   */
  buildPrompt(product, category, style) {
    const priceInfo = product.price ? `가격: ₩${product.price.toLocaleString()}` : '';
    const ratingInfo = product.rating ? `평점: ${product.rating}점` : '';
    const features = product.features?.slice(0, 3).join(', ') || '';

    return `다음 상품에 대한 인스타그램/틱톡 홍보 콘텐츠를 만들어주세요.

상품명: ${product.name}
카테고리: ${category.name}
${priceInfo}
${ratingInfo}
특징: ${features || '인기 상품'}

다음 JSON 형식으로 응답해주세요:
{
  "hook": "첫 문장 (3초 내에 시선을 사로잡는 문장, 30자 이내)",
  "description": "상품 핵심 장점 3가지 (번호로 구분)",
  "cta": "행동 유도 문구",
  "hashtags": ["해시태그1", "해시태그2", ...]
}`;
  }

  /**
   * 카테고리 감지
   */
  detectCategory(product) {
    const name = (product.name || '').toLowerCase();
    const categoryStr = (product.category || '').toLowerCase();

    for (const cat of config.categories) {
      // 카테고리명 매칭
      if (categoryStr.includes(cat.name.toLowerCase())) {
        return cat;
      }
      // 키워드 매칭
      for (const keyword of cat.keywords) {
        if (name.includes(keyword) || categoryStr.includes(keyword)) {
          return cat;
        }
      }
    }

    // 기본값
    return config.categories[0];
  }

  /**
   * 텍스트 응답 파싱
   */
  parseTextResponse(text, product, category, style, variationIndex) {
    // 간단한 텍스트 파싱
    return {
      productId: product.id,
      productName: product.name,
      variation: variationIndex + 1,
      style,
      hook: this.generateFallbackHook(product),
      description: text.substring(0, 200),
      cta: "링크 댓글 남겨주시면 DM으로 보내드려요 🔗",
      hashtags: this.generateHashtags(category),
      productUrl: product.url,
      category,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 폴백 훅 문장
   */
  generateFallbackHook(product) {
    const hooks = [
      `이거 진짜 대박이에요... 우리집에서 매일 쓰는데`,
      `솔직히 말하면 이거 산 지 1주일 됐는데`,
      `이거 없이 어떻게 살았나 싶을 정도예요`,
      `인스타에서 봤는데 반해서 샀어요`,
      `가성비 끝판왕 진짜에요`,
      `저도 반신반의했는데 지금은`,
      `이거 쓰고 나서 삶이 달라졌어요`,
      `친구가 추천해줘서 샀는데 대박`
    ];
    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  /**
   * 폴백 설명
   */
  generateFallbackDescription(product) {
    const price = product.price ? `₩${product.price.toLocaleString()}` : '저렴한 가격';
    return `1. ${price}에 이 정도 퀄리티면 찐입니다\n2. 배송도 빠르고 포장도 깔끔해요\n3. 실사용 후기도 좋아요`;
  }

  /**
   * 해시태그 생성
   */
  generateHashtags(category) {
    const base = config.hashtags.base;
    const categoryTags = config.hashtags[category.id] || [];
    
    // 기본 + 카테고리 해시태그 조합
    const allTags = [...base.slice(0, 2), ...categoryTags.slice(0, 3)];
    return [...new Set(allTags)].slice(0, 5);
  }

  /**
   * 여러 상품 일괄 생성
   */
  async generateBatch(products) {
    const allContents = [];
    
    for (const product of products) {
      const contents = await this.generateForProduct(product);
      allContents.push(...contents);
      
      // API 레이트 리밋 방지
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allContents;
  }

  /**
   * 템플릿 기반 콘텐츠 생성 (빠른 버전)
   */
  generateFromTemplate(product) {
    const category = this.detectCategory(product);
    
    return {
      productId: product.id,
      productName: product.name,
      hook: this.generateFallbackHook(product),
      description: this.generateFallbackDescription(product),
      cta: "링크 댓글 남겨주시면 DM으로 보내드려요 🔗",
      hashtags: this.generateHashtags(category),
      productUrl: product.url,
      category: category.name,
      isTemplate: true,
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = new ContentGenerator();

// CLI 실행
if (require.main === module) {
  (async () => {
    const generator = require('./content-generator');
    await generator.init();
    
    const products = dataStore.getProducts(5);
    const contents = await generator.generateBatch(products);
    
    console.log(JSON.stringify(contents, null, 2));
  })();
}

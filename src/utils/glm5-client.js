require('dotenv').config();
const axios = require('axios');
const logger = require('./logger');

class GLM5Client {
  constructor() {
    this.baseUrl = process.env.GLM5_BASE_URL || 'https://api.z.ai/api/coding/paas/v4';
    this.apiKey = process.env.GLM5_API_KEY;
    this.model = 'glm-5-turbo';
  }

  async generate(prompt, options = {}) {
    if (!this.apiKey) {
      logger.warn('GLM-5 API 키가 없습니다. 모킹 모드로 동작합니다.');
      return this.mockGenerate(prompt);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: options.systemPrompt || '당신은 한국어 마케팅 전문가입니다.' },
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || 0.8,
          max_tokens: options.maxTokens || 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('GLM-5 API 오류:', error.message);
      return this.mockGenerate(prompt);
    }
  }

  mockGenerate(prompt) {
    // 모킹: 상품 카테고리에 따른 기본 응답
    if (prompt.includes('훅 문장')) {
      return JSON.stringify({
        hook: "이거 진짜 대박이에요... 저도 첨엔 반신반의했는데",
        description: "1. 가성비 최고\n2. 품질 좋음\n3. 배송 빠름",
        cta: "링크 댓글 남겨주시면 DM으로 보내드려요 🔗",
        hashtags: ["#쿠팡추천", "#대박상품", "#생활꿀템"],
        product_url: ""
      });
    }
    return "모킹 응답";
  }
}

module.exports = new GLM5Client();

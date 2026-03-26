require('dotenv').config();
const axios = require('axios');
const dataStore = require('./utils/data-store');
const logger = require('./utils/logger');
const config = require('../config/settings.json');

/**
 * DM 자동 발송기
 * Instagram Graph API로 댓글 감지 → 자동 DM 발송
 */
class DMSender {
  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    this.appId = process.env.INSTAGRAM_APP_ID;
    this.appSecret = process.env.INSTAGRAM_APP_SECRET;
    
    this.dailyLimit = parseInt(process.env.DM_DAILY_LIMIT) || 50;
    this.sentCount = 0;
    this.lastSentDate = null;
    this.sentUsers = new Set(); // 중복 방지
    
    this.mockMode = !this.accessToken || !this.businessAccountId;
    
    if (this.mockMode) {
      logger.info('인스타그램 DM: 모킹 모드로 동작 (API 키 없음)');
    }
  }

  async init() {
    await dataStore.init();
    await this.loadSentHistory();
  }

  /**
   * 이미 보낸 사용자 기록 로드
   */
  async loadSentHistory() {
    const dms = dataStore.getDms(1000);
    this.sentUsers = new Set(dms.map(dm => dm.userId));
  }

  resetDailyCountIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastSentDate !== today) {
      this.sentCount = 0;
      this.lastSentDate = today;
      this.sentUsers.clear();
    }
  }

  /**
   * 미디어(릴스/포스트)의 댓글 조회
   */
  async getComments(mediaId) {
    if (this.mockMode) {
      return this.mockComments(mediaId);
    }

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${mediaId}/comments`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,text,from{id,username},timestamp'
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      logger.error('댓글 조회 오류:', error.message);
      return this.mockComments(mediaId);
    }
  }

  /**
   * DM 발송
   */
  async sendDM(recipientId, message, productUrl = null) {
    this.resetDailyCountIfNeeded();

    // 중복 체크
    if (this.sentUsers.has(recipientId)) {
      logger.info(`중복 DM 스킵: ${recipientId}`);
      return { success: false, reason: 'duplicate' };
    }

    // 일일 한도 체크
    if (this.sentCount >= this.dailyLimit) {
      logger.warn(`일일 DM 한도(${this.dailyLimit}) 초과`);
      return { success: false, reason: 'daily_limit_exceeded' };
    }

    // 실제 메시지 구성
    const finalMessage = productUrl 
      ? message.replace('{product_url}', productUrl)
      : message;

    if (this.mockMode) {
      return this.mockSendDM(recipientId, finalMessage);
    }

    try {
      // Instagram Graph API DM 발송
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/messages`,
        {
          recipient: { id: recipientId },
          message: { text: finalMessage }
        },
        {
          params: { access_token: this.accessToken }
        }
      );

      // 기록
      this.sentCount++;
      this.sentUsers.add(recipientId);
      
      await dataStore.addDm({
        userId: recipientId,
        message: finalMessage,
        productUrl,
        success: true,
        messageId: response.data.message_id
      });

      logger.info(`DM 발송 성공: ${recipientId} (${this.sentCount}/${this.dailyLimit})`);
      return { success: true, messageId: response.data.message_id };
    } catch (error) {
      logger.error('DM 발송 오류:', error.message);
      
      await dataStore.addDm({
        userId: recipientId,
        message: finalMessage,
        productUrl,
        success: false,
        error: error.message
      });

      return { success: false, reason: error.message };
    }
  }

  /**
   * 링크 요청 댓글 감지 → 자동 DM 발송
   */
  async processLinkRequestComments(mediaId, productUrl, templateId = 'default') {
    const comments = await this.getComments(mediaId);
    const template = this.getTemplate(templateId);
    const results = [];

    for (const comment of comments) {
      // 링크 요청 감지 (키워드)
      if (this.isLinkRequest(comment.text)) {
        const result = await this.sendDM(
          comment.from?.id,
          template,
          productUrl
        );
        results.push({
          commentId: comment.id,
          userId: comment.from?.id,
          username: comment.from?.username,
          result
        });

        // 스팸 방지 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`댓글 ${comments.length}개 중 ${results.length}개 처리`);
    return results;
  }

  /**
   * 링크 요청 댓글인지 판단
   */
  isLinkRequest(text) {
    const keywords = ['링크', 'link', '어디서', '사고싶', '구매', '구입', '어디서샀', '좀 보내', 'dm', '디엠'];
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * DM 템플릿 가져오기
   */
  getTemplate(templateId) {
    const template = config.dmTemplates.find(t => t.id === templateId);
    return template?.template || config.dmTemplates[0].template;
  }

  /**
   * 대량 DM 발송 (주의해서 사용)
   */
  async sendBulkDMs(recipients, productUrl, templateId = 'default', delayMs = 2000) {
    const results = [];
    const template = this.getTemplate(templateId);

    for (const recipient of recipients) {
      const result = await this.sendDM(recipient.id, template, productUrl);
      results.push({ recipient: recipient.id, result });
      
      // 스팸 방지 딜레이
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return results;
  }

  /**
   * 미디어 ID로 댓글 모니터링 시작
   */
  async startMonitoring(mediaId, productUrl, intervalMs = 60000) {
    logger.info(`댓글 모니터링 시작: ${mediaId}`);
    
    const monitor = async () => {
      await this.processLinkRequestComments(mediaId, productUrl);
    };

    // 초기 실행
    await monitor();

    // 주기적 실행
    return setInterval(monitor, intervalMs);
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      sentToday: this.sentCount,
      dailyLimit: this.dailyLimit,
      remaining: this.dailyLimit - this.sentCount,
      totalSent: this.sentUsers.size
    };
  }

  // 모킹 함수들
  mockComments(mediaId) {
    const mockUsers = ['user_kim', 'user_lee', 'user_park', 'user_choi', 'user_jung'];
    const mockTexts = [
      '링크 부탁드려요!',
      '이거 어디서 사나요?',
      'link please 🙏',
      'DM으로 링크 좀 보내주세요',
      '저도 사고 싶어요!',
      '이쁘네요 어디서?',
      '구매 링크 있나요?'
    ];

    return mockUsers.map((user, i) => ({
      id: `comment_${Date.now()}_${i}`,
      text: mockTexts[Math.floor(Math.random() * mockTexts.length)],
      from: {
        id: `ig_${user}_${Date.now()}`,
        username: user
      },
      timestamp: new Date().toISOString()
    }));
  }

  mockSendDM(recipientId, message) {
    this.sentCount++;
    this.sentUsers.add(recipientId);

    // 기록 저장
    dataStore.addDm({
      userId: recipientId,
      message,
      success: true,
      messageId: `mock_dm_${Date.now()}`,
      isMock: true
    });

    logger.info(`[MOCK] DM 발송 성공: ${recipientId} (${this.sentCount}/${this.dailyLimit})`);
    return { success: true, messageId: `mock_dm_${Date.now()}`, isMock: true };
  }
}

module.exports = new DMSender();

// CLI 실행
if (require.main === module) {
  (async () => {
    const dmSender = require('./dm-sender');
    await dmSender.init();
    
    const args = process.argv.slice(2);
    
    if (args[0] === 'test') {
      // 테스트 모드: 목업 미디어 ID로 댓글 처리
      const mediaId = 'mock_media_123';
      const productUrl = 'https://coupa.ng/test123';
      const results = await dmSender.processLinkRequestComments(mediaId, productUrl);
      console.log(JSON.stringify(results, null, 2));
    } else if (args[0] === 'stats') {
      console.log(JSON.stringify(dmSender.getStats(), null, 2));
    } else {
      console.log('Usage: node dm-sender.js [test|stats]');
    }
  })();
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const productHunter = require('./product-hunter');
const contentGenerator = require('./content-generator');
const dmSender = require('./dm-sender');
const dataStore = require('./utils/data-store');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3004;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 초기화
async function initialize() {
  await dataStore.init();
  await productHunter.init();
  await contentGenerator.init();
  await dmSender.init();
  
  logger.info('어필리에이트 시스템 초기화 완료');
  
  // 자동 상품 발굴 스케줄 (매일 오전 9시)
  cron.schedule('0 9 * * *', async () => {
    logger.info('자동 상품 발굴 시작...');
    await productHunter.huntAll();
  });
}

// ============================================
// API 라우트
// ============================================

/**
 * GET /api/products
 * 발굴된 상품 목록
 */
app.get('/api/products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const products = dataStore.getProducts(limit);
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    logger.error('상품 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/products/hunt
 * 상품 수동 발굴
 */
app.post('/api/products/hunt', async (req, res) => {
  try {
    const { keyword, category } = req.body;
    
    let products;
    if (category) {
      products = await productHunter.huntByCategory(category);
    } else {
      products = await productHunter.huntAll(keyword);
    }
    
    res.json({
      success: true,
      hunted: products.length,
      data: products
    });
  } catch (error) {
    logger.error('상품 발굴 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/content
 * 생성된 콘텐츠 목록
 */
app.get('/api/content', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const contents = dataStore.getContents(limit);
    res.json({
      success: true,
      count: contents.length,
      data: contents
    });
  } catch (error) {
    logger.error('콘텐츠 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/content/generate
 * 콘텐츠 생성
 */
app.post('/api/content/generate', async (req, res) => {
  try {
    const { product } = req.body;
    
    if (!product) {
      // 상품이 없으면 저장된 상품에서 랜덤 선택
      const products = dataStore.getProducts(1);
      if (products.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: '상품이 없습니다. 먼저 상품을 발굴해주세요.' 
        });
      }
      const contents = await contentGenerator.generateForProduct(products[0]);
      return res.json({ success: true, count: contents.length, data: contents });
    }
    
    const contents = await contentGenerator.generateForProduct(product);
    res.json({
      success: true,
      count: contents.length,
      data: contents
    });
  } catch (error) {
    logger.error('콘텐츠 생성 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats
 * 클릭수, 전환수, 수익 통계
 */
app.get('/api/stats', (req, res) => {
  try {
    const stats = dataStore.getStats();
    const dmStats = dmSender.getStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        dm: dmStats,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('통계 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/stats/update
 * 통계 수동 업데이트
 */
app.post('/api/stats/update', async (req, res) => {
  try {
    const { clicks, conversions, revenue } = req.body;
    await dataStore.updateStats(clicks || 0, conversions || 0, revenue || 0);
    
    res.json({
      success: true,
      data: dataStore.getStats()
    });
  } catch (error) {
    logger.error('통계 업데이트 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dm/send
 * DM 발송
 */
app.post('/api/dm/send', async (req, res) => {
  try {
    const { recipientId, message, productUrl } = req.body;
    
    if (!recipientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'recipientId가 필요합니다.' 
      });
    }
    
    const result = await dmSender.sendDM(recipientId, message, productUrl);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('DM 발송 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/dm/process-comments
 * 댓글 처리 (링크 요청 → DM 발송)
 */
app.post('/api/dm/process-comments', async (req, res) => {
  try {
    const { mediaId, productUrl, templateId } = req.body;
    
    if (!mediaId || !productUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'mediaId와 productUrl이 필요합니다.' 
      });
    }
    
    const results = await dmSender.processLinkRequestComments(
      mediaId, 
      productUrl, 
      templateId
    );
    
    res.json({
      success: true,
      processed: results.length,
      data: results
    });
  } catch (error) {
    logger.error('댓글 처리 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dm/stats
 * DM 발송 통계
 */
app.get('/api/dm/stats', (req, res) => {
  try {
    const stats = dmSender.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('DM 통계 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dms
 * 발송된 DM 목록
 */
app.get('/api/dms', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const dms = dataStore.getDms(limit);
    res.json({
      success: true,
      count: dms.length,
      data: dms
    });
  } catch (error) {
    logger.error('DM 목록 조회 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/automation/run
 * 전체 자동화 실행 (발굴 → 생성 → 준비)
 */
app.post('/api/automation/run', async (req, res) => {
  try {
    logger.info('전체 자동화 실행 시작');
    
    // 1. 상품 발굴
    const products = await productHunter.huntAll();
    logger.info(`상품 ${products.length}개 발굴 완료`);
    
    // 2. 콘텐츠 생성
    const contents = await contentGenerator.generateBatch(products.slice(0, 5));
    logger.info(`콘텐츠 ${contents.length}개 생성 완료`);
    
    res.json({
      success: true,
      data: {
        productsHunted: products.length,
        contentsGenerated: contents.length,
        products: products.slice(0, 5),
        contents: contents.slice(0, 3)
      }
    });
  } catch (error) {
    logger.error('자동화 실행 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/health
 * 헬스 체크
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================
// 대시보드 UI (선택적)
// ============================================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Somnal Affiliate Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #fff; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .card { background: #1a1a1a; border-radius: 12px; padding: 20px; }
    .stat { text-align: center; }
    .stat-value { font-size: 2.5rem; font-weight: bold; color: #4ade80; }
    .stat-label { color: #888; margin-top: 0.5rem; }
    button { background: #4ade80; color: #000; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; margin: 0.5rem; }
    button:hover { background: #22c55e; }
    button:disabled { background: #444; cursor: not-allowed; }
    pre { background: #0a0a0a; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.875rem; }
    .loading { opacity: 0.5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🖤 Somnal Affiliate Dashboard</h1>
    
    <div class="grid">
      <div class="card stat">
        <div class="stat-value" id="clicks">0</div>
        <div class="stat-label">총 클릭수</div>
      </div>
      <div class="card stat">
        <div class="stat-value" id="conversions">0</div>
        <div class="stat-label">전환수</div>
      </div>
      <div class="card stat">
        <div class="stat-value" id="revenue">₩0</div>
        <div class="stat-label">총 수익</div>
      </div>
      <div class="card stat">
        <div class="stat-value" id="dms">0</div>
        <div class="stat-label">오늘 발송 DM</div>
      </div>
    </div>

    <div class="card" style="margin-top: 20px;">
      <h2>⚡ 빠른 액션</h2>
      <button onclick="huntProducts()">🔍 상품 발굴</button>
      <button onclick="generateContent()">✨ 콘텐츠 생성</button>
      <button onclick="runAutomation()">🚀 전체 자동화</button>
      <button onclick="refreshStats()">🔄 새로고침</button>
    </div>

    <div class="card" style="margin-top: 20px;">
      <h2>📊 상품 목록 (최신 10개)</h2>
      <pre id="products">로딩 중...</pre>
    </div>

    <div class="card" style="margin-top: 20px;">
      <h2>💬 생성된 콘텐츠 (최신 5개)</h2>
      <pre id="contents">로딩 중...</pre>
    </div>
  </div>

  <script>
    const API = '/api';
    
    async function refreshStats() {
      try {
        const res = await fetch(API + '/stats');
        const json = await res.json();
        if (json.success) {
          document.getElementById('clicks').textContent = json.data.clicks.toLocaleString();
          document.getElementById('conversions').textContent = json.data.conversions.toLocaleString();
          document.getElementById('revenue').textContent = '₩' + json.data.revenue.toLocaleString();
          document.getElementById('dms').textContent = json.data.dm?.sentToday || 0;
        }
      } catch (e) { console.error(e); }
    }
    
    async function loadProducts() {
      try {
        const res = await fetch(API + '/products?limit=10');
        const json = await res.json();
        if (json.success) {
          document.getElementById('products').textContent = 
            json.data.map(p => \`[\${p.platform}] \${p.name} - ₩\${p.price?.toLocaleString()} (\${(p.commissionRate * 100).toFixed(1)}%)\`).join('\\n');
        }
      } catch (e) { console.error(e); }
    }
    
    async function loadContents() {
      try {
        const res = await fetch(API + '/content?limit=5');
        const json = await res.json();
        if (json.success) {
          document.getElementById('contents').textContent = 
            json.data.map(c => \`\${c.hook}\\n  👉 \${c.cta}\\n  # \${c.hashtags?.join(' ')}\`).join('\\n\\n');
        }
      } catch (e) { console.error(e); }
    }
    
    async function huntProducts() {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = '발굴 중...';
      try {
        const res = await fetch(API + '/products/hunt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const json = await res.json();
        alert(json.success ? json.hunted + '개 상품 발굴 완료!' : '오류: ' + json.error);
        loadProducts();
      } catch (e) { alert('오류: ' + e.message); }
      btn.disabled = false;
      btn.textContent = '🔍 상품 발굴';
    }
    
    async function generateContent() {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = '생성 중...';
      try {
        const res = await fetch(API + '/content/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const json = await res.json();
        alert(json.success ? json.count + '개 콘텐츠 생성 완료!' : '오류: ' + json.error);
        loadContents();
      } catch (e) { alert('오류: ' + e.message); }
      btn.disabled = false;
      btn.textContent = '✨ 콘텐츠 생성';
    }
    
    async function runAutomation() {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = '실행 중...';
      try {
        const res = await fetch(API + '/automation/run', { method: 'POST' });
        const json = await res.json();
        alert(json.success ? '자동화 완료!\\n상품: ' + json.data.productsHunted + '개\\n콘텐츠: ' + json.data.contentsGenerated + '개' : '오류: ' + json.error);
        refreshStats();
        loadProducts();
        loadContents();
      } catch (e) { alert('오류: ' + e.message); }
      btn.disabled = false;
      btn.textContent = '🚀 전체 자동화';
    }
    
    // 초기 로드
    refreshStats();
    loadProducts();
    loadContents();
    
    // 30초마다 자동 새로고침
    setInterval(refreshStats, 30000);
  </script>
</body>
</html>
  `);
});

// 서버 시작
initialize().then(() => {
  app.listen(PORT, () => {
    logger.info(`어필리에이트 서버 실행 중: http://localhost:${PORT}`);
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║        🖤 Somnal Affiliate System Started!               ║
╠═══════════════════════════════════════════════════════════╣
║  Dashboard: http://localhost:${PORT}                        ║
║  API Docs:  http://localhost:${PORT}/api/health             ║
║                                                           ║
║  Endpoints:                                               ║
║  - GET  /api/products      발굴된 상품 목록               ║
║  - POST /api/products/hunt 상품 발굴 실행                 ║
║  - GET  /api/content       생성된 콘텐츠                  ║
║  - POST /api/content/generate 콘텐츠 생성                 ║
║  - GET  /api/stats         수익 통계                      ║
║  - POST /api/dm/send       DM 발송                        ║
║  - POST /api/dm/process-comments 댓글 처리                ║
║  - POST /api/automation/run 전체 자동화                   ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}).catch(error => {
  logger.error('서버 초기화 실패:', error);
  process.exit(1);
});

module.exports = app;

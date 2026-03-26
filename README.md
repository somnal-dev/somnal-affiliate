# Somnal Affiliate System

어필리에이트 마케팅 자동화 시스템

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 API 키 입력

# 서버 시작
npm start

# 또는 PM2로 실행
pm2 start ecosystem.config.js
```

## 📊 대시보드

http://localhost:3004 에서 웹 대시보드 접속

## 🔌 API 엔드포인트

### 상품
- `GET /api/products` - 발굴된 상품 목록
- `POST /api/products/hunt` - 상품 발굴 실행

### 콘텐츠
- `GET /api/content` - 생성된 콘텐츠 목록
- `POST /api/content/generate` - 콘텐츠 생성

### 통계
- `GET /api/stats` - 수익 통계
- `POST /api/stats/update` - 통계 업데이트

### DM
- `POST /api/dm/send` - DM 발송
- `POST /api/dm/process-comments` - 댓글 처리
- `GET /api/dm/stats` - DM 통계

### 자동화
- `POST /api/automation/run` - 전체 자동화 실행

## ⚙️ 환경 변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| COUPANG_ACCESS_KEY | 쿠팡 파트너스 Access Key | 선택 |
| COUPANG_SECRET_KEY | 쿠팡 파트너스 Secret Key | 선택 |
| AMAZON_ACCESS_KEY | 아마존 어소시에이트 Access Key | 선택 |
| AMAZON_SECRET_KEY | 아마존 어소시에이트 Secret Key | 선택 |
| AMAZON_ASSOCIATE_TAG | 아마존 어소시에이트 Tag | 선택 |
| INSTAGRAM_ACCESS_TOKEN | 인스타그램 Graph API 토큰 | 선택 |
| INSTAGRAM_BUSINESS_ACCOUNT_ID | 인스타그램 비즈니스 계정 ID | 선택 |
| GLM5_API_KEY | GLM-5 API 키 | 권장 |
| PORT | 서버 포트 (기본: 3004) | 선택 |
| DM_DAILY_LIMIT | 일일 DM 발송 한도 (기본: 50) | 선택 |
| HUNT_DAILY_LIMIT | 일일 상품 발굴 한도 (기본: 20) | 선택 |
| MOCK_MODE | 모킹 모드 강제 사용 | 선택 |

## 🔧 모킹 모드

API 키가 없어도 시스템이 동작하도록 모킹 모드를 지원합니다.

- API 키가 설정되지 않으면 자동으로 모킹 모드로 전환
- 가상의 상품 데이터와 DM 발송 결과 반환
- 실제 API 연결 없이 시스템 테스트 가능

## 📁 프로젝트 구조

```
somnal-affiliate/
├── src/
│   ├── server.js           # Express 서버
│   ├── product-hunter.js   # 상품 발굴 봇
│   ├── content-generator.js # 콘텐츠 생성기
│   ├── dm-sender.js        # DM 자동 발송기
│   ├── domestic/           # 국내 API
│   │   ├── coupang.js
│   │   └── aliexpress.js
│   ├── international/      # 해외 API
│   │   ├── amazon.js
│   │   └── shein.js
│   └── utils/
│       ├── logger.js
│       ├── glm5-client.js
│       └── data-store.js
├── config/
│   └── settings.json
├── data/                   # 저장된 데이터
├── logs/                   # 로그 파일
├── ecosystem.config.js     # PM2 설정
├── package.json
└── README.md
```

## 🎯 목표

6월까지 월 1,000만원 수익 달성

### 예상 수익 계산
- 댓글당 평균 수익: ₩1,000~5,000
- 일일 DM 발송: 50건
- 전환율: 10%
- 일일 수익: ₩5,000~25,000
- 월 수익: ₩150,000~750,000

스케일업으로 목표 달성 가능!

## 📝 라이선스

MIT

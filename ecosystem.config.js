module.exports = {
  apps: [
    {
      name: 'somnal-affiliate',
      cwd: '/home/choi/.openclaw/workspace/somnal-affiliate',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3004
      },
      error_file: '/home/choi/.openclaw/workspace/somnal-affiliate/logs/error.log',
      out_file: '/home/choi/.openclaw/workspace/somnal-affiliate/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 자동 재시작 설정
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 3000
    },
    {
      name: 'somnal-affiliate-hunter',
      cwd: '/home/choi/.openclaw/workspace/somnal-affiliate',
      script: 'src/product-hunter.js',
      cron_restart: '0 9 * * *', // 매일 오전 9시
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'somnal-affiliate-content',
      cwd: '/home/choi/.openclaw/workspace/somnal-affiliate',
      script: 'src/content-generator.js',
      cron_restart: '0 10 * * *', // 매일 오전 10시
      autorestart: false,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

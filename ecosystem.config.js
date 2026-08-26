/**
 * Cấu hình PM2 cho Joytab. Chạy: pm2 start ecosystem.config.js
 *
 * BE đọc cấu hình từ api/.env (PORT=9000) nên `cwd` phải là ./api, không set NODE_ENV ở đây
 * để khỏi vô tình bật cookie `secure` khi vẫn chạy http://localhost.
 * FE chạy bản build sẵn qua `pnpm start` (đã gắn -p 3005 trong ui/package.json).
 */
module.exports = {
  apps: [
    {
      name: 'joytab-api',
      cwd: './api',
      script: 'dist/src/main.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
    {
      name: 'joytab-ui',
      cwd: './ui',
      script: 'pnpm',
      args: 'start',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};

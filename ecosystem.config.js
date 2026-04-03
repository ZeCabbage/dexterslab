module.exports = {
  apps: [
    {
      name: 'dexterslab-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './dexterslab-frontend'
    },
    {
      name: 'dexterslab-backend',
      script: 'server.js',
      cwd: './dexterslab-backend',
      interpreter: 'node',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      merge_logs: true,
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
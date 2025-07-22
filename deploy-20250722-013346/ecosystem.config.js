module.exports = {
  apps: [{
    name: 'fuckit-app',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/re.podtards.com',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};

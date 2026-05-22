module.exports = {
  apps: [
    {
      name: "sleepox",
      script: "bun",
      args: "run serve:selfhost",
      env: {
        HOST: "0.0.0.0",
        PORT: "3000",
        NODE_ENV: "production",
      },
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 5,
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
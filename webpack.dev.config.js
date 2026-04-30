const { createConfig } = require('@openedx/frontend-build');

const config = createConfig('webpack-dev');

config.devServer = {
  ...config.devServer,
  allowedHosts: 'all',
};

module.exports = config;

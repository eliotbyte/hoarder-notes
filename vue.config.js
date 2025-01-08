const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require('webpack');
require('dotenv').config(); // Add dotenv to load environment variables

module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.DefinePlugin({
        // Vue feature flags
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        'process.env.VITE_API_URL': JSON.stringify(process.env.VUE_APP_API_URL || 'http://localhost:3001'),
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),
      new BundleAnalyzerPlugin({
        analyzerMode: 'disabled',
        openAnalyzer: false,
      }),
    ],
    performance: {
      hints: false,
    },
  },
  devServer: {
    proxy: {
      '/api': {
        target: process.env.VUE_APP_API_URL || 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        pathRewrite: { '^/api': '' },
      },
    },
  },
};

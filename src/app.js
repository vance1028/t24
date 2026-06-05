'use strict';

const express = require('express');
const cors = require('cors');

const categoriesRouter = require('./routes/categories');
const articlesRouter = require('./routes/articles');
const activitiesRouter = require('./routes/activities');
const { sendError } = require('./utils/http');

/**
 * 创建 Express 应用实例。
 *
 * 注意：数据库连接与种子数据由调用方（server.js / 测试）负责准备，
 * 本函数只负责组装中间件与路由。
 *
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: '爱国主义教育宣传管理平台',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/categories', categoriesRouter);
  app.use('/api/articles', articlesRouter);
  app.use('/api/activities', activitiesRouter);

  // 404
  app.use((req, res) => {
    sendError(res, 404, '接口不存在');
  });

  // 统一错误处理（含 JSON 解析错误）
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return sendError(res, 400, '请求体不是合法的 JSON');
    }
    // eslint-disable-next-line no-console
    console.error(err);
    return sendError(res, 500, '服务器内部错误');
  });

  return app;
}

module.exports = { createApp };

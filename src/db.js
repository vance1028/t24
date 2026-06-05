'use strict';

const mysql = require('mysql2/promise');

/**
 * MySQL 连接池。连接参数全部来自环境变量，便于在 docker compose / 本地 / 测试间切换。
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 13306,
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'apppass',
  database: process.env.DB_NAME || 'patriotic_edu',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: false,
});

/**
 * 带重试地等待数据库就绪（容器刚拉起时 MySQL 可能还没接受连接）。
 */
async function waitForDb({ retries = 30, delayMs = 1000 } = {}) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, waitForDb, close };

'use strict';

/**
 * 数据仓储层 - 基于 MySQL（mysql2/promise）。
 *
 * 所有方法均为 async，返回与旧内存实现一致的对象结构（camelCase 字段），
 * 以便路由层无需关心底层是内存还是数据库。
 */

const { pool } = require('../db');

/* ----------------------------- 行映射 ----------------------------- */

function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapArticle(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    categoryId: row.category_id,
    author: row.author,
    status: row.status,
    tags: parseTags(row.tags),
    views: row.views,
    publishedAt: toIso(row.published_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: toIso(row.start_time),
    endTime: toIso(row.end_time),
    capacity: row.capacity,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapRegistration(row) {
  if (!row) return null;
  return {
    id: row.id,
    activityId: row.activity_id,
    name: row.name,
    department: row.department,
    createdAt: toIso(row.created_at),
  };
}

function toIso(v) {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function parseTags(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* --------------------------- 测试/初始化 --------------------------- */

/** 清空所有表并重新写入种子数据（供测试与本地初始化使用）。 */
async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE registrations');
    await conn.query('TRUNCATE TABLE articles');
    await conn.query('TRUNCATE TABLE activities');
    await conn.query('TRUNCATE TABLE categories');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await conn.query(
      `INSERT INTO categories (id, name, description) VALUES
        (1, '红色历史', '党史、新中国史、改革开放史、社会主义发展史宣传'),
        (2, '时政要闻', '重要会议精神与时政热点解读'),
        (3, '英模人物', '时代楷模、道德模范、革命先烈事迹')`,
    );
    await conn.query(
      `INSERT INTO articles (id, title, summary, content, category_id, author, status, tags, published_at) VALUES
        (1, '从一大到二十大：百年初心', '回顾党的重要历史节点', '中国共产党的百年历程是一部不懈奋斗史……', 1, '宣传部', 'published', JSON_ARRAY('党史','初心使命'), CURRENT_TIMESTAMP(3)),
        (2, '学习贯彻最新会议精神', '深入解读会议核心要义', '会议强调，要坚定不移……', 2, '理论学习中心组', 'published', JSON_ARRAY('时政'), CURRENT_TIMESTAMP(3)),
        (3, '草稿：英雄事迹征集启事', '面向全单位征集身边的英模故事', '现面向全体职工征集……', 3, '编辑部', 'draft', JSON_ARRAY('征集'), NULL)`,
    );
    await conn.query(
      `INSERT INTO activities (id, title, description, location, start_time, end_time, capacity) VALUES
        (1, '红色教育基地参观学习', '组织参观本地革命纪念馆，重温入党誓词', '市革命纪念馆', '2026-07-01 09:00:00.000', '2026-07-01 12:00:00.000', 50),
        (2, '爱国主义主题宣讲会', '邀请专家开展专题宣讲', '单位多功能厅', '2026-07-15 14:00:00.000', '2026-07-15 16:00:00.000', 2)`,
    );
  } finally {
    conn.release();
  }
}

/* ----------------------------- 分类 ----------------------------- */

async function listCategories() {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY id');
  return rows.map(mapCategory);
}

async function getCategory(id) {
  const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
  return mapCategory(rows[0]);
}

async function findCategoryByName(name) {
  const [rows] = await pool.query('SELECT * FROM categories WHERE name = ?', [name]);
  return mapCategory(rows[0]);
}

async function createCategory({ name, description = '' }) {
  const [result] = await pool.query(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [name, description],
  );
  return getCategory(result.insertId);
}

async function updateCategory(id, patch) {
  const sets = [];
  const params = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    params.push(patch.description);
  }
  if (sets.length > 0) {
    params.push(id);
    await pool.query(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getCategory(id);
}

async function deleteCategory(id) {
  const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function countArticlesByCategory(categoryId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM articles WHERE category_id = ?',
    [categoryId],
  );
  return rows[0].cnt;
}

/* ----------------------------- 文章 ----------------------------- */

async function listArticles({ categoryId, status, keyword } = {}) {
  const where = [];
  const params = [];
  if (categoryId !== undefined) {
    where.push('category_id = ?');
    params.push(categoryId);
  }
  if (status !== undefined) {
    where.push('status = ?');
    params.push(status);
  }
  if (keyword !== undefined && keyword !== '') {
    where.push('(title LIKE ? OR summary LIKE ? OR content LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM articles ${clause} ORDER BY id`,
    params,
  );
  return rows.map(mapArticle);
}

async function getArticle(id) {
  const [rows] = await pool.query('SELECT * FROM articles WHERE id = ?', [id]);
  return mapArticle(rows[0]);
}

async function createArticle({
  title,
  summary = '',
  content = '',
  categoryId,
  author = '',
  status = 'draft',
  tags = [],
}) {
  const publishedAt = status === 'published' ? new Date() : null;
  const [result] = await pool.query(
    `INSERT INTO articles (title, summary, content, category_id, author, status, tags, published_at)
     VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)`,
    [
      title,
      summary,
      content,
      categoryId,
      author,
      status,
      JSON.stringify(Array.isArray(tags) ? tags : []),
      publishedAt,
    ],
  );
  return getArticle(result.insertId);
}

async function updateArticle(id, patch) {
  const current = await getArticle(id);
  if (!current) return null;

  const sets = [];
  const params = [];
  const colMap = {
    title: 'title',
    summary: 'summary',
    content: 'content',
    categoryId: 'category_id',
    author: 'author',
  };
  for (const [key, col] of Object.entries(colMap)) {
    if (patch[key] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(patch[key]);
    }
  }
  if (patch.tags !== undefined) {
    sets.push('tags = CAST(? AS JSON)');
    params.push(JSON.stringify(Array.isArray(patch.tags) ? patch.tags : []));
  }
  if (patch.status !== undefined && patch.status !== current.status) {
    sets.push('status = ?');
    params.push(patch.status);
    if (patch.status === 'published' && !current.publishedAt) {
      sets.push('published_at = ?');
      params.push(new Date());
    }
  }
  if (sets.length > 0) {
    params.push(id);
    await pool.query(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getArticle(id);
}

async function deleteArticle(id) {
  const [result] = await pool.query('DELETE FROM articles WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function incrementArticleViews(id) {
  await pool.query('UPDATE articles SET views = views + 1 WHERE id = ?', [id]);
  return getArticle(id);
}

/* ----------------------------- 活动 ----------------------------- */

async function listActivities() {
  const [rows] = await pool.query('SELECT * FROM activities ORDER BY id');
  return rows.map(mapActivity);
}

async function getActivity(id) {
  const [rows] = await pool.query('SELECT * FROM activities WHERE id = ?', [id]);
  return mapActivity(rows[0]);
}

function toMysqlDatetime(v) {
  // 把 ISO 字符串转成 MySQL DATETIME(3) 可接受的 UTC 字符串
  const d = new Date(v);
  return d.toISOString().slice(0, 23).replace('T', ' ');
}

async function createActivity({
  title,
  description = '',
  location = '',
  startTime,
  endTime,
  capacity = 0,
}) {
  const [result] = await pool.query(
    `INSERT INTO activities (title, description, location, start_time, end_time, capacity)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description, location, toMysqlDatetime(startTime), toMysqlDatetime(endTime), capacity],
  );
  return getActivity(result.insertId);
}

async function updateActivity(id, patch) {
  const sets = [];
  const params = [];
  const colMap = {
    title: 'title',
    description: 'description',
    location: 'location',
    capacity: 'capacity',
  };
  for (const [key, col] of Object.entries(colMap)) {
    if (patch[key] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(patch[key]);
    }
  }
  if (patch.startTime !== undefined) {
    sets.push('start_time = ?');
    params.push(toMysqlDatetime(patch.startTime));
  }
  if (patch.endTime !== undefined) {
    sets.push('end_time = ?');
    params.push(toMysqlDatetime(patch.endTime));
  }
  if (sets.length > 0) {
    params.push(id);
    await pool.query(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getActivity(id);
}

async function deleteActivity(id) {
  const [result] = await pool.query('DELETE FROM activities WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/* --------------------------- 活动报名 --------------------------- */

async function listRegistrations(activityId) {
  const [rows] = await pool.query(
    'SELECT * FROM registrations WHERE activity_id = ? ORDER BY id',
    [activityId],
  );
  return rows.map(mapRegistration);
}

async function countRegistrations(activityId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ?',
    [activityId],
  );
  return rows[0].cnt;
}

async function findRegistration(activityId, name) {
  const [rows] = await pool.query(
    'SELECT * FROM registrations WHERE activity_id = ? AND name = ?',
    [activityId, name],
  );
  return mapRegistration(rows[0]);
}

/**
 * 报名（带名额校验，整段在事务内完成以避免超额并发）。
 * @returns {{ ok: true, registration } | { ok: false, reason: 'duplicate'|'full' }}
 */
async function createRegistration({ activityId, name, department = '' }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 锁住该活动行，串行化同一活动的并发报名
    const [actRows] = await conn.query(
      'SELECT capacity FROM activities WHERE id = ? FOR UPDATE',
      [activityId],
    );
    const capacity = actRows[0].capacity;

    const [dup] = await conn.query(
      'SELECT id FROM registrations WHERE activity_id = ? AND name = ?',
      [activityId, name],
    );
    if (dup.length > 0) {
      await conn.rollback();
      return { ok: false, reason: 'duplicate' };
    }

    const [cntRows] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ?',
      [activityId],
    );
    if (capacity > 0 && cntRows[0].cnt >= capacity) {
      await conn.rollback();
      return { ok: false, reason: 'full' };
    }

    const [result] = await conn.query(
      'INSERT INTO registrations (activity_id, name, department) VALUES (?, ?, ?)',
      [activityId, name, department],
    );
    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM registrations WHERE id = ?', [
      result.insertId,
    ]);
    return { ok: true, registration: mapRegistration(rows[0]) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  seed,
  // 分类
  listCategories,
  getCategory,
  findCategoryByName,
  createCategory,
  updateCategory,
  deleteCategory,
  countArticlesByCategory,
  // 文章
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  incrementArticleViews,
  // 活动
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  // 报名
  listRegistrations,
  countRegistrations,
  findRegistration,
  createRegistration,
};

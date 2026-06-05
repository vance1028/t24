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
    registrationDeadline: toIso(row.registration_deadline),
    checkinStart: toIso(row.checkin_start),
    checkinEnd: toIso(row.checkin_end),
    isHot: Boolean(row.is_hot),
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
    status: row.status,
    checkinCode: row.checkin_code,
    checkedInAt: toIso(row.checked_in_at),
    promotedAt: toIso(row.promoted_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapUserCredit(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    absentCount: row.absent_count,
    restrictedUntil: toIso(row.restricted_until),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapSystemConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    configKey: row.config_key,
    configValue: row.config_value,
    description: row.description,
    updatedAt: toIso(row.updated_at),
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

function generateCheckinCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

async function getSystemConfig(key) {
  const [rows] = await pool.query(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    [key],
  );
  return rows.length > 0 ? rows[0].config_value : null;
}

async function isUserRestricted(name, activity) {
  const [rows] = await pool.query(
    'SELECT restricted_until FROM user_credit WHERE name = ?',
    [name],
  );
  if (rows.length === 0 || !rows[0].restricted_until) return false;
  const restrictedUntil = new Date(rows[0].restricted_until);
  if (restrictedUntil <= new Date()) return false;

  const hotThreshold = parseInt(await getSystemConfig('hot_activity_capacity_threshold') || '50', 10);
  const isHotActivity = activity.isHot || (activity.capacity > 0 && activity.capacity <= hotThreshold);
  return isHotActivity;
}

/** 清空所有表并重新写入种子数据（供测试与本地初始化使用）。 */
async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE system_config');
    await conn.query('TRUNCATE TABLE user_credit');
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
      `INSERT INTO activities (id, title, description, location, start_time, end_time, capacity, registration_deadline, checkin_start, checkin_end, is_hot) VALUES
        (1, '红色教育基地参观学习', '组织参观本地革命纪念馆，重温入党誓词', '市革命纪念馆', '2026-07-01 09:00:00.000', '2026-07-01 12:00:00.000', 50, '2026-06-30 18:00:00.000', '2026-07-01 08:30:00.000', '2026-07-01 09:30:00.000', 1),
        (2, '爱国主义主题宣讲会', '邀请专家开展专题宣讲', '单位多功能厅', '2026-07-15 14:00:00.000', '2026-07-15 16:00:00.000', 2, '2026-07-14 18:00:00.000', '2026-07-15 13:30:00.000', '2026-07-15 14:30:00.000', 0)`,
    );
    await conn.query(
      `INSERT INTO system_config (config_key, config_value, description) VALUES
        ('absent_threshold', '3', '累计缺席次数阈值，达到后限制报名热门活动'),
        ('restriction_days', '30', '失信限制天数，达到缺席阈值后限制报名的天数'),
        ('hot_activity_capacity_threshold', '50', '热门活动名额判定阈值（名额<=该值视为热门，或is_hot=1）')`,
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
  registrationDeadline = null,
  checkinStart = null,
  checkinEnd = null,
  isHot = false,
}) {
  const [result] = await pool.query(
    `INSERT INTO activities (title, description, location, start_time, end_time, capacity, registration_deadline, checkin_start, checkin_end, is_hot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title, description, location,
      toMysqlDatetime(startTime), toMysqlDatetime(endTime), capacity,
      registrationDeadline ? toMysqlDatetime(registrationDeadline) : null,
      checkinStart ? toMysqlDatetime(checkinStart) : null,
      checkinEnd ? toMysqlDatetime(checkinEnd) : null,
      isHot ? 1 : 0,
    ],
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
    isHot: 'is_hot',
  };
  for (const [key, col] of Object.entries(colMap)) {
    if (patch[key] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(key === 'isHot' ? (patch[key] ? 1 : 0) : patch[key]);
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
  if (patch.registrationDeadline !== undefined) {
    sets.push('registration_deadline = ?');
    params.push(patch.registrationDeadline ? toMysqlDatetime(patch.registrationDeadline) : null);
  }
  if (patch.checkinStart !== undefined) {
    sets.push('checkin_start = ?');
    params.push(patch.checkinStart ? toMysqlDatetime(patch.checkinStart) : null);
  }
  if (patch.checkinEnd !== undefined) {
    sets.push('checkin_end = ?');
    params.push(patch.checkinEnd ? toMysqlDatetime(patch.checkinEnd) : null);
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

async function listRegistrations(activityId, { status } = {}) {
  const where = ['activity_id = ?'];
  const params = [activityId];
  if (status !== undefined) {
    where.push('status = ?');
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT * FROM registrations WHERE ${where.join(' AND ')} ORDER BY id`,
    params,
  );
  return rows.map(mapRegistration);
}

async function countRegistrations(activityId, { status } = {}) {
  const where = ['activity_id = ?'];
  const params = [activityId];
  if (status !== undefined) {
    where.push('status = ?');
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM registrations WHERE ${where.join(' AND ')}`,
    params,
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

async function findRegistrationByCode(checkinCode) {
  const [rows] = await pool.query(
    'SELECT * FROM registrations WHERE checkin_code = ?',
    [checkinCode],
  );
  return mapRegistration(rows[0]);
}

/**
 * 报名（带名额校验、候补队列、失信限制，事务内完成保证并发安全）。
 * @returns {{ ok: true, registration, isWaitlisted: boolean } | { ok: false, reason: string }}
 */
async function createRegistration({ activityId, name, department = '' }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [actRows] = await conn.query(
      'SELECT * FROM activities WHERE id = ? FOR UPDATE',
      [activityId],
    );
    if (actRows.length === 0) {
      await conn.rollback();
      return { ok: false, reason: 'activity_not_found' };
    }
    const activity = actRows[0];

    if (activity.registration_deadline && new Date(activity.registration_deadline) <= new Date()) {
      await conn.rollback();
      return { ok: false, reason: 'registration_closed' };
    }

    const [dup] = await conn.query(
      'SELECT id, status FROM registrations WHERE activity_id = ? AND name = ?',
      [activityId, name],
    );
    if (dup.length > 0) {
      if (dup[0].status === 'cancelled') {
        await conn.query(
          'DELETE FROM registrations WHERE id = ?',
          [dup[0].id],
        );
      } else {
        await conn.rollback();
        return { ok: false, reason: 'duplicate' };
      }
    }

    const [creditRows] = await conn.query(
      'SELECT restricted_until FROM user_credit WHERE name = ?',
      [name],
    );
    if (creditRows.length > 0 && creditRows[0].restricted_until) {
      const restrictedUntil = new Date(creditRows[0].restricted_until);
      if (restrictedUntil > new Date()) {
        const hotThreshold = parseInt(await getSystemConfig('hot_activity_capacity_threshold') || '50', 10);
        const isHotActivity = Boolean(activity.is_hot) || (activity.capacity > 0 && activity.capacity <= hotThreshold);
        if (isHotActivity) {
          await conn.rollback();
          return { ok: false, reason: 'restricted' };
        }
      }
    }

    const [cntRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ? AND status IN ('registered', 'checked_in')",
      [activityId],
    );
    const currentCount = cntRows[0].cnt;
    const isFull = activity.capacity > 0 && currentCount >= activity.capacity;
    const status = isFull ? 'waitlisted' : 'registered';
    const checkinCode = !isFull ? generateCheckinCode() : null;

    const [result] = await conn.query(
      'INSERT INTO registrations (activity_id, name, department, status, checkin_code) VALUES (?, ?, ?, ?, ?)',
      [activityId, name, department, status, checkinCode],
    );

    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM registrations WHERE id = ?', [
      result.insertId,
    ]);
    return { ok: true, registration: mapRegistration(rows[0]), isWaitlisted: isFull };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 取消报名（触发候补递补，事务内完成保证并发安全）。
 * @returns {{ ok: true, promoted?: Registration } | { ok: false, reason: string }}
 */
async function cancelRegistration(activityId, name) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [regRows] = await conn.query(
      'SELECT id, status FROM registrations WHERE activity_id = ? AND name = ? FOR UPDATE',
      [activityId, name],
    );
    if (regRows.length === 0) {
      await conn.rollback();
      return { ok: false, reason: 'not_found' };
    }
    const reg = regRows[0];
    if (reg.status === 'cancelled') {
      await conn.rollback();
      return { ok: false, reason: 'already_cancelled' };
    }
    if (reg.status === 'checked_in') {
      await conn.rollback();
      return { ok: false, reason: 'already_checked_in' };
    }

    await conn.query(
      "UPDATE registrations SET status = 'cancelled', checkin_code = NULL WHERE id = ?",
      [reg.id],
    );

    let promotedReg = null;
    if (reg.status === 'registered') {
      const [waitlistRows] = await conn.query(
        "SELECT id, name, department FROM registrations WHERE activity_id = ? AND status = 'waitlisted' ORDER BY id ASC LIMIT 1 FOR UPDATE",
        [activityId],
      );
      if (waitlistRows.length > 0) {
        const waitlisted = waitlistRows[0];
        const newCode = generateCheckinCode();
        await conn.query(
          "UPDATE registrations SET status = 'registered', checkin_code = ?, promoted_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
          [newCode, waitlisted.id],
        );
        const [promotedRows] = await conn.query(
          'SELECT * FROM registrations WHERE id = ?',
          [waitlisted.id],
        );
        promotedReg = mapRegistration(promotedRows[0]);
      }
    }

    await conn.commit();
    return { ok: true, promoted: promotedReg };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 签到核销。
 * @returns {{ ok: true, registration } | { ok: false, reason: string }}
 */
async function checkinRegistration(activityId, checkinCode, name) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [actRows] = await conn.query(
      'SELECT * FROM activities WHERE id = ?',
      [activityId],
    );
    if (actRows.length === 0) {
      await conn.rollback();
      return { ok: false, reason: 'activity_not_found' };
    }
    const activity = actRows[0];
    const now = new Date();

    if (activity.checkin_start && now < new Date(activity.checkin_start)) {
      await conn.rollback();
      return { ok: false, reason: 'too_early' };
    }
    if (activity.checkin_end && now > new Date(activity.checkin_end)) {
      await conn.rollback();
      return { ok: false, reason: 'too_late' };
    }

    let regId = null;
    if (checkinCode) {
      const [regRows] = await conn.query(
        'SELECT id, name, status FROM registrations WHERE checkin_code = ? AND activity_id = ? FOR UPDATE',
        [checkinCode, activityId],
      );
      if (regRows.length === 0) {
        await conn.rollback();
        return { ok: false, reason: 'invalid_code' };
      }
      regId = regRows[0].id;
      if (name && regRows[0].name !== name) {
        await conn.rollback();
        return { ok: false, reason: 'name_mismatch' };
      }
      if (regRows[0].status === 'checked_in') {
        await conn.rollback();
        return { ok: false, reason: 'already_checked_in' };
      }
      if (regRows[0].status !== 'registered') {
        await conn.rollback();
        return { ok: false, reason: 'invalid_status' };
      }
    } else if (name) {
      const [regRows] = await conn.query(
        'SELECT id, status FROM registrations WHERE name = ? AND activity_id = ? FOR UPDATE',
        [name, activityId],
      );
      if (regRows.length === 0) {
        await conn.rollback();
        return { ok: false, reason: 'not_registered' };
      }
      regId = regRows[0].id;
      if (regRows[0].status === 'checked_in') {
        await conn.rollback();
        return { ok: false, reason: 'already_checked_in' };
      }
      if (regRows[0].status !== 'registered') {
        await conn.rollback();
        return { ok: false, reason: 'invalid_status' };
      }
    } else {
      await conn.rollback();
      return { ok: false, reason: 'missing_identifier' };
    }

    await conn.query(
      "UPDATE registrations SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [regId],
    );
    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM registrations WHERE id = ?', [regId]);
    return { ok: true, registration: mapRegistration(rows[0]) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 活动结束后标记缺席人员（批量处理）。
 * @returns {{ ok: true, absentCount: number }}
 */
async function markAbsentees(activityId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [regRows] = await conn.query(
      "SELECT name FROM registrations WHERE activity_id = ? AND status = 'registered' FOR UPDATE",
      [activityId],
    );

    if (regRows.length === 0) {
      await conn.commit();
      return { ok: true, absentCount: 0 };
    }

    await conn.query(
      "UPDATE registrations SET status = 'absent' WHERE activity_id = ? AND status = 'registered'",
      [activityId],
    );

    const absentThreshold = parseInt(await getSystemConfig('absent_threshold') || '3', 10);
    const restrictionDays = parseInt(await getSystemConfig('restriction_days') || '30', 10);
    const now = new Date();

    for (const reg of regRows) {
      await conn.query(
        'INSERT INTO user_credit (name, absent_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE absent_count = absent_count + 1',
        [reg.name],
      );
      const [creditRows] = await conn.query(
        'SELECT absent_count FROM user_credit WHERE name = ?',
        [reg.name],
      );
      if (creditRows[0].absent_count >= absentThreshold) {
        const restrictedUntil = new Date(now.getTime() + restrictionDays * 24 * 60 * 60 * 1000);
        await conn.query(
          'UPDATE user_credit SET restricted_until = ? WHERE name = ?',
          [toMysqlDatetime(restrictedUntil.toISOString()), reg.name],
        );
      }
    }

    await conn.commit();
    return { ok: true, absentCount: regRows.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* --------------------------- 统计查询 --------------------------- */

async function getActivityStats(activityId) {
  const [registeredRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ? AND status IN ('registered', 'checked_in')",
    [activityId],
  );
  const [waitlistRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ? AND status = 'waitlisted'",
    [activityId],
  );
  const [checkedInRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ? AND status = 'checked_in'",
    [activityId],
  );
  const [absentRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE activity_id = ? AND status = 'absent'",
    [activityId],
  );

  const registered = registeredRows[0].cnt;
  const checkedIn = checkedInRows[0].cnt;
  return {
    registeredCount: registered,
    waitlistCount: waitlistRows[0].cnt,
    checkedInCount: checkedIn,
    absentCount: absentRows[0].cnt,
    attendanceRate: registered > 0 ? Number(((checkedIn / registered) * 100).toFixed(1)) : 0,
  };
}

async function getUserStats(name) {
  const [rows] = await pool.query(
    'SELECT * FROM user_credit WHERE name = ?',
    [name],
  );
  const credit = rows.length > 0 ? mapUserCredit(rows[0]) : null;

  const [regRows] = await pool.query(
    'SELECT r.*, a.title AS activity_title FROM registrations r JOIN activities a ON r.activity_id = a.id WHERE r.name = ? ORDER BY r.created_at DESC',
    [name],
  );

  return {
    credit,
    participationHistory: regRows.map((r) => ({
      id: r.id,
      activityId: r.activity_id,
      activityTitle: r.activity_title,
      status: r.status,
      createdAt: toIso(r.created_at),
      checkedInAt: toIso(r.checked_in_at),
    })),
  };
}

async function listSystemConfigs() {
  const [rows] = await pool.query('SELECT * FROM system_config ORDER BY id');
  return rows.map(mapSystemConfig);
}

async function updateSystemConfig(key, value) {
  await pool.query(
    'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
    [key, value, value],
  );
  const [rows] = await pool.query('SELECT * FROM system_config WHERE config_key = ?', [key]);
  return mapSystemConfig(rows[0]);
}

async function getUserCredit(name) {
  const [rows] = await pool.query('SELECT * FROM user_credit WHERE name = ?', [name]);
  return rows.length > 0 ? mapUserCredit(rows[0]) : null;
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
  findRegistrationByCode,
  createRegistration,
  cancelRegistration,
  checkinRegistration,
  markAbsentees,
  // 统计
  getActivityStats,
  getUserStats,
  getUserCredit,
  // 系统配置
  listSystemConfigs,
  updateSystemConfig,
};

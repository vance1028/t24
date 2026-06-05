'use strict';

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { createApp } = require('../src/app');
const { waitForDb, close } = require('../src/db');
const store = require('../src/data/store');

const app = createApp();

before(async () => {
  await waitForDb();
});

// 每个用例前重置数据库到种子状态，保证用例间互不干扰
beforeEach(async () => {
  await store.seed();
});

after(async () => {
  await close();
});

test('GET /api/health 返回 ok', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

test('GET /api/categories 返回种子分类及文章计数', async () => {
  const res = await request(app).get('/api/categories');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 3);
  const redHistory = res.body.data.find((c) => c.name === '红色历史');
  assert.ok(redHistory);
  assert.strictEqual(redHistory.articleCount, 1);
});

test('POST /api/categories 创建分类成功', async () => {
  const res = await request(app)
    .post('/api/categories')
    .send({ name: '国防教育', description: '增强全民国防观念' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.name, '国防教育');
  assert.ok(res.body.data.id > 0);
});

test('POST /api/categories 空名称返回 400', async () => {
  const res = await request(app).post('/api/categories').send({ name: '   ' });
  assert.strictEqual(res.status, 400);
});

test('POST /api/categories 重名返回 409', async () => {
  const res = await request(app).post('/api/categories').send({ name: '红色历史' });
  assert.strictEqual(res.status, 409);
});

test('DELETE 含文章的分类返回 409', async () => {
  const res = await request(app).delete('/api/categories/1');
  assert.strictEqual(res.status, 409);
});

test('GET /api/articles 支持按状态筛选', async () => {
  const res = await request(app).get('/api/articles?status=published');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((a) => a.status === 'published'));
});

test('GET /api/articles 支持关键词搜索', async () => {
  const res = await request(app).get('/api/articles?keyword=初心');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
});

test('GET /api/articles 支持按分类筛选', async () => {
  const res = await request(app).get('/api/articles?categoryId=1');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.every((a) => a.categoryId === 1));
});

test('GET /api/articles/:id 累加浏览量', async () => {
  await request(app).get('/api/articles/1');
  const res = await request(app).get('/api/articles/1');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.views, 2);
});

test('POST /api/articles 创建文章并默认 draft', async () => {
  const res = await request(app)
    .post('/api/articles')
    .send({ title: '新时代宣传工作', categoryId: 1, content: '正文', tags: ['宣传'] });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.status, 'draft');
  assert.strictEqual(res.body.data.publishedAt, null);
  assert.deepStrictEqual(res.body.data.tags, ['宣传']);
});

test('POST /api/articles 分类不存在返回 400', async () => {
  const res = await request(app)
    .post('/api/articles')
    .send({ title: 'x', categoryId: 9999 });
  assert.strictEqual(res.status, 400);
});

test('PUT /api/articles 发布时写入 publishedAt', async () => {
  const res = await request(app).put('/api/articles/3').send({ status: 'published' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.status, 'published');
  assert.ok(res.body.data.publishedAt);
});

test('DELETE /api/articles 删除成功返回 204', async () => {
  const res = await request(app).delete('/api/articles/2');
  assert.strictEqual(res.status, 204);
  const after2 = await request(app).get('/api/articles/2');
  assert.strictEqual(after2.status, 404);
});

test('POST /api/activities 结束早于开始返回 400', async () => {
  const res = await request(app)
    .post('/api/activities')
    .send({
      title: '测试活动',
      startTime: '2026-08-01T10:00:00.000Z',
      endTime: '2026-08-01T09:00:00.000Z',
    });
  assert.strictEqual(res.status, 400);
});

test('POST /api/activities 创建成功并可查询', async () => {
  const res = await request(app)
    .post('/api/activities')
    .send({
      title: '主题党日',
      location: '会议室',
      startTime: '2026-09-01T01:00:00.000Z',
      endTime: '2026-09-01T03:00:00.000Z',
      capacity: 30,
    });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.capacity, 30);
});

test('活动报名：正常报名成功', async () => {
  const res = await request(app)
    .post('/api/activities/1/registrations')
    .send({ name: '张三', department: '办公室' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.name, '张三');
});

test('活动报名：重复报名返回 409', async () => {
  await request(app).post('/api/activities/1/registrations').send({ name: '李四' });
  const res = await request(app)
    .post('/api/activities/1/registrations')
    .send({ name: '李四' });
  assert.strictEqual(res.status, 409);
});

test('活动报名：名额已满返回 409', async () => {
  // 活动 2 的 capacity = 2
  await request(app).post('/api/activities/2/registrations').send({ name: '甲' });
  await request(app).post('/api/activities/2/registrations').send({ name: '乙' });
  const res = await request(app)
    .post('/api/activities/2/registrations')
    .send({ name: '丙' });
  assert.strictEqual(res.status, 409);
});

test('活动报名：并发不超额（capacity=2 时只放进 2 人）', async () => {
  const names = ['p1', 'p2', 'p3', 'p4', 'p5'];
  const results = await Promise.all(
    names.map((n) =>
      request(app).post('/api/activities/2/registrations').send({ name: n }),
    ),
  );
  const success = results.filter((r) => r.status === 201).length;
  assert.strictEqual(success, 2);
  const detail = await request(app).get('/api/activities/2');
  assert.strictEqual(detail.body.data.registeredCount, 2);
});

test('活动报名后 registeredCount 同步更新', async () => {
  await request(app).post('/api/activities/1/registrations').send({ name: '王五' });
  const res = await request(app).get('/api/activities/1');
  assert.strictEqual(res.body.data.registeredCount, 1);
});

test('未知接口返回 404', async () => {
  const res = await request(app).get('/api/unknown');
  assert.strictEqual(res.status, 404);
});

test('非法 JSON 请求体返回 400', async () => {
  const res = await request(app)
    .post('/api/categories')
    .set('Content-Type', 'application/json')
    .send('{ bad json');
  assert.strictEqual(res.status, 400);
});

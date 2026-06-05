'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, isNonEmptyString, toPositiveInt } = require('../utils/http');

const router = express.Router();

/** 包装 async 处理器，统一把异常交给错误中间件。 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 列出所有宣传内容分类
router.get(
  '/',
  wrap(async (req, res) => {
    const categories = await store.listCategories();
    const list = await Promise.all(
      categories.map(async (c) => ({
        ...c,
        articleCount: await store.countArticlesByCategory(c.id),
      })),
    );
    res.json({ data: list });
  }),
);

// 获取单个分类
router.get(
  '/:id',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的分类 ID');
    const category = await store.getCategory(id);
    if (!category) return sendError(res, 404, '分类不存在');
    res.json({
      data: { ...category, articleCount: await store.countArticlesByCategory(id) },
    });
  }),
);

// 新建分类
router.post(
  '/',
  wrap(async (req, res) => {
    const { name, description } = req.body || {};
    if (!isNonEmptyString(name)) {
      return sendError(res, 400, '分类名称不能为空');
    }
    if (await store.findCategoryByName(name.trim())) {
      return sendError(res, 409, '分类名称已存在');
    }
    const category = await store.createCategory({
      name: name.trim(),
      description: typeof description === 'string' ? description : '',
    });
    res.status(201).json({ data: category });
  }),
);

// 更新分类
router.put(
  '/:id',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的分类 ID');
    if (!(await store.getCategory(id))) return sendError(res, 404, '分类不存在');

    const { name, description } = req.body || {};
    if (name !== undefined && !isNonEmptyString(name)) {
      return sendError(res, 400, '分类名称不能为空');
    }
    if (name !== undefined) {
      const existing = await store.findCategoryByName(name.trim());
      if (existing && existing.id !== id) {
        return sendError(res, 409, '分类名称已存在');
      }
    }
    const updated = await store.updateCategory(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
    });
    res.json({ data: updated });
  }),
);

// 删除分类（分类下仍有文章时拒绝删除）
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的分类 ID');
    if (!(await store.getCategory(id))) return sendError(res, 404, '分类不存在');
    if ((await store.countArticlesByCategory(id)) > 0) {
      return sendError(res, 409, '该分类下仍有宣传文章，无法删除');
    }
    await store.deleteCategory(id);
    res.status(204).end();
  }),
);

module.exports = router;

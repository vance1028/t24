'use strict';

const express = require('express');
const store = require('../data/store');
const { sendError, isNonEmptyString, toPositiveInt } = require('../utils/http');

const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validTime(v) {
  if (typeof v !== 'string') return false;
  return !Number.isNaN(Date.parse(v));
}

// 列出教育活动
router.get(
  '/',
  wrap(async (req, res) => {
    const activities = await store.listActivities();
    const list = await Promise.all(
      activities.map(async (a) => ({
        ...a,
        registeredCount: await store.countRegistrations(a.id),
      })),
    );
    res.json({ data: list, total: list.length });
  }),
);

// 获取单个活动
router.get(
  '/:id',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    const activity = await store.getActivity(id);
    if (!activity) return sendError(res, 404, '活动不存在');
    res.json({
      data: { ...activity, registeredCount: await store.countRegistrations(id) },
    });
  }),
);

// 新建活动
router.post(
  '/',
  wrap(async (req, res) => {
    const { title, description, location, startTime, endTime, capacity } = req.body || {};

    if (!isNonEmptyString(title)) {
      return sendError(res, 400, '活动标题不能为空');
    }
    if (!validTime(startTime) || !validTime(endTime)) {
      return sendError(res, 400, '开始时间和结束时间必须是有效的时间格式');
    }
    if (Date.parse(endTime) <= Date.parse(startTime)) {
      return sendError(res, 400, '结束时间必须晚于开始时间');
    }
    let cap = 0;
    if (capacity !== undefined) {
      if (!Number.isInteger(capacity) || capacity < 0) {
        return sendError(res, 400, '名额上限必须是非负整数');
      }
      cap = capacity;
    }

    const activity = await store.createActivity({
      title: title.trim(),
      description: typeof description === 'string' ? description : '',
      location: typeof location === 'string' ? location : '',
      startTime,
      endTime,
      capacity: cap,
    });
    res.status(201).json({ data: activity });
  }),
);

// 更新活动
router.put(
  '/:id',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    const activity = await store.getActivity(id);
    if (!activity) return sendError(res, 404, '活动不存在');

    const { title, description, location, startTime, endTime, capacity } = req.body || {};
    if (title !== undefined && !isNonEmptyString(title)) {
      return sendError(res, 400, '活动标题不能为空');
    }
    const newStart = startTime !== undefined ? startTime : activity.startTime;
    const newEnd = endTime !== undefined ? endTime : activity.endTime;
    if (startTime !== undefined && !validTime(startTime)) {
      return sendError(res, 400, '开始时间格式无效');
    }
    if (endTime !== undefined && !validTime(endTime)) {
      return sendError(res, 400, '结束时间格式无效');
    }
    if (Date.parse(newEnd) <= Date.parse(newStart)) {
      return sendError(res, 400, '结束时间必须晚于开始时间');
    }
    if (capacity !== undefined) {
      if (!Number.isInteger(capacity) || capacity < 0) {
        return sendError(res, 400, '名额上限必须是非负整数');
      }
      if (capacity !== 0 && capacity < (await store.countRegistrations(id))) {
        return sendError(res, 409, '名额上限不能小于当前已报名人数');
      }
    }

    const patch = {};
    if (title !== undefined) patch.title = title.trim();
    if (description !== undefined) patch.description = description;
    if (location !== undefined) patch.location = location;
    if (startTime !== undefined) patch.startTime = startTime;
    if (endTime !== undefined) patch.endTime = endTime;
    if (capacity !== undefined) patch.capacity = capacity;

    const updated = await store.updateActivity(id, patch);
    res.json({ data: { ...updated, registeredCount: await store.countRegistrations(id) } });
  }),
);

// 删除活动
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');
    await store.deleteActivity(id);
    res.status(204).end();
  }),
);

/* --------------------------- 活动报名 --------------------------- */

// 查看某活动的报名名单
router.get(
  '/:id/registrations',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');
    res.json({ data: await store.listRegistrations(id) });
  }),
);

// 报名参加活动
router.post(
  '/:id/registrations',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');

    const { name, department } = req.body || {};
    if (!isNonEmptyString(name)) {
      return sendError(res, 400, '报名人姓名不能为空');
    }

    const result = await store.createRegistration({
      activityId: id,
      name: name.trim(),
      department: typeof department === 'string' ? department : '',
    });
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        return sendError(res, 409, '该人员已报名此活动');
      }
      return sendError(res, 409, '活动名额已满');
    }
    res.status(201).json({ data: result.registration });
  }),
);

module.exports = router;

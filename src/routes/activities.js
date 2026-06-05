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
        registeredCount: await store.countRegistrations(a.id, { status: 'registered' }),
        waitlistCount: await store.countRegistrations(a.id, { status: 'waitlisted' }),
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
      data: {
        ...activity,
        registeredCount: await store.countRegistrations(id, { status: 'registered' }),
        waitlistCount: await store.countRegistrations(id, { status: 'waitlisted' }),
      },
    });
  }),
);

// 新建活动
router.post(
  '/',
  wrap(async (req, res) => {
    const { title, description, location, startTime, endTime, capacity, registrationDeadline, checkinStart, checkinEnd, isHot } = req.body || {};

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
    if (registrationDeadline !== undefined && registrationDeadline !== null && !validTime(registrationDeadline)) {
      return sendError(res, 400, '报名截止时间格式无效');
    }
    if (checkinStart !== undefined && checkinStart !== null && !validTime(checkinStart)) {
      return sendError(res, 400, '签到开始时间格式无效');
    }
    if (checkinEnd !== undefined && checkinEnd !== null && !validTime(checkinEnd)) {
      return sendError(res, 400, '签到结束时间格式无效');
    }

    const activity = await store.createActivity({
      title: title.trim(),
      description: typeof description === 'string' ? description : '',
      location: typeof location === 'string' ? location : '',
      startTime,
      endTime,
      capacity: cap,
      registrationDeadline: registrationDeadline || null,
      checkinStart: checkinStart || null,
      checkinEnd: checkinEnd || null,
      isHot: Boolean(isHot),
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

    const { title, description, location, startTime, endTime, capacity, registrationDeadline, checkinStart, checkinEnd, isHot } = req.body || {};
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
      const registeredCount = await store.countRegistrations(id, { status: 'registered' });
      if (capacity !== 0 && capacity < registeredCount) {
        return sendError(res, 409, '名额上限不能小于当前已报名人数');
      }
    }
    if (registrationDeadline !== undefined && registrationDeadline !== null && !validTime(registrationDeadline)) {
      return sendError(res, 400, '报名截止时间格式无效');
    }
    if (checkinStart !== undefined && checkinStart !== null && !validTime(checkinStart)) {
      return sendError(res, 400, '签到开始时间格式无效');
    }
    if (checkinEnd !== undefined && checkinEnd !== null && !validTime(checkinEnd)) {
      return sendError(res, 400, '签到结束时间格式无效');
    }

    const patch = {};
    if (title !== undefined) patch.title = title.trim();
    if (description !== undefined) patch.description = description;
    if (location !== undefined) patch.location = location;
    if (startTime !== undefined) patch.startTime = startTime;
    if (endTime !== undefined) patch.endTime = endTime;
    if (capacity !== undefined) patch.capacity = capacity;
    if (registrationDeadline !== undefined) patch.registrationDeadline = registrationDeadline;
    if (checkinStart !== undefined) patch.checkinStart = checkinStart;
    if (checkinEnd !== undefined) patch.checkinEnd = checkinEnd;
    if (isHot !== undefined) patch.isHot = isHot;

    const updated = await store.updateActivity(id, patch);
    res.json({ data: { ...updated, registeredCount: await store.countRegistrations(id, { status: 'registered' }) } });
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

// 查看某活动的报名名单（支持按状态过滤）
router.get(
  '/:id/registrations',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');
    const { status } = req.query;
    const opts = status ? { status } : {};
    res.json({ data: await store.listRegistrations(id, opts) });
  }),
);

// 查看候补队列
router.get(
  '/:id/waitlist',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');
    const waitlist = await store.listRegistrations(id, { status: 'waitlisted' });
    res.json({ data: waitlist, total: waitlist.length });
  }),
);

// 报名参加活动（支持候补）
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
      const reasonMap = {
        duplicate: '该人员已报名此活动',
        full: '活动名额已满',
        registration_closed: '报名已截止',
        restricted: '因缺席次数过多，您暂时无法报名热门活动',
        activity_not_found: '活动不存在',
      };
      return sendError(res, 409, reasonMap[result.reason] || '报名失败');
    }
    res.status(201).json({
      data: result.registration,
      isWaitlisted: result.isWaitlisted,
      message: result.isWaitlisted ? '已加入候补队列' : '报名成功',
    });
  }),
);

// 取消报名（触发候补递补）
router.delete(
  '/:id/registrations/:name',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    const name = decodeURIComponent(req.params.name);
    if (!isNonEmptyString(name)) return sendError(res, 400, '无效的姓名');

    const result = await store.cancelRegistration(id, name.trim());
    if (!result.ok) {
      const reasonMap = {
        not_found: '未找到该报名记录',
        already_cancelled: '该报名已取消',
        already_checked_in: '已签到，无法取消',
      };
      return sendError(res, 409, reasonMap[result.reason] || '取消失败');
    }
    res.json({
      message: '取消成功',
      promoted: result.promoted || null,
    });
  }),
);

// 签到核销
router.post(
  '/:id/checkin',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');

    const { checkinCode, name } = req.body || {};
    if (!checkinCode && !name) {
      return sendError(res, 400, '请提供签到码或姓名');
    }

    const result = await store.checkinRegistration(
      id,
      checkinCode ? checkinCode.trim().toUpperCase() : null,
      name ? name.trim() : null,
    );
    if (!result.ok) {
      const reasonMap = {
        activity_not_found: '活动不存在',
        too_early: '签到尚未开始',
        too_late: '签到已结束',
        invalid_code: '签到码无效',
        name_mismatch: '姓名与签到码不匹配',
        already_checked_in: '已签到，请勿重复签到',
        not_registered: '该人员未报名此活动',
        invalid_status: '当前状态不允许签到',
        missing_identifier: '缺少签到标识',
      };
      return sendError(res, 409, reasonMap[result.reason] || '签到失败');
    }
    res.json({ data: result.registration, message: '签到成功' });
  }),
);

// 活动结束后标记缺席（批量）
router.post(
  '/:id/mark-absentees',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');

    const result = await store.markAbsentees(id);
    res.json({
      message: `已标记 ${result.absentCount} 名缺席人员`,
      absentCount: result.absentCount,
    });
  }),
);

// 获取活动统计数据
router.get(
  '/:id/stats',
  wrap(async (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (id === null) return sendError(res, 400, '无效的活动 ID');
    if (!(await store.getActivity(id))) return sendError(res, 404, '活动不存在');

    const stats = await store.getActivityStats(id);
    const absentList = await store.listRegistrations(id, { status: 'absent' });
    res.json({
      data: {
        ...stats,
        absentList,
      },
    });
  }),
);

/* --------------------------- 用户相关 --------------------------- */

// 获取用户参与历史和信用记录
router.get(
  '/users/:name/stats',
  wrap(async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    if (!isNonEmptyString(name)) return sendError(res, 400, '无效的姓名');

    const stats = await store.getUserStats(name.trim());
    res.json({ data: stats });
  }),
);

/* --------------------------- 系统配置 --------------------------- */

// 获取所有系统配置
router.get(
  '/configs',
  wrap(async (req, res) => {
    const configs = await store.listSystemConfigs();
    res.json({ data: configs });
  }),
);

// 更新系统配置
router.put(
  '/configs/:key',
  wrap(async (req, res) => {
    const key = req.params.key;
    const { value } = req.body || {};
    if (value === undefined || value === null) {
      return sendError(res, 400, '配置值不能为空');
    }
    const config = await store.updateSystemConfig(key, String(value));
    res.json({ data: config });
  }),
);

module.exports = router;

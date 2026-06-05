'use strict';

/** 统一的错误响应辅助函数。 */
function sendError(res, status, message, details) {
  const body = { error: { message } };
  if (details !== undefined) body.error.details = details;
  return res.status(status).json(body);
}

/** 校验值是否为非空字符串。 */
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** 将值解析为正整数，失败返回 null。 */
function toPositiveInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

module.exports = { sendError, isNonEmptyString, toPositiveInt };

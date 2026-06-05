# 爱国主义教育宣传管理平台 - 后端 API

一个纯后端的 REST API 服务，用于管理爱国主义教育宣传内容、教育活动及活动报名。
本项目作为「功能迭代」类评测题目的基础工程：结构清晰、使用真实的 MySQL 持久化，并通过 docker compose 一键编排。

## 技术栈

- Node.js (≥ 18) + Express 4
- 数据库：MySQL 8（`mysql2/promise` 连接池）
- 编排：Docker Compose
- 测试：Node 内置 `node:test` + `supertest`

## 快速开始

### 方式一：docker compose（推荐）

```bash
docker compose up --build
```

- API 暴露在 `http://localhost:4790`
- MySQL 暴露在宿主机 `13306` 端口
- 首次启动时 `db/init.sql` 会自动建表并写入种子数据

### 方式二：本地运行（自带一个 MySQL）

```bash
# 先准备一个 MySQL，并通过环境变量提供连接信息
export DB_HOST=127.0.0.1 DB_PORT=13306 DB_USER=app DB_PASSWORD=apppass DB_NAME=patriotic_edu

npm install
npm run seed     # 重置并写入种子数据
npm start        # 启动服务（默认端口 4790）
```

### 运行测试

测试连接真实 MySQL（默认 `127.0.0.1:13306`，可用 `DB_*` 环境变量覆盖），每个用例前会重置数据：

```bash
npm test
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4790` | API 监听端口 |
| `DB_HOST` | `127.0.0.1` | MySQL 主机 |
| `DB_PORT` | `13306` | MySQL 端口 |
| `DB_USER` | `app` | MySQL 用户 |
| `DB_PASSWORD` | `apppass` | MySQL 密码 |
| `DB_NAME` | `patriotic_edu` | 数据库名 |
| `SEED_ON_START` | - | 设为 `false` 可禁用启动时的空库自动播种 |

## 目录结构

```
src/
├── app.js              # 组装 Express 应用（路由、中间件、错误处理）
├── server.js           # 启动入口（等待 DB 就绪 + 空库自动播种）
├── db.js               # mysql2 连接池与就绪等待
├── data/
│   └── store.js        # 数据仓储层（SQL 实现）
├── routes/
│   ├── categories.js   # 宣传内容分类
│   ├── articles.js     # 宣传文章
│   └── activities.js   # 教育活动与报名
└── utils/
    └── http.js         # 通用响应/校验辅助
db/
├── schema.sql          # 表结构
├── seed.sql            # 种子数据
└── init.sql            # 容器首次初始化（schema + seed 合并）
scripts/
└── seed.js             # 手动重置种子数据
test/
└── api.test.js         # 接口测试
```

## 数据模型

- **categories 宣传分类**：`id, name(唯一), description, created_at, updated_at`
- **articles 宣传文章**：`id, title, summary, content, category_id(FK), author, status(draft/published/archived), tags(JSON), views, published_at, created_at, updated_at`
- **activities 教育活动**：`id, title, description, location, start_time, end_time, capacity, created_at, updated_at`
- **registrations 活动报名**：`id, activity_id(FK), name, department, created_at`，`(activity_id, name)` 唯一

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/categories` | 分类列表（含文章数） |
| GET | `/api/categories/:id` | 分类详情 |
| POST | `/api/categories` | 新建分类 |
| PUT | `/api/categories/:id` | 更新分类 |
| DELETE | `/api/categories/:id` | 删除分类（有文章时拒绝） |
| GET | `/api/articles` | 文章列表（支持 `categoryId`/`status`/`keyword` 筛选） |
| GET | `/api/articles/:id` | 文章详情（累加浏览量） |
| POST | `/api/articles` | 新建文章 |
| PUT | `/api/articles/:id` | 更新文章（发布时记录 publishedAt） |
| DELETE | `/api/articles/:id` | 删除文章 |
| GET | `/api/activities` | 活动列表（含已报名人数） |
| GET | `/api/activities/:id` | 活动详情 |
| POST | `/api/activities` | 新建活动 |
| PUT | `/api/activities/:id` | 更新活动 |
| DELETE | `/api/activities/:id` | 删除活动 |
| GET | `/api/activities/:id/registrations` | 活动报名名单 |
| POST | `/api/activities/:id/registrations` | 报名活动（事务内校验重复与名额，并发安全） |

## 响应约定

- 成功：`{ "data": ... }`，列表附带 `total`
- 失败：`{ "error": { "message": "...", "details": ... } }`，配合对应 HTTP 状态码

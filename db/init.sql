-- 容器首次初始化脚本（docker-entrypoint-initdb.d）
-- 内容 = schema.sql + seed.sql 合并，保证 `docker compose up` 后即有表和种子数据。

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200) NOT NULL,
  summary      VARCHAR(500) NOT NULL DEFAULT '',
  content      MEDIUMTEXT NOT NULL,
  category_id  INT UNSIGNED NOT NULL,
  author       VARCHAR(100) NOT NULL DEFAULT '',
  status       ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  tags         JSON NULL,
  views        INT UNSIGNED NOT NULL DEFAULT 0,
  published_at DATETIME(3) NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_articles_category (category_id),
  KEY idx_articles_status (status),
  CONSTRAINT fk_articles_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activities (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title                   VARCHAR(200) NOT NULL,
  description             VARCHAR(1000) NOT NULL DEFAULT '',
  location                VARCHAR(200) NOT NULL DEFAULT '',
  start_time              DATETIME(3) NOT NULL,
  end_time                DATETIME(3) NOT NULL,
  capacity                INT UNSIGNED NOT NULL DEFAULT 0,
  registration_deadline   DATETIME(3) NULL,
  checkin_start           DATETIME(3) NULL,
  checkin_end             DATETIME(3) NULL,
  is_hot                  TINYINT(1) NOT NULL DEFAULT 0,
  created_at              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registrations (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id     INT UNSIGNED NOT NULL,
  name            VARCHAR(100) NOT NULL,
  department      VARCHAR(100) NOT NULL DEFAULT '',
  status          ENUM('registered','waitlisted','checked_in','absent','cancelled') NOT NULL DEFAULT 'registered',
  checkin_code    VARCHAR(32) NULL,
  checked_in_at   DATETIME(3) NULL,
  promoted_at     DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reg_activity_name (activity_id, name),
  KEY idx_reg_activity (activity_id),
  KEY idx_reg_status (status),
  KEY idx_reg_checkin_code (checkin_code),
  CONSTRAINT fk_reg_activity FOREIGN KEY (activity_id)
    REFERENCES activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_credit (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100) NOT NULL,
  absent_count    INT UNSIGNED NOT NULL DEFAULT 0,
  restricted_until DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_credit_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_config (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  config_key      VARCHAR(100) NOT NULL,
  config_value    VARCHAR(500) NOT NULL,
  description     VARCHAR(200) NOT NULL DEFAULT '',
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (id, name, description) VALUES
  (1, '红色历史', '党史、新中国史、改革开放史、社会主义发展史宣传'),
  (2, '时政要闻', '重要会议精神与时政热点解读'),
  (3, '英模人物', '时代楷模、道德模范、革命先烈事迹');

INSERT INTO articles (id, title, summary, content, category_id, author, status, tags, published_at) VALUES
  (1, '从一大到二十大：百年初心', '回顾党的重要历史节点', '中国共产党的百年历程是一部不懈奋斗史……', 1, '宣传部', 'published', JSON_ARRAY('党史', '初心使命'), CURRENT_TIMESTAMP(3)),
  (2, '学习贯彻最新会议精神', '深入解读会议核心要义', '会议强调，要坚定不移……', 2, '理论学习中心组', 'published', JSON_ARRAY('时政'), CURRENT_TIMESTAMP(3)),
  (3, '草稿：英雄事迹征集启事', '面向全单位征集身边的英模故事', '现面向全体职工征集……', 3, '编辑部', 'draft', JSON_ARRAY('征集'), NULL);

INSERT INTO activities (id, title, description, location, start_time, end_time, capacity, registration_deadline, checkin_start, checkin_end, is_hot) VALUES
  (1, '红色教育基地参观学习', '组织参观本地革命纪念馆，重温入党誓词', '市革命纪念馆', '2026-07-01 09:00:00.000', '2026-07-01 12:00:00.000', 50, '2026-06-30 18:00:00.000', '2026-07-01 08:30:00.000', '2026-07-01 09:30:00.000', 1),
  (2, '爱国主义主题宣讲会', '邀请专家开展专题宣讲', '单位多功能厅', '2026-07-15 14:00:00.000', '2026-07-15 16:00:00.000', 2, '2026-07-14 18:00:00.000', '2026-07-15 13:30:00.000', '2026-07-15 14:30:00.000', 0);

INSERT INTO system_config (config_key, config_value, description) VALUES
  ('absent_threshold', '3', '累计缺席次数阈值，达到后限制报名热门活动'),
  ('restriction_days', '30', '失信限制天数，达到缺席阈值后限制报名的天数'),
  ('hot_activity_capacity_threshold', '50', '热门活动名额判定阈值（名额<=该值视为热门，或is_hot=1）');

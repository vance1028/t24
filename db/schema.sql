-- 爱国主义教育宣传管理平台 - 表结构
-- 该文件可独立执行用于建表；init.sql 会引用它的内容用于容器首次初始化。

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
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(200) NOT NULL,
  description VARCHAR(1000) NOT NULL DEFAULT '',
  location    VARCHAR(200) NOT NULL DEFAULT '',
  start_time  DATETIME(3) NOT NULL,
  end_time    DATETIME(3) NOT NULL,
  capacity    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registrations (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  department  VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reg_activity_name (activity_id, name),
  KEY idx_reg_activity (activity_id),
  CONSTRAINT fk_reg_activity FOREIGN KEY (activity_id)
    REFERENCES activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

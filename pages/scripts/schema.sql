-- ikun-tab 表结构（与 backend-py/app/models/*.py 完全一致）
-- 用途：把 Pages 备用站指向一个空库时，可先用本文件初始化；
--       若数据库已由 Python 主站创建，则无需执行。
-- 用法：mysql -h <host> -u <user> -p <db> < schema.sql

CREATE TABLE IF NOT EXISTS tab_user (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(128) NULL,
  password VARCHAR(128) NOT NULL,
  pwd_version INT NOT NULL DEFAULT 0,
  avatar VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户';

CREATE TABLE IF NOT EXISTS tab_group (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  icon VARCHAR(64) DEFAULT '🌟',
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_group_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='书签分组';

CREATE TABLE IF NOT EXISTS tab_bookmark (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  type INT NOT NULL DEFAULT 0 COMMENT '0=书签 1=文件夹',
  name VARCHAR(128) NOT NULL,
  url VARCHAR(512) NULL,
  icon_type VARCHAR(16) NOT NULL DEFAULT 'favicon',
  icon_value VARCHAR(512) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_group_parent (group_id, parent_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='书签';

CREATE TABLE IF NOT EXISTS tab_widget (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  type VARCHAR(32) NOT NULL,
  name VARCHAR(64) NULL,
  `rows` INT NOT NULL DEFAULT 1,
  cols INT NOT NULL DEFAULT 1,
  config TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  x INT NOT NULL DEFAULT 0,
  y INT NOT NULL DEFAULT 0,
  enabled INT NOT NULL DEFAULT 1,
  KEY idx_widget_group (group_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='小组件';

CREATE TABLE IF NOT EXISTS tab_user_setting (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  theme VARCHAR(16) NOT NULL DEFAULT 'light',
  search_engine_id BIGINT NULL,
  background_type VARCHAR(16) NOT NULL DEFAULT 'bing',
  background_value VARCHAR(512) NULL,
  background_animation INT NOT NULL DEFAULT 0,
  bookmark_open_target VARCHAR(16) NOT NULL DEFAULT 'new',
  auto_focus_search INT NOT NULL DEFAULT 1,
  transition_animation VARCHAR(16) NOT NULL DEFAULT 'flip',
  primary_color VARCHAR(16) NULL,
  ui_opacity INT NOT NULL DEFAULT 100,
  bg_overlay_opacity INT NOT NULL DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户设置';

CREATE TABLE IF NOT EXISTS tab_search_engine (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  url_template VARCHAR(512) NOT NULL,
  icon VARCHAR(255) NULL,
  is_default INT NOT NULL DEFAULT 0,
  KEY idx_engine_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='搜索引擎';

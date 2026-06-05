-- 爱国主义教育宣传管理平台 - 种子数据
SET NAMES utf8mb4;

INSERT INTO categories (id, name, description) VALUES
  (1, '红色历史', '党史、新中国史、改革开放史、社会主义发展史宣传'),
  (2, '时政要闻', '重要会议精神与时政热点解读'),
  (3, '英模人物', '时代楷模、道德模范、革命先烈事迹');

INSERT INTO articles (id, title, summary, content, category_id, author, status, tags, published_at) VALUES
  (1, '从一大到二十大：百年初心', '回顾党的重要历史节点', '中国共产党的百年历程是一部不懈奋斗史……', 1, '宣传部', 'published', JSON_ARRAY('党史', '初心使命'), CURRENT_TIMESTAMP(3)),
  (2, '学习贯彻最新会议精神', '深入解读会议核心要义', '会议强调，要坚定不移……', 2, '理论学习中心组', 'published', JSON_ARRAY('时政'), CURRENT_TIMESTAMP(3)),
  (3, '草稿：英雄事迹征集启事', '面向全单位征集身边的英模故事', '现面向全体职工征集……', 3, '编辑部', 'draft', JSON_ARRAY('征集'), NULL);

INSERT INTO activities (id, title, description, location, start_time, end_time, capacity) VALUES
  (1, '红色教育基地参观学习', '组织参观本地革命纪念馆，重温入党誓词', '市革命纪念馆', '2026-07-01 09:00:00.000', '2026-07-01 12:00:00.000', 50),
  (2, '爱国主义主题宣讲会', '邀请专家开展专题宣讲', '单位多功能厅', '2026-07-15 14:00:00.000', '2026-07-15 16:00:00.000', 2);

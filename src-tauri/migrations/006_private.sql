-- 私有笔记标记：is_private = 1 的笔记不会通过同步发给任何对端（全量/多选/单条都过滤）
-- 用户在编辑器头部点「锁」图标切换。导出/导入功能不受影响（属于本机数据迁移）。
ALTER TABLE notes ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_notes_is_private ON notes(is_private);

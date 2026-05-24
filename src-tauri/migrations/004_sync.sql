-- 多设备同步：为 notes 增加全局唯一身份 uuid
-- 不动整数主键 id 和外键关系，仅新增 uuid 列作为跨设备同步标识
ALTER TABLE notes ADD COLUMN uuid TEXT;

-- uuid 唯一索引（回填前所有行 uuid 为 NULL，SQLite 允许多个 NULL，不冲突）
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_uuid ON notes(uuid);

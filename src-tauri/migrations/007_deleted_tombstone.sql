-- 彻底删除墓碑:记录被永久删除的笔记 uuid,防止同步时被对端重新插入"复活"
CREATE TABLE IF NOT EXISTS deleted_notes (
    uuid TEXT PRIMARY KEY,
    deleted_at TEXT NOT NULL
);

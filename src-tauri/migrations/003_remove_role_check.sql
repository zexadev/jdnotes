-- 重建 chat_messages 表，移除 role 的 CHECK 约束
-- 原表有 CHECK(role IN ('user', 'assistant'))，需要支持 tool_call/tool_result 等新角色

CREATE TABLE IF NOT EXISTS chat_messages_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    images TEXT DEFAULT '[]',
    timestamp TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- 迁移现有数据
INSERT INTO chat_messages_new (id, note_id, conversation_id, role, content, images, timestamp)
SELECT id, note_id, conversation_id, role, content, COALESCE(images, '[]'), timestamp
FROM chat_messages;

-- 替换旧表
DROP TABLE chat_messages;
ALTER TABLE chat_messages_new RENAME TO chat_messages;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_note_id ON chat_messages(note_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- 对话表：每个笔记可以有多个对话
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '新对话',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_note_id ON conversations(note_id);

-- 给 chat_messages 添加 conversation_id 列和 images 列
ALTER TABLE chat_messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN images TEXT DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- 为现有消息创建默认对话
-- 找出所有有消息的 note_id，为每个创建一个默认对话
INSERT INTO conversations (note_id, title, created_at, updated_at)
SELECT DISTINCT note_id, '对话 1',
    COALESCE(MIN(timestamp), datetime('now')),
    COALESCE(MAX(timestamp), datetime('now'))
FROM chat_messages
GROUP BY note_id;

-- 将现有消息关联到对应的默认对话
UPDATE chat_messages
SET conversation_id = (
    SELECT c.id FROM conversations c
    WHERE c.note_id = chat_messages.note_id
    LIMIT 1
)
WHERE conversation_id IS NULL;

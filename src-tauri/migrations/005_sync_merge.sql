-- git 式三路合并：为每条笔记保存"上次同步达成一致的内容快照"作为合并基准（共同祖先 base）
-- synced_content：上次同步完成时本地与远端一致的 content 全文（仅本地用，绝不跨网传输）
-- has_conflict：1 表示该笔记本次同步产生过冲突（已生成冲突副本，供前端提示）
ALTER TABLE notes ADD COLUMN synced_content TEXT;
ALTER TABLE notes ADD COLUMN has_conflict INTEGER NOT NULL DEFAULT 0;

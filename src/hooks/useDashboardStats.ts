import { useMemo } from 'react';
import { formatDateKey, type Note } from '../lib/db';

interface DashboardStats {
  // 基础统计
  totalNotes: number;
  favoriteNotes: number;
  favoriteRatio: number;

  // 增长趋势
  weeklyGrowth: number;

  // 字数统计
  totalWords: number;
  avgWords: number;

  // 活跃度
  activeDays: number;
  streak: number;
  todayCount: number;
  wroteToday: boolean;
  distribution: Map<string, number>;

  // 标签统计
  topTags: { name: string; count: number }[];

  // 待办提醒明细：已过期在前（新过期优先），其后按到期时间升序。
  // 不携带 overdue 标记——memo 里冻结的钟跨零点会把已过期标成未来，过期判定留给渲染期实时算
  reminderItems: { id: number; title: string; date: Date }[];

  // 最近活跃
  recentNotes: {
    id: number;
    title: string;
    updatedAt: Date;
  }[];

  // 图表数据
  trendData: { date: string; count: number }[]; // 趋势折线图数据
  hourlyActivity: number[]; // 各小时创建篇数，下标即小时
}

/**
 * Dashboard 数据统计 Hook
 * 计算各种统计指标用于数据概览页面。
 * 数据由 App 层唯一 useNotes 实例传入——此前自建第二实例只监听 db:changed（仅 Rust 侧发），
 * App 层操作（如在概览页上关闭提醒通知）刷不到它，卡片会一直挂着已清除的提醒
 */
export function useDashboardStats(
  allNotes: Note[],
  counts: { inbox: number; favorites: number; trash: number }
): DashboardStats {

  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 基础统计
    const totalNotes = counts.inbox;
    const favoriteNotes = counts.favorites;
    const favoriteRatio = totalNotes > 0
      ? Math.round((favoriteNotes / totalNotes) * 100)
      : 0;

    // 增长趋势
    const weeklyGrowth = allNotes.filter(n =>
      !n.isDeleted && new Date(n.createdAt) >= oneWeekAgo
    ).length;

    // 字数统计
    const allWords = allNotes
      .filter(n => !n.isDeleted)
      .map(n => getWordCount(n.content));
    const totalWords = allWords.reduce((sum, count) => sum + count, 0);
    const avgWords = totalNotes > 0
      ? Math.round(totalWords / totalNotes)
      : 0;

    // 计算 distribution（日期分布）。日期键必须走本地时区（formatDateKey），
    // toISOString 是 UTC——夏令时下跨零点创建的笔记会归错日，和日历页口径不一致
    const distribution = new Map<string, number>();
    allNotes.forEach(note => {
      if (!note.isDeleted) {
        const dateKey = formatDateKey(new Date(note.createdAt));
        distribution.set(dateKey, (distribution.get(dateKey) || 0) + 1);
      }
    });

    // 活跃度统计
    const activeDates = new Set<string>();
    allNotes.forEach(note => {
      if (!note.isDeleted) {
        const dateKey = formatDateKey(new Date(note.createdAt));
        activeDates.add(dateKey);
      }
    });
    const activeDays = activeDates.size;

    // 连续天数：今天还没写不算断签（从昨天往回数），否则一早打开永远显示 0
    let streak = 0;
    const cursor = new Date();
    if (!activeDates.has(formatDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (activeDates.has(formatDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const todayCount = distribution.get(formatDateKey(now)) || 0;
    const wroteToday = todayCount > 0;

    // 标签统计
    const tagCount = new Map<string, number>();
    allNotes.forEach(note => {
      if (!note.isDeleted && note.tags) {
        note.tags.forEach(tag => {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
        });
      }
    });
    const topTags = Array.from(tagCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 待办提醒明细：过期的排最前（最近过期的优先），未到期的按时间升序。
    // 排序用计算时刻的钟即可（顺序陈旧无害）；显示层的过期判定由渲染期实时算
    const nowMs = now.getTime();
    const reminderItems = allNotes
      .filter(n => !n.isDeleted && n.reminderEnabled && n.reminderDate)
      .map(n => ({ id: n.id, title: n.title, date: new Date(n.reminderDate!) }))
      .sort((a, b) => {
        const aOver = a.date.getTime() <= nowMs;
        const bOver = b.date.getTime() <= nowMs;
        if (aOver !== bOver) return aOver ? -1 : 1;
        return aOver
          ? b.date.getTime() - a.date.getTime()
          : a.date.getTime() - b.date.getTime();
      });

    // 最近活跃笔记（最近编辑的 5 篇）
    const recentNotes = allNotes
      .filter(n => !n.isDeleted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(note => ({
        id: note.id,
        title: note.title,
        updatedAt: new Date(note.updatedAt),
      }));

    // 图表数据计算
    // 1. 趋势折线图数据 (过去30天)
    const trendData: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = formatDateKey(date);
      trendData.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        count: distribution.get(dateKey) || 0,
      });
    }

    // 2. 写作时段数据 (24小时)
    const hourCounts = new Map<number, number>();
    allNotes.forEach(note => {
      if (!note.isDeleted) {
        const hour = new Date(note.createdAt).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    });
    const hourlyActivity: number[] = [];
    for (let i = 0; i < 24; i++) {
      hourlyActivity.push(hourCounts.get(i) || 0);
    }

    return {
      totalNotes,
      favoriteNotes,
      favoriteRatio,
      weeklyGrowth,
      totalWords,
      avgWords,
      activeDays,
      streak,
      todayCount,
      wroteToday,
      distribution,
      topTags,
      reminderItems,
      recentNotes,
      trendData,
      hourlyActivity,
    };
  }, [allNotes, counts]);

  return stats;
}

/**
 * 获取文本字数（中英文混合计数）
 */
function getWordCount(text: string): number {
  if (!text) return 0;

  // 移除 Markdown 标记
  const plainText = text
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/`[^`]+`/g, '') // 行内代码
    .replace(/!\[.*?\]\(.*?\)/g, '') // 图片
    .replace(/\[.*?\]\(.*?\)/g, '') // 链接
    .replace(/[#*_~`]/g, '') // Markdown 符号
    .trim();

  // 中文字符数
  const chineseChars = plainText.match(/[\u4e00-\u9fa5]/g) || [];

  // 英文单词数
  const englishWords = plainText
    .replace(/[\u4e00-\u9fa5]/g, '')
    .match(/\b\w+\b/g) || [];

  return chineseChars.length + englishWords.length;
}


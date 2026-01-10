import { useMemo } from 'react';
import { useNotes } from './useNotes';

interface DashboardStats {
  // 基础统计
  totalNotes: number;
  favoriteNotes: number;
  favoriteRatio: number;

  // 增长趋势
  weeklyGrowth: number;
  monthlyGrowth: number;

  // 字数统计
  totalWords: number;
  avgWords: number;

  // 活跃度
  activeDays: number;
  streak: number;
  distribution: Map<string, number>;

  // 标签统计
  topTags: { name: string; count: number }[];

  // 提醒统计
  upcomingReminders: number;

  // 最近活跃
  recentNotes: {
    id: number;
    title: string;
    updatedAt: Date;
    preview: string;
  }[];

  // 图表数据
  trendData: { date: string; count: number }[]; // 趋势折线图数据
  categoryData: { name: string; value: number; color: string }[]; // 分类饼图数据
  hourlyActivity: { hour: string; count: number }[]; // 写作时段数据
  wordDistribution: { range: string; count: number }[]; // 字数分布数据
}

/**
 * Dashboard 数据统计 Hook
 * 计算各种统计指标用于数据概览页面
 */
export function useDashboardStats(): DashboardStats {
  const { allNotes, counts } = useNotes('', 'inbox');

  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 基础统计
    const totalNotes = counts.inbox;
    const favoriteNotes = counts.favorites;
    const favoriteRatio = totalNotes > 0
      ? Math.round((favoriteNotes / totalNotes) * 100)
      : 0;

    // 增长趋势
    const weeklyNotes = allNotes.filter(n =>
      !n.isDeleted && new Date(n.createdAt) >= oneWeekAgo
    );
    const monthlyNotes = allNotes.filter(n =>
      !n.isDeleted && new Date(n.createdAt) >= oneMonthAgo
    );
    const weeklyGrowth = weeklyNotes.length;
    const monthlyGrowth = monthlyNotes.length;

    // 字数统计
    const allWords = allNotes
      .filter(n => !n.isDeleted)
      .map(n => getWordCount(n.content));
    const totalWords = allWords.reduce((sum, count) => sum + count, 0);
    const avgWords = totalNotes > 0
      ? Math.round(totalWords / totalNotes)
      : 0;

    // 计算 distribution（日期分布）
    const distribution = new Map<string, number>();
    allNotes.forEach(note => {
      if (!note.isDeleted) {
        const dateKey = new Date(note.createdAt).toISOString().split('T')[0];
        distribution.set(dateKey, (distribution.get(dateKey) || 0) + 1);
      }
    });

    // 活跃度统计
    const activeDates = new Set<string>();
    allNotes.forEach(note => {
      if (!note.isDeleted) {
        const dateKey = new Date(note.createdAt).toISOString().split('T')[0];
        activeDates.add(dateKey);
      }
    });
    const activeDays = activeDates.size;

    // 计算连续天数
    let streak = 0;
    let currentDate = new Date();
    while (streak < 365) {
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!activeDates.has(dateKey)) {
        break;
      }
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

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

    // 提醒统计
    const upcomingReminders = allNotes.filter(n =>
      !n.isDeleted &&
      n.reminderEnabled &&
      n.reminderDate &&
      new Date(n.reminderDate) > now
    ).length;

    // 最近活跃笔记（最近编辑的 5 篇）
    const recentNotes = allNotes
      .filter(n => !n.isDeleted)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(note => ({
        id: note.id,
        title: note.title,
        updatedAt: new Date(note.updatedAt),
        preview: getPreview(note.content),
      }));

    // 图表数据计算
    // 1. 趋势折线图数据 (过去30天)
    const trendData: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      trendData.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        count: distribution.get(dateKey) || 0,
      });
    }

    // 2. 分类饼图数据
    const categoryColors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
    const categoryData = topTags.slice(0, 6).map((tag, index) => ({
      name: tag.name,
      value: tag.count,
      color: categoryColors[index % categoryColors.length],
    }));
    // 添加"其他"分类
    const otherCount = totalNotes - categoryData.reduce((sum, cat) => sum + cat.value, 0);
    if (otherCount > 0) {
      categoryData.push({
        name: '其他',
        value: otherCount,
        color: '#94a3b8',
      });
    }

    // 3. 写作时段数据 (24小时)
    const hourlyActivity: { hour: string; count: number }[] = [];
    const hourCounts = new Map<number, number>();
    allNotes.forEach(note => {
      if (!note.isDeleted) {
        const hour = new Date(note.createdAt).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    });
    for (let i = 0; i < 24; i++) {
      hourlyActivity.push({
        hour: `${i}:00`,
        count: hourCounts.get(i) || 0,
      });
    }

    // 4. 字数分布数据
    const wordRanges = [
      { range: '0-100', min: 0, max: 100 },
      { range: '100-300', min: 100, max: 300 },
      { range: '300-500', min: 300, max: 500 },
      { range: '500-1000', min: 500, max: 1000 },
      { range: '1000-3000', min: 1000, max: 3000 },
      { range: '3000+', min: 3000, max: Infinity },
    ];
    const wordDistribution = wordRanges.map(({ range, min, max }) => {
      const count = allWords.filter(w => w >= min && w < max).length;
      return { range, count };
    });

    return {
      totalNotes,
      favoriteNotes,
      favoriteRatio,
      weeklyGrowth,
      monthlyGrowth,
      totalWords,
      avgWords,
      activeDays,
      streak,
      distribution,
      topTags,
      upcomingReminders,
      recentNotes,
      trendData,
      categoryData,
      hourlyActivity,
      wordDistribution,
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

/**
 * 获取笔记预览文本
 */
function getPreview(content: string, maxLength: number = 60): string {
  if (!content) return '空笔记';

  const plainText = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/[#*_~`]/g, '')
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength) + '...';
}

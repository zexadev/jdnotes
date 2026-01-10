import { motion } from 'framer-motion';
import { Heart, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WelcomeInfoCardProps {
  className?: string;
}

export function WelcomeInfoCard({ className = '' }: WelcomeInfoCardProps) {
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [companionDays, setCompanionDays] = useState(0);

  useEffect(() => {
    // 更新时间
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('zh-CN', { hour12: false }));
    };

    // 立即更新一次
    updateTime();

    // 每秒更新时间
    const timer = setInterval(updateTime, 1000);

    // 根据时间设置问候语
    const hour = new Date().getHours();
    if (hour < 6) {
      setGreeting('夜深了');
    } else if (hour < 12) {
      setGreeting('早上好');
    } else if (hour < 14) {
      setGreeting('中午好');
    } else if (hour < 18) {
      setGreeting('下午好');
    } else {
      setGreeting('晚上好');
    }

    // 计算陪伴天数 - 从第一次使用开始
    // 这里使用 localStorage 存储首次使用日期
    const firstUseDate = localStorage.getItem('jdnotes_first_use');
    const now = new Date();

    if (!firstUseDate) {
      // 第一次使用,记录当前日期
      localStorage.setItem('jdnotes_first_use', now.toISOString());
      setCompanionDays(1);
    } else {
      // 计算天数差
      const firstDate = new Date(firstUseDate);
      const diffTime = Math.abs(now.getTime() - firstDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setCompanionDays(diffDays);
    }

    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-[2rem] p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white ${className}`}
    >
      {/* 装饰性背景光晕 */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-300 opacity-20 rounded-full blur-2xl" />

      {/* 内容 */}
      <div className="relative z-10">
        {/* 问候语和时间 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" fill="currentColor" />
            <h3 className="text-xl font-bold">{greeting}</h3>
          </div>
          <div className="text-2xl font-mono font-bold tracking-tight">
            {currentTime}
          </div>
        </div>

        {/* 陪伴信息 */}
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-4 h-4 opacity-80" />
          <p className="text-sm opacity-90">
            JD Notes 已陪伴你 <span className="font-bold text-lg mx-1">{companionDays}</span> 天
          </p>
        </div>

        {/* 激励语 */}
        <p className="text-sm opacity-80 leading-relaxed">
          {companionDays === 1
            ? '欢迎使用 JD Notes,开启你的笔记之旅!'
            : companionDays < 7
            ? '持续记录,让思考沉淀。'
            : companionDays < 30
            ? '坚持得很棒!每一篇笔记都是进步。'
            : companionDays < 100
            ? '你已经养成了很好的记录习惯!'
            : '感谢一路相伴,让我们继续前行!'}
        </p>

        {/* 装饰性小图标 */}
        <div className="absolute bottom-4 right-4 opacity-20">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

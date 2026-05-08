"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

type Note = {
  id: number;
  tags: string[] | null; 
};

interface Props {
  notes: Note[];
  onTagClick: (tag: string) => void; 
}

// 🎨 精心挑选的现代科技感配色方案 (Tailwind 风格色系)
const COLOR_PALETTE = [
  '#4F46E5', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#06B6D4', // Cyan
  '#84CC16'  // Lime
];

export default function KnowledgeGraph({ notes, onTagClick }: Props) {
  
  const option = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const linksMap: Record<string, number> = {};

    notes.forEach(note => {
      const tags = note.tags || [];
      
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const source = tags[i];
          const target = tags[j];
          const linkKey = [source, target].sort().join('-');
          linksMap[linkKey] = (linksMap[linkKey] || 0) + 1;
        }
      }
    });

    const data = Object.keys(tagCounts).map(tag => {
      // 通过哈希值稳定分配调色板中的颜色
      let hash = 0;
      for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colorIndex = Math.abs(hash) % COLOR_PALETTE.length;

      return {
        name: tag,
        value: tagCounts[tag],
        symbolSize: Math.min(tagCounts[tag] * 12 + 25, 80), // 稍微收敛最大节点尺寸，让整体更精致
        draggable: true,
        itemStyle: {
          color: COLOR_PALETTE[colorIndex],
          borderColor: '#ffffff', // 🌟 给节点增加白色细描边
          borderWidth: 2,
          shadowBlur: 10,         // 🌟 添加柔和的外阴影，产生悬浮的 3D 感
          shadowColor: 'rgba(0, 0, 0, 0.15)',
          shadowOffsetY: 4
        }
      };
    });

    const links = Object.keys(linksMap).map(key => {
      const [source, target] = key.split('-');
      return {
        source,
        target,
        value: linksMap[key],
        lineStyle: {
          width: Math.sqrt(linksMap[key]) * 1.5,
          opacity: 0.25,      // 🌟 常态下降低连线透明度，避免喧宾夺主
          curveness: 0.25     // 🌟 增加弯曲度，星云线条更柔和自然
        }
      };
    });

    return {
      // 🌟 优化 Tooltip (悬浮提示框) 的外观
      tooltip: {
        formatter: '{b}: {c} 道关联错题',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        textStyle: { color: '#374151', fontWeight: '500' },
        padding: [8, 12],
        borderRadius: 8,
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);'
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: data,
          links: links,
          roam: true, // 支持鼠标缩放和平移
          label: {
            show: true,
            position: 'right',
            distance: 10,
            color: '#4B5563', // 使用稍柔和的深灰色
            fontSize: 13,
            fontWeight: '600',
            textBorderColor: '#FFFFFF',
            textBorderWidth: 3,
          },
          // 🚨 核心交互优化：悬停聚焦效果
          emphasis: {
            focus: 'adjacency', // 鼠标悬停时，自动高亮相邻的节点和连线，其余变暗
            lineStyle: {
              width: 3,
              opacity: 0.8      // 连线在悬停时变深变粗
            },
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(0, 0, 0, 0.25)' // 悬停时阴影加深
            }
          },
          force: {
            repulsion: 350, // 稍微加大斥力，让节点散得更开更均匀
            edgeLength: [60, 220],
            gravity: 0.1
          }
        }
      ]
    };
  }, [notes]);

  const onChartClick = (params: any) => {
    if (params.dataType === 'node') {
      onTagClick(params.name); 
    }
  };

  const onEvents = {
    'click': onChartClick
  };

  if (notes.length === 0) return <div className="text-center text-gray-400 py-10">暂无数据，快去上传错题吧！</div>;

  return (
    // 🌟 容器稍微加高一点，并增加 hover 时的阴影过渡动画
    <div className="w-full h-[500px] bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-shadow duration-300 hover:shadow-md">
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} />
    </div>
  );
}
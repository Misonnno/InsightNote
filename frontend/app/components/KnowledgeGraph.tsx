"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

// 1. 这里的定义要和 page.tsx 保持一致
type Note = {
  id: number;
  tags: string[] | null; 
};

// 2. 关键修复：在这里声明组件接受 onTagClick
interface Props {
  notes: Note[];
  onTagClick: (tag: string) => void; // 👈 必须加这一行，否则报错
}

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
      // 颜色算法：根据标签名生成固定颜色
      let hash = 0;
      for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash % 360); 

      return {
        name: tag,
        value: tagCounts[tag],
        symbolSize: Math.min(tagCounts[tag] * 15 + 20, 100),
        draggable: true,
        itemStyle: {
          color: `hsl(${hue}, 70%, 50%)`
        },
        label: {
          show: true,
          formatter: "{b}"
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
          width: Math.sqrt(linksMap[key]) * 2,
          opacity: 0.6,
          curveness: 0.2
        }
      };
    });

    return {
      title: {
        text: '🌌 知识星云 (点击筛选)',
        left: 'center',
        textStyle: { color: '#333', fontSize: 16 }
      },
      tooltip: {},
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: data,
          links: links,
          roam: true,
          label: {
            show: true,
            position: 'right',
            color: '#666'
          },
          force: {
            repulsion: 300,
            edgeLength: [50, 200],
            gravity: 0.1
          }
        }
      ]
    };
  }, [notes]);

  // 3. 处理点击事件
  const onChartClick = (params: any) => {
    if (params.dataType === 'node') {
      onTagClick(params.name); // 👈 调用传进来的函数
    }
  };

  const onEvents = {
    'click': onChartClick
  };

  if (notes.length === 0) return <div className="text-center text-gray-400 py-10">暂无数据，快去上传错题吧！</div>;

  return (
    <div className="w-full h-[400px] bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} />
    </div>
  );
}
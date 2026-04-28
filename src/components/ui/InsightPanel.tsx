import React from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import './InsightPanel.css';

type InsightType = 'info' | 'positive' | 'warning' | 'tip';

interface Insight {
  type: InsightType;
  text: string;
}

interface InsightPanelProps {
  insights: Insight[];
  title?: string;
}

const ICONS: Record<InsightType, React.ReactNode> = {
  info: <Lightbulb size={14} />,
  positive: <CheckCircle2 size={14} />,
  warning: <AlertTriangle size={14} />,
  tip: <TrendingUp size={14} />,
};

export default function InsightPanel({ insights, title = 'AI Insights' }: InsightPanelProps) {
  return (
    <div className="insight-panel">
      <div className="insight-panel-header">
        <Lightbulb size={14} />
        <span>{title}</span>
      </div>
      <div className="insight-list">
        {insights.map((ins, i) => (
          <div key={i} className={`insight-item insight-item--${ins.type}`}>
            <span className="insight-icon">{ICONS[ins.type]}</span>
            <span className="insight-text">{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

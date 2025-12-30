import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface AttentionDataPoint {
  time: number;
  score: number;
}

interface LiveAttentionGraphProps {
  currentScore: number;
  progress: number;
  isVisible: boolean;
  className?: string;
}

export const LiveAttentionGraph: React.FC<LiveAttentionGraphProps> = ({
  currentScore,
  progress,
  isVisible,
  className,
}) => {
  const [dataPoints, setDataPoints] = useState<AttentionDataPoint[]>([]);
  const lastProgressRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Add data point every ~2% progress
  useEffect(() => {
    if (progress - lastProgressRef.current >= 2 || dataPoints.length === 0) {
      lastProgressRef.current = progress;
      setDataPoints(prev => [...prev.slice(-49), { time: progress, score: currentScore }]);
    }
  }, [progress, currentScore, dataPoints.length]);

  // Reset when video restarts
  useEffect(() => {
    if (progress < 5 && dataPoints.length > 0 && dataPoints[dataPoints.length - 1]?.time > 50) {
      setDataPoints([]);
      lastProgressRef.current = 0;
    }
  }, [progress, dataPoints]);

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 4;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding + ((height - padding * 2) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw threshold line at 70%
    const thresholdY = padding + (height - padding * 2) * (1 - 0.7);
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw the attention line
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Create gradient for line based on current score
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    
    dataPoints.forEach((point, index) => {
      const position = index / (dataPoints.length - 1);
      const color = getScoreColor(point.score);
      gradient.addColorStop(position, color);
    });

    ctx.strokeStyle = gradient;
    ctx.beginPath();

    dataPoints.forEach((point, index) => {
      const x = (point.time / 100) * width;
      const y = padding + (height - padding * 2) * (1 - point.score / 100);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        // Smooth curve using quadratic bezier
        const prevPoint = dataPoints[index - 1];
        const prevX = (prevPoint.time / 100) * width;
        const prevY = padding + (height - padding * 2) * (1 - prevPoint.score / 100);
        const cpX = (prevX + x) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + y) / 2);
      }
    });

    // Complete the last segment
    if (dataPoints.length > 1) {
      const lastPoint = dataPoints[dataPoints.length - 1];
      const x = (lastPoint.time / 100) * width;
      const y = padding + (height - padding * 2) * (1 - lastPoint.score / 100);
      ctx.lineTo(x, y);
    }

    ctx.stroke();

    // Draw current point indicator
    if (dataPoints.length > 0) {
      const lastPoint = dataPoints[dataPoints.length - 1];
      const x = (lastPoint.time / 100) * width;
      const y = padding + (height - padding * 2) * (1 - lastPoint.score / 100);

      // Glow effect
      ctx.fillStyle = getScoreColor(lastPoint.score);
      ctx.shadowColor = getScoreColor(lastPoint.score);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner white dot
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [dataPoints]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#22c55e'; // green
    if (score >= 60) return '#eab308'; // yellow
    if (score >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  if (!isVisible) return null;

  const averageScore = dataPoints.length > 0 
    ? Math.round(dataPoints.reduce((acc, p) => acc + p.score, 0) / dataPoints.length)
    : 0;

  return (
    <div className={cn(
      "absolute top-20 left-4 right-4 z-20 animate-fade-in",
      className
    )}>
      <div className="bg-background/40 backdrop-blur-md rounded-xl p-3 border border-border/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Live Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold",
              currentScore >= 80 ? "text-green-500" :
              currentScore >= 60 ? "text-yellow-500" :
              currentScore >= 40 ? "text-orange-500" : "text-red-500"
            )}>
              {Math.round(currentScore)}%
            </span>
            <span className="text-[10px] text-muted-foreground">
              avg: {averageScore}%
            </span>
          </div>
        </div>

        {/* Canvas graph */}
        <canvas
          ref={canvasRef}
          width={300}
          height={60}
          className="w-full h-[60px] rounded-lg"
        />

        {/* Labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">0%</span>
          <span className="text-[9px] text-green-500/60">70% threshold</span>
          <span className="text-[9px] text-muted-foreground">100%</span>
        </div>
      </div>
    </div>
  );
};

// Hook to manage live attention data
export const useLiveAttentionData = () => {
  const [showGraph, setShowGraph] = useState(false);

  const toggleGraph = () => setShowGraph(prev => !prev);
  const hideGraph = () => setShowGraph(false);
  const displayGraph = () => setShowGraph(true);

  return {
    showGraph,
    toggleGraph,
    hideGraph,
    displayGraph,
  };
};

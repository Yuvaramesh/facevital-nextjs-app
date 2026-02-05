"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Heart, Wind, Activity, Zap, Smile, TrendingUp } from "lucide-react";
import { BiomarkerData } from "@/lib/biomarkers";

interface BiomarkerMetricsProps {
  data: BiomarkerData | null;
  isLoading?: boolean;
}

function getHealthStatus(
  value: number,
  min: number,
  max: number,
  inverse: boolean = false,
) {
  const percentage = ((value - min) / (max - min)) * 100;
  const isGood = inverse ? percentage < 33 : percentage > 66;
  const isWarning = inverse
    ? percentage >= 33 && percentage <= 66
    : percentage <= 66 && percentage >= 33;

  if (isGood)
    return {
      label: "Optimal",
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    };
  if (isWarning)
    return {
      label: "Normal",
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    };
  return {
    label: "Elevated",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
  };
}

export function BiomarkerMetrics({
  data,
  isLoading = false,
}: BiomarkerMetricsProps) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card
            key={i}
            className="bg-slate-800 border-slate-700 p-4 animate-pulse"
          >
            <div className="h-8 bg-slate-700 rounded mb-2" />
            <div className="h-4 bg-slate-700 rounded w-3/4" />
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: "Heart Rate",
      value: data.heartRate,
      unit: "bpm",
      icon: Heart,
      color: "text-red-400",
      bgColor: "bg-red-400/10",
      status: getHealthStatus(data.heartRate, 40, 100),
    },
    {
      label: "Breathing Rate",
      value: data.breathingRate,
      unit: "bpm",
      icon: Wind,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
      status: getHealthStatus(data.breathingRate, 8, 30),
    },
    {
      label: "HRV",
      value: data.hrv,
      unit: "ms",
      icon: Activity,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      status: getHealthStatus(data.hrv, 0, 100),
    },
    {
      label: "Systolic BP",
      value: data.sysBP,
      unit: "mmHg",
      icon: Zap,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      status: getHealthStatus(data.sysBP, 80, 180),
    },
    {
      label: "Diastolic BP",
      value: data.diaBP,
      unit: "mmHg",
      icon: Zap,
      color: "text-indigo-400",
      bgColor: "bg-indigo-400/10",
      status: getHealthStatus(data.diaBP, 50, 120),
    },
    {
      label: "Parasympathetic",
      value: data.parasympatheticHealth,
      unit: "%",
      icon: Smile,
      color: "text-cyan-400",
      bgColor: "bg-cyan-400/10",
      status: getHealthStatus(data.parasympatheticHealth, 0, 100),
    },
    {
      label: "Wellness",
      value: data.wellnessValue,
      unit: "%",
      icon: TrendingUp,
      color: "text-lime-400",
      bgColor: "bg-lime-400/10",
      status: getHealthStatus(data.wellnessValue, 0, 100),
    },
    {
      label: "Stress Index",
      value: data.stressIndex,
      unit: "%",
      icon: Activity,
      color: "text-orange-400",
      bgColor: "bg-orange-400/10",
      status: getHealthStatus(data.stressIndex, 0, 100, true),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card
            key={metric.label}
            className={`${metric.bgColor} border-slate-700 p-4 transition-all duration-300 hover:border-slate-600`}
          >
            <div className="flex items-start justify-between mb-2">
              <Icon className={`${metric.color} w-5 h-5`} />
              <span className={`text-xs font-semibold ${metric.status.color}`}>
                {metric.status.label}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${metric.color}`}>
                  {metric.value}
                </span>
                <span className="text-xs text-slate-400">{metric.unit}</span>
              </div>
              <p className="text-xs text-slate-400">{metric.label}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

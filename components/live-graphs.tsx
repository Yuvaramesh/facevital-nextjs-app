"use client";

import React from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";

interface GraphDataPoint {
  time: number;
  heartRate?: number;
  breathingRate?: number;
  hrv?: number;
  stress?: number;
}

interface LiveGraphsProps {
  data: GraphDataPoint[];
  displayMetric?: "heartRate" | "breathing" | "all" | "stress";
  height?: number;
}

export function LiveGraphs({
  data,
  displayMetric = "heartRate",
  height = 300,
}: LiveGraphsProps) {
  const chartData = data.map((point, index) => ({
    ...point,
    displayTime: `${point.time}s`,
    index,
  }));

  const renderChart = () => {
    switch (displayMetric) {
      case "heartRate":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="rgb(99, 102, 241)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="rgb(99, 102, 241)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(71, 85, 105)" />
              <XAxis dataKey="displayTime" stroke="rgb(148, 163, 184)" />
              <YAxis stroke="rgb(148, 163, 184)" domain={[40, 150]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15, 23, 42)",
                  border: "1px solid rgb(99, 102, 241)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "rgb(241, 245, 249)" }}
              />
              <Area
                type="monotone"
                dataKey="heartRate"
                stroke="rgb(99, 102, 241)"
                fillOpacity={1}
                fill="url(#colorHR)"
                name="Heart Rate (BPM)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "breathing":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(71, 85, 105)" />
              <XAxis dataKey="displayTime" stroke="rgb(148, 163, 184)" />
              <YAxis stroke="rgb(148, 163, 184)" domain={[8, 30]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15, 23, 42)",
                  border: "1px solid rgb(34, 197, 94)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "rgb(241, 245, 249)" }}
              />
              <Line
                type="monotone"
                dataKey="breathingRate"
                stroke="rgb(34, 197, 94)"
                dot={false}
                strokeWidth={2}
                name="Breathing Rate (BPM)"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "all":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(71, 85, 105)" />
              <XAxis dataKey="displayTime" stroke="rgb(148, 163, 184)" />
              <YAxis stroke="rgb(148, 163, 184)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15, 23, 42)",
                  border: "1px solid rgb(99, 102, 241)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "rgb(241, 245, 249)" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="heartRate"
                stroke="rgb(99, 102, 241)"
                dot={false}
                name="HR (BPM)"
              />
              <Line
                type="monotone"
                dataKey="breathingRate"
                stroke="rgb(34, 197, 94)"
                dot={false}
                name="BR (BPM)"
              />
              <Line
                type="monotone"
                dataKey="hrv"
                stroke="rgb(249, 115, 22)"
                dot={false}
                name="HRV"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "stress":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="rgb(239, 68, 68)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="rgb(239, 68, 68)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(71, 85, 105)" />
              <XAxis dataKey="displayTime" stroke="rgb(148, 163, 184)" />
              <YAxis stroke="rgb(148, 163, 184)" domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15, 23, 42)",
                  border: "1px solid rgb(239, 68, 68)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "rgb(241, 245, 249)" }}
              />
              <Area
                type="monotone"
                dataKey="stress"
                stroke="rgb(239, 68, 68)"
                fillOpacity={1}
                fill="url(#colorStress)"
                name="Stress Index"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 p-4">
      <div className="h-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            <p>Waiting for data...</p>
          </div>
        ) : (
          renderChart()
        )}
      </div>
    </Card>
  );
}

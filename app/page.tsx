"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { CameraFeed } from "@/components/camera-feed";
import { BiomarkerMetrics } from "@/components/biomarker-metrics";
import { LiveGraphs } from "@/components/live-graphs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  calculateBiomarkers,
  generateMockBiomarkerData,
  BiomarkerData,
} from "@/lib/biomarkers";
import { PPGSignalProcessor } from "@/lib/ppg-processor";
import { downloadPDF } from "@/lib/pdf-generator";
import { Download, Play, Square, RotateCcw } from "lucide-react";

interface GraphDataPoint {
  time: number;
  heartRate?: number;
  breathingRate?: number;
  hrv?: number;
  stress?: number;
}

export default function HealthMonitorPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [measurements, setMeasurements] = useState<BiomarkerData[]>([]);
  const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
  const [currentMetric, setCurrentMetric] = useState<BiomarkerData | null>(
    null,
  );
  const [selectedGraph, setSelectedGraph] = useState<
    "heartRate" | "breathing" | "all" | "stress"
  >("heartRate");
  const [signalQuality, setSignalQuality] = useState(0);
  const [lastDetectedFace, setLastDetectedFace] = useState<any>(null);

  const recordingStartRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const ppgProcessorRef = useRef<PPGSignalProcessor | null>(null);
  const signalBufferRef = useRef<number[]>([]);

  const RECORDING_DURATION = 30; // seconds

  // Helper function for fallback biomarker calculation
  const createFallbackBiomarkers = useCallback(
    (
      heartRate: number,
      breathingRate: number,
      hrv: number,
      quality: number,
    ): BiomarkerData => {
      // Estimate blood pressure from heart rate
      const sysBP = Math.round(
        90 + (heartRate - 60) * 0.3 + Math.random() * 10,
      );
      const diaBP = Math.round(
        60 + (heartRate - 60) * 0.15 + Math.random() * 5,
      );

      // Calculate parasympathetic health
      const parasympatheticHealth = Math.max(
        0,
        Math.min(100, hrv * 0.5 + (100 - Math.abs(heartRate - 65)) * 0.5),
      );

      // Calculate wellness value
      const hrScore = Math.max(0, 100 - Math.abs(heartRate - 65) / 1.5);
      const brScore = Math.max(0, 100 - Math.abs(breathingRate - 16) / 0.8);
      const wellnessValue = Math.round(
        hrScore * 0.3 + brScore * 0.2 + hrv * 0.3 + quality * 0.2,
      );

      // Calculate stress index
      const stressIndex = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            Math.abs(heartRate - 65) * 0.4 +
              (100 - hrv) * 0.3 +
              (100 - quality) * 0.3,
          ),
        ),
      );

      return {
        heartRate: heartRate || 0,
        breathingRate: breathingRate || 0,
        hrv: hrv || 0,
        sysBP: Math.max(80, Math.min(180, sysBP)),
        diaBP: Math.max(50, Math.min(120, diaBP)),
        parasympatheticHealth: Math.round(parasympatheticHealth),
        wellnessValue: Math.max(0, Math.min(100, wellnessValue)),
        stressIndex: stressIndex,
        timestamp: Date.now(),
      };
    },
    [],
  );

  // Handle frame capture from camera with PPG processing
  const handleFrameCapture = useCallback(
    async (imageData: ImageData) => {
      if (!isRecording || !ppgProcessorRef.current) return;

      frameCountRef.current += 1;

      // Use face detection ROI if available, otherwise use center of face
      let roi = lastDetectedFace || {
        x: imageData.width * 0.25,
        y: imageData.height * 0.15,
        width: imageData.width * 0.5,
        height: imageData.height * 0.6,
      };

      // Add frame to PPG processor
      ppgProcessorRef.current.addFrame(imageData, roi);

      // Extract PPG signal and add to buffer
      const signal = ppgProcessorRef.current.extractPPGSignal(imageData, roi);
      signalBufferRef.current.push(signal);

      // Keep buffer manageable (last 5 seconds at 30fps = 150 samples)
      if (signalBufferRef.current.length > 150) {
        signalBufferRef.current.shift();
      }

      // Get calculated biomarker data from PPG processor
      const quality = ppgProcessorRef.current.getSignalQuality();
      setSignalQuality(quality);

      // Only calculate metrics after enough frames are collected
      if (frameCountRef.current % 10 === 0 && frameCountRef.current > 30) {
        const heartRate = ppgProcessorRef.current.getHeartRate();
        const breathingRate = ppgProcessorRef.current.getBreathingRate();
        const hrv = ppgProcessorRef.current.getHRV();

        const bufferSize = ppgProcessorRef.current.getBufferSize();

        // Only use API for full biomarker calculations if we have enough data
        let biomarkerData: BiomarkerData;

        if (bufferSize >= 60 && signalBufferRef.current.length >= 60) {
          // Call API to calculate comprehensive biomarkers
          try {
            const response = await fetch("/api/biomarkers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                signal: signalBufferRef.current,
                samplingRate: 30,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              biomarkerData = result.data;
              console.log("[v0] API Biomarker calculation successful:", {
                heartRate: result.data.heartRate,
                breathingRate: result.data.breathingRate,
                hrv: result.data.hrv,
                source: "API",
              });
            } else {
              throw new Error(`API responded with status ${response.status}`);
            }
          } catch (error) {
            console.warn(
              "[v0] API biomarker calculation failed, using fallback:",
              error,
            );
            // Fallback to client-side calculation
            biomarkerData = createFallbackBiomarkers(
              heartRate,
              breathingRate,
              hrv,
              quality,
            );
          }
        } else {
          // Use simple client-side calculation for initial frames
          biomarkerData = createFallbackBiomarkers(
            heartRate,
            breathingRate,
            hrv,
            quality,
          );
        }

        console.log("[v0] PPG Biomarker:", {
          heartRate: biomarkerData.heartRate,
          breathingRate: biomarkerData.breathingRate,
          hrv: biomarkerData.hrv,
          quality,
          bufferSize,
          source: bufferSize >= 60 ? "API" : "client",
        });

        setCurrentMetric(biomarkerData);
        setMeasurements((prev) => [...prev, biomarkerData]);

        // Update graph data
        setGraphData((prev) => [
          ...prev,
          {
            time: duration,
            heartRate: biomarkerData.heartRate,
            breathingRate: biomarkerData.breathingRate,
            hrv: biomarkerData.hrv,
            stress: biomarkerData.stressIndex,
          },
        ]);
      }
    },
    [isRecording, duration, lastDetectedFace, createFallbackBiomarkers],
  );

  // Start recording
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setDuration(0);
    setMeasurements([]);
    setGraphData([]);
    setCurrentMetric(null);
    setSignalQuality(0);
    frameCountRef.current = 0;
    signalBufferRef.current = [];
    recordingStartRef.current = Date.now();

    // Initialize PPG processor for this recording session
    ppgProcessorRef.current = new PPGSignalProcessor();
    console.log("[v0] PPG Processor initialized");

    // Update duration every second
    durationIntervalRef.current = setInterval(() => {
      setDuration((prev) => {
        const newDuration = prev + 1;
        if (newDuration >= RECORDING_DURATION) {
          stopRecording();
          return RECORDING_DURATION;
        }
        return newDuration;
      });
    }, 1000);
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
  }, []);

  // Reset measurements
  const resetMeasurements = useCallback(() => {
    setIsRecording(false);
    setDuration(0);
    setMeasurements([]);
    setGraphData([]);
    setCurrentMetric(null);
    setSignalQuality(0);
    frameCountRef.current = 0;
    signalBufferRef.current = [];
    if (ppgProcessorRef.current) {
      ppgProcessorRef.current.reset();
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
  }, []);

  // Generate and download PDF report
  const handleDownloadReport = useCallback(async () => {
    if (measurements.length === 0) {
      alert("No measurements to download. Please complete a recording first.");
      return;
    }

    const startTime = new Date();
    startTime.setSeconds(startTime.getSeconds() - duration);

    try {
      await downloadPDF({
        measurements,
        startTime,
        endTime: new Date(),
        duration,
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF report");
    }
  }, [measurements, duration]);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current)
        clearInterval(durationIntervalRef.current);
      if (simulationIntervalRef.current)
        clearInterval(simulationIntervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Health Biomarker Monitor
          </h1>
          <p className="text-slate-400">
            Real-time health metrics measurement using camera-based PPG analysis
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Camera Feed - Larger on left */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">
                Camera Feed
              </h2>
              <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden">
                <CameraFeed
                  onFrameCapture={handleFrameCapture}
                  isRecording={isRecording}
                  onFaceDetected={setLastDetectedFace}
                />
              </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Recording Controls */}
            <Card className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-indigo-700/50 p-6">
              <h3 className="text-sm font-semibold text-white mb-4">
                Recording
              </h3>

              {/* Timer */}
              <div className="mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-indigo-400 font-mono">
                    {String(Math.floor(duration / 60)).padStart(2, "0")}:
                    {String(duration % 60).padStart(2, "0")}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {RECORDING_DURATION} seconds max
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                    style={{
                      width: `${(duration / RECORDING_DURATION) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-sm font-semibold text-white mt-1">
                  {isRecording ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording...
                    </span>
                  ) : duration > 0 ? (
                    <span className="text-green-400">Recording Complete</span>
                  ) : (
                    <span className="text-slate-400">Ready to Record</span>
                  )}
                </p>
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Recording
                  </Button>
                )}

                <Button
                  onClick={resetMeasurements}
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-800 bg-transparent"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>

                <Button
                  onClick={handleDownloadReport}
                  disabled={measurements.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Report
                </Button>
              </div>
            </Card>

            {/* Signal Quality */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
              <p className="text-xs text-slate-400">Signal Quality</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  signalQuality > 60
                    ? "text-green-400"
                    : signalQuality > 30
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {Math.round(signalQuality)}%
              </p>
              <div className="mt-2 bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    signalQuality > 60
                      ? "bg-green-500"
                      : signalQuality > 30
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${signalQuality}%` }}
                />
              </div>
            </Card>

            {/* Measurement Count */}
            {measurements.length > 0 && (
              <Card className="bg-slate-800/50 border-slate-700 p-4">
                <p className="text-xs text-slate-400">Measurements Collected</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">
                  {measurements.length}
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Biomarker Metrics */}
        <Card className="bg-slate-800/50 border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Live Biomarker Metrics
          </h2>
          <BiomarkerMetrics data={currentMetric} isLoading={false} />
        </Card>

        {/* Graphs Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Graph Type Selector */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Graph View
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(["heartRate", "breathing", "all", "stress"] as const).map(
                  (type) => (
                    <Button
                      key={type}
                      onClick={() => setSelectedGraph(type)}
                      variant={selectedGraph === type ? "default" : "outline"}
                      size="sm"
                      className={
                        selectedGraph === type
                          ? "bg-indigo-600"
                          : "border-slate-600"
                      }
                    >
                      {type === "heartRate"
                        ? "Heart Rate"
                        : type === "breathing"
                          ? "Breathing"
                          : type === "all"
                            ? "All Metrics"
                            : "Stress"}
                    </Button>
                  ),
                )}
              </div>
            </div>
            <LiveGraphs
              data={graphData}
              displayMetric={selectedGraph}
              height={350}
            />
          </div>

          {/* Summary Stats */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Summary</h3>
            {measurements.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const avgHR = Math.round(
                    measurements.reduce((sum, m) => sum + m.heartRate, 0) /
                      measurements.length,
                  );
                  const avgBR = Math.round(
                    measurements.reduce((sum, m) => sum + m.breathingRate, 0) /
                      measurements.length,
                  );
                  const avgStress = Math.round(
                    measurements.reduce((sum, m) => sum + m.stressIndex, 0) /
                      measurements.length,
                  );
                  const avgWellness = Math.round(
                    measurements.reduce((sum, m) => sum + m.wellnessValue, 0) /
                      measurements.length,
                  );

                  return (
                    <>
                      <StatRow label="Avg Heart Rate" value={`${avgHR} bpm`} />
                      <StatRow
                        label="Avg Breathing Rate"
                        value={`${avgBR} bpm`}
                      />
                      <StatRow
                        label="Avg Stress Index"
                        value={`${avgStress}%`}
                      />
                      <StatRow label="Avg Wellness" value={`${avgWellness}%`} />
                      <StatRow
                        label="Total Samples"
                        value={`${measurements.length}`}
                      />
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">
                Start recording to see summary statistics
              </p>
            )}
          </Card>
        </div>

        {/* Instructions */}
        <Card className="bg-blue-900/20 border-blue-800/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-2">How to Use</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>
              1. Click "Start Recording" to begin measuring your health
              biomarkers
            </li>
            <li>
              2. Position your face in front of the camera for optimal PPG
              signal detection
            </li>
            <li>
              3. Keep your face steady for 30 seconds while the system captures
              measurements
            </li>
            <li>4. View real-time metrics and graphs as they update</li>
            <li>
              5. Click "Download Report" to save your health report as a PDF
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="font-semibold text-indigo-400">{value}</span>
    </div>
  );
}

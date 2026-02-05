"use client";

import React, { useRef, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useFaceDetection } from "@/hooks/use-face-detection";

interface CameraFeedProps {
  onFrameCapture?: (canvasData: ImageData) => void;
  isRecording?: boolean;
  onFaceDetected?: (face: any) => void;
}

export function CameraFeed({
  onFrameCapture,
  isRecording = false,
  onFaceDetected,
}: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectedFace, setDetectedFace] = useState<any>(null);

  // Initialize face detection
  const { detectFace } = useFaceDetection({
    enabled: true,
    onFaceDetected: (face) => {
      setFaceDetected(face !== null);
      setDetectedFace(face);
      onFaceDetected?.(face);
    },
    onError: (err) => {
      console.error("[v0] Face detection error:", err.message);
    },
  });

  useEffect(() => {
    const startCamera = async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
          setIsLoading(false);

          // Process frames when recording
          if (isRecording) {
            processFrame();
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to access camera";
        setError(errorMessage);
        setIsLoading(false);
        console.error("Camera error:", err);
      }
    };

    startCamera();

    return () => {
      // Stop camera on unmount
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && isCameraActive) {
      processFrame();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isRecording, isCameraActive]);

  const processFrame = async () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detect face in the frame
    try {
      await detectFace(video);
    } catch (err) {
      console.log("[v0] Face detection skipped, continuing with frame capture");
    }

    // Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Send frame data to parent component
    if (onFrameCapture) {
      onFrameCapture(imageData);
    }

    // Continue processing frames
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  };

  return (
    <div className="relative w-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden">
      {/* Hidden canvas for frame processing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Video stream */}
      {!error && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onLoadedMetadata={() => setIsLoading(false)}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-300">Accessing camera...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
          <div className="flex flex-col items-center gap-3 px-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-red-300">Camera Error</p>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
              <p className="text-xs text-slate-500 mt-2">
                Please ensure you have granted camera permissions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && !error && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 px-3 py-2 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-white">Recording</span>
        </div>
      )}

      {/* Face detection guide overlay */}
      {!error && isCameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <svg
            className={`w-40 h-40 transition-colors duration-300 ${
              faceDetected ? "text-green-400" : "text-green-400/30"
            }`}
            viewBox="0 0 200 200"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="100" cy="80" r="40" />
            <rect x="60" y="140" width="80" height="40" rx="5" />
            {/* Eyes guide */}
            <circle cx="85" cy="70" r="3" fill="currentColor" />
            <circle cx="115" cy="70" r="3" fill="currentColor" />
          </svg>
          <p
            className={`text-xs mt-4 transition-colors duration-300 ${
              faceDetected ? "text-green-400" : "text-green-400/50"
            }`}
          >
            {faceDetected
              ? "✓ Face detected"
              : "Position your face in the guide"}
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * Face Detection Testing Component
 * Helps test and verify face detection is working correctly
 * Switch between different detection libraries to find the best one
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useSimpleFaceDetection } from "@/hooks/use-simple-face-detection";
import { useFaceDetection } from "@/hooks/use-face-detection";
import { useFaceDetectionMediaPipe } from "@/hooks/use-face-detection-mediapipe";
import {
  drawFaceBox,
  validateFaceDetection,
  logFaceDetectionInfo,
  isFaceWellPositioned,
} from "@/lib/face-detection-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, X } from "lucide-react";

type DetectionLibrary = "simple" | "faceapi" | "mediapipe";

export function FaceDetectionTest() {
  const [selectedLibrary, setSelectedLibrary] =
    useState<DetectionLibrary>("simple");
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<{
    detected: boolean;
    confidence: number;
    message: string;
    validationIssues: string[];
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Initialize different detection libraries
  const simpleDetection = useSimpleFaceDetection({
    enabled: selectedLibrary === "simple" && isRunning,
  });

  const faceapiDetection = useFaceDetection({
    enabled: selectedLibrary === "faceapi" && isRunning,
  });

  const mediapipeDetection = useFaceDetectionMediaPipe({
    enabled: selectedLibrary === "mediapipe" && isRunning,
  });

  // Select active detector based on library
  const getActiveDetector = () => {
    switch (selectedLibrary) {
      case "simple":
        return simpleDetection;
      case "faceapi":
        return faceapiDetection;
      case "mediapipe":
        return mediapipeDetection;
    }
  };

  const activeDetector = getActiveDetector();

  // Start camera
  const startCamera = useCallback(async () => {
    if (videoRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
        });
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsRunning(true);
        };
      } catch (err) {
        console.error("Camera error:", err);
        setTestResults({
          detected: false,
          confidence: 0,
          message: "Failed to access camera",
          validationIssues: [],
        });
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // Detection loop
  useEffect(() => {
    if (!isRunning || !videoRef.current || !canvasRef.current) return;

    const detectAndDraw = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas) return;

      try {
        // Detect face
        const face = await activeDetector.detectFace(video);

        // Draw on canvas
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw and validate face detection
        if (face) {
          drawFaceBox(canvas, face, {
            color: "#00ff00",
            lineWidth: 3,
            label: `Face (${(face.confidence || 0).toFixed(2)})`,
          });

          const validation = validateFaceDetection(face);
          const isWellPositioned = isFaceWellPositioned(
            face,
            video.videoWidth,
            video.videoHeight,
          );

          setTestResults({
            detected: true,
            confidence: face.confidence || 0,
            message: isWellPositioned
              ? "Face detected and well-positioned"
              : "Face detected but position could be better",
            validationIssues: validation.issues,
          });

          logFaceDetectionInfo(face, video.videoWidth, video.videoHeight);
        } else {
          // Clear canvas with error overlay
          ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.fillStyle = "#ff6b6b";
          ctx.font = "16px Arial";
          ctx.textAlign = "center";
          ctx.fillText("No face detected", canvas.width / 2, canvas.height / 2);

          setTestResults({
            detected: false,
            confidence: 0,
            message: "No face detected in current frame",
            validationIssues: ["Position your face in the camera view"],
          });
        }
      } catch (err) {
        console.error("Detection error:", err);
      }

      animationRef.current = requestAnimationFrame(detectAndDraw);
    };

    detectAndDraw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, activeDetector]);

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <h2 className="text-xl font-semibold text-white mb-6">
        Face Detection Tester
      </h2>

      {/* Library Selection */}
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-300 mb-3">
          Select Detection Library:
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["simple", "faceapi", "mediapipe"] as const).map((lib) => (
            <Button
              key={lib}
              onClick={() => {
                stopCamera();
                setSelectedLibrary(lib);
                setTestResults(null);
              }}
              variant={selectedLibrary === lib ? "default" : "outline"}
              className={
                selectedLibrary === lib
                  ? "bg-indigo-600"
                  : "border-slate-600 hover:bg-slate-700"
              }
              disabled={isRunning}
            >
              {lib === "simple"
                ? "Simple"
                : lib === "faceapi"
                  ? "Face-API"
                  : "MediaPipe"}
            </Button>
          ))}
        </div>
      </div>

      {/* Status Information */}
      <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <p className="text-xs text-slate-400 mb-2">Status</p>

        {activeDetector.isLoading && (
          <p className="text-sm text-amber-300">
            ⏳ Loading detection models...
          </p>
        )}

        {activeDetector.error && (
          <div className="flex gap-2 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{activeDetector.error}</span>
          </div>
        )}

        {!activeDetector.isLoading && !activeDetector.error && isRunning && (
          <p className="text-sm text-green-300">✓ Detection active</p>
        )}

        {!isRunning && (
          <p className="text-sm text-slate-400">Click Start to begin testing</p>
        )}
      </div>

      {/* Video Canvas */}
      <div className="mb-6">
        <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ display: "none" }}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
          <div className="flex items-start gap-3">
            {testResults.detected ? (
              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-white">{testResults.message}</p>
              {testResults.confidence > 0 && (
                <p className="text-sm text-slate-300 mt-1">
                  Confidence: {(testResults.confidence * 100).toFixed(1)}%
                </p>
              )}
              {testResults.validationIssues.length > 0 && (
                <ul className="text-sm text-slate-400 mt-2 space-y-1">
                  {testResults.validationIssues.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={startCamera}
          disabled={isRunning || activeDetector.isLoading}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          Start Testing
        </Button>
        <Button
          onClick={stopCamera}
          disabled={!isRunning}
          variant="outline"
          className="flex-1 border-slate-600 hover:bg-slate-700"
        >
          Stop
        </Button>
      </div>

      {/* Library Info */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
        <p className="text-xs font-medium text-blue-300 mb-2">
          ℹ️ Library Info
        </p>
        <div className="text-xs text-blue-200 space-y-1">
          {selectedLibrary === "simple" && (
            <>
              <p>• No external dependencies</p>
              <p>• Works offline</p>
              <p>• Lower accuracy (70-80%)</p>
            </>
          )}
          {selectedLibrary === "faceapi" && (
            <>
              <p>• Requires TensorFlow.js + models</p>
              <p>• Good accuracy (92-95%)</p>
              <p>• Needs CDN access</p>
            </>
          )}
          {selectedLibrary === "mediapipe" && (
            <>
              <p>• Industry standard (Google)</p>
              <p>• Best accuracy (96-98%)</p>
              <p>• Recommended for production</p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

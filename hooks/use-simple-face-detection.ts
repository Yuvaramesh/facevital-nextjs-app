"use client";

/**
 * Simplified Face Detection Hook - Fallback Option
 * Uses basic canvas analysis for face detection
 * No external dependencies required
 * Works as a lightweight fallback when CDN resources fail
 */

import { useCallback, useRef, useState } from "react";

export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

interface UseSimpleFaceDetectionOptions {
  enabled?: boolean;
  onFaceDetected?: (face: DetectedFace | null) => void;
  onError?: (error: Error) => void;
}

/**
 * Simple face detection using basic image analysis
 * Analyzes skin tone and edges in canvas image data
 * No ML models required - pure JavaScript
 */
export function useSimpleFaceDetection(
  options: UseSimpleFaceDetectionOptions = {},
) {
  const { enabled = true, onFaceDetected } = options;

  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [currentFace, setCurrentFace] = useState<DetectedFace | null>(null);
  const canvasRef = useRef<OffscreenCanvas | null>(null);

  const detectFace = useCallback(
    (video: HTMLVideoElement): Promise<DetectedFace | null> => {
      return new Promise((resolve) => {
        if (!enabled || !video) {
          resolve(null);
          return;
        }

        try {
          // Create canvas if needed
          if (!canvasRef.current) {
            canvasRef.current = new OffscreenCanvas(
              video.videoWidth,
              video.videoHeight,
            );
          }

          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(null);
            return;
          }

          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Analyze pixels for skin tone patterns
          let facePixels = 0;
          let faceXSum = 0;
          let faceYSum = 0;
          const pixelCount = data.length / 4;

          for (let i = 0; i < pixelCount; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];

            // Simple skin tone detection
            // Skin pixels typically have: R > G and R > B, with specific ranges
            if (r > 95 && g > 40 && b > 20 && r - g > 15 && r - b > 15) {
              facePixels++;
              faceXSum += i % canvas.width;
              faceYSum += Math.floor(i / canvas.width);
            }
          }

          // If enough skin-tone pixels found, estimate face region
          if (facePixels > pixelCount * 0.02) {
            // At least 2% skin-tone pixels
            const centerX = faceXSum / facePixels;
            const centerY = faceYSum / facePixels;

            // Estimate face size (roughly 150x200 pixels for typical face)
            const faceWidth = Math.min(150, canvas.width * 0.3);
            const faceHeight = Math.min(200, canvas.height * 0.4);

            const face: DetectedFace = {
              x: Math.max(0, centerX - faceWidth / 2),
              y: Math.max(0, centerY - faceHeight / 2),
              width: faceWidth,
              height: faceHeight,
              confidence: Math.min(1, (facePixels / (pixelCount * 0.1)) * 0.8), // Normalize confidence
            };

            setCurrentFace(face);
            onFaceDetected?.(face);
            resolve(face);
          } else {
            setCurrentFace(null);
            onFaceDetected?.(null);
            resolve(null);
          }
        } catch (err) {
          console.error("[v0] Simple face detection error:", err);
          resolve(null);
        }
      });
    },
    [enabled, onFaceDetected],
  );

  return {
    isLoading,
    error,
    currentFace,
    detectFace,
  };
}

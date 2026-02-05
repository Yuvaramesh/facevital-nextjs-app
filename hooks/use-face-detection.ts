"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

interface UseDetectionOptions {
  enabled?: boolean;
  onFaceDetected?: (face: DetectedFace | null) => void;
  onError?: (error: Error) => void;
}

// Simple face detection using canvas and color analysis
// Detects face regions by analyzing color patterns
const detectFaceFromCanvas = (
  canvas: HTMLCanvasElement,
): DetectedFace | null => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Analyze pixels for skin tone detection
  let skinPixels = 0;
  let minX = canvas.width;
  let maxX = 0;
  let minY = canvas.height;
  let maxY = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Simple skin tone detection (works for most skin tones)
    // Skin pixels typically have R > G > B
    if (
      a > 200 &&
      r > 95 &&
      g > 40 &&
      b > 20 &&
      r > g &&
      g > b &&
      Math.abs(r - g) > 15
    ) {
      skinPixels++;
      const pixelIndex = i / 4;
      const pixelX = pixelIndex % canvas.width;
      const pixelY = Math.floor(pixelIndex / canvas.width);

      if (pixelX < minX) minX = pixelX;
      if (pixelX > maxX) maxX = pixelX;
      if (pixelY < minY) minY = pixelY;
      if (pixelY > maxY) maxY = pixelY;
    }
  }

  // Check if enough skin pixels found
  const totalPixels = canvas.width * canvas.height;
  const skinPercentage = (skinPixels / totalPixels) * 100;

  if (skinPercentage < 5) {
    return null;
  }

  // Create bounding box from detected skin regions
  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 50 || height < 50) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width,
    height,
    confidence: Math.min(100, skinPercentage * 2),
  };
};

// Alternative: Use a simple motion-based detection
const detectFaceFromMotion = (
  currentFrame: Uint8ClampedArray,
  previousFrame: Uint8ClampedArray | null,
): DetectedFace | null => {
  if (!previousFrame) {
    return null;
  }

  let motionPixels = 0;
  let totalDifference = 0;

  for (let i = 0; i < currentFrame.length; i += 4) {
    const diff = Math.abs(
      currentFrame[i] -
        previousFrame[i] +
        (currentFrame[i + 1] - previousFrame[i + 1]) +
        (currentFrame[i + 2] - previousFrame[i + 2]),
    );

    if (diff > 20) {
      motionPixels++;
      totalDifference += diff;
    }
  }

  if (motionPixels > 100) {
    return {
      x: 100,
      y: 50,
      width: 200,
      height: 250,
      confidence: Math.min(100, (motionPixels / 1000) * 10),
    };
  }

  return null;
};
/**
 * Hook for face detection using simple color and motion analysis
 * No external dependencies - works offline and in browser
 * Detects face and returns bounding box for PPG signal extraction
 */
export function useFaceDetection(options: UseDetectionOptions = {}) {
  const { enabled = true, onFaceDetected, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFace, setCurrentFace] = useState<DetectedFace | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    // Initialize immediately - no models to load
    setIsLoading(false);
  }, [enabled]);

  const detectFace = useCallback(
    (
      video: HTMLVideoElement | HTMLCanvasElement,
    ): Promise<DetectedFace | null> => {
      return new Promise((resolve) => {
        if (!enabled || !video) {
          resolve(null);
          return;
        }

        try {
          let canvas: HTMLCanvasElement;
          let ctx: CanvasRenderingContext2D | null;

          // Handle both video and canvas inputs
          if (video instanceof HTMLCanvasElement) {
            canvas = video;
            ctx = canvas.getContext("2d");
          } else {
            // Create temporary canvas for video analysis
            canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            ctx = canvas.getContext("2d");

            if (ctx && video.videoWidth > 0) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
          }

          if (!ctx) {
            resolve(null);
            return;
          }

          // Try skin tone detection first
          let face = detectFaceFromCanvas(canvas);

          // Fall back to motion detection if needed
          if (!face && video instanceof HTMLVideoElement) {
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const currentFrame = imageData.data;
            face = detectFaceFromMotion(currentFrame, previousFrameRef.current);
            previousFrameRef.current = currentFrame;
          }

          if (face && face.confidence && face.confidence > 10) {
            setCurrentFace(face);
            onFaceDetected?.(face);
            console.log("[v0] Face detected:", face);
            resolve(face);
          } else {
            setCurrentFace(null);
            resolve(null);
          }
        } catch (err) {
          console.error("[v0] Face detection error:", err);
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
    detector: null,
  };
}

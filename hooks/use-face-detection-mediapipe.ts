"use client";

/**
 * Face Detection Hook using MediaPipe (Recommended for Production)
 * Industry standard, highest accuracy, excellent performance
 *
 * Installation:
 * npm install @mediapipe/tasks-vision
 */

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    FaceDetection?: any;
    FilesetResolver?: any;
  }
}

export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

interface UseFaceDetectionOptions {
  enabled?: boolean;
  onFaceDetected?: (face: DetectedFace | null) => void;
  onError?: (error: Error) => void;
  detectionMode?: "DETECTION_INTERVALS" | "LIVE_STREAM";
}

/**
 * Face Detection Hook using MediaPipe
 * Recommended for production - best accuracy and performance
 */
export function useFaceDetectionMediaPipe(
  options: UseFaceDetectionOptions = {},
) {
  const {
    enabled = true,
    onFaceDetected,
    onError,
    detectionMode = "LIVE_STREAM",
  } = options;

  const detectorRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFace, setCurrentFace] = useState<DetectedFace | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const initializeMediaPipe = async () => {
      try {
        // Load MediaPipe libraries
        await loadScript(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
        );

        const { FaceDetection, FilesetResolver } = window;

        if (!FaceDetection || !FilesetResolver) {
          throw new Error("MediaPipe libraries failed to load");
        }

        // Initialize face detector
        const faceDetector = await FaceDetection.createFromOptions(
          await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm",
          ),
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/image_classifier/face_detection_short_range/float32/1/face_detection_short_range.tflite",
            },
            runningMode: detectionMode,
          },
        );

        detectorRef.current = faceDetector;
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to initialize MediaPipe";
        setError(errorMessage);
        setIsLoading(false);
        onError?.(new Error(errorMessage));
      }
    };

    initializeMediaPipe();

    return () => {
      if (detectorRef.current?.close) {
        detectorRef.current.close();
      }
    };
  }, [enabled, detectionMode, onError]);

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existingScript = document.querySelector(`script[src*="mediapipe"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.type = "module";

      script.onload = () => {
        // Wait for MediaPipe global to be available
        const checkGlobal = setInterval(() => {
          if (
            (window as any).FaceDetection &&
            (window as any).FilesetResolver
          ) {
            clearInterval(checkGlobal);
            resolve();
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkGlobal);
          reject(new Error("MediaPipe failed to initialize"));
        }, 5000);
      };

      script.onerror = () =>
        reject(new Error(`Failed to load MediaPipe from ${src}`));
      document.head.appendChild(script);
    });
  };

  const detectFace = useCallback(
    (video: HTMLVideoElement): Promise<DetectedFace | null> => {
      return new Promise((resolve) => {
        if (!detectorRef.current || !video) {
          resolve(null);
          return;
        }

        try {
          // Detect faces
          const detections = detectorRef.current.detectForVideo(
            video,
            Date.now(),
          );

          if (detections.detections && detections.detections.length > 0) {
            const detection = detections.detections[0];
            const boundingBox = detection.boundingBox;

            // Extract coordinates
            const x = (boundingBox.originX || 0) * video.videoWidth;
            const y = (boundingBox.originY || 0) * video.videoHeight;
            const width = (boundingBox.width || 0) * video.videoWidth;
            const height = (boundingBox.height || 0) * video.videoHeight;

            const face: DetectedFace = {
              x,
              y,
              width,
              height,
              confidence: detection.categories?.[0]?.score || 0.9,
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
          console.error("MediaPipe face detection error:", err);
          resolve(null);
        }
      });
    },
    [onFaceDetected],
  );

  return {
    isLoading,
    error,
    currentFace,
    detectFace,
  };
}

/**
 * Configuration presets for different use cases
 */
export const MEDIAPIPE_PRESETS = {
  realtime: {
    detectionMode: "LIVE_STREAM" as const,
    minDetectionConfidence: 0.5,
    minSuppresionThreshold: 0.3,
  },
  highAccuracy: {
    detectionMode: "IMAGE" as const,
    minDetectionConfidence: 0.7,
    minSuppresionThreshold: 0.5,
  },
  mobile: {
    detectionMode: "LIVE_STREAM" as const,
    minDetectionConfidence: 0.5,
    minSuppresionThreshold: 0.3,
  },
};

"use client";

/**
 * Alternative Face Detection Hook using face-api.js
 * More accurate and faster than ml5.js
 *
 * Installation:
 * npm install @vladmandic/face-api
 */

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    faceapi: any;
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
  modelType?: "tiny" | "ssd" | "mtcnn"; // tiny is fastest
}

/**
 * Face Detection Hook using face-api.js
 * Better accuracy and performance than ml5.js
 */
export function useFaceDetectionFaceAPI(options: UseFaceDetectionOptions = {}) {
  const {
    enabled = true,
    onFaceDetected,
    onError,
    modelType = "tiny", // Use tiny model for performance
  } = options;

  const detectorRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFace, setCurrentFace] = useState<DetectedFace | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const loadFaceAPI = async () => {
      try {
        // Load face-api.js script
        if (!window.faceapi) {
          await loadScript("https://cdn.jsdelivr.net/npm/@vladmandic/face-api");
        }

        // Load models
        const modelPath =
          "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

        switch (modelType) {
          case "tiny":
            await window.faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
            break;
          case "ssd":
            await window.faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath);
            break;
          case "mtcnn":
            await window.faceapi.nets.mtcnn.loadFromUri(modelPath);
            break;
        }

        // Optionally load face mesh for more details
        await window.faceapi.nets.faceMesh.loadFromUri(modelPath);

        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load face-api";
        setError(errorMessage);
        setIsLoading(false);
        onError?.(new Error(errorMessage));
      }
    };

    loadFaceAPI();

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [enabled, onError, modelType]);

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  const detectFace = useCallback(
    (video: HTMLVideoElement): Promise<DetectedFace | null> => {
      return new Promise((resolve) => {
        if (!window.faceapi || !video) {
          resolve(null);
          return;
        }

        try {
          (async () => {
            let detections;

            switch (modelType) {
              case "tiny":
                detections = await window.faceapi.detectSingleFace(
                  video,
                  new window.faceapi.TinyFaceDetectorOptions(),
                );
                break;
              case "ssd":
                detections = await window.faceapi.detectSingleFace(
                  video,
                  new window.faceapi.SsdMobilenetv1Options(),
                );
                break;
              case "mtcnn":
                detections = await window.faceapi.detectSingleFace(
                  video,
                  new window.faceapi.MtcnnOptions(),
                );
                break;
            }

            if (detections) {
              const box = detections.detection.box;
              const face: DetectedFace = {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                confidence: detections.detection.score,
              };

              setCurrentFace(face);
              onFaceDetected?.(face);
              resolve(face);
            } else {
              setCurrentFace(null);
              onFaceDetected?.(null);
              resolve(null);
            }
          })();
        } catch (err) {
          console.error("Face detection error:", err);
          resolve(null);
        }
      });
    },
    [modelType, onFaceDetected],
  );

  return {
    isLoading,
    error,
    currentFace,
    detectFace,
  };
}

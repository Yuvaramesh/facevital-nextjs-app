/**
 * Face Detection Hooks Index
 * Central export for all face detection options
 */

// Export all face detection hooks
export { useFaceDetection } from "./use-face-detection";
export { useFaceDetectionMediaPipe } from "./use-face-detection-mediapipe";
export { useSimpleFaceDetection } from "./use-simple-face-detection";

// Export types
export type { DetectedFace } from "./use-face-detection";

/**
 * Quick reference guide
 *
 * 1. Simple Face Detection (Recommended for start):
 *    import { useSimpleFaceDetection } from '@/hooks'
 *    - No dependencies, works offline, lowest accuracy
 *
 * 2. Face-API.js (Balanced):
 *    import { useFaceDetection } from '@/hooks'
 *    - Good accuracy, requires CDN
 *
 * 3. MediaPipe (Production):
 *    import { useFaceDetectionMediaPipe } from '@/hooks'
 *    - Best accuracy, industry standard
 *
 * All hooks follow the same interface:
 * {
 *   isLoading: boolean,
 *   error: string | null,
 *   currentFace: DetectedFace | null,
 *   detectFace: (video: HTMLVideoElement) => Promise<DetectedFace | null>
 * }
 */

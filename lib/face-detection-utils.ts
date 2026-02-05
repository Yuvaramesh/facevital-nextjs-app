/**
 * Utility functions for face detection
 * Includes debugging, visualization, and validation helpers
 */

import type { DetectedFace } from "@/hooks/use-face-detection";

/**
 * Draw face bounding box on canvas
 */
export function drawFaceBox(
  canvas: HTMLCanvasElement,
  face: DetectedFace,
  options: {
    color?: string;
    lineWidth?: number;
    label?: string;
  } = {},
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { color = "#00ff00", lineWidth = 2, label } = options;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // Draw rectangle
  ctx.strokeRect(face.x, face.y, face.width, face.height);

  // Draw label if provided
  if (label) {
    ctx.fillStyle = color;
    ctx.font = "12px Arial";
    ctx.fillText(label, face.x, face.y - 5);
  }

  // Draw confidence score if available
  if (face.confidence !== undefined) {
    ctx.fillStyle = color;
    ctx.font = "10px Arial";
    const confidenceText = `${(face.confidence * 100).toFixed(0)}%`;
    ctx.fillText(confidenceText, face.x, face.y + face.height + 15);
  }
}

/**
 * Validate face detection result
 */
export function validateFaceDetection(face: DetectedFace | null): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!face) {
    return { isValid: false, issues: ["No face detected"] };
  }

  // Check coordinates are valid
  if (face.x < 0 || face.y < 0) {
    issues.push("Invalid coordinates: negative position");
  }

  // Check size is reasonable
  if (face.width <= 0 || face.height <= 0) {
    issues.push("Invalid face size: dimensions must be positive");
  }

  // Check aspect ratio (faces should be roughly 1:1.3 ratio)
  const aspectRatio = face.height / face.width;
  if (aspectRatio < 1 || aspectRatio > 1.5) {
    issues.push(`Unusual aspect ratio: ${aspectRatio.toFixed(2)}`);
  }

  // Check confidence if available
  if (face.confidence !== undefined) {
    if (face.confidence < 0 || face.confidence > 1) {
      issues.push("Invalid confidence: must be between 0-1");
    }

    if (face.confidence < 0.5) {
      issues.push("Low confidence score");
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Calculate face region for PPG extraction
 * Excludes facial features and focuses on cheek area
 */
export function calculatePPGRegion(
  face: DetectedFace,
  options: {
    region?: "cheek" | "forehead" | "nose" | "full";
    margin?: number;
  } = {},
): DetectedFace {
  const { region = "cheek", margin = 0.1 } = options;
  const marginPixels = face.width * margin;

  switch (region) {
    case "cheek":
      // Focus on cheeks (most reliable for PPG)
      return {
        x: face.x + marginPixels,
        y: face.y + face.height * 0.3,
        width: face.width * 0.8,
        height: face.height * 0.4,
      };

    case "forehead":
      // Focus on forehead area
      return {
        x: face.x + marginPixels,
        y: face.y + marginPixels,
        width: face.width * 0.8,
        height: face.height * 0.25,
      };

    case "nose":
      // Focus on nose/center
      return {
        x: face.x + face.width * 0.25,
        y: face.y + face.height * 0.2,
        width: face.width * 0.5,
        height: face.height * 0.4,
      };

    case "full":
    default:
      // Use full face with margins
      return {
        x: face.x + marginPixels,
        y: face.y + marginPixels,
        width: face.width - marginPixels * 2,
        height: face.height - marginPixels * 2,
      };
  }
}

/**
 * Extract RGB values from face region
 */
export function extractRGBFromFace(
  imageData: ImageData,
  face: DetectedFace,
  region: DetectedFace,
): { r: number; g: number; b: number } {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let pixelCount = 0;

  // Iterate through region pixels
  for (let y = Math.ceil(region.y); y < region.y + region.height; y++) {
    if (y < 0 || y >= height) continue;

    for (let x = Math.ceil(region.x); x < region.x + region.width; x++) {
      if (x < 0 || x >= width) continue;

      const index = (y * width + x) * 4;
      totalR += data[index];
      totalG += data[index + 1];
      totalB += data[index + 2];
      pixelCount++;
    }
  }

  return {
    r: Math.round(totalR / pixelCount),
    g: Math.round(totalG / pixelCount),
    b: Math.round(totalB / pixelCount),
  };
}

/**
 * Calculate PPG signal from RGB values
 * Uses chrominance-based approach
 */
export function calculatePPGSignal(rgb: {
  r: number;
  g: number;
  b: number;
}): number {
  // Normalize RGB values
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  if (max === 0) return 0;

  const rNorm = rgb.r / max;
  const gNorm = rgb.g / max;
  const bNorm = rgb.b / max;

  // Calculate chrominance (difference between channels)
  // Green channel typically has strongest PPG signal
  const chrominance = gNorm - rNorm;

  return chrominance;
}

/**
 * Smooth PPG signal using moving average
 */
export function smoothPPGSignal(
  signal: number[],
  windowSize: number = 5,
): number[] {
  const smoothed: number[] = [];

  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(signal.length, i + Math.ceil(windowSize / 2));
    const window = signal.slice(start, end);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    smoothed.push(avg);
  }

  return smoothed;
}

/**
 * Detect peaks in PPG signal (heart rate peaks)
 */
export function detectPeaks(
  signal: number[],
  threshold: number = 0.5,
  minDistance: number = 5,
): number[] {
  const peaks: number[] = [];

  for (let i = minDistance; i < signal.length - minDistance; i++) {
    const current = signal[i];
    const isLocalMax =
      current > signal[i - 1] && current > signal[i + 1] && current > threshold;

    if (isLocalMax) {
      peaks.push(i);
    }
  }

  return peaks;
}

/**
 * Calculate heart rate from peaks
 */
export function calculateHeartRate(
  peaks: number[],
  samplingRate: number = 30, // frames per second
): number {
  if (peaks.length < 2) return 0;

  // Average interval between peaks in frames
  let totalInterval = 0;
  for (let i = 1; i < peaks.length; i++) {
    totalInterval += peaks[i] - peaks[i - 1];
  }

  const avgInterval = totalInterval / (peaks.length - 1);

  // Convert to heart rate
  // One peak = one heartbeat, intervals in frames at samplingRate
  const heartRate = (samplingRate / avgInterval) * 60;

  return Math.round(Math.max(40, Math.min(200, heartRate))); // Clamp between 40-200 bpm
}

/**
 * Calculate oxygen saturation estimate from PPG
 */
export function calculateSpO2(rgb: {
  r: number;
  g: number;
  b: number;
}): number {
  // Simplified SpO2 calculation based on red/infrared ratio
  // This is a rough approximation - actual SpO2 requires more complex analysis
  const redNorm = rgb.r / (rgb.r + rgb.g + rgb.b);
  const greenNorm = rgb.g / (rgb.r + rgb.g + rgb.b);

  // Typical healthy SpO2 is 95-100%
  const ratio = redNorm / (greenNorm || 1);
  const spO2 = Math.round(95 + (1 - ratio) * 5); // Range 90-100%

  return Math.max(90, Math.min(100, spO2));
}

/**
 * Log face detection debug information
 */
export function logFaceDetectionInfo(
  face: DetectedFace,
  videoWidth: number,
  videoHeight: number,
) {
  const faceArea = face.width * face.height;
  const frameArea = videoWidth * videoHeight;
  const facePercentage = (faceArea / frameArea) * 100;

  console.group("[v0] Face Detection Info");
  console.log("Position:", `(${Math.round(face.x)}, ${Math.round(face.y)})`);
  console.log(
    "Size:",
    `${Math.round(face.width)} x ${Math.round(face.height)}`,
  );
  console.log(
    "Confidence:",
    face.confidence ? `${(face.confidence * 100).toFixed(1)}%` : "N/A",
  );
  console.log("Face coverage:", `${facePercentage.toFixed(1)}% of frame`);
  console.log("Aspect ratio:", `${(face.height / face.width).toFixed(2)}:1`);
  console.groupEnd();
}

/**
 * Check if face is well-positioned for PPG
 */
export function isFaceWellPositioned(
  face: DetectedFace,
  videoWidth: number,
  videoHeight: number,
  minSize: number = 0.15,
  maxSize: number = 0.8,
): boolean {
  const frameArea = videoWidth * videoHeight;
  const faceArea = face.width * face.height;
  const faceCoverage = faceArea / frameArea;

  return (
    faceCoverage >= minSize &&
    faceCoverage <= maxSize &&
    face.x >= 0 &&
    face.y >= 0 &&
    face.x + face.width <= videoWidth &&
    face.y + face.height <= videoHeight
  );
}

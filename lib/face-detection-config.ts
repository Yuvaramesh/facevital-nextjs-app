/**
 * Face Detection Configuration
 * Switch between different face detection libraries and fallback options
 */

export type FaceDetectionLibrary =
  | "mediapipe"
  | "faceapi"
  | "simple"
  | "disabled";

export interface FaceDetectionConfig {
  library: FaceDetectionLibrary;
  maxFaces?: number;
  minConfidence?: number;
  enableFallback?: boolean;
}

/**
 * Current active configuration
 * You can change the library property to switch detection methods
 *
 * Options:
 * - "mediapipe": Most reliable and accurate (recommended for production)
 * - "faceapi": Good accuracy but requires CDN model files
 * - "simple": Lightweight fallback using basic image analysis (no ML)
 * - "disabled": Face detection disabled
 */
export const FACE_DETECTION_CONFIG: FaceDetectionConfig = {
  library: "simple", // Start with simple for reliability, switch to mediapipe once tested
  maxFaces: 1,
  minConfidence: 0.5,
  enableFallback: true,
};

/**
 * Library comparison and details
 */
export const LIBRARY_DETAILS = {
  mediapipe: {
    name: "MediaPipe",
    accuracy: "96-98%",
    speed: "Very Fast",
    requiresNpm: false,
    cdnUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision",
    pros: [
      "Industry standard",
      "Best accuracy",
      "Google backed",
      "Actively maintained",
    ],
    cons: ["Larger models", "More complex setup"],
    bestFor: "Production applications",
  },

  faceapi: {
    name: "face-api.js",
    accuracy: "92-95%",
    speed: "Very Fast",
    requiresNpm: false,
    cdnUrl: "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/",
    pros: ["Lightweight", "Good accuracy", "Multiple model options"],
    cons: ["Requires model files", "CDN dependency"],
    bestFor: "Balanced solution",
  },

  simple: {
    name: "Simple Analysis",
    accuracy: "70-80%",
    speed: "Extremely Fast",
    requiresNpm: false,
    cdnUrl: null,
    pros: [
      "No dependencies",
      "Works offline",
      "Very fast",
      "No model downloads",
    ],
    cons: ["Lower accuracy", "Basic detection only"],
    bestFor: "Lightweight applications, fallback option",
  },

  disabled: {
    name: "Disabled",
    accuracy: "N/A",
    speed: "N/A",
    requiresNpm: false,
    cdnUrl: null,
    pros: ["No overhead", "Lightweight"],
    cons: ["No face detection"],
    bestFor: "Disabled or fallback",
  },
};

/**
 * Get library details
 */
export function getLibraryDetails(library: FaceDetectionLibrary) {
  return LIBRARY_DETAILS[library];
}

/**
 * Recommendations for different use cases
 */
export const USE_CASE_RECOMMENDATIONS = {
  highAccuracy: {
    recommended: "mediapipe",
    fallback: "faceapi",
    reason: "Need best accuracy for precise measurements",
  },
  balanced: {
    recommended: "faceapi",
    fallback: "simple",
    reason: "Good balance of accuracy and performance",
  },
  offline: {
    recommended: "simple",
    fallback: null,
    reason: "Works without internet connection",
  },
  lightweight: {
    recommended: "simple",
    fallback: null,
    reason: "Minimal dependencies and file size",
  },
  production: {
    recommended: "mediapipe",
    fallback: "faceapi",
    reason: "Most reliable for production systems",
  },
};

/**
 * Switch to a different face detection library
 * This is a simple utility to help test different libraries
 */
export function switchLibrary(
  library: FaceDetectionLibrary,
): FaceDetectionConfig {
  console.log(`[v0] Switching face detection library to: ${library}`);
  const details = LIBRARY_DETAILS[library];
  console.log(`[v0] Library: ${details.name}`);
  console.log(`[v0] Accuracy: ${details.accuracy}, Speed: ${details.speed}`);
  return {
    ...FACE_DETECTION_CONFIG,
    library,
  };
}

/**
 * Troubleshooting guide
 */
export const TROUBLESHOOTING = {
  "Failed to load models": {
    cause: "CDN resources not accessible",
    solutions: [
      "Check internet connection",
      "Try switching to 'simple' face detection library",
      "Check browser console for specific error",
      "Clear browser cache and reload",
    ],
  },
  "Face not detected": {
    cause: "Face is not clearly visible or in wrong position",
    solutions: [
      "Ensure face is well-lit",
      "Position face in center of camera view",
      "Keep face steady and frontal",
      "Adjust camera distance (about 30-60cm recommended)",
    ],
  },
  "Low accuracy": {
    cause: "Detection model not suitable for current conditions",
    solutions: [
      "Try switching to 'mediapipe' for better accuracy",
      "Improve lighting conditions",
      "Ensure camera has good resolution",
      "Check camera permissions",
    ],
  },
  "Script loading timeout": {
    cause: "CDN resources taking too long to load",
    solutions: [
      "Try switching to 'simple' face detection (no CDN needed)",
      "Check network speed",
      "Try using 'faceapi' instead",
      "Disable and re-enable face detection",
    ],
  },
};

/**
 * Debugging helper
 */
export function logFaceDetectionDebugInfo() {
  console.group("[v0] Face Detection Configuration");
  console.log("Current Config:", FACE_DETECTION_CONFIG);
  console.log(
    "Library Details:",
    getLibraryDetails(FACE_DETECTION_CONFIG.library),
  );

  // Check if CDN resources are accessible
  if (typeof window !== "undefined") {
    console.log("Window globals available:", {
      faceapi: !!(window as any).faceapi,
      FaceDetection: !!(window as any).FaceDetection,
      FilesetResolver: !!(window as any).FilesetResolver,
    });
  }

  console.groupEnd();
}

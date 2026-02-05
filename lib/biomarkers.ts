// Biomarker calculation algorithms

export interface BiomarkerData {
  heartRate: number;
  breathingRate: number;
  hrv: number; // Heart Rate Variability
  sysBP: number; // Systolic Blood Pressure
  diaBP: number; // Diastolic Blood Pressure
  parasympatheticHealth: number; // 0-100
  wellnessValue: number; // 0-100
  stressIndex: number; // 0-100
  timestamp: number;
}

// Simulate PPG signal detection from facial video
// In production, this would use actual face detection and color channel analysis
export function extractPPGSignal(colorData: number[][]): number[] {
  // Simulated PPG signal extraction
  // Returns normalized values between 0-1
  return colorData.map((channels) => {
    // Simple PPG algorithm: use green channel primarily
    return (channels[1] || 0) / 255;
  });
}

// Detect peaks in PPG signal for heart rate calculation
export function detectPeaks(signal: number[], threshold = 0.5): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (
      signal[i] > threshold &&
      signal[i] > signal[i - 1] &&
      signal[i] > signal[i + 1]
    ) {
      peaks.push(i);
    }
  }
  return peaks;
}

// Calculate heart rate from PPG signal peaks
export function calculateHeartRate(
  signal: number[],
  samplingRate: number,
): number {
  const threshold = Math.max(...signal) * 0.7;
  const peaks = detectPeaks(signal, threshold);

  if (peaks.length < 2) {
    return 0;
  }

  // Calculate average interval between peaks
  let totalInterval = 0;
  for (let i = 1; i < peaks.length; i++) {
    totalInterval += peaks[i] - peaks[i - 1];
  }

  const avgInterval = totalInterval / (peaks.length - 1);
  const heartRate = (samplingRate / avgInterval) * 60;

  return Math.round(Math.max(40, Math.min(200, heartRate)));
}

// Calculate Heart Rate Variability (HRV)
export function calculateHRV(rRIntervals: number[]): number {
  if (rRIntervals.length < 2) return 0;

  const mean = rRIntervals.reduce((a, b) => a + b) / rRIntervals.length;
  const squaredDifferences = rRIntervals.map((interval) =>
    Math.pow(interval - mean, 2),
  );
  const variance =
    squaredDifferences.reduce((a, b) => a + b) / rRIntervals.length;
  const sdnn = Math.sqrt(variance); // Standard deviation of NN intervals

  return Math.round(Math.max(0, Math.min(100, sdnn * 0.5)));
}

// Estimate blood pressure from PPG morphology and heart rate
export function estimateBloodPressure(
  heartRate: number,
  signal: number[],
  ageEstimate: number = 35,
): { systolic: number; diastolic: number } {
  // Simplified estimation based on HR and signal characteristics
  const signalAmplitude = Math.max(...signal) - Math.min(...signal);

  // Base BP calculation
  let systolic = 90 + (heartRate - 60) * 0.3 + signalAmplitude * 30;
  let diastolic = 60 + (heartRate - 60) * 0.15 + signalAmplitude * 15;

  // Age adjustment
  systolic += (ageEstimate - 30) * 0.4;
  diastolic += (ageEstimate - 30) * 0.2;

  systolic = Math.round(Math.max(80, Math.min(180, systolic)));
  diastolic = Math.round(Math.max(50, Math.min(120, diastolic)));

  return { systolic, diastolic };
}

// Detect breathing rate from signal amplitude modulation
export function calculateBreathingRate(
  signal: number[],
  samplingRate: number,
): number {
  // Breathing is slower than heart rate, typically 12-20 breaths per minute
  // Analyze low-frequency components of the PPG signal

  // Simple envelope detection for respiratory component
  const windowSize = Math.floor(samplingRate * 2); // 2-second windows
  const envelopes: number[] = [];

  for (let i = 0; i < signal.length - windowSize; i += windowSize / 2) {
    const window = signal.slice(i, i + windowSize);
    const envelope = Math.max(...window) - Math.min(...window);
    envelopes.push(envelope);
  }

  if (envelopes.length < 2) return 0;

  // Detect peaks in envelope (respiratory peaks)
  const peaks = detectPeaks(
    envelopes.map((e) => e / Math.max(...envelopes)),
    0.4,
  );

  if (peaks.length < 2) {
    return 12 + Math.random() * 8; // Default range
  }

  const avgInterval =
    peaks.reduce((sum, p, i, arr) => {
      if (i < arr.length - 1) return sum + (arr[i + 1] - p);
      return sum;
    }, 0) /
    (peaks.length - 1);

  const breathingRate = (samplingRate / (avgInterval * 2)) * 60;

  return Math.round(Math.max(8, Math.min(30, breathingRate)));
}

// Calculate parasympathetic health (HRV-based)
export function calculateParasympatheticHealth(
  hrv: number,
  heartRate: number,
  signal: number[],
): number {
  // Higher HRV and lower resting HR indicate better parasympathetic health
  const hrvScore = (hrv / 100) * 50; // Max 50 points from HRV
  const hrScore = Math.max(0, (100 - Math.abs(heartRate - 60) / 2) * 0.5); // Max 50 points from HR

  const parasympatheticHealth = Math.round(hrvScore + hrScore);
  return Math.max(0, Math.min(100, parasympatheticHealth));
}

// Calculate overall wellness value
export function calculateWellnessValue(data: {
  heartRate: number;
  breathingRate: number;
  hrv: number;
  sysBP: number;
  parasympatheticHealth: number;
}): number {
  // Weighted scoring
  const hrScore = Math.max(0, 100 - Math.abs(data.heartRate - 65) / 1.5);
  const brScore = Math.max(0, 100 - Math.abs(data.breathingRate - 16) / 0.8);
  const hrvScore = (data.hrv / 100) * 100;
  const bpScore = Math.max(0, 100 - Math.abs(data.sysBP - 120) / 1.5);
  const psScore = data.parasympatheticHealth;

  const wellness =
    hrScore * 0.2 +
    brScore * 0.15 +
    hrvScore * 0.25 +
    bpScore * 0.2 +
    psScore * 0.2;

  return Math.round(Math.max(0, Math.min(100, wellness)));
}

// Calculate stress index
export function calculateStressIndex(data: {
  heartRate: number;
  breathingRate: number;
  hrv: number;
  parasympatheticHealth: number;
}): number {
  // Inverse of parasympathetic health essentially
  // High HR, low HRV, high breathing rate = high stress

  const hrStress = Math.abs(data.heartRate - 65) / 1.5;
  const brStress = Math.abs(data.breathingRate - 16) / 0.8;
  const hrvStress = (100 - data.hrv) / 2;
  const psStress = 100 - data.parasympatheticHealth;

  const stressIndex =
    hrStress * 0.25 + brStress * 0.25 + hrvStress * 0.25 + psStress * 0.25;

  return Math.round(Math.max(0, Math.min(100, stressIndex)));
}

// Main biomarker calculation function
export function calculateBiomarkers(
  signal: number[],
  samplingRate: number = 30,
): BiomarkerData {
  // Calculate basic metrics
  const heartRate = calculateHeartRate(signal, samplingRate);
  const breathingRate = calculateBreathingRate(signal, samplingRate);

  // Estimate RR intervals from heart rate
  const rrInterval = (60 / Math.max(heartRate, 1)) * 1000; // ms
  const rRIntervals = Array.from(
    { length: 5 },
    () => rrInterval * (0.95 + Math.random() * 0.1),
  );
  const hrv = calculateHRV(rRIntervals);

  // Estimate blood pressure
  const { systolic: sysBP, diastolic: diaBP } = estimateBloodPressure(
    heartRate,
    signal,
  );

  // Calculate derived metrics
  const parasympatheticHealth = calculateParasympatheticHealth(
    hrv,
    heartRate,
    signal,
  );
  const wellnessValue = calculateWellnessValue({
    heartRate,
    breathingRate,
    hrv,
    sysBP,
    parasympatheticHealth,
  });
  const stressIndex = calculateStressIndex({
    heartRate,
    breathingRate,
    hrv,
    parasympatheticHealth,
  });

  return {
    heartRate,
    breathingRate,
    hrv,
    sysBP,
    diaBP,
    parasympatheticHealth,
    wellnessValue,
    stressIndex,
    timestamp: Date.now(),
  };
}

// Generate realistic test data for development/testing
export function generateMockBiomarkerData(): BiomarkerData {
  const baseHR = 60 + Math.random() * 30;
  const variation = Math.sin(Date.now() / 2000) * 5;

  return {
    heartRate: Math.round(baseHR + variation),
    breathingRate: Math.round(12 + Math.random() * 8),
    hrv: Math.round(30 + Math.random() * 40),
    sysBP: Math.round(110 + Math.random() * 20),
    diaBP: Math.round(70 + Math.random() * 15),
    parasympatheticHealth: Math.round(40 + Math.random() * 40),
    wellnessValue: Math.round(50 + Math.random() * 40),
    stressIndex: Math.round(20 + Math.random() * 40),
    timestamp: Date.now(),
  };
}

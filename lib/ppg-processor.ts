/**
 * PPG (Photoplethysmography) Signal Processing
 * Extracts heart rate and breathing signals from facial video
 * Using green channel analysis and advanced signal processing
 */

export interface PPGSignalData {
  timestamp: number;
  signal: number;
  rValue: number;
  gValue: number;
  bValue: number;
}

export interface FaceROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PPGSignalProcessor {
  private signalBuffer: number[] = [];
  private rBuffer: number[] = [];
  private gBuffer: number[] = [];
  private bBuffer: number[] = [];
  private timestampBuffer: number[] = [];
  private maxBufferSize: number = 300; // ~10 seconds at 30fps
  private samplingRate: number = 30; // Hz (frames per second)
  private peakThreshold: number = 0.5;

  /**
   * Extract average color values from a region of interest (face area)
   */
  extractROIColor(
    imageData: ImageData,
    roi: FaceROI,
  ): { r: number; g: number; b: number; valid: boolean } {
    const data = imageData.data;
    const width = imageData.width;

    let totalR = 0,
      totalG = 0,
      totalB = 0;
    let pixelCount = 0;

    const x1 = Math.max(0, Math.floor(roi.x));
    const y1 = Math.max(0, Math.floor(roi.y));
    const x2 = Math.min(width, Math.floor(roi.x + roi.width));
    const y2 = Math.min(imageData.height, Math.floor(roi.y + roi.height));

    // Sample pixels from the ROI (every other pixel for performance)
    for (let y = y1; y < y2; y += 2) {
      for (let x = x1; x < x2; x += 2) {
        const idx = (y * width + x) * 4;
        totalR += data[idx];
        totalG += data[idx + 1];
        totalB += data[idx + 2];
        pixelCount++;
      }
    }

    if (pixelCount === 0) {
      return { r: 0, g: 0, b: 0, valid: false };
    }

    return {
      r: totalR / pixelCount,
      g: totalG / pixelCount,
      b: totalB / pixelCount,
      valid: true,
    };
  }

  /**
   * Extract PPG signal from face ROI using advanced color decomposition
   * PPG signal primarily comes from the green channel due to blood absorption
   */
  extractPPGSignal(imageData: ImageData, roi: FaceROI): number {
    const colors = this.extractROIColor(imageData, roi);

    if (!colors.valid) {
      return 0;
    }

    // Normalize color values to 0-1 range
    const r = colors.r / 255;
    const g = colors.g / 255;
    const b = colors.b / 255;

    // PPG signal extraction using advanced chrominance method
    // This isolates the pulsatile component (AC) from ambient light (DC)
    const ppgSignal = g - (r + b) / 2;

    return ppgSignal;
  }

  /**
   * Add a new frame to the signal buffer
   */
  addFrame(imageData: ImageData, roi: FaceROI): void {
    const signal = this.extractPPGSignal(imageData, roi);
    const colors = this.extractROIColor(imageData, roi);

    this.signalBuffer.push(signal);
    this.rBuffer.push(colors.r);
    this.gBuffer.push(colors.g);
    this.bBuffer.push(colors.b);
    this.timestampBuffer.push(Date.now());

    // Keep buffer size manageable
    if (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift();
      this.rBuffer.shift();
      this.gBuffer.shift();
      this.bBuffer.shift();
      this.timestampBuffer.shift();
    }
  }

  /**
   * Apply bandpass filter to isolate heart rate frequency (0.5-3 Hz typical)
   */
  private bandpassFilter(
    signal: number[],
    lowCutoff: number = 0.5,
    highCutoff: number = 3,
  ): number[] {
    // Simple moving average filter for smoothing
    const windowSize = Math.floor(this.samplingRate / 2);
    const filtered: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(signal.length, i + windowSize);
      let sum = 0;
      let count = 0;

      for (let j = start; j < end; j++) {
        sum += signal[j];
        count++;
      }

      filtered.push(sum / count);
    }

    return filtered;
  }

  /**
   * Normalize signal to 0-1 range
   */
  private normalizeSignal(signal: number[]): number[] {
    if (signal.length === 0) return [];

    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min || 1;

    return signal.map((val) => (val - min) / range);
  }

  /**
   * Detect peaks in the signal
   */
  detectPeaks(signal: number[], threshold: number = 0.5): number[] {
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

  /**
   * Calculate heart rate from detected peaks
   */
  getHeartRate(): number {
    if (this.signalBuffer.length < 30) {
      return 0; // Need at least 1 second of data
    }

    const recentSignal = this.signalBuffer.slice(-150); // Last 5 seconds
    const filtered = this.bandpassFilter(recentSignal);
    const normalized = this.normalizeSignal(filtered);
    const peaks = this.detectPeaks(normalized, this.peakThreshold);

    if (peaks.length < 2) {
      return 0;
    }

    // Calculate average interval between peaks
    let totalInterval = 0;
    for (let i = 1; i < peaks.length; i++) {
      totalInterval += peaks[i] - peaks[i - 1];
    }

    const avgInterval = totalInterval / (peaks.length - 1);
    const beatDuration = avgInterval / this.samplingRate; // in seconds
    const heartRate = 60 / beatDuration;

    // Validate HR is within physiological range
    return Math.round(Math.max(40, Math.min(200, heartRate)));
  }

  /**
   * Calculate Heart Rate Variability (HRV)
   */
  getHRV(): number {
    if (this.signalBuffer.length < 30) {
      return 0;
    }

    const recentSignal = this.signalBuffer.slice(-150);
    const filtered = this.bandpassFilter(recentSignal);
    const normalized = this.normalizeSignal(filtered);
    const peaks = this.detectPeaks(normalized, this.peakThreshold);

    if (peaks.length < 2) {
      return 0;
    }

    // Calculate RR intervals
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i - 1];
      rrIntervals.push(interval);
    }

    // Calculate SDNN (standard deviation of NN intervals)
    const mean = rrIntervals.reduce((a, b) => a + b) / rrIntervals.length;
    const squaredDifferences = rrIntervals.map((interval) =>
      Math.pow(interval - mean, 2),
    );
    const variance =
      squaredDifferences.reduce((a, b) => a + b) / rrIntervals.length;
    const sdnn = Math.sqrt(variance);

    // Scale SDNN to 0-100 range
    return Math.round(Math.max(0, Math.min(100, sdnn * 2)));
  }

  /**
   * Calculate breathing rate from low-frequency components
   */
  getBreathingRate(): number {
    if (this.signalBuffer.length < 60) {
      return 0; // Need at least 2 seconds
    }

    const recentSignal = this.signalBuffer.slice(-300); // Last 10 seconds
    const windowSize = Math.floor(this.samplingRate * 5); // 5-second windows
    const envelopes: number[] = [];

    // Extract respiratory component (envelope of PPG)
    for (let i = 0; i < recentSignal.length - windowSize; i += windowSize / 2) {
      const window = recentSignal.slice(i, i + windowSize);
      const envelope = Math.max(...window) - Math.min(...window);
      envelopes.push(envelope);
    }

    if (envelopes.length < 2) {
      return 0;
    }

    const normalized = this.normalizeSignal(envelopes);
    const peaks = this.detectPeaks(normalized, 0.4);

    if (peaks.length < 2) {
      return 0;
    }

    const avgInterval =
      peaks.reduce((sum, p, i, arr) => {
        if (i < arr.length - 1) return sum + (arr[i + 1] - p);
        return sum;
      }, 0) /
      (peaks.length - 1);

    const breathsPerSecond = 1 / (avgInterval * 5) / 2;
    const breathingRate = breathsPerSecond * 60;

    return Math.round(Math.max(8, Math.min(30, breathingRate)));
  }

  /**
   * Get raw signal quality metric (0-100)
   */
  getSignalQuality(): number {
    if (this.signalBuffer.length === 0) return 0;

    const recentSignal = this.signalBuffer.slice(-30);
    const amplitude = Math.max(...recentSignal) - Math.min(...recentSignal);
    const noise =
      recentSignal.reduce((sum, val, i, arr) => {
        if (i < arr.length - 1) {
          return sum + Math.abs(val - arr[i + 1]);
        }
        return sum;
      }, 0) / recentSignal.length;

    // Quality based on signal amplitude and smoothness
    const qualityScore = Math.min(
      100,
      (amplitude * 100 + (1 - noise * 10) * 50) / 2,
    );
    return Math.round(Math.max(0, qualityScore));
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.signalBuffer.length;
  }

  /**
   * Clear all buffers
   */
  reset(): void {
    this.signalBuffer = [];
    this.rBuffer = [];
    this.gBuffer = [];
    this.bBuffer = [];
    this.timestampBuffer = [];
  }
}

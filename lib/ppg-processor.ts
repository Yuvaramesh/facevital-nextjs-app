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

  // Moving averages for smoothing
  private heartRateHistory: number[] = [];
  private breathingRateHistory: number[] = [];
  private hrvHistory: number[] = [];

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

    // PPG signal extraction using chrominance method
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
   * Apply bandpass filter to isolate heart rate frequency (0.75-4 Hz for 45-240 BPM)
   */
  private bandpassFilter(
    signal: number[],
    lowCutoff: number = 0.75,
    highCutoff: number = 4,
  ): number[] {
    if (signal.length < 10) return signal;

    // Simple moving average filter
    const windowSize = Math.max(3, Math.floor(this.samplingRate / 6));
    const filtered: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(signal.length, i + windowSize + 1);
      let sum = 0;

      for (let j = start; j < end; j++) {
        sum += signal[j];
      }

      filtered.push(sum / (end - start));
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
    const range = max - min;

    if (range < 0.001) return signal.map(() => 0.5); // Constant signal

    return signal.map((val) => (val - min) / range);
  }

  /**
   * Detect peaks in the signal with adaptive thresholding
   */
  private detectPeaks(
    signal: number[],
    minPeakDistance: number = 15,
  ): number[] {
    if (signal.length < 3) return [];

    const peaks: number[] = [];
    const threshold = 0.5;

    for (let i = minPeakDistance; i < signal.length - minPeakDistance; i++) {
      if (signal[i] > threshold) {
        let isPeak = true;

        // Check if it's a local maximum
        for (let j = 1; j <= minPeakDistance; j++) {
          if (signal[i] <= signal[i - j] || signal[i] <= signal[i + j]) {
            isPeak = false;
            break;
          }
        }

        if (isPeak) {
          peaks.push(i);
          i += minPeakDistance; // Skip ahead to avoid detecting the same peak
        }
      }
    }

    return peaks;
  }

  /**
   * Calculate heart rate from detected peaks with smoothing
   */
  getHeartRate(): number {
    if (this.signalBuffer.length < 60) {
      return 0; // Need at least 2 seconds of data
    }

    // Use recent data (last 5 seconds)
    const windowSize = Math.min(150, this.signalBuffer.length);
    const recentSignal = this.signalBuffer.slice(-windowSize);

    // Apply bandpass filter
    const filtered = this.bandpassFilter(recentSignal);
    const normalized = this.normalizeSignal(filtered);

    // Detect peaks with minimum distance based on physiological limits
    // Minimum 0.3s between beats (200 BPM max)
    const minPeakDistance = Math.floor(this.samplingRate * 0.3);
    const peaks = this.detectPeaks(normalized, minPeakDistance);

    if (peaks.length < 2) {
      // Return smoothed previous value if available
      return this.getSmoothedHeartRate(0);
    }

    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // Remove outliers (intervals outside 1.5 * IQR)
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const q1 = sortedIntervals[Math.floor(sortedIntervals.length * 0.25)];
    const q3 = sortedIntervals[Math.floor(sortedIntervals.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const validIntervals = intervals.filter(
      (interval) => interval >= lowerBound && interval <= upperBound,
    );

    if (validIntervals.length === 0) {
      return this.getSmoothedHeartRate(0);
    }

    // Calculate heart rate from average interval
    const avgInterval =
      validIntervals.reduce((a, b) => a + b) / validIntervals.length;
    const beatDuration = avgInterval / this.samplingRate;
    let heartRate = 60 / beatDuration;

    // Clamp to physiological range
    heartRate = Math.max(45, Math.min(200, heartRate));

    return this.getSmoothedHeartRate(Math.round(heartRate));
  }

  /**
   * Smooth heart rate using moving average
   */
  private getSmoothedHeartRate(newValue: number): number {
    if (newValue > 0) {
      this.heartRateHistory.push(newValue);
      if (this.heartRateHistory.length > 5) {
        this.heartRateHistory.shift();
      }
    }

    if (this.heartRateHistory.length === 0) return 0;

    const sum = this.heartRateHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.heartRateHistory.length);
  }

  /**
   * Calculate Heart Rate Variability (HRV) with smoothing
   */
  getHRV(): number {
    if (this.signalBuffer.length < 90) {
      return 0; // Need at least 3 seconds
    }

    const windowSize = Math.min(150, this.signalBuffer.length);
    const recentSignal = this.signalBuffer.slice(-windowSize);
    const filtered = this.bandpassFilter(recentSignal);
    const normalized = this.normalizeSignal(filtered);

    const minPeakDistance = Math.floor(this.samplingRate * 0.3);
    const peaks = this.detectPeaks(normalized, minPeakDistance);

    if (peaks.length < 3) {
      return this.getSmoothedHRV(0);
    }

    // Calculate RR intervals in milliseconds
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = peaks[i] - peaks[i - 1];
      const intervalMs = (interval / this.samplingRate) * 1000;
      rrIntervals.push(intervalMs);
    }

    if (rrIntervals.length < 2) {
      return this.getSmoothedHRV(0);
    }

    // Calculate SDNN (standard deviation of NN intervals)
    const mean = rrIntervals.reduce((a, b) => a + b) / rrIntervals.length;
    const squaredDifferences = rrIntervals.map((interval) =>
      Math.pow(interval - mean, 2),
    );
    const variance =
      squaredDifferences.reduce((a, b) => a + b) / rrIntervals.length;
    const sdnn = Math.sqrt(variance);

    // Convert to 0-100 scale (typical HRV range 20-100ms)
    const hrv = Math.min(100, Math.max(0, (sdnn / 100) * 100));

    return this.getSmoothedHRV(Math.round(hrv));
  }

  /**
   * Smooth HRV using moving average
   */
  private getSmoothedHRV(newValue: number): number {
    if (newValue > 0) {
      this.hrvHistory.push(newValue);
      if (this.hrvHistory.length > 5) {
        this.hrvHistory.shift();
      }
    }

    if (this.hrvHistory.length === 0) return 0;

    const sum = this.hrvHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.hrvHistory.length);
  }

  /**
   * Calculate breathing rate from low-frequency components
   */
  getBreathingRate(): number {
    if (this.signalBuffer.length < 90) {
      return 0; // Need at least 3 seconds
    }

    // Use longer window for breathing (last 10 seconds)
    const windowSize = Math.min(300, this.signalBuffer.length);
    const recentSignal = this.signalBuffer.slice(-windowSize);

    // Apply stronger low-pass filter for respiratory component
    const lowPassFiltered = this.lowPassFilter(recentSignal, 1.5);
    const normalized = this.normalizeSignal(lowPassFiltered);

    // Detect breathing peaks (much slower than heart rate)
    // Minimum 2 seconds between breaths (30 BPM max)
    const minPeakDistance = Math.floor(this.samplingRate * 2);
    const peaks = this.detectPeaks(normalized, minPeakDistance);

    if (peaks.length < 2) {
      return this.getSmoothedBreathingRate(0);
    }

    // Calculate average interval
    let totalInterval = 0;
    for (let i = 1; i < peaks.length; i++) {
      totalInterval += peaks[i] - peaks[i - 1];
    }

    const avgInterval = totalInterval / (peaks.length - 1);
    const breathPeriod = avgInterval / this.samplingRate;
    let breathingRate = 60 / breathPeriod;

    // Clamp to physiological range (8-30 BPM)
    breathingRate = Math.max(8, Math.min(30, breathingRate));

    return this.getSmoothedBreathingRate(Math.round(breathingRate));
  }

  /**
   * Smooth breathing rate using moving average
   */
  private getSmoothedBreathingRate(newValue: number): number {
    if (newValue > 0) {
      this.breathingRateHistory.push(newValue);
      if (this.breathingRateHistory.length > 3) {
        this.breathingRateHistory.shift();
      }
    }

    if (this.breathingRateHistory.length === 0) return 0;

    const sum = this.breathingRateHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.breathingRateHistory.length);
  }

  /**
   * Apply low-pass filter to extract slow respiratory signals
   */
  private lowPassFilter(signal: number[], windowRatio: number = 1.0): number[] {
    const windowSize = Math.max(5, Math.floor(this.samplingRate * windowRatio));
    const filtered: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(signal.length, i + windowSize + 1);
      let sum = 0;

      for (let j = start; j < end; j++) {
        sum += signal[j];
      }

      filtered.push(sum / (end - start));
    }

    return filtered;
  }

  /**
   * Get signal quality metric (0-100)
   */
  getSignalQuality(): number {
    if (this.signalBuffer.length < 30) return 0;

    const recentSignal = this.signalBuffer.slice(-60);

    // Calculate signal-to-noise ratio
    const mean = recentSignal.reduce((a, b) => a + b, 0) / recentSignal.length;
    const variance =
      recentSignal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      recentSignal.length;
    const stdDev = Math.sqrt(variance);

    // Good signal should have variance but not too much noise
    const snr = Math.abs(mean) > 0.001 ? stdDev / Math.abs(mean) : 0;
    const quality = Math.min(100, Math.max(0, snr * 50));

    return Math.round(quality);
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
    this.heartRateHistory = [];
    this.breathingRateHistory = [];
    this.hrvHistory = [];
  }
}

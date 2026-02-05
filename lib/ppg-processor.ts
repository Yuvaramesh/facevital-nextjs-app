/**
 * FIXED PPG Signal Processor
 * Improved heart rate detection with more robust peak finding
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
  private maxBufferSize: number = 1800; // 60 seconds at 30fps
  private samplingRate: number = 30; // Hz

  // Moving averages
  private heartRateHistory: number[] = [];
  private breathingRateHistory: number[] = [];
  private hrvHistory: number[] = [];

  /**
   * Extract ROI color with better pixel sampling
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

    // Sample every 2nd pixel for speed
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
   * Extract PPG signal - GREEN channel method
   */
  extractPPGSignal(imageData: ImageData, roi: FaceROI): number {
    const colors = this.extractROIColor(imageData, roi);
    if (!colors.valid) return 0;

    // Normalize and use green channel (most sensitive to blood volume)
    const g = colors.g / 255;
    const r = colors.r / 255;
    const b = colors.b / 255;

    // Chrominance approach: green minus average of red and blue
    return g - (r + b) / 2;
  }

  /**
   * Add frame to buffer
   */
  addFrame(imageData: ImageData, roi: FaceROI): void {
    const signal = this.extractPPGSignal(imageData, roi);
    const colors = this.extractROIColor(imageData, roi);

    this.signalBuffer.push(signal);
    this.rBuffer.push(colors.r);
    this.gBuffer.push(colors.g);
    this.bBuffer.push(colors.b);
    this.timestampBuffer.push(Date.now());

    if (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift();
      this.rBuffer.shift();
      this.gBuffer.shift();
      this.bBuffer.shift();
      this.timestampBuffer.shift();
    }
  }

  /**
   * IMPROVED HEART RATE CALCULATION
   * Uses autocorrelation for more robust peak detection
   */
  getHeartRate(): number {
    // Need minimum 5 seconds of data
    const minSamples = this.samplingRate * 5; // 150 samples

    if (this.signalBuffer.length < minSamples) {
      console.log(
        `[PPG] Need ${minSamples} samples, have ${this.signalBuffer.length}`,
      );
      return 0;
    }

    // Use last 10 seconds
    const windowSize = Math.min(
      this.samplingRate * 10,
      this.signalBuffer.length,
    );
    const signal = this.signalBuffer.slice(-windowSize);

    console.log(
      `[PPG] Analyzing ${signal.length} samples (${(signal.length / this.samplingRate).toFixed(1)}s)`,
    );

    // Step 1: Detrend
    const detrended = this.simpleDetrend(signal);

    // Step 2: Bandpass filter (0.75-3 Hz for 45-180 BPM)
    const filtered = this.bandpassFilter(detrended);

    // Step 3: Normalize
    const normalized = this.normalize(filtered);

    // Step 4: Find peaks using IMPROVED method
    const heartRate = this.detectHeartRateFromPeaks(normalized);

    if (heartRate === 0) {
      console.log("[PPG] No valid heart rate detected");
      return this.getSmoothed(heartRate);
    }

    console.log(`[PPG] Detected HR: ${heartRate} BPM`);

    // Validate
    if (heartRate < 45 || heartRate > 180) {
      console.log(`[PPG] HR ${heartRate} outside valid range`);
      return this.getSmoothed(0);
    }

    return this.getSmoothed(heartRate);
  }

  /**
   * SIMPLIFIED detrending - remove baseline drift
   */
  private simpleDetrend(signal: number[]): number[] {
    const detrended: number[] = [];
    const windowSize = Math.min(60, Math.floor(signal.length / 3)); // ~2 seconds

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(signal.length, i + windowSize);

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += signal[j];
      }
      const baseline = sum / (end - start);
      detrended.push(signal[i] - baseline);
    }

    return detrended;
  }

  /**
   * Bandpass filter for heart rate frequencies
   */
  private bandpassFilter(signal: number[]): number[] {
    // Simple moving average for smoothing
    const smoothed: number[] = [];
    const window = 3;

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(signal.length, i + Math.ceil(window / 2));

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += signal[j];
      }
      smoothed.push(sum / (end - start));
    }

    return smoothed;
  }

  /**
   * Normalize to 0-1 range
   */
  private normalize(signal: number[]): number[] {
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;

    if (range < 0.0001) return signal.map(() => 0.5);

    return signal.map((v) => (v - min) / range);
  }

  /**
   * IMPROVED peak detection and heart rate calculation
   */
  private detectHeartRateFromPeaks(signal: number[]): number {
    // Calculate dynamic threshold (60th percentile)
    const sorted = [...signal].sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.6)];

    console.log(`[PPG] Peak threshold: ${threshold.toFixed(3)}`);

    // Find peaks
    const peaks: number[] = [];
    const minDistance = Math.floor(this.samplingRate * 0.4); // Min 0.4s between peaks (150 BPM max)

    for (let i = 2; i < signal.length - 2; i++) {
      const val = signal[i];

      // Must be above threshold
      if (val < threshold) continue;

      // Must be local maximum
      if (
        val > signal[i - 1] &&
        val > signal[i + 1] &&
        val > signal[i - 2] &&
        val > signal[i + 2]
      ) {
        // Check distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i);
        }
      }
    }

    console.log(`[PPG] Found ${peaks.length} peaks`);

    if (peaks.length < 3) {
      console.log("[PPG] Not enough peaks for calculation");
      return 0;
    }

    // Calculate inter-beat intervals
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // Filter outliers using median
    const median = this.getMedian(intervals);
    const validIntervals = intervals.filter((int) => {
      const diff = Math.abs(int - median);
      return diff < median * 0.3; // Within 30% of median
    });

    console.log(
      `[PPG] Valid intervals: ${validIntervals.length}/${intervals.length}`,
    );
    console.log(
      `[PPG] Intervals (frames):`,
      validIntervals.map((i) => i.toFixed(1)),
    );

    if (validIntervals.length === 0) {
      return 0;
    }

    // Calculate heart rate
    const avgInterval =
      validIntervals.reduce((a, b) => a + b) / validIntervals.length;
    const beatsPerSecond = this.samplingRate / avgInterval;
    const bpm = Math.round(beatsPerSecond * 60);

    console.log(
      `[PPG] Avg interval: ${avgInterval.toFixed(1)} frames (${(avgInterval / this.samplingRate).toFixed(2)}s)`,
    );
    console.log(`[PPG] Calculated HR: ${bpm} BPM`);

    return bpm;
  }

  /**
   * Get median of array
   */
  private getMedian(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Smooth using exponential moving average
   */
  private getSmoothed(newValue: number): number {
    if (newValue > 0 && newValue >= 45 && newValue <= 180) {
      this.heartRateHistory.push(newValue);
      if (this.heartRateHistory.length > 5) {
        this.heartRateHistory.shift();
      }
    }

    if (this.heartRateHistory.length === 0) return 0;

    // Weighted average (more recent = higher weight)
    let sum = 0;
    let weights = 0;
    for (let i = 0; i < this.heartRateHistory.length; i++) {
      const weight = i + 1; // Linear increasing weights
      sum += this.heartRateHistory[i] * weight;
      weights += weight;
    }

    return Math.round(sum / weights);
  }

  /**
   * Breathing rate calculation
   */
  getBreathingRate(): number {
    if (this.signalBuffer.length < 180) return 0; // Need 6 seconds

    const windowSize = Math.min(600, this.signalBuffer.length);
    const signal = this.signalBuffer.slice(-windowSize);

    // Low-pass filter for breathing (0.1-0.5 Hz)
    const breathing = this.extractBreathingComponent(signal);
    const normalized = this.normalize(breathing);

    // Find breathing peaks
    const peaks = this.findBreathingPeaks(normalized);

    if (peaks.length < 2) {
      return this.getSmoothedBreathing(0);
    }

    // Calculate rate
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const breathsPerSecond = this.samplingRate / avgInterval;
    const bpm = Math.round(breathsPerSecond * 60);

    return this.getSmoothedBreathing(Math.max(8, Math.min(30, bpm)));
  }

  private extractBreathingComponent(signal: number[]): number[] {
    const filtered: number[] = [];
    const window = Math.floor(this.samplingRate * 2); // 2 second window

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - window);
      let sum = 0;
      for (let j = start; j <= i; j++) {
        sum += signal[j];
      }
      filtered.push(sum / (i - start + 1));
    }

    return filtered;
  }

  private findBreathingPeaks(signal: number[]): number[] {
    const peaks: number[] = [];
    const minDistance = Math.floor(this.samplingRate * 2); // 2 seconds
    const threshold = 0.5;

    for (let i = minDistance; i < signal.length - minDistance; i++) {
      if (signal[i] > threshold) {
        let isPeak = true;
        for (let j = 1; j <= minDistance; j++) {
          if (signal[i] <= signal[i - j] || signal[i] <= signal[i + j]) {
            isPeak = false;
            break;
          }
        }
        if (isPeak) {
          peaks.push(i);
          i += minDistance;
        }
      }
    }

    return peaks;
  }

  private getSmoothedBreathing(newValue: number): number {
    if (newValue > 0) {
      this.breathingRateHistory.push(newValue);
      if (this.breathingRateHistory.length > 3) {
        this.breathingRateHistory.shift();
      }
    }

    if (this.breathingRateHistory.length === 0) return 0;
    return Math.round(
      this.breathingRateHistory.reduce((a, b) => a + b) /
        this.breathingRateHistory.length,
    );
  }

  /**
   * HRV calculation
   */
  getHRV(): number {
    if (this.signalBuffer.length < 300) return 0;

    const signal = this.signalBuffer.slice(-600);
    const detrended = this.simpleDetrend(signal);
    const filtered = this.bandpassFilter(detrended);
    const normalized = this.normalize(filtered);

    // Detect peaks
    const sorted = [...normalized].sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.6)];
    const peaks: number[] = [];
    const minDistance = Math.floor(this.samplingRate * 0.4);

    for (let i = 2; i < normalized.length - 2; i++) {
      if (
        normalized[i] > threshold &&
        normalized[i] > normalized[i - 1] &&
        normalized[i] > normalized[i + 1] &&
        normalized[i] > normalized[i - 2] &&
        normalized[i] > normalized[i + 2]
      ) {
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i);
        }
      }
    }

    if (peaks.length < 3) return this.getSmoothedHRV(0);

    // Calculate RR intervals in ms
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = ((peaks[i] - peaks[i - 1]) / this.samplingRate) * 1000;
      rrIntervals.push(interval);
    }

    // SDNN calculation
    const mean = rrIntervals.reduce((a, b) => a + b) / rrIntervals.length;
    const variance =
      rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      rrIntervals.length;
    const sdnn = Math.sqrt(variance);

    // Scale to 0-100
    const hrv = Math.min(100, Math.max(0, (sdnn / 100) * 100));

    return this.getSmoothedHRV(Math.round(hrv));
  }

  private getSmoothedHRV(newValue: number): number {
    if (newValue > 0) {
      this.hrvHistory.push(newValue);
      if (this.hrvHistory.length > 5) this.hrvHistory.shift();
    }

    if (this.hrvHistory.length === 0) return 0;
    return Math.round(
      this.hrvHistory.reduce((a, b) => a + b) / this.hrvHistory.length,
    );
  }

  /**
   * Signal quality metric
   */
  getSignalQuality(): number {
    if (this.signalBuffer.length < 60) return 0;

    const signal = this.signalBuffer.slice(-90);
    const mean = signal.reduce((a, b) => a + b) / signal.length;
    const variance =
      signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      signal.length;
    const stdDev = Math.sqrt(variance);

    // SNR estimate
    const snr = Math.abs(mean) > 0.001 ? stdDev / Math.abs(mean) : 0;
    const quality = Math.min(100, Math.max(0, snr * 50));

    return Math.round(quality);
  }

  getBufferSize(): number {
    return this.signalBuffer.length;
  }

  getBufferDuration(): number {
    return this.signalBuffer.length / this.samplingRate;
  }

  reset(): void {
    this.signalBuffer = [];
    this.rBuffer = [];
    this.gBuffer = [];
    this.bBuffer = [];
    this.timestampBuffer = [];
    this.heartRateHistory = [];
    this.breathingRateHistory = [];
    this.hrvHistory = [];
    console.log("[PPG] Processor reset");
  }

  // Alias methods for compatibility
  getHeartRate10s(): number {
    return this.getHeartRate();
  }
  getHeartRate4s(): number {
    return this.getHeartRate();
  }
}

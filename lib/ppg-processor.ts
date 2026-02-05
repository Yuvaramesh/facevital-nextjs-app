/**
 * PPG Signal Processor - Shen.AI Methodology
 * Implements proper vPPG (video photoplethysmography) for accurate heart rate detection
 * Based on clinical-grade algorithms used in Shen.AI
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
  private samplingRate: number = 30; // Hz (frames per second)

  // Heart rate calculation windows (configurable 4-60 seconds)
  private heartRateWindow10s: number = 300; // 10 seconds * 30fps
  private heartRateWindow4s: number = 120; // 4 seconds * 30fps

  // Moving averages for smoothing
  private heartRateHistory: number[] = [];
  private breathingRateHistory: number[] = [];
  private hrvHistory: number[] = [];

  // Peak detection state
  private lastPeakIndex: number = -1;
  private peakIndices: number[] = [];

  /**
   * Extract average color values from a region of interest (face area)
   * Focus on cheek/forehead regions where blood pulsation is strongest
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

    // Sample pixels from the ROI
    for (let y = y1; y < y2; y += 2) {
      for (let x = x1; x < x2; x += 2) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];

        // Only use opaque pixels
        if (alpha > 200) {
          totalR += data[idx];
          totalG += data[idx + 1];
          totalB += data[idx + 2];
          pixelCount++;
        }
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
   * Extract PPG signal using green channel (most sensitive to blood volume changes)
   * This is the core of vPPG technology
   */
  extractPPGSignal(imageData: ImageData, roi: FaceROI): number {
    const colors = this.extractROIColor(imageData, roi);

    if (!colors.valid) {
      return 0;
    }

    // Normalize to 0-1 range
    const r = colors.r / 255;
    const g = colors.g / 255;
    const b = colors.b / 255;

    // Green channel is most sensitive to blood volume changes
    // Use chrominance-based approach for motion robustness
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

    // Keep buffer size manageable (60 seconds max)
    if (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift();
      this.rBuffer.shift();
      this.gBuffer.shift();
      this.bBuffer.shift();
      this.timestampBuffer.shift();
    }
  }

  /**
   * Calculate heart rate over 10-second window (Shen.AI default)
   * This is the primary method matching Shen.AI's getHeartRate10s()
   */
  getHeartRate10s(): number {
    return this.calculateHeartRateForWindow(this.heartRateWindow10s);
  }

  /**
   * Calculate heart rate over 4-second window (Shen.AI alternative)
   * Faster response but potentially less accurate
   */
  getHeartRate4s(): number {
    return this.calculateHeartRateForWindow(this.heartRateWindow4s);
  }

  /**
   * Main heart rate calculation (default uses 10s window)
   */
  getHeartRate(): number {
    return this.getHeartRate10s();
  }

  /**
   * Core heart rate calculation algorithm
   * Based on Shen.AI methodology with proper vPPG signal processing
   */
  private calculateHeartRateForWindow(windowSize: number): number {
    // Need at least the window size of data
    if (this.signalBuffer.length < windowSize) {
      console.log(
        `[PPG] Insufficient data: ${this.signalBuffer.length}/${windowSize} samples needed`,
      );
      return 0;
    }

    // Extract recent window
    const recentSignal = this.signalBuffer.slice(-windowSize);

    console.log(
      `[PPG] Analyzing ${recentSignal.length} samples (${(recentSignal.length / this.samplingRate).toFixed(1)}s)`,
    );

    // Step 1: Detrend the signal (remove slow baseline drift)
    const detrended = this.detrendSignal(recentSignal);

    // Step 2: Apply bandpass filter for heart rate frequencies (0.75-4 Hz = 45-240 BPM)
    const filtered = this.bandpassFilterHeartRate(detrended);

    // Step 3: Normalize to 0-1 range
    const normalized = this.normalizeSignal(filtered);

    // Step 4: Detect peaks in the filtered signal
    const peaks = this.detectPeaksAdvanced(normalized);

    console.log(`[PPG] Detected ${peaks.length} peaks`);

    if (peaks.length < 2) {
      console.log("[PPG] Not enough peaks for HR calculation");
      return this.getSmoothedHeartRate(0);
    }

    // Step 5: Calculate inter-beat intervals (IBIs)
    const ibis = this.calculateIBIs(peaks);

    console.log(
      `[PPG] IBIs:`,
      ibis.map((i) => ((i / this.samplingRate) * 1000).toFixed(0) + "ms"),
    );

    if (ibis.length === 0) {
      console.log("[PPG] No valid IBIs calculated");
      return this.getSmoothedHeartRate(0);
    }

    // Step 6: Remove outliers from IBIs
    const validIBIs = this.filterOutlierIBIs(ibis);

    console.log(`[PPG] Valid IBIs: ${validIBIs.length}/${ibis.length}`);

    if (validIBIs.length === 0) {
      console.log("[PPG] All IBIs filtered as outliers");
      return this.getSmoothedHeartRate(0);
    }

    // Step 7: Calculate average heart rate from valid IBIs
    const avgIBI = validIBIs.reduce((a, b) => a + b, 0) / validIBIs.length;
    const beatDuration = avgIBI / this.samplingRate; // Convert to seconds
    let heartRate = 60 / beatDuration; // Convert to BPM

    // Step 8: Clamp to physiological range
    heartRate = Math.max(45, Math.min(200, heartRate));

    console.log(
      `[PPG] Calculated HR: ${Math.round(heartRate)} BPM (avg IBI: ${((avgIBI / this.samplingRate) * 1000).toFixed(0)}ms)`,
    );

    // Step 9: Validate and smooth
    if (!this.isPhysiologicallyValid(heartRate)) {
      console.log(`[PPG] HR ${heartRate} failed validation`);
      return this.getSmoothedHeartRate(0);
    }

    return this.getSmoothedHeartRate(Math.round(heartRate));
  }

  /**
   * Detrend signal to remove baseline drift
   * Uses moving average subtraction
   */
  private detrendSignal(signal: number[]): number[] {
    if (signal.length < 10) return signal;

    const windowSize = Math.floor(this.samplingRate * 2); // 2-second window
    const detrended: number[] = [];

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
   * Bandpass filter specifically for heart rate frequencies (0.75-4 Hz)
   * This isolates the cardiac pulse from other signal components
   */
  private bandpassFilterHeartRate(signal: number[]): number[] {
    if (signal.length < 10) return signal;

    // First: Apply moving average to smooth
    let smoothed: number[] = [];
    const smoothWindow = 3;

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - Math.floor(smoothWindow / 2));
      const end = Math.min(signal.length, i + Math.ceil(smoothWindow / 2));
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += signal[j];
      }
      smoothed.push(sum / (end - start));
    }

    // Second: Remove very low frequencies (< 0.75 Hz)
    const lowCutoffWindow = Math.floor(this.samplingRate / 0.75); // ~40 samples at 30fps
    let highPassed: number[] = [];

    for (let i = 0; i < smoothed.length; i++) {
      const start = Math.max(0, i - lowCutoffWindow);
      let sum = 0;
      for (let j = start; j <= i; j++) {
        sum += smoothed[j];
      }
      const lowFreq = sum / (i - start + 1);
      highPassed.push(smoothed[i] - lowFreq);
    }

    return highPassed;
  }

  /**
   * Normalize signal to 0-1 range
   */
  private normalizeSignal(signal: number[]): number[] {
    if (signal.length === 0) return [];

    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;

    if (range < 0.0001) return signal.map(() => 0.5);

    return signal.map((val) => (val - min) / range);
  }

  /**
   * Advanced peak detection with adaptive thresholding
   * This is critical for accurate heart rate detection
   */
  private detectPeaksAdvanced(signal: number[]): number[] {
    if (signal.length < 10) return [];

    const peaks: number[] = [];

    // Calculate adaptive threshold (use 50th percentile of signal)
    const sorted = [...signal].sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * 0.5)];

    console.log(`[PPG] Peak threshold: ${threshold.toFixed(4)}`);

    // Minimum distance between peaks based on maximum physiological HR (200 BPM = 0.3s)
    const minPeakDistance = Math.floor(this.samplingRate * 0.3); // 9 samples at 30fps

    let lastPeakIdx = -minPeakDistance;

    // Scan for peaks
    for (let i = 3; i < signal.length - 3; i++) {
      const val = signal[i];

      // Must be above threshold
      if (val < threshold) continue;

      // Must be local maximum (check 3 samples on each side)
      const isLocalMax =
        val > signal[i - 1] &&
        val > signal[i + 1] &&
        val > signal[i - 2] &&
        val > signal[i + 2] &&
        val > signal[i - 3] &&
        val > signal[i + 3];

      if (!isLocalMax) continue;

      // Check minimum distance from last peak
      if (i - lastPeakIdx < minPeakDistance) continue;

      // Valid peak found
      peaks.push(i);
      lastPeakIdx = i;
    }

    return peaks;
  }

  /**
   * Calculate inter-beat intervals from peak locations
   */
  private calculateIBIs(peaks: number[]): number[] {
    const ibis: number[] = [];

    for (let i = 1; i < peaks.length; i++) {
      const ibi = peaks[i] - peaks[i - 1];
      ibis.push(ibi);
    }

    return ibis;
  }

  /**
   * Filter outlier IBIs using Median Absolute Deviation (MAD)
   * More robust than standard deviation for small samples
   */
  private filterOutlierIBIs(ibis: number[]): number[] {
    if (ibis.length < 2) return ibis;

    // Calculate median
    const sorted = [...ibis].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Calculate MAD
    const deviations = ibis.map((val) => Math.abs(val - median));
    const sortedDevs = [...deviations].sort((a, b) => a - b);
    const mad = sortedDevs[Math.floor(sortedDevs.length / 2)];

    if (mad === 0) {
      // All values are the same, keep them all
      return ibis;
    }

    // Filter outliers (keep values within 2.5 MAD of median)
    const threshold = 2.5 * mad;
    const filtered = ibis.filter((val) => Math.abs(val - median) <= threshold);

    console.log(
      `[PPG] IBI filtering: median=${median.toFixed(1)}, MAD=${mad.toFixed(1)}, kept ${filtered.length}/${ibis.length}`,
    );

    return filtered;
  }

  /**
   * Check if heart rate is physiologically valid
   */
  private isPhysiologicallyValid(heartRate: number): boolean {
    // Must be in valid range
    if (heartRate < 45 || heartRate > 200) {
      console.log(`[PPG] HR ${heartRate} outside valid range (45-200)`);
      return false;
    }

    // Check against recent history for sudden jumps
    if (this.heartRateHistory.length > 0) {
      const recentAvg =
        this.heartRateHistory.reduce((a, b) => a + b, 0) /
        this.heartRateHistory.length;
      const diff = Math.abs(heartRate - recentAvg);

      // Reject if difference is more than 25 BPM (physiologically impossible in short time)
      if (diff > 25) {
        console.log(
          `[PPG] HR ${heartRate} differs too much from recent average ${recentAvg.toFixed(1)} (diff: ${diff.toFixed(1)})`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Smooth heart rate using exponential moving average
   */
  private getSmoothedHeartRate(newValue: number): number {
    if (newValue > 0) {
      this.heartRateHistory.push(newValue);

      // Keep last 6 values (about 1 minute of data at 10s intervals)
      if (this.heartRateHistory.length > 6) {
        this.heartRateHistory.shift();
      }
    }

    if (this.heartRateHistory.length === 0) return 0;

    // Exponential moving average (more weight to recent values)
    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 0; i < this.heartRateHistory.length; i++) {
      const weight = Math.pow(2, i); // Exponentially increasing weights
      weightedSum += this.heartRateHistory[i] * weight;
      weightSum += weight;
    }

    return Math.round(weightedSum / weightSum);
  }

  /**
   * Calculate Heart Rate Variability (HRV) - SDNN method
   * Used by Shen.AI for cardiac health assessment
   */
  getHRV(): number {
    if (this.signalBuffer.length < 300) {
      return 0; // Need at least 10 seconds
    }

    const windowSize = Math.min(600, this.signalBuffer.length); // Use up to 20 seconds
    const recentSignal = this.signalBuffer.slice(-windowSize);

    const detrended = this.detrendSignal(recentSignal);
    const filtered = this.bandpassFilterHeartRate(detrended);
    const normalized = this.normalizeSignal(filtered);
    const peaks = this.detectPeaksAdvanced(normalized);

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
    const squaredDiffs = rrIntervals.map((interval) =>
      Math.pow(interval - mean, 2),
    );
    const variance = squaredDiffs.reduce((a, b) => a + b) / rrIntervals.length;
    const sdnn = Math.sqrt(variance);

    // Convert to 0-100 scale (typical SDNN range 20-100ms)
    const hrv = Math.min(100, Math.max(0, (sdnn / 100) * 100));

    return this.getSmoothedHRV(Math.round(hrv));
  }

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
   * Calculate breathing rate from respiratory component (0.1-0.5 Hz)
   */
  getBreathingRate(): number {
    if (this.signalBuffer.length < 180) {
      return 0; // Need at least 6 seconds
    }

    const windowSize = Math.min(600, this.signalBuffer.length);
    const recentSignal = this.signalBuffer.slice(-windowSize);

    // Apply low-pass filter for respiratory frequencies
    const lowPassFiltered = this.lowPassFilterBreathing(recentSignal);
    const normalized = this.normalizeSignal(lowPassFiltered);

    // Detect breathing peaks (slower than heart rate)
    const minPeakDistance = Math.floor(this.samplingRate * 2); // 2 seconds minimum
    const peaks = this.detectBreathingPeaks(normalized, minPeakDistance);

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

    breathingRate = Math.max(8, Math.min(30, breathingRate));

    return this.getSmoothedBreathingRate(Math.round(breathingRate));
  }

  private lowPassFilterBreathing(signal: number[]): number[] {
    const windowSize = Math.floor(this.samplingRate * 2); // 2-second window
    const filtered: number[] = [];

    for (let i = 0; i < signal.length; i++) {
      const start = Math.max(0, i - windowSize);
      const end = Math.min(signal.length, i + 1);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += signal[j];
      }
      filtered.push(sum / (end - start));
    }

    return filtered;
  }

  private detectBreathingPeaks(
    signal: number[],
    minPeakDistance: number,
  ): number[] {
    const peaks: number[] = [];
    const threshold = 0.5;

    for (let i = minPeakDistance; i < signal.length - minPeakDistance; i++) {
      if (signal[i] > threshold) {
        let isPeak = true;
        for (let j = 1; j <= minPeakDistance; j++) {
          if (signal[i] <= signal[i - j] || signal[i] <= signal[i + j]) {
            isPeak = false;
            break;
          }
        }
        if (isPeak) {
          peaks.push(i);
          i += minPeakDistance;
        }
      }
    }

    return peaks;
  }

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
   * Calculate cardiac workload (Shen.AI metric)
   * Formula: (Systolic BP × Heart Rate) / 60
   */
  calculateCardiacWorkload(systolicBP: number, heartRate: number): number {
    return (systolicBP * heartRate) / 60;
  }

  /**
   * Get signal quality metric (0-100)
   */
  getSignalQuality(): number {
    if (this.signalBuffer.length < 60) return 0;

    const recentSignal = this.signalBuffer.slice(-90);

    // Calculate signal strength (variance)
    const mean = recentSignal.reduce((a, b) => a + b, 0) / recentSignal.length;
    const variance =
      recentSignal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      recentSignal.length;
    const stdDev = Math.sqrt(variance);

    // Calculate signal-to-noise ratio estimate
    const snr = Math.abs(mean) > 0.001 ? stdDev / Math.abs(mean) : 0;
    const quality = Math.min(100, Math.max(0, snr * 50));

    return Math.round(quality);
  }

  /**
   * Get current buffer size in samples
   */
  getBufferSize(): number {
    return this.signalBuffer.length;
  }

  /**
   * Get current buffer duration in seconds
   */
  getBufferDuration(): number {
    return this.signalBuffer.length / this.samplingRate;
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
    this.lastPeakIndex = -1;
    this.peakIndices = [];
    console.log("[PPG] Processor reset");
  }
}

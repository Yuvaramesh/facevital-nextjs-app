import { BiomarkerData } from "./biomarkers";

export interface ReportData {
  measurements: BiomarkerData[];
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
}

// Simple PDF generation using canvas and built-in browser APIs
export async function generatePDF(reportData: ReportData): Promise<Blob> {
  const measurements = reportData.measurements;
  const latestMeasurement = measurements[measurements.length - 1];

  // Create canvas for PDF-like rendering
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Set up PDF-like dimensions (A4: 210x297mm at 96 DPI)
  const width = 800;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;

  // Fill background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  let yPos = 40;
  const lineHeight = 24;
  const sectionSpacing = 40;

  // Helper function to draw text
  function drawText(
    text: string,
    size: number,
    weight: string = "normal",
    color = "#000000",
  ) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(text, 40, yPos);
    yPos += lineHeight;
  }

  function drawLine() {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, yPos);
    ctx.lineTo(width - 40, yPos);
    ctx.stroke();
    yPos += 20;
  }

  // Header
  ctx.fillStyle = "#6366f1";
  ctx.fillRect(0, 0, width, 100);

  ctx.font = "bold 32px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Health Report", 40, 45);

  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#e0e7ff";
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 70);

  yPos = 140;

  // Report Overview
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillStyle = "#1f2937";
  ctx.fillText("Report Overview", 40, yPos);
  yPos += 30;

  drawLine();

  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#4b5563";

  const duration = Math.round(
    (reportData.endTime.getTime() - reportData.startTime.getTime()) / 1000,
  );
  const measurements_count = measurements.length;

  ctx.fillText(`Measurement Duration: ${duration} seconds`, 40, yPos);
  yPos += lineHeight;
  ctx.fillText(`Total Measurements: ${measurements_count}`, 40, yPos);
  yPos += lineHeight;
  ctx.fillText(
    `Start Time: ${reportData.startTime.toLocaleString()}`,
    40,
    yPos,
  );
  yPos += lineHeight;
  ctx.fillText(`End Time: ${reportData.endTime.toLocaleString()}`, 40, yPos);

  yPos += sectionSpacing;
  drawLine();

  // Latest Measurements
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillStyle = "#1f2937";
  ctx.fillText("Latest Biomarker Results", 40, yPos);
  yPos += 30;

  drawLine();

  // Create a grid layout for metrics
  const metricBoxWidth = (width - 120) / 2;
  const metricBoxHeight = 70;
  let xPos = 40;
  let isSecondColumn = false;

  const metrics = [
    {
      label: "Heart Rate",
      value: latestMeasurement.heartRate,
      unit: "BPM",
      color: "#ef4444",
    },
    {
      label: "Breathing Rate",
      value: latestMeasurement.breathingRate,
      unit: "BPM",
      color: "#22c55e",
    },
    {
      label: "HRV",
      value: latestMeasurement.hrv,
      unit: "ms",
      color: "#3b82f6",
    },
    {
      label: "Systolic BP",
      value: latestMeasurement.sysBP,
      unit: "mmHg",
      color: "#a855f7",
    },
    {
      label: "Diastolic BP",
      value: latestMeasurement.diaBP,
      unit: "mmHg",
      color: "#6366f1",
    },
    {
      label: "Parasympathetic Health",
      value: latestMeasurement.parasympatheticHealth,
      unit: "%",
      color: "#06b6d4",
    },
    {
      label: "Wellness Value",
      value: latestMeasurement.wellnessValue,
      unit: "%",
      color: "#84cc16",
    },
    {
      label: "Stress Index",
      value: latestMeasurement.stressIndex,
      unit: "%",
      color: "#f97316",
    },
  ];

  metrics.forEach((metric, index) => {
    // Draw metric box
    ctx.fillStyle = metric.color + "15";
    ctx.strokeStyle = metric.color + "40";
    ctx.lineWidth = 2;
    ctx.fillRect(xPos, yPos, metricBoxWidth, metricBoxHeight);
    ctx.strokeRect(xPos, yPos, metricBoxWidth, metricBoxHeight);

    // Metric label
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(metric.label, xPos + 10, yPos + 15);

    // Metric value
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillStyle = metric.color;
    ctx.fillText(`${metric.value}`, xPos + 10, yPos + 45);

    // Unit
    ctx.font = "12px Arial, sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(metric.unit, xPos + 10, yPos + 62);

    if (isSecondColumn) {
      xPos = 40;
      yPos += metricBoxHeight + 15;
      isSecondColumn = false;
    } else {
      xPos = width - 40 - metricBoxWidth;
      isSecondColumn = true;
    }
  });

  if (isSecondColumn) {
    yPos += metricBoxHeight + 15;
  }

  yPos += 20;
  drawLine();

  // Statistics Section
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillStyle = "#1f2937";
  ctx.fillText("Measurement Statistics", 40, yPos);
  yPos += 30;

  drawLine();

  // Calculate statistics
  const stats = {
    avgHeartRate: Math.round(
      measurements.reduce((sum, m) => sum + m.heartRate, 0) /
        measurements.length,
    ),
    minHeartRate: Math.min(...measurements.map((m) => m.heartRate)),
    maxHeartRate: Math.max(...measurements.map((m) => m.heartRate)),
    avgBreathingRate: Math.round(
      measurements.reduce((sum, m) => sum + m.breathingRate, 0) /
        measurements.length,
    ),
    avgStressIndex: Math.round(
      measurements.reduce((sum, m) => sum + m.stressIndex, 0) /
        measurements.length,
    ),
    avgWellness: Math.round(
      measurements.reduce((sum, m) => sum + m.wellnessValue, 0) /
        measurements.length,
    ),
  };

  ctx.font = "14px Arial, sans-serif";
  ctx.fillStyle = "#4b5563";

  yPos += 10;
  ctx.fillText(
    `Average Heart Rate: ${stats.avgHeartRate} BPM (${stats.minHeartRate} - ${stats.maxHeartRate})`,
    40,
    yPos,
  );
  yPos += lineHeight;
  ctx.fillText(
    `Average Breathing Rate: ${stats.avgBreathingRate} BPM`,
    40,
    yPos,
  );
  yPos += lineHeight;
  ctx.fillText(`Average Stress Index: ${stats.avgStressIndex}%`, 40, yPos);
  yPos += lineHeight;
  ctx.fillText(`Average Wellness Score: ${stats.avgWellness}%`, 40, yPos);

  yPos += sectionSpacing + 20;
  drawLine();

  // Recommendations
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.fillStyle = "#1f2937";
  ctx.fillText("Health Recommendations", 40, yPos);
  yPos += 30;

  const recommendations = getRecommendations(latestMeasurement);
  ctx.font = "13px Arial, sans-serif";
  ctx.fillStyle = "#4b5563";

  recommendations.forEach((rec) => {
    ctx.fillText(`• ${rec}`, 50, yPos);
    yPos += lineHeight;
  });

  // Add footer
  yPos = height - 40;
  ctx.font = "11px Arial, sans-serif";
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(
    "This report is for informational purposes only. Please consult a healthcare professional for medical advice.",
    40,
    yPos,
  );

  // Convert canvas to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      }
    }, "image/png");
  });
}

// Generate PDF and trigger download
export async function downloadPDF(
  reportData: ReportData,
  filename: string = "Health_Report.pdf",
) {
  const blob = await generatePDF(reportData);

  // Create a temporary canvas-based PDF (since we're using image)
  // For production, consider using a library like jsPDF or pdfkit

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(".pdf", ".png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getRecommendations(data: BiomarkerData): string[] {
  const recommendations: string[] = [];

  // Heart Rate recommendations
  if (data.heartRate > 100) {
    recommendations.push(
      "Your heart rate is elevated. Consider relaxation techniques or consult a healthcare provider.",
    );
  } else if (data.heartRate < 50) {
    recommendations.push(
      "Your heart rate is low. Ensure you are well-rested and hydrated.",
    );
  }

  // Blood Pressure recommendations
  if (data.sysBP >= 140 || data.diaBP >= 90) {
    recommendations.push(
      "Your blood pressure is elevated. Monitor regularly and consult a doctor if it persists.",
    );
  }

  // Stress Index recommendations
  if (data.stressIndex > 70) {
    recommendations.push(
      "Your stress index is high. Try meditation, exercise, or other stress-relief activities.",
    );
  }

  // Parasympathetic health recommendations
  if (data.parasympatheticHealth < 40) {
    recommendations.push(
      "Consider improving your parasympathetic nervous system through breathing exercises and adequate sleep.",
    );
  }

  // HRV recommendations
  if (data.hrv < 30) {
    recommendations.push(
      "Your HRV is low. Getting more sleep and exercise may help improve cardiovascular health.",
    );
  }

  // General wellness
  if (data.wellnessValue < 50) {
    recommendations.push(
      "Your overall wellness score is below average. Focus on sleep, nutrition, and regular exercise.",
    );
  } else if (data.wellnessValue > 75) {
    recommendations.push(
      "Great job! Keep up your healthy lifestyle and maintain your wellness routine.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Your health metrics look good. Continue maintaining your healthy lifestyle.",
    );
  }

  return recommendations;
}

// File: app/api/biomarkers/route.ts
// This file MUST be placed at: app/api/biomarkers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { calculateBiomarkers, BiomarkerData } from "@/lib/biomarkers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signal, samplingRate = 30 } = body;

    if (!signal || !Array.isArray(signal)) {
      return NextResponse.json(
        { error: "Invalid signal data. Expected array of numbers." },
        { status: 400 },
      );
    }

    if (signal.length < 5) {
      return NextResponse.json(
        { error: "Insufficient signal data. Need at least 5 samples." },
        { status: 400 },
      );
    }

    // Calculate biomarkers from the PPG signal
    const biomarkers: BiomarkerData = calculateBiomarkers(signal, samplingRate);

    return NextResponse.json({
      success: true,
      data: biomarkers,
      metadata: {
        signalLength: signal.length,
        samplingRate,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Biomarker calculation error:", error);
    return NextResponse.json(
      {
        error: "Failed to calculate biomarkers",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Biomarker calculation API",
    usage: "POST with { signal: number[], samplingRate?: number }",
    endpoints: {
      POST: "/api/biomarkers - Calculate biomarkers from PPG signal",
    },
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    mock_mode: true,
    timestamp: new Date().toISOString(),
  });
}
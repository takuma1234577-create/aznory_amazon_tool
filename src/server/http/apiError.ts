import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        ok: false,
        error: this.code || "ERROR",
        message: this.message
      },
      { status: this.statusCode }
    );
  }
}

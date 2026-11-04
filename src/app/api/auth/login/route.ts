import { NextResponse } from "next/server";
import { AuthService } from "@/server/services/auth.service";
import { handleApiError } from "@/server/errors";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = AuthService.login(body);

    const res = NextResponse.json({
      success: true,
      data: {
        user: result.user,
      },
    });

    setSessionCookie(res.cookies, result.token, result.expiresAt);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}

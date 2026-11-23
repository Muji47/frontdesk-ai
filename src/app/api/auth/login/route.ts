import { NextResponse } from "next/server";
import { AuthService } from "@/server/services/auth.service";
import { handleApiError } from "@/server/errors";
import { setSessionCookie, setUserVaultCookie, getUserVaultToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const existingVaultToken = await getUserVaultToken();
    const result = AuthService.login(body, existingVaultToken);

    const res = NextResponse.json({
      success: true,
      data: {
        user: result.user,
      },
    });

    setSessionCookie(res.cookies, result.token, result.expiresAt);
    if (result.vaultToken) {
      setUserVaultCookie(res.cookies, result.vaultToken);
    }
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}

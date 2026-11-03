import { NextResponse } from "next/server";
import { registerUser, createSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { businessName, industry, name, email, password } = await req.json();

    if (!businessName || !email || !password || !name) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const { userId } = registerUser({
      businessName: businessName.trim(),
      industry: industry || "clinic",
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    const { token, expiresAt } = createSession(userId);

    const res = NextResponse.json({ success: true });
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

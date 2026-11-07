import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const orgId = searchParams.get("orgId") || "org_demo_101";

    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const conv = db
      .prepare(
        `SELECT id, organization_id, status, resolution_badge, is_ai_muted
         FROM conversations
         WHERE id = ? AND organization_id = ?`
      )
      .get(conversationId, orgId) as
      | {
          id: string;
          organization_id: string;
          status: string;
          resolution_badge: string;
          is_ai_muted: number;
        }
      | undefined;

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found", messages: [] },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const rows = db
      .prepare(
        `SELECT id, sender, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`
      )
      .all(conversationId) as {
      id: string;
      sender: "client" | "ai" | "staff";
      content: string;
      created_at: string;
    }[];

    const messages = rows.map((r) => ({
      id: String(r.id),
      sender: r.sender,
      content: String(r.content),
      createdAt: String(r.created_at),
    }));

    return NextResponse.json(
      {
        conversationId: conv.id,
        status: conv.status,
        badge: conv.resolution_badge,
        isAiMuted: conv.is_ai_muted === 1,
        messages,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Widget messages fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation messages", messages: [] },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

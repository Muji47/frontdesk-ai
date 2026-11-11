import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardService } from "@/server/services/dashboard.service";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to add knowledge sources.");
    }

    const contentType = req.headers.get("content-type") || "";
    let title = "";
    let sourceType: "url" | "pdf" | "document" | "manual_qa" = "url";
    let sourceUrl: string | undefined;
    let pageCount = 1;
    let content: string | undefined;
    let fileBuffer: Buffer | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      title = (formData.get("title") as string) || file?.name || "";
      const rawSourceType = (formData.get("sourceType") as string) || "";
      sourceType = ["url", "pdf", "document", "manual_qa"].includes(rawSourceType)
        ? (rawSourceType as any)
        : file?.name.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : "document";
      sourceUrl = (formData.get("sourceUrl") as string) || undefined;
      const rawPageCount = Number(formData.get("pageCount"));
      pageCount = isNaN(rawPageCount) || rawPageCount < 1 ? 1 : rawPageCount;
      content = (formData.get("content") as string) || undefined;

      if (file) {
        const arrayBuf = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuf);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      title = typeof body.title === "string" ? body.title : "";
      sourceType = ["url", "pdf", "document", "manual_qa"].includes(body.sourceType)
        ? body.sourceType
        : "url";
      sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : undefined;
      pageCount = typeof body.pageCount === "number" && body.pageCount > 0 ? body.pageCount : (sourceType === "url" ? 12 : 1);
      content = typeof body.content === "string" ? body.content : typeof body.answer === "string" ? body.answer : undefined;

      if (body.fileBase64 && typeof body.fileBase64 === "string") {
        try {
          const rawB64 = body.fileBase64.includes(",") ? body.fileBase64.split(",")[1] : body.fileBase64;
          fileBuffer = Buffer.from(rawB64, "base64");
        } catch (e) {
          console.warn("[addKnowledgeRoute] Failed to parse base64 file buffer:", e);
        }
      }
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new ValidationError("Valid source title, filename, or URL is required.");
    }

    const source = await DashboardService.addKnowledgeSource(
      user.orgId,
      title.trim(),
      sourceType,
      sourceUrl,
      pageCount,
      content,
      fileBuffer
    );

    return NextResponse.json({ success: true, source }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

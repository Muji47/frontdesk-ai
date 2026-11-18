import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getUserTemplates,
  saveUserTemplate,
  deleteUserTemplate,
  resetUserTemplates,
} from "@/lib/templates";
import {
  handleApiError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to access message templates.");
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || user.userId;

    // Verify target user belongs to same organization
    const targetUser = db
      .prepare("SELECT id, organization_id, name FROM users WHERE id = ? AND organization_id = ?")
      .get(targetUserId, user.orgId) as { id: string; organization_id: string; name: string } | undefined;

    if (!targetUser) {
      throw new ValidationError("User not found in your organization.");
    }

    const templates = getUserTemplates(targetUserId);

    return NextResponse.json({
      success: true,
      data: {
        templates,
        userId: targetUserId,
        userName: targetUser.name,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to manage templates.");
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || user.userId;

    // If managing someone else's templates, caller must be owner or admin
    if (targetUserId !== user.userId) {
      const caller = db
        .prepare("SELECT role FROM users WHERE id = ?")
        .get(user.userId) as { role: string } | undefined;
      if (caller?.role !== "owner" && caller?.role !== "admin") {
        throw new ForbiddenError("Only administrators can edit another staff member's templates.");
      }
    }

    // Verify target user belongs to caller's org
    const targetUser = db
      .prepare("SELECT id FROM users WHERE id = ? AND organization_id = ?")
      .get(targetUserId, user.orgId);
    if (!targetUser) {
      throw new ValidationError("Target user not found in your organization.");
    }

    const saved = saveUserTemplate(targetUserId, {
      id: body.id,
      title: body.title,
      command: body.command,
      content: body.content,
      category: body.category,
      is_active: body.is_active,
    });

    return NextResponse.json({
      success: true,
      data: {
        template: saved,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to delete templates.");
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");
    const targetUserId = searchParams.get("userId") || user.userId;

    if (!templateId) {
      throw new ValidationError("Template ID is required.");
    }

    if (targetUserId !== user.userId) {
      const caller = db
        .prepare("SELECT role FROM users WHERE id = ?")
        .get(user.userId) as { role: string } | undefined;
      if (caller?.role !== "owner" && caller?.role !== "admin") {
        throw new ForbiddenError("Only administrators can delete another staff member's templates.");
      }
    }

    deleteUserTemplate(targetUserId, templateId);

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to reset templates.");
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || user.userId;

    if (targetUserId !== user.userId) {
      const caller = db
        .prepare("SELECT role FROM users WHERE id = ?")
        .get(user.userId) as { role: string } | undefined;
      if (caller?.role !== "owner" && caller?.role !== "admin") {
        throw new ForbiddenError("Only administrators can reset another staff member's templates.");
      }
    }

    const templates = resetUserTemplates(targetUserId);

    return NextResponse.json({
      success: true,
      message: "Predefined templates have been restored to defaults.",
      data: {
        templates,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

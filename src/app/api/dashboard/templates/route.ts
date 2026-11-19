import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getTemplatesForUser,
  saveUserTemplate,
  deleteUserTemplate,
  resetOrgPredefinedTemplates,
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

    // Verify target user belongs to caller's organization
    const targetUser = db
      .prepare("SELECT id, organization_id, name, role FROM users WHERE id = ? AND organization_id = ?")
      .get(targetUserId, user.orgId) as { id: string; organization_id: string; name: string; role: string } | undefined;

    if (!targetUser) {
      throw new ValidationError("User not found in your organization.");
    }

    const { companyTemplates, personalTemplates, allTemplates } = getTemplatesForUser(user.orgId, targetUserId);
    const canManageCompanyTemplates = user.role === "owner" || user.role === "admin";

    return NextResponse.json({
      success: true,
      data: {
        templates: allTemplates,
        companyTemplates,
        personalTemplates,
        userId: targetUserId,
        userName: targetUser.name,
        userRole: targetUser.role,
        orgName: user.orgName,
        canManageCompanyTemplates,
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
      if (user.role !== "owner" && user.role !== "admin") {
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

    const saved = saveUserTemplate(
      targetUserId,
      {
        id: body.id,
        title: body.title,
        command: body.command,
        content: body.content,
        category: body.category,
        is_active: body.is_active,
        is_predefined: body.is_predefined,
      },
      user.orgId,
      user.role
    );

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

    deleteUserTemplate(targetUserId, templateId, user.orgId, user.role);

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

    // Predefined templates belong to the company: only owners and admins can restore company defaults
    if (user.role !== "owner" && user.role !== "admin") {
      throw new ForbiddenError("Only Practice Owners and Administrators have permission to reset company standard templates.");
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || user.userId;

    // Reset company predefined templates back to standard clinic/industry defaults
    resetOrgPredefinedTemplates(user.orgId, user.role);

    // Fetch updated template lists for this user
    const { companyTemplates, personalTemplates, allTemplates } = getTemplatesForUser(user.orgId, targetUserId);

    return NextResponse.json({
      success: true,
      message: "Company predefined messages have been restored to practice defaults.",
      data: {
        templates: allTemplates,
        companyTemplates,
        personalTemplates,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

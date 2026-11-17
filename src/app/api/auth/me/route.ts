import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, hashPassword, verifyPassword } from "@/lib/db";
import { handleApiError, UnauthorizedError, ValidationError } from "@/server/errors";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "No active session found",
        },
      },
      { status: 401 }
    );
  }

  // Fetch fresh record from DB
  const userRow = db
    .prepare("SELECT id, name, email, role, organization_id, created_at FROM users WHERE id = ?")
    .get(user.userId) as {
      id: string;
      name: string;
      email: string;
      role: string;
      organization_id: string;
      created_at: string;
    } | undefined;

  return NextResponse.json({
    success: true,
    data: {
      user: {
        ...user,
        name: userRow?.name || user.name,
        role: userRow?.role || user.role,
        createdAt: userRow?.created_at || null,
      },
    },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("You must be logged in to update your profile.");
    }

    const body = await req.json().catch(() => ({}));
    const newName = typeof body.name === "string" ? body.name.trim() : undefined;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : undefined;
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : undefined;

    if (newName !== undefined && newName.length < 2) {
      throw new ValidationError("Name must be at least 2 characters long.");
    }

    const userRow = db
      .prepare("SELECT id, name, email, role, password_hash, salt, organization_id, created_at FROM users WHERE id = ?")
      .get(user.userId) as {
        id: string;
        name: string;
        email: string;
        role: string;
        password_hash: string;
        salt: string;
        organization_id: string;
        created_at: string;
      } | undefined;

    if (!userRow) {
      throw new UnauthorizedError("User record not found.");
    }

    let updatedName = userRow.name;

    if (newName && newName !== userRow.name) {
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(newName, user.userId);
      updatedName = newName;
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new ValidationError("Current password is required to change password.");
      }
      const isMatch = verifyPassword(currentPassword, userRow.password_hash, userRow.salt);
      if (!isMatch) {
        throw new ValidationError("Current password is incorrect.");
      }
      if (newPassword.length < 8) {
        throw new ValidationError("New password must be at least 8 characters long.");
      }
      const { hash, salt } = hashPassword(newPassword);
      db.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").run(hash, salt, user.userId);
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          ...user,
          name: updatedName,
          createdAt: userRow.created_at,
        },
      },
      message: "Profile updated successfully.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import type { Metadata } from "next";
import { db } from "@/lib/db";
import { HostedChatClient } from "./HostedChatClient";

interface ChatPageProps {
  params: Promise<{ orgId: string }>;
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const { orgId } = await params;

  const orgRow = db
    .prepare("SELECT name, industry FROM organizations WHERE id = ?")
    .get(orgId) as { name?: string; industry?: string } | undefined;

  const agentRow = db
    .prepare("SELECT name FROM agents WHERE organization_id = ?")
    .get(orgId) as { name?: string } | undefined;

  const clinicName = orgRow?.name || "Front Desk";
  const agentName = agentRow?.name || "Maya";

  return {
    title: `${agentName} — ${clinicName} AI Receptionist`,
    description: `Connect with ${agentName}, virtual AI receptionist at ${clinicName}. Book appointments, ask clinic questions, and get 24/7 care support.`,
  };
}

export default async function HostedChatPage({ params }: ChatPageProps) {
  const { orgId } = await params;

  const orgRow = db
    .prepare("SELECT id, name, industry FROM organizations WHERE id = ?")
    .get(orgId) as { id: string; name: string; industry: string } | undefined;

  const agentRow = db
    .prepare("SELECT id, name, greeting, color, tone FROM agents WHERE organization_id = ?")
    .get(orgId) as { id: string; name: string; greeting: string; color: string; tone: string } | undefined;

  const isEcom = orgRow?.industry === "ecommerce";

  const orgName = orgRow?.name || (isEcom ? "Burewala Rice Mills" : "Healing Hands Physio");
  const agentName = agentRow?.name || (isEcom ? "Aria" : "Maya");
  const greeting =
    agentRow?.greeting ||
    (isEcom
      ? "Welcome! I'm Aria, your virtual sales and order assistant. How can I assist you with your order today?"
      : `Hello! I'm ${agentName}, your AI receptionist at ${orgName}. How can I help you with your health and bookings today?`);
  const brandColor = agentRow?.color || (isEcom ? "#4f46e5" : "#0d9488");
  const industry = orgRow?.industry || "clinic";

  const defaultChips = isEcom
    ? ["Track My Order", "Shipping Rates", "Return Policy", "Wholesale Bulk Sacks"]
    : ["Book Appointment", "Consultation Fees", "HICAPS Health Funds", "Opening Hours"];

  return (
    <HostedChatClient
      orgId={orgId}
      orgName={orgName}
      agentName={agentName}
      greeting={greeting}
      brandColor={brandColor}
      industry={industry}
      defaultChips={defaultChips}
    />
  );
}

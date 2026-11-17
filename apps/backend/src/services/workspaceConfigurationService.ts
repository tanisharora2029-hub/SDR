import { WorkspaceConfigurationSchema } from "@ai-sdr/shared";
import type { WorkspaceConfiguration } from "@ai-sdr/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const CATEGORY = "WORKSPACE_CONFIGURATION";

// Use one tenant-scoped record in the existing schema.
export async function getWorkspaceConfiguration(organizationId: string) {
  const revision = await prisma.activityLog.findUnique({
    where: { id: `${CATEGORY}:${organizationId}`, organizationId, category: CATEGORY },
    select: { detailsJson: true }
  });
  if (!revision?.detailsJson) return null;
  return WorkspaceConfigurationSchema.parse(JSON.parse(revision.detailsJson));
}

export async function saveWorkspaceConfiguration(
  tx: Prisma.TransactionClient,
  organizationId: string,
  configuration: WorkspaceConfiguration
) {
  const id = `${CATEGORY}:${organizationId}`;
  const detailsJson = JSON.stringify(configuration);
  await tx.activityLog.upsert({
    where: { id },
    create: {
      id,
      organizationId,
      category: CATEGORY,
      action: "Business configuration updated",
      detailsJson
    },
    update: { detailsJson, createdAt: new Date() }
  });
}

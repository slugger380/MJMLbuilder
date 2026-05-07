import type { CampaignEvent, CampaignResultSummary } from "@/lib/types";

export function createEmptyCampaignResultSummary(): CampaignResultSummary {
  return {
    sentCount: 0,
    deliveredCount: 0,
    openCount: 0,
    clickCount: 0,
    bounceCount: 0,
    unsubscribeCount: 0,
    failedCount: 0,
    openRate: 0,
    clickRate: 0
  };
}

export function summarizeCampaignEvents(events: CampaignEvent[]): CampaignResultSummary {
  const summary = createEmptyCampaignResultSummary();

  for (const event of events) {
    if (event.type === "sent") {
      summary.sentCount += 1;
    }
    if (event.type === "delivered") {
      summary.deliveredCount += 1;
    }
    if (event.type === "opened") {
      summary.openCount += 1;
    }
    if (event.type === "clicked") {
      summary.clickCount += 1;
    }
    if (event.type === "bounced") {
      summary.bounceCount += 1;
    }
    if (event.type === "unsubscribed") {
      summary.unsubscribeCount += 1;
    }
    if (event.type === "failed") {
      summary.failedCount += 1;
    }

    if (!summary.lastActivityAt || event.occurredAt > summary.lastActivityAt) {
      summary.lastActivityAt = event.occurredAt;
    }
  }

  summary.openRate = summary.deliveredCount
    ? Math.round((summary.openCount / summary.deliveredCount) * 1000) / 10
    : 0;
  summary.clickRate = summary.deliveredCount
    ? Math.round((summary.clickCount / summary.deliveredCount) * 1000) / 10
    : 0;

  return summary;
}

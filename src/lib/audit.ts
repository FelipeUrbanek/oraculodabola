import fs from "fs";
import path from "path";

const AUDIT_LOG_PATH = path.join(process.cwd(), "src", "audit_log.json");

export interface AuditEntry {
  timestamp: string;
  headline: string;
  source_url: string;
  source_domain: string;
  category: string;
  status: "SUCCESS" | "FAILED" | "REJECTED";
  reason?: string;
}

export function logAudit(entry: Omit<AuditEntry, "timestamp">) {
  let logs: AuditEntry[] = [];
  if (fs.existsSync(AUDIT_LOG_PATH)) {
    try {
      logs = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, "utf-8"));
    } catch (e) {
      logs = [];
    }
  }

  const newEntry: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  logs.push(newEntry);

  // Keep last 1000 logs
  if (logs.length > 1000) {
    logs = logs.slice(-1000);
  }

  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(logs, null, 2));
}

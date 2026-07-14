import fs from "node:fs";
import path from "node:path";

const dataRoot = path.join(process.cwd(), "data");

function readJsonDir<T>(dir: string): T[] {
  const full = path.join(dataRoot, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(full, f), "utf8")) as T);
}

export interface AbuseCase {
  id: string;
  title: string;
  date: string;
  location: { city?: string; county?: string; state: string; lat?: number; lng?: number };
  agency?: string;
  actor: string;
  category: string;
  summary: string;
  outcome?: string;
  sources: { url: string; outlet: string; date: string }[];
  verified: boolean;
  addedBy: string;
  addedDate: string;
}

export interface LegalCase {
  id: string;
  caseName: string;
  court: string;
  docketNumber?: string;
  status: "filed" | "pending" | "decided" | "dismissed" | "settled";
  issue: string;
  filedDate: string;
  decidedDate?: string;
  summary: string;
  whyItMatters: string;
  links: { url: string; label: string; type: string }[];
  addedDate: string;
}

export interface WinCity {
  id: string;
  city: string;
  state: string;
  date: string;
  lat?: number;
  lng?: number;
  sourceUrl: string;
}

export interface Municipality {
  slug: string;
  name: string;
  county: string;
  state: string;
}

export function loadAbuseCases(): AbuseCase[] {
  return readJsonDir<AbuseCase>("abuse-cases");
}

export function loadLegalCases(): LegalCase[] {
  return readJsonDir<LegalCase>("legal-cases");
}

export function loadWins(): WinCity[] {
  return readJsonDir<WinCity>("wins");
}

export function loadMunicipalities(): Municipality[] {
  const full = path.join(dataRoot, "cities/bexar-municipalities.json");
  if (!fs.existsSync(full)) return [];
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

export function loadGeoMeta(): { lastUpdated: string; counts: Record<string, number> } | null {
  const full = path.join(dataRoot, "geo/cameras/meta.json");
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

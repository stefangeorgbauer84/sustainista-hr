export const PERF_COLLECTIONS = {
  WINS: "wins",
  CHECK_INS: "check_ins",
  OKRS: "okrs",
  KAIZEN: "kaizen_items",
  REVIEWS: "performance_reviews",
};

export function currentWeekLabel(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function currentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

export function currentPeriod(): string {
  const now = new Date();
  const half = now.getMonth() < 6 ? "H1" : "H2";
  return `${now.getFullYear()}-${half}`;
}

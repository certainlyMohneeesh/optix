// ─────────────────────────────────────────────────────────────────────────────
//  OPTION CHAIN — NUMBER & DISPLAY FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────

/** Format a number to Indian locale with decimal places */
export const fn = (n: number | null | undefined, d = 2): string => {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

/** Format OI / Volume as K / L / Cr suffix */
export const fOI = (n: number): string => {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
};

/** Format OI change with + sign */
export const fChg = (n: number): string =>
  (n >= 0 ? "+" : "") + fOI(n);

/** Format percentage change with + sign */
export const fPct = (n: number): string =>
  (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

/** LTP × Volume formatted with ₹ prefix */
export const fLtpVol = (n: number): string => `₹${fOI(n)}`;

/** Time formatted as HH:MM:SS IST */
export const fTime = (d: Date): string =>
  d.toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });

/** Format expiry date from API format yyyy-mm-dd → DD-Mon-YYYY */
export const fExpiry = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-");
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  return `${d}-${months[Number(m) - 1]}-${y}`;
};

/** Convert display expiry (DD-Mon-YYYY) to API format (YYYY-MM-DD) */
export const expiryToAPI = (s: string): string => {
  const months: Record<string, string> = {
    Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
    Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12",
  };
  // Handles "27-Feb-2026", "06 Mar 2026"
  const clean = s.replace(/\s/g, "-");
  const parts = clean.split("-");
  if (parts.length !== 3) return s;
  const [d, mon, y] = parts;
  return `${y}-${months[mon] ?? "01"}-${d.padStart(2, "0")}`;
};

// ── Colour helpers ─────────────────────────────────────────────────────────
export const oiChangeColor = (v: number): string =>
  v > 0 ? "#34d399" : v < 0 ? "#f87171" : "#6b7280";

export const pcrColor = (p: number): string =>
  p > 1.3 ? "#34d399" : p < 0.7 ? "#f87171" : "#fbbf24";

export const pcrLabel = (
  p: number
): [label: string, desc: string, color: string] => {
  if (p > 1.5) return ["STRONGLY BULLISH", "Aggressive put writing — bulls in control", "#34d399"];
  if (p > 1.2) return ["BULLISH", "Put OI dominates — modest upside bias", "#34d399"];
  if (p > 0.8) return ["NEUTRAL", "Balanced OI — range-bound likely", "#fbbf24"];
  if (p > 0.5) return ["BEARISH", "Call OI dominates — downside pressure", "#f87171"];
  return ["STRONGLY BEARISH", "Extreme call writing — sharp fall risk", "#f87171"];
};

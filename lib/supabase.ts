// ─────────────────────────────────────────────────────────────────────────────
//  SUPABASE CLIENT
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { SnapshotRow } from "./types";
import type { Database, SnapshotInsert } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Singleton pattern (safe for Next.js) ─────────────────────────────────────
let _client: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!_client) {
    _client = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return _client;
};

// ── Snapshots ────────────────────────────────────────────────────────────────

/** Persist a chain snapshot to Supabase (fire-and-forget) */
export async function saveSnapshot(
  snapshot: Omit<SnapshotRow, "id" | "created_at">
) {
  const client = getSupabaseClient();
  if (!client) return;
  // Cast chain_data to Json-compatible type expected by the Database generic
  const row: SnapshotInsert = {
    ...snapshot,
    chain_data: snapshot.chain_data as unknown as import("./database.types").Json,
  };
  const { error } = await client.from("option_chain_snapshots").insert(row);
  if (error) console.warn("[Supabase] insert error:", error.message);
}

/** Load the N most-recent snapshots for a symbol + expiry */
export async function loadRecentSnapshots(
  symbol: string,
  expiry: string,
  limit = 20
): Promise<SnapshotRow[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("option_chain_snapshots")
    .select("*")
    .eq("symbol", symbol)
    .eq("expiry", expiry)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[Supabase] load error:", error.message);
    return [];
  }
  return (data ?? []) as SnapshotRow[];
}

/** Subscribe to real-time changes on the snapshots table */
export function subscribeSnapshots(
  symbol: string,
  expiry: string,
  cb: (row: SnapshotRow) => void
) {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const channel = client
    .channel("option_chain_snapshots_live")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "option_chain_snapshots",
        filter: `symbol=eq.${symbol}`,
      },
      (payload) => cb(payload.new as SnapshotRow)
    )
    .subscribe();
  return () => { client.removeChannel(channel); };
}

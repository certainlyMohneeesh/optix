// ─────────────────────────────────────────────────────────────────────────────
//  SUPABASE DATABASE TYPE
//  chain_data is stored as jsonb — must use Supabase's Json scalar, not ChainRow[]
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase Json scalar — mirrors what PostgREST returns for jsonb columns */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SnapshotInsert = {
  broker: string;
  symbol: string;
  expiry: string;
  spot: number;
  chain_data: Json;
  pcr?: number | null;
  max_pain?: number | null;
  total_call_oi?: number | null;
  total_put_oi?: number | null;
  vol_pcr?: number | null;
};

export type Database = {
  public: {
    Tables: {
      option_chain_snapshots: {
        Row: {
          id: string;
          created_at: string;
          broker: string;
          symbol: string;
          expiry: string;
          spot: number;
          chain_data: Json;
          pcr: number | null;
          max_pain: number | null;
          total_call_oi: number | null;
          total_put_oi: number | null;
          vol_pcr: number | null;
        };
        Insert: SnapshotInsert;
        Update: Partial<SnapshotInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

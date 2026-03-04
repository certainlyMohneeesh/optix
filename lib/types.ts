// ─────────────────────────────────────────────────────────────────────────────
//  OPTION CHAIN — TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type Broker = "upstox" | "zerodha";

export type Symbol =
  | "NIFTY"
  | "BANKNIFTY"
  | "FINNIFTY"
  | "MIDCPNIFTY"
  | "SENSEX";

// ── Single option leg data ──────────────────────────────────────────────────
export interface OptionLeg {
  instrument_key: string;
  ltp: number;
  bid_price: number;
  ask_price: number;
  oi: number;
  prev_oi: number;
  oi_change: number;
  oi_change_pct: number;
  volume: number;
  /** LTP × Volume in ₹ */
  ltp_volume: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  day_high: number;
  day_low: number;
}

// ── One row of the option chain ──────────────────────────────────────────────
export interface ChainRow {
  strike: number;
  call: OptionLeg;
  put: OptionLeg;
}

// ── Derived analytics ────────────────────────────────────────────────────────
export interface ChainAnalytics {
  pcr: number;
  maxPain: number;
  ivSkew: number;
  totalCallOI: number;
  totalPutOI: number;
  totalCallVolume: number;
  totalPutVolume: number;
  maxCallOI: number;
  maxPutOI: number;
  maxLtpVolume: number;
}

// ── WebSocket tick (Upstox v3) ───────────────────────────────────────────────
export interface UpstoxTick {
  instrument_key: string;
  ltp: number;
  oi: number;
  volume: number;
  bid_price: number;
  ask_price: number;
  cp?: number; // close price
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

// ── WebSocket tick (Zerodha KiteTicker) ─────────────────────────────────────
export interface ZerodhaTick {
  instrument_token: number;
  last_price: number;
  oi: number;
  volume: number;
  depth?: {
    buy: Array<{ price: number; quantity: number }>;
    sell: Array<{ price: number; quantity: number }>;
  };
  ohlc?: { open: number; high: number; low: number; close: number };
}

// ── Upstox REST option chain response shape ──────────────────────────────────
export interface UpstoxOptionChainItem {
  strike_price: number;
  underlying_spot_price?: number; // present in option/chain response
  call_options: {
    instrument_key: string;
    market_data: {
      ltp: number;
      oi: number;
      prev_oi?: number;
      volume: number;
      bid_price: number;
      ask_price: number;
      high: number;
      low: number;
    };
    option_greeks: {
      iv: number;
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
    };
  };
  put_options: {
    instrument_key: string;
    market_data: {
      ltp: number;
      oi: number;
      prev_oi?: number;
      volume: number;
      bid_price: number;
      ask_price: number;
      high: number;
      low: number;
    };
    option_greeks: {
      iv: number;
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
    };
  };
}

// ── Zerodha instrument record ────────────────────────────────────────────────
export interface ZerodhaInstrument {
  instrument_token: number;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: "CE" | "PE" | "FUT" | "EQ";
  segment: string;
  exchange: string;
}

// ── Zerodha quote ────────────────────────────────────────────────────────────
export interface ZerodhaQuote {
  instrument_token: number;
  timestamp: string;
  last_trade_time: string;
  last_price: number;
  last_quantity: number;
  buy_quantity: number;
  sell_quantity: number;
  volume: number;
  average_price: number;
  oi: number;
  oi_day_high: number;
  oi_day_low: number;
  net_change: number;
  lower_circuit_limit: number;
  upper_circuit_limit: number;
  ohlc: { open: number; high: number; low: number; close: number };
  depth: {
    buy: Array<{ quantity: number; price: number; orders: number }>;
    sell: Array<{ quantity: number; price: number; orders: number }>;
  };
}

// ── UI state ──────────────────────────────────────────────────────────────────
export type ViewTab = "chain" | "analytics" | "greeks" | "setup";
export type MetricKey = "oi" | "ltp" | "volume" | "ltpvol" | "iv";
export type FilterKey = "all" | "itm" | "otm" | "atm";
export type ConnectionStatus = "demo" | "connecting" | "connected" | "error" | "auth_required" | "reconnecting";

// ── Supabase snapshot row ─────────────────────────────────────────────────────
export interface SnapshotRow {
  id: string;
  created_at: string;
  broker: Broker;
  symbol: Symbol;
  expiry: string;
  spot: number;
  chain_data: ChainRow[];
  pcr: number;
  max_pain: number;
  total_call_oi: number;
  total_put_oi: number;
}

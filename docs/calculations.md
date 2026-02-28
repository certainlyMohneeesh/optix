# OPTIX — How Every Calculation Works

> Plain-language explanation of every formula, number, and colour rule in the app.
> No finance jargon where possible, with a plain-English analogy for each concept.

---

## Table of Contents

1. [ATM Strike](#1-atm-strike)
2. [Put-Call Ratio (PCR)](#2-put-call-ratio-pcr)
3. [Max Pain](#3-max-pain)
4. [IV Skew](#4-iv-skew)
5. [LTP × Volume](#5-ltp--volume)
6. [OI Change & OI Change %](#6-oi-change--oi-change-)
7. [Greeks — Delta, Gamma, Theta, Vega](#7-greeks)
8. [Volume PCR](#8-volume-pcr)
9. [ITM / OTM / ATM filter](#9-itm--otm--atm-filter)
10. [Bar widths in the table](#10-bar-widths-in-the-table)
11. [Colour rules](#11-colour-rules)
12. [OI Bar Chart scaling](#12-oi-bar-chart-scaling)
13. [Number formatting (K / L / Cr)](#13-number-formatting)

---

## 1. ATM Strike

**What it is:** The strike price that is closest to the current market price (spot).

**Formula:**
```
ATM = round(spot / step) × step
```

**Example (NIFTY, spot = 22,487, step = 50):**
```
ATM = round(22487 / 50) × 50
    = round(449.74) × 50
    = 450 × 50
    = 22,500
```

> **Plain English:** Each index trades in fixed gaps (50 for NIFTY, 100 for BANKNIFTY, etc.). ATM is simply the nearest available strike to the current price, snapped to the nearest gap.

---

## 2. Put-Call Ratio (PCR)

**What it is:** Compares how much put open interest (OI) exists vs call OI across the entire chain.

**Formula:**
```
PCR = Total Put OI ÷ Total Call OI
```

**Example:**
```
Total Put OI  = 5,40,000
Total Call OI = 4,00,000
PCR = 5,40,000 / 4,00,000 = 1.35
```

**How to read it:**

| PCR value | What it means |
|---|---|
| > 1.5 | **Strongly Bullish** — traders are buying heavy puts for insurance, market likely to go up |
| 1.2 – 1.5 | **Bullish** — puts slightly outweigh calls |
| 0.8 – 1.2 | **Neutral** — roughly balanced, range-bound market expected |
| 0.5 – 0.8 | **Bearish** — calls outweigh puts |
| < 0.5 | **Strongly Bearish** — aggressive call writing, sharp fall possible |

> **Plain English:** If more people are buying puts (downside protection), that often means big players think the market will hold up or go higher — they're willing to sell puts, which is bullish. PCR is a contrarian indicator.

---

## 3. Max Pain

**What it is:** The strike price where option buyers (collectively) lose the most money on expiry. Option writers (the big traders/institutions) naturally try to drive the price here by expiry.

**Formula:** For every possible strike as an "expiry price", calculate:
```
Pain at strike X =
  Σ [ (X - strike) × call OI ]  for all strikes BELOW X   (ITM calls)
+ Σ [ (strike - X) × put OI  ]  for all strikes ABOVE X   (ITM puts)

Max Pain = the strike X where this sum is MINIMUM
```

**Example (simplified, 3 strikes):**

Say strikes 100, 110, 120 exist. Testing strike 110 as expiry:
- Strike 100 call has OI 1000 → call pain = (110-100) × 1000 = 10,000
- Strike 120 put has OI 800  → put pain  = (120-110) × 800  =  8,000
- Total pain at 110 = 18,000

We test all strikes and pick the one with the **lowest total**. That is Max Pain.

> **Plain English:** Imagine option buyers hold lottery tickets. The strike at which most tickets expire worthless is Max Pain. Institutions who sold those tickets profit most if price lands there by expiry.

---

## 4. IV Skew

**What it is:** Measures whether put options are more expensive (in volatility terms) than call options at equal distance from ATM.

**Formula:**
```
IV Skew = IV of OTM Put (1 step below ATM) − IV of OTM Call (1 step above ATM)
```

**Example (NIFTY ATM = 22500, step = 50):**
```
OTM Put  = 22450 PE → IV = 14.5%
OTM Call = 22550 CE → IV = 12.0%
IV Skew  = 14.5 − 12.0 = +2.5%
```

**How to read it:**

| Skew | Meaning |
|---|---|
| Positive (+) | Puts are pricier → fear of downside, bearish protection premium |
| Near zero | Balanced fear — market is calm |
| Negative (−) | Calls are pricier → fear of a sharp rally (rare) |

> **Plain English:** IV is the "price of fear" in an option. A positive skew means people are paying more to buy puts (protective insurance). Think of it like car insurance getting more expensive when more accidents are expected.

---

## 5. LTP × Volume

**What it is:** Traded rupee value — how much money actually changed hands in that option today.

**Formula:**
```
LTP × Volume = Last Traded Price × Number of contracts traded today
             (each contract = lot size × 1 underlying unit)
```

**Example:**
```
NIFTY 22500 CE LTP    = ₹120
Volume today          = 5,000 contracts
LTP × Volume          = ₹120 × 5,000 = ₹6,00,000
```

Displayed as `₹6.00L` in the app.

> **Plain English:** Volume tells you *how many* trades happened. LTP is the last price. Multiplied together, it gives the total rupee flow through that option — a better proxy for actual interest than volume alone.

---

## 6. OI Change & OI Change %

**What it is:** How much Open Interest has increased or decreased since the previous snapshot.

**Formulas:**
```
OI Change     = Current OI − Previous OI
OI Change %   = (OI Change ÷ Previous OI) × 100
```

**Example:**
```
Current OI  = 8,40,000
Previous OI = 7,20,000
OI Change   = +1,20,000
OI Change % = (1,20,000 / 7,20,000) × 100 = +16.67%
```

**Colour rule:**
- Green (+) = OI is building up (new positions being opened)
- Red (−) = OI is falling (positions being closed/squared off)

> **Plain English:** OI Change tells you whether traders are entering new bets (+) or exiting old ones (−). Rising OI in calls = more bearish bets being placed. Rising OI in puts = more hedges being added.

---

## 7. Greeks

Greeks are sensitivity measures for an option's price. The app displays them per strike.

### Delta (Δ)
**How much the option price moves for every ₹1 move in the underlying.**

```
Call Delta: ranges from 0 to +1
Put Delta:  ranges from 0 to −1
```
- ATM option ≈ 0.5 (moves ₹0.50 per ₹1 spot move)
- Deep ITM option ≈ 0.9+ (moves almost like the stock itself)
- Deep OTM option ≈ 0.05 (barely reacts)

> **Plain English:** Delta is the "speed" of the option. Higher delta = option reacts more to spot price movement.

### Gamma (Γ)
**How fast Delta itself changes for every ₹1 move in spot.**

- Highest near ATM, near expiry
- Drops far OTM/ITM

> **Plain English:** Gamma is the "acceleration" of the option. High gamma = delta can change rapidly. Dangerous near expiry.

### Theta (Θ)
**How much value the option loses every day due to time passing (time decay).**

- Always negative (options lose value as time passes)
- Fastest near expiry for ATM options

> **Plain English:** Every day you hold an option, Theta eats away its value like rent. If the stock doesn't move, you lose Theta every single day.

### Vega (ν)
**How much the option price changes for every 1% change in Implied Volatility.**

- Highest for ATM and longer-dated options
- A high-vega option gains value if IV spikes

> **Plain English:** Vega is your exposure to "fear". If news breaks and markets panic, IV jumps — high-vega options get expensive. Calm markets → IV falls → option loses vega value.

---

## 8. Volume PCR

**What it is:** Same as PCR but using traded volume instead of open interest.

**Formula:**
```
Volume PCR = Total Put Volume ÷ Total Call Volume
```

**Why it matters:**  
OI-based PCR reflects accumulated positions. Volume PCR reflects *today's* activity — a leading indicator.

> **Plain English:** If today people traded many more puts than calls, even if total OI is balanced, it signals fresh bearish activity. Volume PCR captures same-day sentiment.

---

## 9. ITM / OTM / ATM filter

The table filter narrows down which strikes are shown.

| Filter | Rule | Example (NIFTY spot 22,487) |
|---|---|---|
| **ALL** | All strikes | Everything |
| **ITM** | Strike < Spot (for calls); Strike > Spot (for puts) | Calls below 22,487 |
| **OTM** | Strike > Spot (for calls); Strike < Spot (for puts) | Calls above 22,487 |
| **NEAR ATM** | Within 2 steps of ATM | 22,400 to 22,600 (±100) |

> **Plain English:**  
> - ITM (In The Money) = the option already has real value if you exercised today  
> - OTM (Out of The Money) = purely speculative, no intrinsic value yet  
> - ATM = right at the current market price

---

## 10. Bar widths in the table

Every cell in the option chain table that shows OI, Volume, LTP, LTP×Volume or IV has a faint horizontal bar behind the number. This bar shows the **relative size** of that value compared to the highest value in the chain.

**Formula for bar width:**
```
Bar width % =
  OI metric    → this_strike_OI ÷ max_OI_in_chain
  Volume       → this_volume ÷ (total_volume ÷ 20)
  LTP×Volume   → this_ltp_volume ÷ max_ltp_volume_in_chain
  LTP          → ltp ÷ 2000  (fixed normaliser)
  IV           → iv ÷ 40     (fixed normaliser, 40% treated as max)
```

> **Plain English:** The bar is a heat-map overlay. The widest bar in any column belongs to the strike with the highest value. Narrow bar = small number, full bar = the biggest in the chain.

---

## 11. Colour rules

### OI Change colours
```
OI Change > 0  → Green  (new money flowing in)
OI Change < 0  → Red    (money flowing out)
OI Change = 0  → Grey
```

### PCR colours (applied to PCR stat card)
```
PCR > 1.3  → Green  (bullish)
PCR < 0.7  → Red    (bearish)
otherwise  → Amber  (neutral)
```

### IV Skew colour (stat card)
```
Skew > +1.5%  → Red    (put skew, fear of downside)
Skew < −1.5%  → Green  (call skew, fear of rally)
otherwise     → Amber  (balanced)
```

### Strike row background
```
ATM strike row → faint violet tint
Max Pain strike label → purple text + "MAX PAIN" badge
ITM call cells → slightly brighter red text
ITM put cells  → slightly brighter green text
```

---

## 12. OI Bar Chart scaling

The OI bar chart shows a **bidirectional chart** — calls extend left, puts extend right from the centre divider.

**Width calculation:**
```
Call bar width % = (strike's call OI ÷ max OI in entire chain) × 100
Put  bar width % = (strike's put  OI ÷ max OI in entire chain) × 100
```

Both sides use the **same maximum** so the chart is symmetric and directly comparable.

The Max Pain strike's call bar is shown in **purple** instead of red to visually mark it.

> **Plain English:** The longest bar marks the strike where the most open positions exist. That strike usually acts as a support/resistance magnet.

---

## 13. Number formatting

All big numbers are compressed to a readable suffix:

| Value range | Format | Example |
|---|---|---|
| ≥ 1,00,00,000 (1 Cr) | `X.XXCr` | `1.25Cr` |
| ≥ 1,00,000 (1 L) | `X.XXL` | `8.40L` |
| ≥ 1,000 (1 K) | `X.XK` | `420.0K` |
| < 1,000 | raw integer | `847` |

**Spot / LTP prices** use Indian locale (commas at thousands, lakhs):
```
22,487.50  →  "22,487.50"
1,48,312.30  →  "1,48,312.30"
```

**Time** is always shown in IST (Asia/Kolkata) in 24-hour HH:MM:SS format.

**Expiry dates** are displayed as `DD-Mon-YYYY` (e.g. `27-Feb-2026`) in the UI but converted to `YYYY-MM-DD` when sent to the API.

---

## How it all connects — data flow summary

```
API / WebSocket
      │
      ▼
  ChainRow[]            ← one row per strike, with call leg + put leg
      │
      ├─ calcPCR()          → pcr (single number)
      ├─ calcMaxPain()       → maxPain strike  
      ├─ calcIVSkew()        → ivSkew %
      ├─ sum call/put OI     → totalCallOI, totalPutOI
      ├─ sum call/put vol    → totalCallVolume, totalPutVolume
      └─ max OI / maxLtpVol → used for bar width normalization
              │
              ▼
        ChainAnalytics        ← all computed in computeAnalytics()
              │
        Displayed in:
          StatStrip   → spot, PCR, maxPain, ivSkew, totals
          Table       → per-strike OI, volume, LTP, LTP×Vol, IV, Δ
          OIBarChart  → OI distribution chart
          Analytics   → PCR gauge, max pain chart, OI change, IV skew
          Greeks      → Δ, Γ, Θ, ν per strike
```

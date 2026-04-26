"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SubstrateId = "mrd" | "denseshield" | "kerdiboard" | "kerdisheating";

// ── Data (from TileCalculator.html) ─────────────────────────────
const substrateData = {
  mrd: {
    name: "Mold Resistant Drywall",
    note:
      "Use USG Sheetrock Mold Tough or CGC equivalent. Apply 2 coats RedGard or similar waterproofing membrane over all seams and corners before tiling.",
    mats: [
      { icon: "🟦", name: 'Mold resistant drywall 1/2"', desc: "4×8 sheets" },
      { icon: "🔩", name: "Drywall screws coarse", desc: '1-5/8" — every 8" on studs' },
      { icon: "🎞", name: "Mesh tape", desc: "Fiberglass — all seams" },
      { icon: "🛡", name: "RedGard waterproofing", desc: "2 coats — seams, corners, full field" },
    ],
  },
  denseshield: {
    name: "Denseshield Tile Backer",
    note:
      "No additional waterproofing membrane needed — Denseshield is its own barrier. Tape seams with alkali-resistant mesh tape + thinset.",
    mats: [
      { icon: "🟫", name: 'Denseshield 1/2"', desc: "3×5 sheets" },
      { icon: "🔩", name: "Backer board screws", desc: '1-1/4" — every 8" on studs' },
      { icon: "🎞", name: "Alkali-resistant mesh tape", desc: "All seams" },
      { icon: "🪣", name: "Thinset for seams", desc: "Embed tape in thinset" },
    ],
  },
  kerdiboard: {
    name: "Schluter KERDI-BOARD",
    note:
      "Fully waterproof foam board. Use KERDI-BAND at all seams and corners with unmodified thinset. No additional membrane required.",
    mats: [
      { icon: "🟧", name: "Schluter KERDI-BOARD", desc: '1/2" or 5/8" — measure sq ft' },
      { icon: "🎞", name: 'KERDI-BAND 5"', desc: "All seams and inside corners" },
      { icon: "🪣", name: "Unmodified thinset", desc: "For embedding KERDI-BAND" },
      { icon: "🔩", name: "KERDI-BOARD screws + washers", desc: 'Every 12" on studs' },
    ],
  },
  kerdisheating: {
    name: "Schluter KERDI Sheathing",
    note: "Bonded directly to studs. Lightweight and fully waterproof. Requires KERDI-BAND at corners and penetrations.",
    mats: [
      { icon: "🟨", name: "Schluter KERDI sheathing", desc: "Roll — measure linear ft" },
      { icon: "🎞", name: "KERDI-BAND", desc: "All corners and penetrations" },
      { icon: "🪣", name: "Unmodified thinset", desc: "To bond sheathing to substrate" },
      { icon: "🔩", name: "KERDI-FIX sealant", desc: "All perimeter edges" },
    ],
  },
} as const;

const doorPrices: Record<string, Record<string, [number, number]>> = {
  frameless: { swing: [1800, 3500], sliding: [2200, 4000], bifold: [2000, 3800] },
  semi: { swing: [900, 1800], sliding: [1100, 2200], bifold: [1000, 2000] },
  framed: { swing: [400, 900], sliding: [600, 1200], bifold: [500, 1100] },
};
const doorInstall: Record<string, string> = {
  frameless: "$350–600",
  semi: "$250–400",
  framed: "$150–300",
};

type TabId = "walls" | "floor" | "ceiling" | "substrate" | "door" | "list";
type FloorSub = "scratch" | "ditra" | "slab";
type DoorType = "frameless" | "semi" | "framed";
type DoorConfig = "swing" | "sliding" | "bifold";

function tilesForArea(sqIn: number, tw: number, th: number, joint: number) {
  const tileArea = (tw + joint) * (th + joint);
  return Math.ceil(sqIn / tileArea);
}
function sqInToSqFt(sqin: number) {
  return sqin / 144;
}
function fmt(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

const floorSubLabels: Record<FloorSub, string> = {
  scratch: "Portland cement + sand mix. Float to level before tile.",
  ditra: "Schluter Ditra mat over thinset. Thinset also on top before tile.",
  slab: "Thinset directly on concrete or existing tile (if sound).",
};

const WALL_SIZES: { w: number; h: number; label: string }[] = [
  { w: 3, h: 6, label: "3×6" },
  { w: 4, h: 4, label: "4×4" },
  { w: 4, h: 12, label: "4×12" },
  { w: 12, h: 12, label: "12×12" },
  { w: 12, h: 24, label: "12×24" },
  { w: 24, h: 24, label: "24×24" },
  { w: 24, h: 48, label: "24×48" },
  { w: 48, h: 48, label: "48×48" },
];

const CEIL_SIZES: { w: number; h: number; label: string }[] = [
  { w: 3, h: 6, label: "3×6 (same)" },
  { w: 12, h: 12, label: "12×12" },
  { w: 12, h: 24, label: "12×24" },
  { w: 24, h: 24, label: "24×24" },
  { w: 48, h: 48, label: "48×48" },
];

const JOINTS: { v: number; label: string }[] = [
  { v: 0.0625, label: '1/16"' },
  { v: 0.125, label: '1/8"' },
  { v: 0.1875, label: '3/16"' },
  { v: 0.25, label: '1/4"' },
];

type MatLine = { icon: string; name: string; desc: string; qty: string };

function TileCalculatorView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomName = searchParams.get("room") || "Room";

  const [tab, setTab] = useState<TabId>("walls");
  const [tileW, setTileW] = useState(3);
  const [tileH, setTileH] = useState(6);
  const [ceilTileW, setCeilTileW] = useState(3);
  const [ceilTileH, setCeilTileH] = useState(6);
  const [jointIn, setJointIn] = useState(0.0625);
  const [floorSub, setFloorSub] = useState<FloorSub>("scratch");
  const [wallSub, setWallSub] = useState<SubstrateId>("mrd");
  const [doorType, setDoorType] = useState<DoorType>("frameless");
  const [doorConfig, setDoorConfig] = useState<DoorConfig>("swing");

  const [wA_w, setWA_w] = useState(60);
  const [wA_h, setWA_h] = useState(96);
  const [wB_w, setWB_w] = useState(36);
  const [wB_h, setWB_h] = useState(96);
  const [wC_w, setWC_w] = useState(36);
  const [wC_h, setWC_h] = useState(96);
  const [hasNiche, setHasNiche] = useState(false);
  const [nicheW, setNicheW] = useState(12);
  const [nicheH, setNicheH] = useState(24);
  const [hasBench, setHasBench] = useState(false);
  const [benchW, setBenchW] = useState(36);
  const [benchD, setBenchD] = useState(16);
  const [flW, setFlW] = useState(60);
  const [flL, setFlL] = useState(36);
  const [hasHeat, setHasHeat] = useState(false);
  const [hasSteam, setHasSteam] = useState(false);
  const [hasCeiling, setHasCeiling] = useState(false);
  const [clW, setClW] = useState(60);
  const [clL, setClL] = useState(36);
  const [doorW, setDoorW] = useState(36);
  const [doorH, setDoorH] = useState(78);

  const setTileSize = useCallback((w: number, h: number) => {
    setTileW(w);
    setTileH(h);
  }, []);
  const setCeilTile = useCallback((w: number, h: number) => {
    setCeilTileW(w);
    setCeilTileH(h);
  }, []);

  const calc = useMemo(() => {
    const walls = [
      { id: "A" as const, w: wA_w, h: wA_h },
      { id: "B" as const, w: wB_w, h: wB_h },
      { id: "C" as const, w: wC_w, h: wC_h },
    ];
    const wallPerWall: Record<string, string> = {};
    let totalWallSqIn = 0;
    for (const wall of walls) {
      const sqin = wall.w * wall.h;
      totalWallSqIn += sqin;
      const t = tilesForArea(sqin, tileW * 12, tileH * 12, jointIn * 12);
      wallPerWall[wall.id] = `${Math.ceil(t * 1.1)} tiles`;
    }
    if (hasNiche) {
      const nSqIn = nicheW * nicheH;
      totalWallSqIn -= nSqIn;
    }
    let benchSqIn = 0;
    if (hasBench) {
      benchSqIn = benchW * benchD + benchW * 18;
      totalWallSqIn += benchSqIn;
    }
    const wallSqFt = sqInToSqFt(totalWallSqIn);
    const wallTiles = tilesForArea(totalWallSqIn, tileW * 12, tileH * 12, jointIn * 12);
    const wallTilesWaste = Math.ceil(wallTiles * 1.1);
    const perimIn = (wA_w + wB_w + wC_w) * 2;
    const schluterFt = Math.ceil(sqInToSqFt(perimIn));
    const flSqIn = flW * flL;
    const flSqFt = sqInToSqFt(flSqIn);
    const flTiles = Math.ceil(
      tilesForArea(flSqIn, tileW * 12, tileH * 12, jointIn * 12) * 1.1
    );
    let ceilSqFt = 0;
    let ceilTiles = 0;
    if (hasCeiling) {
      const clSqIn = clW * clL;
      ceilSqFt = sqInToSqFt(clSqIn);
      ceilTiles = Math.ceil(
        tilesForArea(clSqIn, ceilTileW * 12, ceilTileH * 12, jointIn * 12) * 1.1
      );
    }
    const coverage = tileW >= 12 ? 25 : 40;
    const totalTileSqFt = wallSqFt + flSqFt + ceilSqFt;
    const thinsetBags = Math.ceil(totalTileSqFt / coverage);
    const groutCoverage = tileW <= 4 ? 15 : tileW <= 12 ? 30 : 50;
    const groutBags = Math.ceil(totalTileSqFt / groutCoverage);

    return {
      wallPerWall,
      wallSqFt,
      wallTiles,
      wallTilesWaste,
      schluterFt,
      flSqFt,
      flTiles,
      ceilSqFt,
      ceilTiles,
      hasCeil: hasCeiling,
      thinsetBags,
      groutBags,
      hasHeat,
      hasSteam,
      floorSub,
    };
  }, [
    wA_w, wA_h, wB_w, wB_h, wC_w, wC_h, tileW, tileH, jointIn, hasNiche, nicheW, nicheH,
    hasBench, benchW, benchD, flW, flL, hasCeiling, clW, clL, ceilTileW, ceilTileH, hasHeat,
    hasSteam, floorSub,
  ]);

  const matListItems: MatLine[] = useMemo(() => {
    const d = calc;
    const items: MatLine[] = [
      { icon: "🔲", name: "Wall tile", qty: `${d.wallTilesWaste} tiles`, desc: `${d.wallSqFt.toFixed(0)} sq ft + 10% waste` },
      { icon: "🔲", name: "Floor tile", qty: `${d.flTiles} tiles`, desc: `${d.flSqFt.toFixed(0)} sq ft + 10% waste` },
    ];
    if (d.hasCeil) {
      items.push({
        icon: "🔲",
        name: "Ceiling tile",
        qty: `${d.ceilTiles} tiles`,
        desc: `${d.ceilSqFt.toFixed(0)} sq ft + 10% waste`,
      });
    }
    items.push(
      { icon: "🪣", name: "Thinset bags", qty: `${d.thinsetBags} bags`, desc: "50 lb — walls, floor, ceiling" },
      { icon: "🪣", name: "Grout bags", qty: `${d.groutBags} bags`, desc: "10 lb — all joints" },
      { icon: "📏", name: "Schluter strip", qty: `${d.schluterFt} ft`, desc: "All exposed tile edges" },
      { icon: "🛡", name: "Waterproofing", qty: `${Math.ceil(d.wallSqFt + d.flSqFt)} sq ft`, desc: "RedGard or KERDI coverage" }
    );
    if (d.floorSub === "ditra") {
      items.push({ icon: "🟧", name: "Schluter Ditra mat", qty: `${Math.ceil(d.flSqFt)} sq ft`, desc: "Floor uncoupling membrane" });
    }
    if (d.floorSub === "scratch") {
      items.push({ icon: "🪣", name: "Portland / sand mix", qty: `${Math.ceil(d.flSqFt / 15)} bags`, desc: "Scratch coat — 50 lb bags" });
    }
    if (d.hasHeat) {
      items.push(
        { icon: "🔥", name: "Electric heat mat", qty: `${Math.ceil(d.flSqFt)} sq ft`, desc: "Under tile — match floor sq ft" },
        { icon: "🌡", name: "Thermostat", qty: "1 unit", desc: "In-floor heat controller" },
        { icon: "🧪", name: "Self-leveler", qty: `${Math.ceil(d.flSqFt / 40)} bags`, desc: "Over heat mat before tile" }
      );
    }
    if (d.hasSteam) {
      items.push(
        { icon: "💨", name: "Steam generator", qty: "1 unit", desc: "2–7 kW depending on shower size" },
        { icon: "💨", name: "Steam head", qty: "1 unit", desc: "Low on wall, away from door" },
        { icon: "🎛", name: "Steam control", qty: "1 unit", desc: "Digital controller" },
        { icon: "🪵", name: "Blocking lumber 2x6", qty: "as needed", desc: "For steam generator mounting" }
      );
    }
    items.push(
      { icon: "🧪", name: "Silicone caulk", qty: "3 tubes", desc: "All corners and transitions" },
      { icon: "🧪", name: "Grout sealer", qty: "1 bottle", desc: "After grout cures — 72h" }
    );
    return items;
  }, [calc]);

  const doorCalc = useMemo(() => {
    const sqFt = (doorW * doorH) / 144;
    const [lo, hi] = doorPrices[doorType][doorConfig];
    return {
      sqFt: sqFt.toFixed(1),
      lo: fmt(lo),
      hi: fmt(hi),
      loN: lo,
      hiN: hi,
      install: doorInstall[doorType],
      label: `${doorType.charAt(0).toUpperCase() + doorType.slice(1)} ${doorConfig}`,
    };
  }, [doorW, doorH, doorType, doorConfig]);

  /** Rough supply total: glass door mid-range + modelled material allowances */
  const totalSupplyCad = useMemo(() => {
    const doorMid = (doorCalc.loN + doorCalc.hiN) / 2;
    const d = calc;
    let mat =
      d.thinsetBags * 45 +
      d.groutBags * 14 +
      d.schluterFt * 4 +
      Math.ceil(d.wallSqFt + d.flSqFt) * 2;
    if (d.floorSub === "ditra") mat += Math.ceil(d.flSqFt) * 7;
    if (d.floorSub === "scratch") mat += Math.ceil(d.flSqFt / 15) * 30;
    if (d.hasHeat) mat += Math.ceil(d.flSqFt) * 5 + 180;
    if (d.hasSteam) mat += 4000;
    return Math.max(0, Math.round(doorMid + mat));
  }, [doorCalc.loN, doorCalc.hiN, calc]);

  const dSub = substrateData[wallSub];

  const onPushQuote = useCallback(() => {
    try {
      alert("Material list pushed to quote. In production this writes to the project estimate.");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="tile-calc">
      <div className="topbar">
        <button type="button" className="back" aria-label="Back" onClick={() => router.back()}>
          ←
        </button>
        <div>
          <div className="topbar-title">Tile Calculator</div>
          <div className="topbar-sub">{roomName}</div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ["walls", "WALLS"],
            ["floor", "FLOOR"],
            ["ceiling", "CEILING"],
            ["substrate", "SUBSTRATE"],
            ["door", "GLASS DOOR"],
            ["list", "MATERIAL LIST"],
          ] as [TabId, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={"tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
            aria-selected={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="content">
        <div className={"panel" + (tab === "walls" ? " active" : "")} id="panel-walls" role="tabpanel">
          <div className="section">
            <div className="section-title">Tile Size</div>
            <div className="chip-row" id="tileSizeChips">
              {WALL_SIZES.map((s) => (
                <button
                  type="button"
                  key={s.label}
                  className={"chip" + (tileW === s.w && tileH === s.h ? " active" : "")}
                  onClick={() => setTileSize(s.w, s.h)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-title">Grout Joint</div>
            <div className="seg" style={{ maxWidth: 280 }}>
              {JOINTS.map((j) => (
                <button
                  type="button"
                  key={j.v}
                  className={"seg-btn" + (jointIn === j.v ? " active" : "")}
                  onClick={() => {
                    setJointIn(j.v);
                  }}
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>

          <div className="gap" />
          <div className="section-title">Wall Dimensions</div>

          {(["A", "B", "C"] as const).map((wid, i) => {
            const label = `Wall ${wid} ${i === 0 ? "(back)" : i === 1 ? "(left)" : "(right)"}`;
            const w = wid === "A" ? wA_w : wid === "B" ? wB_w : wC_w;
            const h = wid === "A" ? wA_h : wid === "B" ? wB_h : wC_h;
            const setW = wid === "A" ? setWA_w : wid === "B" ? setWB_w : setWC_w;
            const setH = wid === "A" ? setWA_h : wid === "B" ? setWB_h : setWC_h;
            return (
              <div className="wall-block" key={wid}>
                <div className="wall-header">
                  <span>{label}</span>
                  <span className="wall-header-val" id={`wall${wid}-count`}>
                    {calc.wallPerWall[wid] ?? "— tiles"}
                  </span>
                </div>
                <div className="card-row">
                  <div className="card-label">Width</div>
                  <input
                    className="num-input"
                    type="number"
                    inputMode="decimal"
                    value={w}
                    onChange={(e) => setW(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
                <div className="card-row">
                  <div className="card-label">Height</div>
                  <input
                    className="num-input"
                    type="number"
                    inputMode="decimal"
                    value={h}
                    onChange={(e) => setH(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
              </div>
            );
          })}

          <div className="card">
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Niche</div>
                <div className="toggle-sub">Subtract niche area from tile count</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={hasNiche} onChange={(e) => setHasNiche(e.target.checked)} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>
            {hasNiche && (
              <div id="nicheFields">
                <div className="card-row">
                  <div className="card-label">Niche width</div>
                  <input
                    className="num-input"
                    type="number"
                    value={nicheW}
                    onChange={(e) => setNicheW(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
                <div className="card-row">
                  <div className="card-label">Niche height</div>
                  <input
                    className="num-input"
                    type="number"
                    value={nicheH}
                    onChange={(e) => setNicheH(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
              </div>
            )}
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Bench</div>
                <div className="toggle-sub">Add bench top and face tile</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={hasBench} onChange={(e) => setHasBench(e.target.checked)} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>
            {hasBench && (
              <div id="benchFields">
                <div className="card-row">
                  <div className="card-label">Bench width</div>
                  <input
                    className="num-input"
                    type="number"
                    value={benchW}
                    onChange={(e) => setBenchW(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
                <div className="card-row">
                  <div className="card-label">Bench depth</div>
                  <input
                    className="num-input"
                    type="number"
                    value={benchD}
                    onChange={(e) => setBenchD(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
              </div>
            )}
          </div>

          <div className="gap" />
          <div className="section-title">Wall Totals</div>
          <div className="card">
            <div className="result-row">
              <div className="result-label">Total wall sq ft</div>
              <div>
                <span className="result-val">{calc.wallSqFt.toFixed(1)}</span>
                <span className="result-unit">sq ft</span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">Tiles needed</div>
              <div>
                <span className="result-val">{calc.wallTiles}</span>
                <span className="result-unit">tiles</span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">With 10% waste</div>
              <div>
                <span className="result-val result-val--accent">
                  {calc.wallTilesWaste}
                </span>
                <span className="result-unit">tiles</span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">Schluter linear ft</div>
              <div>
                <span className="result-val">{calc.schluterFt}</span>
                <span className="result-unit">ft</span>
              </div>
            </div>
          </div>
        </div>

        <div className={"panel" + (tab === "floor" ? " active" : "")} id="panel-floor" role="tabpanel">
          <div className="section">
            <div className="section-title">Floor Dimensions</div>
            <div className="card">
              <div className="card-row">
                <div className="card-label">Width</div>
                <input
                  className="num-input"
                  type="number"
                  inputMode="decimal"
                  value={flW}
                  onChange={(e) => setFlW(parseFloat(e.target.value) || 0)}
                />
                <div className="card-unit">in</div>
              </div>
              <div className="card-row">
                <div className="card-label">Length</div>
                <input
                  className="num-input"
                  type="number"
                  inputMode="decimal"
                  value={flL}
                  onChange={(e) => setFlL(parseFloat(e.target.value) || 0)}
                />
                <div className="card-unit">in</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Floor Substrate</div>
            <div className="seg" style={{ flexWrap: "wrap", maxWidth: "100%" }}>
              {(
                [
                  ["scratch", "Scratch Coat"],
                  ["ditra", "Ditra"],
                  ["slab", "Slab / Existing"],
                ] as [FloorSub, string][]
              ).map(([k, lab]) => (
                <button
                  type="button"
                  key={k}
                  className={"seg-btn" + (floorSub === k ? " active" : "")}
                  style={{ flex: "none", padding: "8px 14px" }}
                  onClick={() => setFloorSub(k)}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>

          <div className="card" id="floorSubInfo" style={{ marginBottom: 10 }}>
            <div className="card-row">
              <div className="card-label" id="floorSubLabel">
                {floorSubLabels[floorSub]}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Heated Floor</div>
                <div className="toggle-sub">Electric mat + thermostat</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={hasHeat} onChange={(e) => setHasHeat(e.target.checked)} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Steam Unit</div>
                <div className="toggle-sub">Generator + head + control + blocking required</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={hasSteam} onChange={(e) => setHasSteam(e.target.checked)} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>
          </div>

          <div className="gap" />
          <div className="section-title">Floor Totals</div>
          <div className="card">
            <div className="result-row">
              <div className="result-label">Floor sq ft</div>
              <div>
                <span className="result-val">{calc.flSqFt.toFixed(1)}</span>
                <span className="result-unit">sq ft</span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">Floor tiles (10% waste)</div>
              <div>
                <span className="result-val">{calc.flTiles}</span>
                <span className="result-unit">tiles</span>
              </div>
            </div>
            {hasHeat && (
              <div className="result-row heatRowFlex" id="heatRow">
                <div className="result-label">Heat mat sq ft</div>
                <div>
                  <span className="result-val">{calc.flSqFt.toFixed(1)}</span>
                  <span className="result-unit">sq ft</span>
                </div>
              </div>
            )}
          </div>

          {hasSteam && (
            <div id="steamNote" style={{ display: "block" }}>
              <div className="gap" />
              <div className="status-band status-warn">
                <div className="status-dot" />
                Steam requires: cement board blocking on all walls, pitch floor to drain, Kerdi or equivalent
                waterproofing, steam-rated grout.
              </div>
            </div>
          )}
        </div>

        <div className={"panel" + (tab === "ceiling" ? " active" : "")} id="panel-ceiling" role="tabpanel">
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Tile ceiling</div>
                <div className="toggle-sub">Same tile as walls or different</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={hasCeiling} onChange={(e) => setHasCeiling(e.target.checked)} />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>
          </div>

          {hasCeiling && (
            <div id="ceilingFields" style={{ display: "block" }}>
              <div className="section">
                <div className="section-title">Ceiling Tile Size</div>
                <div className="chip-row">
                  {CEIL_SIZES.map((s) => (
                    <button
                      type="button"
                      key={s.label}
                      className={"chip" + (ceilTileW === s.w && ceilTileH === s.h ? " active" : "")}
                      onClick={() => setCeilTile(s.w, s.h)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="section-title">Ceiling Dimensions</div>
              <div className="card">
                <div className="card-row">
                  <div className="card-label">Width</div>
                  <input
                    className="num-input"
                    type="number"
                    value={clW}
                    onChange={(e) => setClW(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
                <div className="card-row">
                  <div className="card-label">Length</div>
                  <input
                    className="num-input"
                    type="number"
                    value={clL}
                    onChange={(e) => setClL(parseFloat(e.target.value) || 0)}
                  />
                  <div className="card-unit">in</div>
                </div>
              </div>
              <div className="gap" />
              <div className="card">
                <div className="result-row">
                  <div className="result-label">Ceiling sq ft</div>
                  <div>
                    <span className="result-val">{calc.ceilSqFt.toFixed(1)}</span>
                    <span className="result-unit">sq ft</span>
                  </div>
                </div>
                <div className="result-row">
                  <div className="result-label">Ceiling tiles (10% waste)</div>
                  <div>
                    <span className="result-val">{calc.ceilTiles}</span>
                    <span className="result-unit">tiles</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!hasCeiling && (
            <div
              id="ceilingEmpty"
              style={{ padding: "40px 0", textAlign: "center", color: "#666", fontSize: 13 }}
            >
              Toggle ceiling tile above to calculate.
            </div>
          )}
        </div>

        <div className={"panel" + (tab === "substrate" ? " active" : "")} id="panel-substrate" role="tabpanel">
          <div className="section">
            <div className="section-title">Wall Substrate</div>
            <div className="seg" style={{ flexWrap: "wrap" }}>
              {(
                [
                  ["mrd", "Mold Resistant DW"],
                  ["denseshield", "Denseshield"],
                  ["kerdiboard", "Schluter Board"],
                  ["kerdisheating", "Schluter Sheathing"],
                ] as [SubstrateId, string][]
              ).map(([k, lab]) => (
                <button
                  type="button"
                  key={k}
                  className={"seg-btn" + (wallSub === k ? " active" : "")}
                  style={{ flex: "none", padding: "8px 12px", margin: 2 }}
                  onClick={() => setWallSub(k)}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
          <div className="gap" />
          <div className="card" id="substrateInfo">
            <div className="card-row">
              <div>
                <div style={{ fontSize: 13, color: "#111", fontWeight: 500 }}>{dSub.name}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4, lineHeight: 1.5 }}>{dSub.note}</div>
              </div>
            </div>
          </div>
          <div className="gap" />
          <div className="section-title">Substrate Materials Required</div>
          <div className="mat-list" id="substrateMats">
            {dSub.mats.map((m) => (
              <div className="mat-item" key={m.name + m.desc}>
                <div className="mat-icon">{m.icon}</div>
                <div className="mat-info">
                  <div className="mat-name">{m.name}</div>
                  <div className="mat-desc">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={"panel" + (tab === "door" ? " active" : "")} id="panel-door" role="tabpanel">
          <div className="section">
            <div className="section-title">Door Type</div>
            <div className="seg">
              {(
                [
                  ["frameless", "Frameless"],
                  ["semi", "Semi-frameless"],
                  ["framed", "Framed"],
                ] as [DoorType, string][]
              ).map(([k, lab]) => (
                <button
                  type="button"
                  key={k}
                  className={"seg-btn" + (doorType === k ? " active" : "")}
                  onClick={() => setDoorType(k)}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
          <div className="section">
            <div className="section-title">Opening Size</div>
            <div className="card">
              <div className="card-row">
                <div className="card-label">Opening width</div>
                <input
                  className="num-input"
                  type="number"
                  value={doorW}
                  onChange={(e) => setDoorW(parseFloat(e.target.value) || 0)}
                />
                <div className="card-unit">in</div>
              </div>
              <div className="card-row">
                <div className="card-label">Opening height</div>
                <input
                  className="num-input"
                  type="number"
                  value={doorH}
                  onChange={(e) => setDoorH(parseFloat(e.target.value) || 0)}
                />
                <div className="card-unit">in</div>
              </div>
            </div>
          </div>
          <div className="section">
            <div className="section-title">Configuration</div>
            <div className="seg">
              {(
                [
                  ["swing", "Swing"],
                  ["sliding", "Sliding"],
                  ["bifold", "Bi-fold"],
                ] as [DoorConfig, string][]
              ).map(([k, lab]) => (
                <button
                  type="button"
                  key={k}
                  className={"seg-btn" + (doorConfig === k ? " active" : "")}
                  onClick={() => setDoorConfig(k)}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
          <div className="gap" />
          <div className="section-title">Glass Door Estimate</div>
          <div className="card">
            <div className="result-row">
              <div className="result-label">Glass sq ft</div>
              <div>
                <span className="result-val">{doorCalc.sqFt}</span>
                <span className="result-unit">sq ft</span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">Door type</div>
              <div>
                <span className="result-val" style={{ fontSize: 14 }}>
                  {doorCalc.label}
                </span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">Supply estimate</div>
              <div>
                <span className="result-val result-val--accent">
                  {doorCalc.lo}
                </span>
                <span className="result-unit"> – </span>
                <span className="result-val result-val--accent">
                  {doorCalc.hi}
                </span>
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">Install (est.)</div>
              <div>
                <span className="result-val" style={{ fontSize: 14 }}>
                  {doorCalc.install}
                </span>
              </div>
            </div>
          </div>
          <div className="gap" />
          <div className="status-band status-warn">
            <div className="status-dot" />
            Glass door pricing is a supply estimate only. Get supplier quote for final pricing. Tempered glass required by
            code.
          </div>
        </div>

        <div className={"panel" + (tab === "list" ? " active" : "")} id="panel-list" role="tabpanel">
          <div className="section-title">Complete Material List</div>
          <div className="mat-list" id="fullMatList">
            {matListItems.map((i) => {
              const qParts = i.qty.split(" ");
              const n = qParts[0];
              const u = qParts.slice(1).join(" ");
              return (
                <div className="mat-item" key={i.name + i.qty}>
                  <div className="mat-icon">{i.icon}</div>
                  <div className="mat-info">
                    <div className="mat-name">{i.name}</div>
                    <div className="mat-desc">{i.desc}</div>
                  </div>
                  <div className="mat-qty">
                    {n}
                    <div className="mat-qty-unit">{u}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bottom-bar">
        <div className="bottom-inner">
          <div className="total-wrap">
            <div className="total-label">Total estimate</div>
            <div className="total-val" id="grandTotal">
              {fmt(totalSupplyCad)}
            </div>
          </div>
          <button type="button" className="push-btn" onClick={onPushQuote}>
            Push to Quote →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="tile-calc"
          style={{ minHeight: "100vh", background: "#ffffff", color: "#111111" }}
        />
      }
    >
      <TileCalculatorView />
    </Suspense>
  );
}

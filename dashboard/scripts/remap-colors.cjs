/**
 * Remap Tikchop colors from "green neon / dark glassmorphism"
 * to the new "Crémeux & chaleureux" design system:
 * warm espresso ink, terracotta, warm cream/sand surfaces.
 *
 * This ONLY rewrites hardcoded hex/rgb() values in app/**.
 * tokens.css is authored by hand (see styles/tokens.css) and is skipped here.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "app");

// old lowercased hex -> new hex
const HEX_MAP = {
  // Dark espresso ink (was dark green ink)
  "#07120d": "#2b2219",
  "#08120d": "#261e16",
  "#06100a": "#221b14",
  "#07100a": "#231c15",
  "#040b07": "#1c1610",
  "#101713": "#292117",
  "#111814": "#2a2218",
  "#0e1712": "#272016",
  "#0f1813": "#282017",
  "#14221a": "#2f261b",
  "#111b21": "#2a2118",
  "#0c2016": "#1f1a13",
  "#0b1e15": "#1e1912",
  "#0c1d16": "#1f1a13",
  "#122b20": "#241d15",
  "#073f28": "#2e231a",
  "#063d28": "#2c221a",
  "#06281a": "#221b14",
  "#042719": "#1d1812",
  "#0b1e15": "#1e1912",
  "#141c18": "#2a2218",

  // Terracotta primary (was deep green)
  "#008f5a": "#c2572b",
  "#057a55": "#a84a25",
  "#006d44": "#8f3e1d",
  "#006540": "#8a3c1c",
  "#005f3d": "#96451f",
  "#005b3b": "#8a3b1c",
  "#08724f": "#b04e28",
  "#00c853": "#c95e2e",
  "#00e676": "#e8783c",

  // Warm coral accent (was neon green)
  "#39f58e": "#f0954c",
  "#14ff8d": "#f5b060",
  "#69ffb4": "#f7c68a",
  "#6dffac": "#f4bc7e",

  // Cream / sand surfaces (was mint)
  "#eafff3": "#fbefe0",
  "#eafff5": "#fbefe2",
  "#eafff1": "#fbeee0",
  "#e9fff1": "#faedde",
  "#ecfff5": "#fbf0e3",
  "#f2fbf6": "#f7f0e4",
  "#f7faf6": "#f9f4ea",
  "#f5fbf7": "#f8f2e7",
  "#f4fbf6": "#f7f1e5",
  "#f7fbf8": "#f9f4ea",
  "#f2f7f4": "#f4ede1",
  "#edf6f1": "#f1e9dc",
  "#e7f8ee": "#f1e8da",
  "#e2fbe9": "#f0e7d8",
  "#d9fdd3": "#f3e8d4",
  "#baf7d6": "#f2e4cc",
  "#bff3cf": "#efe2ca",
  "#bbfcdc": "#f1e5cd",
  "#c2fcd5": "#f0e4cc",
  "#b4fed2": "#eee2ca",
  "#b1fecf": "#ede1c9",
  "#c5ffd6": "#f1e5cd",
  "#c5fedb": "#f1e6cf",
  "#b4ffd1": "#eee3cb",
  "#e8fff2": "#f8efe2",
  "#f8fbf5": "#f9f5ec",
  "#f0f5ee": "#efe9dd",
  "#edf7f0": "#f2ebdf",
  "#e9f5ee": "#f0e9dc",
  "#eafff3": "#fbefe0",

  // Warm backgrounds (was ivory/cream-green)
  "#fbf9f4": "#fbf6ee",
  "#fffdf5": "#fffdf6",
  "#fffdf8": "#fffef9",
  "#f5f7f2": "#f7f2e8",
  "#f3f5f1": "#f4efe5",
  "#f1f1ee": "#f0ece2",
  "#f0f2f5": "#f1eee9",
  "#f0ede8": "#eee8dc",
  "#f0eee9": "#eee9de",
  "#efeae2": "#ece5d8",
  "#ebe7dc": "#e9e2d4",
  "#e8dcc8": "#e7dac2",
  "#e8e4dc": "#e6dfd2",

  // Muted text (was muted green)
  "#685f4f": "#6e6354",
  "#4e6055": "#6e6353",
  "#647168": "#776c5d",
  "#849189": "#8a8072",
  "#8b9a92": "#91877a",
  "#7e8f86": "#847a6d",
  "#8fa499": "#948a7d",
  "#4a6055": "#6a5f50",
  "#6b8070": "#786d5e",
  "#536158": "#5f574b",
  "#26332b": "#3a3228",
  "#323c37": "#443b30",
  "#28533f": "#3c3327",
  "#b9c7bf": "#c4b9a8",
  "#263f5b": "#3a2f24",
  "#667781": "#776d60",

  // Misc warm mapping
  "#4d3200": "#6a4a1f",
  "#5b3b00": "#7a5425",
  "#5a4212": "#6d5126",
  "#5f4a13": "#74572a",
  "#3c2a00": "#5e431d",
  "#171006": "#3a2f24",
  "#8a5500": "#9c651f",
  "#7a4b00": "#8a5c22",
  "#9b6500": "#a96e26",
  "#7a4f00": "#8a5d22",
  "#8a5a00": "#a06a24",
  "#fff9e6": "#fff6e0",
  "#fff7dc": "#fdf2d4",
  "#fff8dd": "#fdf3d6",
  "#fff7dd": "#fdf2d5",
  "#fff8dc": "#fdf2d5",
  "#fff7d8": "#fcf1d2",
  "#fff8d7": "#fcf1d1",
  "#fff8db": "#fcf2d3",
  "#fff6c4": "#fbeec0",
  "#fff0bd": "#f9e8b4",
  "#ffe699": "#f8df8e",
  "#ffe082": "#f6da7c",
  "#ffd86a": "#f4cd5e",
  "#ffd966": "#f4ce60",
  "#ffe66d": "#f6d766",
  "#ffcf3d": "#f4c13a",
  "#ffc400": "#f2bc32",
  "#ffb000": "#ef9f28",
  "#f5a000": "#e08f1e",
  "#4d3200": "#6a4a1f",
  "#5b3b00": "#7a5425",
};

const RGB_MAP = [
  { from: /rgb\(7_18_13_\/_/g, to: "rgb(43_34_25_/_" },
  { from: /rgb\(13_23_18_\/_/g, to: "rgb(58_46_36_/_" },
  { from: /rgb\(16_24_20_\/_/g, to: "rgb(60_48_37_/_" },
  { from: /rgb\(57_245_142_\/_/g, to: "rgb(240_149_76_/_" },

  // Old neon green rgba(0,230,118,…) → terracotta rgba(194,87,43,…)
  { from: /rgba\(0,\s*230,\s*118/g, to: "rgba(194, 87, 43" },
  { from: /rgba\(0, 230, 118/g, to: "rgba(194, 87, 43" },
  // Old bright neon rgb(57,245,142,…) → coral rgba(240,149,76,…)
  { from: /rgba\(57,\s*245,\s*142/g, to: "rgba(240, 149, 76" },
  { from: /rgba\(57, 245, 142/g, to: "rgba(240, 149, 76" },
  { from: /rgb\(57,245,142/g, to: "rgb(240,149,76" },
  { from: /rgb\(57, 245, 142/g, to: "rgb(240, 149, 76" },
  // Space-separated neon rgb(109 255 172 / …) → warm
  { from: /rgb\(109 255 172/g, to: "rgb(244 188 126" },
  // Space-separated mint rgb(238 249 242 / …) → warm sand
  { from: /rgb\(238 249 242/g, to: "rgb(248 243 233" },
  // Space-separated dark green rgb(17 24 20 / …) → espresso
  { from: /rgb\(17 24 20/g, to: "rgb(41 33 23" },
  // Space-separated deep green rgb(5 122 85 / …) → terracotta
  { from: /rgb\(5 122 85/g, to: "rgb(168 74 37" },
  // Space-separated deep green rgb(8 114 79 / …) → terracotta
  { from: /rgb\(8 114 79/g, to: "rgb(176 78 40" },
  // Space-separated neon green rgb(41 204 122 / …) → coral
  { from: /rgb\(41 204 122/g, to: "rgb(240 149 76" },
  { from: /rgb\(53 216 131/g, to: "rgb(244 188 126" },
  // Space-separated dark green rgb(7 18 13 / …) → espresso
  { from: /rgb\(7 18 13/g, to: "rgb(43 34 25" },
  // Space-separated dark green rgb(16 24 20 / …) → espresso
  { from: /rgb\(16 24 20/g, to: "rgb(60 48 37" },
  // Space-separated dark green rgb(24 35 28 / …) → espresso
  { from: /rgb\(24 35 28/g, to: "rgb(60 48 37" },
  // Space-separated dark blue-green rgb(18 31 45 / …) → espresso
  { from: /rgb\(18 31 45/g, to: "rgb(60 48 37" },
  // Space-separated dark green rgb(20 32 26 / …) → espresso
  { from: /rgb\(20 32 26/g, to: "rgb(60 48 37" },
  // Space-separated dark green rgb(0 143 90 / …) → terracotta
  { from: /rgb\(0 143 90/g, to: "rgb(194 87 43" },
  { from: /rgb\(0 230 118/g, to: "rgb(232 120 60" },
  // Dark green ink rgba(7,18,13,…) → espresso rgba(43,34,25,…)
  { from: /rgba\(7,\s*18,\s*13/g, to: "rgba(43, 34, 25" },
  { from: /rgba\(7, 18, 13/g, to: "rgba(43, 34, 25" },
  { from: /rgb\(7,18,13/g, to: "rgb(43,34,25" },
  { from: /rgb\(7, 18, 13/g, to: "rgb(43, 34, 25" },
  // rgba(8,18,13,…) → espresso
  { from: /rgba\(8,\s*18,\s*13/g, to: "rgba(38, 30, 22" },
  { from: /rgba\(8, 18, 13/g, to: "rgba(38, 30, 22" },
  { from: /rgb\(8,18,13/g, to: "rgb(38,30,22" },
  // rgba(2,9,5,…) → espresso
  { from: /rgba\(2,\s*9,\s*5/g, to: "rgba(43, 34, 25" },
  { from: /rgba\(2, 9, 5/g, to: "rgba(43, 34, 25" },
  { from: /rgb\(2,9,5/g, to: "rgb(43,34,25" },
];

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|jsx|ts|tsx|css)$/.test(entry.name) && !/tokens\.css$/.test(entry.name)) files.push(p);
  }
})(ROOT);

let changed = 0;
for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  let out = src;

  for (const [from, to] of Object.entries(HEX_MAP)) {
    // case-insensitive match of the hex
    out = out.replace(new RegExp(from.slice(1), "gi"), (m) => to.replace(/^#/, ""));
  }

  for (const { from, to } of RGB_MAP) {
    out = out.replace(from, to);
  }

  if (out !== src) {
    fs.writeFileSync(file, out, "utf8");
    changed++;
    console.log("updated", path.relative(ROOT, file));
  }
}

console.log(`\n${changed} files updated.`);

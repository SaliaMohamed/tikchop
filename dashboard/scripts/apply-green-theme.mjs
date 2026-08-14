import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EXCLUDE = /node_modules|\/output\/|\/\.next\/|playwright|\.git\//;

// ancien theme creme/warm -> nouveau theme vert emeraude epure (iOS)
const MAP = {
  // ── Encre espresso -> vert foret profond ──
  "#2B2219": "#0F2B20",
  "#261E16": "#0A2319",
  "#292117": "#0C271C",
  "#2A2118": "#0C271C",
  "#2A2218": "#0C271C",
  "#221B14": "#091D14",
  "#1F1A13": "#081A12",
  "#1E1912": "#081A12",
  "#1C1610": "#071710",
  "#241D15": "#0A1F16",
  "#2C221A": "#0D291E",
  "#2E231A": "#0E2A1F",
  "#3A2F24": "#133327",
  "#3A3228": "#14362A",
  "#3C3327": "#15382C",
  "#443B30": "#1A4033",
  "#1D1812": "#0A1F16",
  "#1E1912": "#081A12",

  // ── Terra cotta (deep) -> emeraude profond ──
  "#96451F": "#047857",
  "#8A3C1C": "#065F46",
  "#8F3E1D": "#065F46",
  "#B04E28": "#047857",
  "#8A3B1C": "#065F46",

  // ── Primary terracotta -> emeraude ──
  "#C2572B": "#059669",
  "#A84A25": "#047857",
  "#E8783C": "#10B981",
  "#F7C68A": "#6EE7B7",
  "#F0954C": "#34D399",

  // ── Fonds creme/sable -> blancs menthe ──
  "#FBF6EE": "#F6FBF7",
  "#F8F2E7": "#F1F8F3",
  "#F9F4EA": "#F5FBF8",
  "#F7F0E4": "#F2F9F5",
  "#F7F1E5": "#F4FAF6",
  "#FBEFE0": "#E8F7EE",
  "#FBEFE2": "#EAF8F0",
  "#FBEEE0": "#E7F6ED",
  "#FBF0E3": "#EBF8F0",
  "#FAEDDE": "#E6F5EC",
  "#F4EDE1": "#EEF8F2",
  "#F1EEE9": "#F0F7F3",
  "#F0ECE2": "#EDF6F0",
  "#EEE9DE": "#EAF3ED",
  "#ECE5D8": "#E7F1EA",
  "#E7DAC2": "#DCEFE3",
  "#F3E8D4": "#F0F8F2",
  "#F1E5CD": "#EDF7F0",
  "#F0E4CC": "#ECF5EF",
  "#F1E6CF": "#EEF7F0",
  "#F0E9DC": "#ECF4EF",
  "#F1E9DC": "#ECF4EF",
  "#F2E4CC": "#EEF7F1",
  "#EDE1C9": "#EAF3EC",
  "#EEE2CA": "#EBF4ED",
  "#EEE3CB": "#EBF4ED",
  "#EFE2CA": "#EAF3EC",
  "#F7F2E8": "#F3FAF6",
  "#F0E7D8": "#ECF5EF",
  "#E9E2D4": "#E7F0EA",
  "#FFFEF9": "#FDFFFE",
  "#FBF9F4": "#F8FBF9",

  // ── Texte mute (brun) -> vert-gris ──
  "#6E6353": "#54685E",
  "#6E6354": "#54685E",
  "#776C5D": "#4C6B5E",
  "#776D60": "#4C6B5E",
  "#786D5E": "#4E6E61",
  "#8A8072": "#6F8277",
  "#91877A": "#77897F",
  "#6A5F50": "#577066",
  "#5F574B": "#547064",
  "#C4B9A8": "#AFC4B8",

  // ── Vestiges ancien theme vert -> harmonisation ──
  "#07120D": "#071B12",
  "#06100A": "#061812",
  "#101814": "#0B1D14",
  "#122B20": "#0F2B20",
  "#008F5A": "#059669",
  "#007A4D": "#047857",
  "#005F3D": "#065F46",
  "#F3F6EF": "#EDF8F0",
  "#EAFFF5": "#E4F7EC",
  "#F4FBF7": "#F2FAF5",
  "#496155": "#3E6B55",
  "#4E6055": "#4B6E5E",
};

// ancien rgba -> nouveau vert emeraude
const RGB_MAP = [
  ["240, 149, 76", "52, 211, 153"],
  ["240,149,76", "52,211,153"],
  ["194, 87, 43", "5, 150, 105"],
  ["194,87,43", "5,150,105"],
  ["43, 34, 25", "15, 43, 32"],
  ["43,34,25", "15,43,32"],
  ["213, 194, 166", "160, 205, 185"],
  ["213,194,166", "160,205,185"],
];

let filesChanged = 0;

function processFile(file) {
  const before = readFileSync(file, "utf8");
  let out = before;
  for (const [oldHex, newHex] of Object.entries(MAP)) {
    const re = new RegExp(oldHex.replace("#", "#"), "gi");
    out = out.replace(re, newHex);
  }
  for (const [oldRgb, newRgb] of RGB_MAP) {
    out = out.replaceAll(oldRgb, newRgb);
  }
  if (out !== before) {
    writeFileSync(file, out, "utf8");
    filesChanged += 1;
    return true;
  }
  return false;
}

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDE.test(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(js|jsx|ts|tsx|css)$/.test(entry)) processFile(full);
  }
}

walk(ROOT + "/app");
if (statSync(ROOT + "/components", { throwIfNoEntry: false })) walk(ROOT + "/components");
walk(ROOT + "/lib");

// recount actual replacements
let total = 0;
function countReal(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDE.test(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) countReal(full);
    else if (/\.(js|jsx|ts|tsx|css)$/.test(entry)) {
      const content = readFileSync(full, "utf8");
      for (const [oldHex] of Object.entries(MAP)) {
        const re = new RegExp(oldHex.replace("#", "#"), "gi");
        const m = content.match(re);
        if (m) total += m.length;
      }
      for (const [oldRgb] of RGB_MAP) {
        const m = content.matchAll(oldRgb);
        if (m) total += Array.from(m).length;
      }
    }
  }
}
countReal(ROOT + "/app");
if (statSync(ROOT + "/components", { throwIfNoEntry: false })) countReal(ROOT + "/components");
countReal(ROOT + "/lib");

console.log(`Fichiers modifies: ${filesChanged}`);
console.log(`Occurrences totales remplacees: ${total}`);
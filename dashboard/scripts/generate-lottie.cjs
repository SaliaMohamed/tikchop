const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "public", "lottie");

const EASE_OUT = { x: [0.16, 0.42, 1, 1], y: [0.09, 0, 0.83, 0.83] };
const EASE_IN_OUT = { x: [0.42, 0, 0.58, 1], y: [0, 0, 1, 1] };

function keyframes(keys, easing = EASE_IN_OUT) {
  const frames = keys.map((k, i) => {
    const f = { t: k.t, s: k.s };
    if (i < keys.length - 1) f.o = { x: [0.42, 0, 0.58, 1], y: [0, 0, 1, 1] };
    if (i > 0) f.i = { x: [0.42, 0, 0.58, 1], y: [0, 0, 1, 1] };
    return f;
  });
  return { a: 1, k: frames };
}

function staticProp(value) {
  return { a: 0, k: value };
}

function shapeLayer({ ind, shapes, ip = 0, op = 120, st = 0, ks = {}, nm = "layer" }) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: {
      o: ks.o || staticProp(100),
      r: ks.r || staticProp(0),
      p: ks.p || staticProp([0, 0, 0]),
      a: staticProp([0, 0, 0]),
      s: ks.s || staticProp([100, 100, 100]),
    },
    ao: 0,
    shapes: [
      ...shapes,
      {
        ty: "tr",
        nm: "Transform",
        p: staticProp([0, 0]),
        a: staticProp([0, 0]),
        s: staticProp([100, 100]),
        r: staticProp(0),
        o: staticProp(100),
        sk: staticProp(0),
        sa: staticProp(0),
      },
    ],
    ip,
    op,
    st,
    bm: 0,
    ef: [],
  };
}

function fillShape(rgb, opacity = 100) {
  return {
    ty: "fl",
    nm: "Fill",
    c: staticProp([...rgb, 1]),
    o: staticProp(opacity),
    r: 1,
  };
}

function strokeShape(rgb, width = 10, opacity = 100) {
  return {
    ty: "st",
    nm: "Stroke",
    c: staticProp([...rgb, 1]),
    o: staticProp(opacity),
    w: staticProp(width),
    lc: 2,
    lj: 2,
    ml: 4,
  };
}

function ellipseShape(w, h) {
  return {
    ty: "el",
    nm: "Ellipse",
    sr: 1,
    p: staticProp([0, 0]),
    s: staticProp([w, h]),
    d: 1,
  };
}

function rectShape(w, h, r = 0) {
  return {
    ty: "rc",
    nm: "Rectangle",
    d: 1,
    s: staticProp([w, h]),
    p: staticProp([0, 0]),
    r: staticProp(r),
  };
}

function pathShape(vertices, closed = false) {
  const i = vertices.map(() => [0, 0]);
  return {
    ty: "sh",
    nm: "Path",
    d: 1,
    ks: {
      a: 0,
      k: { i, o: i, v: vertices, c: closed },
    },
  };
}

function build(animations) {
  return animations.map(({ name, w, h, layers }) => {
    const animation = {
      v: "5.7.4",
      fr: 30,
      ip: 0,
      op: 120,
      w,
      h,
      nm: name,
      ddd: 0,
      assets: [],
      layers,
      markers: [],
    };
    const filePath = path.join(OUT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(animation), "utf8");
    return filePath;
  });
}

const TIKCHOP_CORAL = [0.97, 0.36, 0.24]; // #F75C3D terracotta
const TIKCHOP_CORAL_DEEP = [0.84, 0.25, 0.14]; // #D63F24
const INK = [0.13, 0.11, 0.09]; // #221C16 warm ink
const CREAM = [0.99, 0.97, 0.93]; // #FDF7ED ivory
const GOLD = [0.96, 0.65, 0.2]; // #F5A633
const GREEN = [0.15, 0.62, 0.45]; // #269E73
const WHITE = [1, 1, 1];

const animations = [];

// ─── chat.json — WhatsApp bubble + bouncing dots ─────────────────────────────
{
  const layers = [];
  // Bubble
  layers.push(
    shapeLayer({
      ind: 1,
      nm: "bubble",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 112, 0] },
          { t: 30, s: [100, 104, 0] },
          { t: 60, s: [100, 112, 0] },
          { t: 90, s: [100, 104, 0] },
          { t: 120, s: [100, 112, 0] },
        ]),
      },
      shapes: [rectShape(148, 96, 30), fillShape(CREAM)],
    }),
  );
  // Bubble border
  layers.push(
    shapeLayer({
      ind: 2,
      nm: "bubble-border",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 112, 0] },
          { t: 30, s: [100, 104, 0] },
          { t: 60, s: [100, 112, 0] },
          { t: 90, s: [100, 104, 0] },
          { t: 120, s: [100, 112, 0] },
        ]),
      },
      shapes: [rectShape(148, 96, 30), strokeShape([0.86, 0.82, 0.76], 5)],
    }),
  );
  // Three typing dots
  const dotPositions = [-30, 0, 30];
  dotPositions.forEach((x, i) => {
    layers.push(
      shapeLayer({
        ind: 3 + i,
        nm: `dot-${i}`,
        st: i * 6,
        ks: {
          p: keyframes([
            { t: 0, s: [100 + x, 112, 0] },
            { t: 8, s: [100 + x, 100, 0] },
            { t: 16, s: [100 + x, 112, 0] },
            { t: 36, s: [100 + x, 112, 0] },
          ]),
        },
        shapes: [ellipseShape(22, 22), fillShape(TIKCHOP_CORAL)],
      }),
    );
  });
  animations.push({ name: "chat", w: 200, h: 200, layers });
}

// ─── success.json — circle pop + check draw ──────────────────────────────────
{
  const layers = [];
  // Checkmark (draws in)
  layers.push(
    shapeLayer({
      ind: 1,
      nm: "check",
      ks: {
        s: keyframes([
          { t: 0, s: [10, 10, 100] },
          { t: 24, s: [105, 105, 100] },
          { t: 32, s: [98, 98, 100] },
          { t: 40, s: [100, 100, 100] },
        ]),
      },
      shapes: [
        pathShape([
          [-34, 6],
          [-6, 34],
          [38, -26],
        ]),
        strokeShape(TIKCHOP_CORAL_DEEP, 14, 100),
      ],
    }),
  );
  // Outer ring stroke
  layers.push(
    shapeLayer({
      ind: 2,
      nm: "ring",
      ks: {
        s: keyframes([
          { t: 0, s: [0, 0, 100] },
          { t: 18, s: [100, 100, 100] },
        ]),
      },
      shapes: [ellipseShape(150, 150), strokeShape(TIKCHOP_CORAL, 7)],
    }),
  );
  // Soft glow disc
  layers.push(
    shapeLayer({
      ind: 3,
      nm: "glow",
      ks: {
        s: keyframes([
          { t: 0, s: [0, 0, 100] },
          { t: 22, s: [100, 100, 100] },
        ]),
        o: keyframes([
          { t: 0, s: [0] },
          { t: 30, s: [100] },
          { t: 60, s: [35] },
          { t: 120, s: [35] },
        ]),
      },
      shapes: [ellipseShape(120, 120), fillShape([0.98, 0.86, 0.82], 100)],
    }),
  );
  animations.push({ name: "success", w: 200, h: 200, layers });
}

// ─── coin.json — bouncing coin with shine ────────────────────────────────────
{
  const layers = [];
  // Coin body
  layers.push(
    shapeLayer({
      ind: 1,
      nm: "coin",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 110, 0] },
          { t: 20, s: [100, 96, 0] },
          { t: 40, s: [100, 110, 0] },
          { t: 80, s: [100, 100, 0] },
          { t: 120, s: [100, 110, 0] },
        ]),
        r: keyframes([
          { t: 0, s: [0] },
          { t: 120, s: [360] },
        ]),
      },
      shapes: [ellipseShape(130, 130), fillShape(GOLD)],
    }),
  );
  // Inner disc
  layers.push(
    shapeLayer({
      ind: 2,
      nm: "inner",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 110, 0] },
          { t: 20, s: [100, 96, 0] },
          { t: 40, s: [100, 110, 0] },
          { t: 80, s: [100, 100, 0] },
          { t: 120, s: [100, 110, 0] },
        ]),
        r: keyframes([
          { t: 0, s: [0] },
          { t: 120, s: [360] },
        ]),
      },
      shapes: [ellipseShape(88, 88), strokeShape([0.85, 0.5, 0.14], 6)],
    }),
  );
  // Shine slash
  layers.push(
    shapeLayer({
      ind: 3,
      nm: "shine",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 110, 0] },
          { t: 20, s: [100, 96, 0] },
          { t: 40, s: [100, 110, 0] },
          { t: 80, s: [100, 100, 0] },
          { t: 120, s: [100, 110, 0] },
        ]),
        r: keyframes([
          { t: 0, s: [-45] },
          { t: 120, s: [315] },
        ]),
        o: keyframes([
          { t: 0, s: [0] },
          { t: 30, s: [90] },
          { t: 60, s: [0] },
          { t: 90, s: [90] },
          { t: 120, s: [0] },
        ]),
      },
      shapes: [rectShape(10, 64, 5), fillShape(WHITE, 100)],
    }),
  );
  // Sparkles
  const sparkPositions = [
    [150, 70, 0],
    [55, 150, 0],
    [155, 150, 0],
  ];
  sparkPositions.forEach((pos, i) => {
    layers.push(
      shapeLayer({
        ind: 4 + i,
        nm: `spark-${i}`,
        st: i * 20,
        ks: {
          p: staticProp(pos),
          s: keyframes([
            { t: 0, s: [0, 0, 100] },
            { t: 10, s: [100, 100, 100] },
            { t: 30, s: [0, 0, 100] },
          ]),
        },
        shapes: [ellipseShape(20, 20), fillShape(TIKCHOP_CORAL)],
      }),
    );
  });
  animations.push({ name: "coin", w: 200, h: 200, layers });
}

// ─── truck.json — delivery truck slide in with rotating wheels ───────────────
{
  const W = 260;
  const H = 200;
  const driveY = 138;
  const layers = [];
  // Cargo box
  layers.push(
    shapeLayer({
      ind: 1,
      nm: "cargo",
      ks: {
        p: keyframes([
          { t: 0, s: [-180, 100, 0] },
          { t: 40, s: [W / 2 - 10, 100, 0] },
          { t: 120, s: [W / 2 - 10, 100, 0] },
        ]),
      },
      shapes: [rectShape(130, 76, 10), fillShape(TIKCHOP_CORAL)],
    }),
  );
  // Cargo stripe
  layers.push(
    shapeLayer({
      ind: 2,
      nm: "cargo-stripe",
      ks: {
        p: keyframes([
          { t: 0, s: [-180, 100, 0] },
          { t: 40, s: [W / 2 - 10, 100, 0] },
          { t: 120, s: [W / 2 - 10, 100, 0] },
        ]),
      },
      shapes: [rectShape(130, 16, 8), fillShape([0.84, 0.25, 0.14], 100)],
    }),
  );
  // Cab
  layers.push(
    shapeLayer({
      ind: 3,
      nm: "cab",
      ks: {
        p: keyframes([
          { t: 0, s: [-180, 108, 0] },
          { t: 40, s: [W / 2 + 62, 108, 0] },
          { t: 120, s: [W / 2 + 62, 108, 0] },
        ]),
      },
      shapes: [rectShape(56, 56, 12), fillShape(INK)],
    }),
  );
  // Wheels
  const wheelXs = [W / 2 - 36, W / 2 + 52];
  wheelXs.forEach((x, i) => {
    layers.push(
      shapeLayer({
        ind: 4 + i,
        nm: `wheel-${i}`,
        ks: {
          p: keyframes([
            { t: 0, s: [-180, driveY, 0] },
            { t: 40, s: [x, driveY, 0] },
            { t: 120, s: [x, driveY, 0] },
          ]),
          r: keyframes([
            { t: 0, s: [0] },
            { t: 120, s: [360] },
          ]),
        },
        shapes: [
          ellipseShape(40, 40),
          fillShape(INK),
          { ty: "el", nm: "hub", sr: 1, p: staticProp([0, 0]), s: staticProp([14, 14]), d: 1 },
          fillShape(CREAM),
        ],
      }),
    );
  });
  // Ground line
  layers.push(
    shapeLayer({
      ind: 6,
      nm: "ground",
      ks: {
        p: staticProp([W / 2, driveY + 34, 0]),
      },
      shapes: [rectShape(W - 20, 6, 3), fillShape([0.86, 0.82, 0.76], 60)],
    }),
  );
  animations.push({ name: "truck", w: W, h: H, layers });
}

// ─── sparkle.json — four-point star twinkle ──────────────────────────────────
{
  const layers = [];
  const starVertices = [
    [0, -60], [13, -13], [60, 0], [13, 13], [0, 60],
    [-13, 13], [-60, 0], [-13, -13],
  ];
  layers.push(
    shapeLayer({
      ind: 1,
      nm: "star",
      ks: {
        s: keyframes([
          { t: 0, s: [0, 0, 100] },
          { t: 18, s: [110, 110, 100] },
          { t: 30, s: [100, 100, 100] },
          { t: 60, s: [100, 100, 100] },
        ]),
        o: keyframes([
          { t: 0, s: [0] },
          { t: 14, s: [100] },
          { t: 80, s: [100] },
        ]),
      },
      shapes: [pathShape(starVertices, true), fillShape(GOLD)],
    }),
  );
  // Small companion sparkles
  const companions = [
    [46, -52, 0],
    [150, 40, 0],
    [60, 155, 0],
    [155, 140, 0],
  ];
  companions.forEach((pos, i) => {
    layers.push(
      shapeLayer({
        ind: 2 + i,
        nm: `comp-${i}`,
        st: 6 + i * 12,
        ks: {
          p: staticProp(pos),
          s: keyframes([
            { t: 0, s: [0, 0, 100] },
            { t: 8, s: [100, 100, 100] },
            { t: 22, s: [0, 0, 100] },
          ]),
        },
        shapes: [pathShape(starVertices.map(([x, y]) => [x * 0.3, y * 0.3]), true), fillShape(TIKCHOP_CORAL)],
      }),
    );
  });
  animations.push({ name: "sparkle", w: 200, h: 200, layers });
}

// ─── empty-box.json — open empty box ─────────────────────────────────────────
{
  const layers = [];
  // Box base
  layers.push(
    shapeLayer({
      ind: 1,
      nm: "box",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 116, 0] },
          { t: 30, s: [100, 110, 0] },
          { t: 60, s: [100, 116, 0] },
          { t: 90, s: [100, 112, 0] },
          { t: 120, s: [100, 116, 0] },
        ]),
      },
      shapes: [rectShape(120, 88, 10), fillShape(CREAM), strokeShape([0.86, 0.82, 0.76], 5)],
    }),
  );
  // Flaps
  const flaps = [
    { pos: [100, 66, 0], size: [54, 26], rx: -28 },
    { pos: [100, 166, 0], size: [54, 26], rx: 28 },
    { pos: [42, 116, 0], size: [26, 54], rx: -28 },
    { pos: [158, 116, 0], size: [26, 54], rx: 28 },
  ];
  flaps.forEach((flap, i) => {
    layers.push(
      shapeLayer({
        ind: 2 + i,
        nm: `flap-${i}`,
        ks: {
          p: staticProp(flap.pos),
          r: keyframes([
            { t: 0, s: [flap.rx] },
            { t: 40, s: [flap.rx + 8] },
            { t: 80, s: [flap.rx] },
          ]),
        },
        shapes: [rectShape(flap.size[0], flap.size[1], 6), fillShape([0.93, 0.89, 0.82])],
      }),
    );
  });
  // Sad little dot
  layers.push(
    shapeLayer({
      ind: 6,
      nm: "empty-dot",
      ks: {
        p: keyframes([
          { t: 0, s: [100, 112, 0] },
          { t: 30, s: [100, 106, 0] },
          { t: 60, s: [100, 112, 0] },
          { t: 90, s: [100, 108, 0] },
          { t: 120, s: [100, 112, 0] },
        ]),
      },
      shapes: [ellipseShape(26, 26), strokeShape(TIKCHOP_CORAL_DEEP, 5)],
    }),
  );
  animations.push({ name: "empty-box", w: 200, h: 200, layers });
}

const written = build(animations);
console.log("Lottie animations written:", written.map((p) => path.basename(p)).join(", "));

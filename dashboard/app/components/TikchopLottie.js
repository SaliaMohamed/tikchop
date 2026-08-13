"use client";

import dynamic from "next/dynamic";

const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false },
);

const ANIMATIONS = {
  chat: "/lottie/chat.json",
  success: "/lottie/success.json",
  coin: "/lottie/coin.json",
  truck: "/lottie/truck.json",
  sparkle: "/lottie/sparkle.json",
  "empty-box": "/lottie/empty-box.json",
};

/**
 * Lottie self-hosted animation. Loads the player on the client only (ssr:false)
 * and renders nothing while loading so the layout stays stable.
 */
export default function TikchopLottie({
  name,
  size = 160,
  className = "",
  loop = true,
  autoplay = true,
  speed = 1,
  style,
  ariaLabel = "",
}) {
  const src = ANIMATIONS[name];
  if (!src) return null;

  return (
    <Player
      src={src}
      loop={loop}
      autoplay={autoplay}
      speed={speed}
      className={className}
      style={{ width: size, height: size, ...style }}
      aria-label={ariaLabel || `Animation ${name}`}
    />
  );
}

export { ANIMATIONS as TIKCHOP_LOTTIE };

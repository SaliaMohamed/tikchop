/**
 * TikChop Illustration Library
 * Premium, animated inline SVG illustrations using the TikChop design system.
 * Self-contained styles and CSS keyframes for fluid, hardware-accelerated animations.
 * Colors: Dark #07120d | Green #008f5a | Mint #39f58e | Cream #fbf9f4 | White #ffffff
 */

import React from "react";

/** Empty catalogue / no products */
export function IllustrationEmptyShop({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="emptyShopBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#bbfcdc" />
        </linearGradient>
        <filter id="emptyShopShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#07120d" floodOpacity="0.08" />
        </filter>
        <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <style>{`
        @keyframes esFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes esPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(57, 245, 142, 0.4)); }
          50% { transform: scale(1.06); filter: drop-shadow(0 0 10px rgba(57, 245, 142, 0.85)); }
        }
        @keyframes esSpin {
          0% { transform: rotate(0deg) scale(0.95); opacity: 0.6; }
          50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
          100% { transform: rotate(360deg) scale(0.95); opacity: 0.6; }
        }
        .es-main { transform-origin: 80px 80px; }
        .es-bag { animation: esFloat 4s ease-in-out infinite; transform-origin: 80px 85px; }
        .es-plus { animation: esPulse 2.5s ease-in-out infinite; transform-origin: 80px 75px; }
        .es-star-1 { animation: esSpin 3s linear infinite; transform-origin: 48px 48px; }
        .es-star-2 { animation: esSpin 4.5s linear infinite; transform-origin: 118px 52px; }
      `}</style>

      {/* Background circle */}
      <circle cx="80" cy="80" r="72" fill="url(#emptyShopBg)" />
      
      {/* Store shelf and structure */}
      <g className="es-main" filter="url(#emptyShopShadow)">
        {/* Store base back shadow */}
        <rect x="24" y="96" width="112" height="12" rx="6" fill="#008f5a" opacity="0.14" />
        
        {/* Store stand shelf */}
        <rect x="28" y="94" width="104" height="6" rx="3" fill="#07120d" opacity="0.8" />
        
        {/* Striped Awning (Shop front canvas) */}
        <path d="M 32 46 L 128 46 L 122 62 C 122 62 118 64 114 62 C 110 60 106 62 106 62 C 106 62 102 64 98 62 C 94 60 90 62 90 62 C 90 62 86 64 82 62 C 78 60 74 62 74 62 C 74 62 70 64 66 62 C 62 60 58 62 58 62 C 58 62 54 64 50 62 C 46 60 42 62 42 62 Z" fill="#008f5a" />
        {/* White awning stripes */}
        <path d="M 46 46 L 54 46 L 50 62 L 42 62 Z" fill="#ffffff" opacity="0.9" />
        <path d="M 62 46 L 70 46 L 66 62 L 58 62 Z" fill="#ffffff" opacity="0.9" />
        <path d="M 78 46 L 86 46 L 82 62 L 74 62 Z" fill="#ffffff" opacity="0.9" />
        <path d="M 94 46 L 102 46 L 98 62 L 90 62 Z" fill="#ffffff" opacity="0.9" />
        <path d="M 110 46 L 118 46 L 114 62 L 106 62 Z" fill="#ffffff" opacity="0.9" />

        {/* Small products on shelf */}
        <g className="es-bag">
          <rect x="42" y="70" width="22" height="24" rx="5" fill="#ffffff" stroke="#008f5a" strokeWidth="1.5" />
          <path d="M 49 70 C 49 66, 57 66, 57 70" stroke="#008f5a" strokeWidth="1.5" fill="none" />
          <line x1="48" y1="78" x2="58" y2="78" stroke="#39f58e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="48" y1="83" x2="54" y2="83" stroke="#008f5a" strokeWidth="2" strokeLinecap="round" />

          <rect x="96" y="70" width="22" height="24" rx="5" fill="#ffffff" stroke="#008f5a" strokeWidth="1.5" />
          <path d="M 103 70 C 103 66, 111 66, 111 70" stroke="#008f5a" strokeWidth="1.5" fill="none" />
          <line x1="102" y1="78" x2="112" y2="78" stroke="#39f58e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="102" y1="83" x2="108" y2="83" stroke="#008f5a" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>

      {/* Center glowing add product circle */}
      <g className="es-plus" filter="url(#glowGreen)">
        <circle cx="80" cy="76" r="15" fill="#07120d" />
        <line x1="80" y1="70" x2="80" y2="82" stroke="#39f58e" strokeWidth="3" strokeLinecap="round" />
        <line x1="74" y1="76" x2="86" y2="76" stroke="#39f58e" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Sparkles */}
      <path className="es-star-1" d="M 48 44 L 50 48 L 54 50 L 50 52 L 48 56 L 46 52 L 42 50 L 46 48 Z" fill="#39f58e" />
      <path className="es-star-2" d="M 118 48 L 119 51 L 122 52 L 119 53 L 118 56 L 117 53 L 114 52 L 117 51 Z" fill="#008f5a" />
    </svg>
  );
}

/** WhatsApp / chat bubble illustration */
export function IllustrationWhatsApp({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c2016" />
          <stop offset="100%" stopColor="#040b07" />
        </linearGradient>
        <linearGradient id="waPhoneOutline" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#39f58e" />
          <stop offset="100%" stopColor="#008f5a" />
        </linearGradient>
        <filter id="waSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="10" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
        </filter>
        <filter id="waGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <style>{`
        @keyframes waFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-1deg); }
        }
        @keyframes waPulse {
          0% { r: 8px; opacity: 0.8; }
          100% { r: 22px; opacity: 0; }
        }
        @keyframes waDot {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        .wa-float-group { animation: waFloat 5s ease-in-out infinite; transform-origin: 80px 80px; }
        .wa-pulse-ring { animation: waPulse 2s cubic-bezier(0.24, 0, 0.38, 1) infinite; }
        .wa-dot-1 { animation: waDot 1.4s ease-in-out infinite; transform-origin: 65px 74px; }
        .wa-dot-2 { animation: waDot 1.4s ease-in-out infinite 0.2s; transform-origin: 80px 74px; }
        .wa-dot-3 { animation: waDot 1.4s ease-in-out infinite 0.4s; transform-origin: 95px 74px; }
      `}</style>

      {/* Deep circular background */}
      <circle cx="80" cy="80" r="72" fill="url(#waBgGrad)" />

      {/* Floating message system */}
      <g className="wa-float-group" filter="url(#waSoftShadow)">
        {/* Phone mockup */}
        <rect x="36" y="32" width="88" height="96" rx="18" fill="#141c18" stroke="url(#waPhoneOutline)" strokeWidth="2.5" />
        
        {/* Speaker & camera slot */}
        <rect x="70" y="39" width="20" height="3" rx="1.5" fill="#323c37" />
        <circle cx="94" cy="40.5" r="1.5" fill="#323c37" />

        {/* Outer pulsating wireless signal */}
        <circle cx="80" cy="74" r="18" fill="none" stroke="#39f58e" strokeWidth="1.5" className="wa-pulse-ring" />

        {/* Message bubble */}
        <rect x="46" y="52" width="68" height="42" rx="12" fill="#008f5a" />
        <path d="M56 94 L50 102 L64 94 Z" fill="#008f5a" />

        {/* Text lines inside bubble / avatar mock */}
        <circle cx="58" cy="62" r="3.5" fill="#ffffff" opacity="0.9" />
        <rect x="66" y="60" width="34" height="4" rx="2" fill="#ffffff" opacity="0.9" />
        
        {/* Wave/Pulse indicator dots */}
        <g>
          <circle cx="68" cy="78" r="3.5" fill="#39f58e" className="wa-dot-1" />
          <circle cx="80" cy="78" r="3.5" fill="#39f58e" className="wa-dot-2" />
          <circle cx="92" cy="78" r="3.5" fill="#39f58e" className="wa-dot-3" />
        </g>

        {/* Sparkle details */}
        <circle cx="118" cy="46" r="2.5" fill="#39f58e" filter="url(#waGlow)" />
        <circle cx="44" cy="116" r="3" fill="#39f58e" />
      </g>
    </svg>
  );
}

/** Shopping cart / orders illustration */
export function IllustrationCart({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cartBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#c2fcd5" />
        </linearGradient>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#39f58e" />
          <stop offset="100%" stopColor="#008f5a" />
        </linearGradient>
        <filter id="cartShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="3" dy="9" stdDeviation="5" floodColor="#07120d" floodOpacity="0.07" />
        </filter>
      </defs>
      <style>{`
        @keyframes cartFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(1deg); }
        }
        @keyframes receiptFloat {
          0%, 100% { transform: translateY(0px) skewY(0deg); }
          50% { transform: translateY(-4px) skewY(1deg); }
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(57,245,142,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(57,245,142,0); }
        }
        .cart-body { animation: cartFloat 4s ease-in-out infinite; transform-origin: 80px 80px; }
        .receipt-wave { animation: receiptFloat 3.6s ease-in-out infinite; transform-origin: 90px 45px; }
        .badge-pulsing { animation: badgePulse 2s ease-in-out infinite; transform-origin: 114px 44px; }
      `}</style>

      {/* Gradient Mint Background */}
      <circle cx="80" cy="80" r="72" fill="url(#cartBgGrad)" />

      {/* Floating Receipt */}
      <g className="receipt-wave" filter="url(#cartShadow)">
        <path d="M 82 28 L 108 24 L 118 78 L 92 82 Z" fill="#ffffff" />
        {/* Zigzag bottom for receipt */}
        <path d="M 92 82 L 95 78 L 98 82 L 101 78 L 104 82 L 107 78 L 110 82 L 113 78 L 116 82 L 118 78 L 118 80 L 92 82" fill="#ffffff" />
        {/* Lines on receipt */}
        <line x1="88" y1="36" x2="102" y2="34" stroke="#008f5a" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="90" y1="44" x2="104" y2="42" stroke="#07120d" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
        <line x1="92" y1="52" x2="106" y2="50" stroke="#07120d" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 1" />
        <line x1="94" y1="60" x2="108" y2="58" stroke="#008f5a" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Main Cart Body */}
      <g className="cart-body" filter="url(#cartShadow)">
        {/* Cart items visual representations */}
        <rect x="62" y="62" width="16" height="24" rx="4" fill="#008f5a" opacity="0.35" transform="rotate(-6 62 62)" />
        <rect x="76" y="60" width="18" height="22" rx="4" fill="#39f58e" opacity="0.6" transform="rotate(4 76 60)" />

        {/* Wireframe basket metal */}
        <path
          d="M 34 50 L 46 50 L 58 90 L 108 90 L 118 58 L 52 58"
          stroke="#008f5a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Basket grids */}
        <line x1="66" y1="58" x2="72" y2="90" stroke="#008f5a" strokeWidth="2" opacity="0.5" />
        <line x1="82" y1="58" x2="86" y2="90" stroke="#008f5a" strokeWidth="2" opacity="0.5" />
        <line x1="98" y1="58" x2="100" y2="90" stroke="#008f5a" strokeWidth="2" opacity="0.5" />
        <line x1="52" y1="74" x2="112" y2="74" stroke="#008f5a" strokeWidth="2" opacity="0.5" />

        {/* Trolley handle */}
        <path d="M 34 50 L 26 44 L 28 38" stroke="#07120d" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Wheels */}
        <circle cx="68" cy="99" r="8" fill="#07120d" />
        <circle cx="68" cy="99" r="3.5" fill="#39f58e" />
        <circle cx="98" cy="99" r="8" fill="#07120d" />
        <circle cx="98" cy="99" r="3.5" fill="#39f58e" />
      </g>

      {/* Floating Success Check badge */}
      <g className="badge-pulsing" filter="url(#cartShadow)">
        <circle cx="114" cy="44" r="13" fill="url(#badgeGrad)" />
        <path
          d="M 107 44 L 111 48 L 120 38"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/** Delivery / truck illustration */
export function IllustrationDelivery({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="deliveryBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#b4fed2" />
        </linearGradient>
        <linearGradient id="truckBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0b1e15" />
          <stop offset="100%" stopColor="#040b07" />
        </linearGradient>
        <filter id="truckShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="8" stdDeviation="5" floodColor="#07120d" floodOpacity="0.08" />
        </filter>
      </defs>
      <style>{`
        @keyframes truckRide {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        @keyframes speedLine {
          0% { stroke-dashoffset: 40; opacity: 0.1; }
          50% { opacity: 0.7; }
          100% { stroke-dashoffset: 0; opacity: 0.1; }
        }
        @keyframes pinPulse {
          0% { transform: scale(0.85); opacity: 0.4; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.4; }
        }
        @keyframes waveRadar {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .tr-truck { animation: truckRide 0.28s linear infinite; }
        .tr-speed-1 { animation: speedLine 1.2s linear infinite; stroke-dasharray: 12 12; }
        .tr-speed-2 { animation: speedLine 1.2s linear infinite 0.6s; stroke-dasharray: 15 15; }
        .tr-pin { animation: pinPulse 2s ease-in-out infinite; transform-origin: 120px 48px; }
        .tr-radar { animation: waveRadar 2s cubic-bezier(0.2, 0, 0.4, 1) infinite; transform-origin: 120px 65px; }
      `}</style>

      {/* BG Circle */}
      <circle cx="80" cy="80" r="72" fill="url(#deliveryBg)" />

      {/* Ground road */}
      <rect x="20" y="116" width="120" height="4" rx="2" fill="#008f5a" opacity="0.2" />

      {/* Radar waves beneath pin */}
      <ellipse cx="120" cy="65" rx="14" ry="4" fill="none" stroke="#39f58e" strokeWidth="2" className="tr-radar" />

      {/* Map Pin Point */}
      <g className="tr-pin" filter="url(#truckShadow)">
        <path d="M 120 64 C 120 64 129 55 129 48 C 129 41 123 36 120 36 C 117 36 111 41 111 48 C 111 55 120 64 120 64 Z" fill="#008f5a" />
        <circle cx="120" cy="47" r="4.5" fill="#ffffff" />
      </g>

      {/* Animated speed paths */}
      <line x1="12" y1="84" x2="38" y2="84" stroke="#008f5a" strokeWidth="2.5" strokeLinecap="round" className="tr-speed-1" />
      <line x1="16" y1="94" x2="46" y2="94" stroke="#008f5a" strokeWidth="2" strokeLinecap="round" className="tr-speed-2" />

      {/* Delivery Truck */}
      <g className="tr-truck" filter="url(#truckShadow)">
        {/* Main cargo container */}
        <rect x="36" y="62" width="62" height="40" rx="8" fill="url(#truckBody)" />
        
        {/* Modern styled cabin */}
        <path d="M 98 68 L 122 68 C 126 68 128 72 129 76 L 132 88 L 132 102 L 98 102 Z" fill="#008f5a" />
        <rect x="98" y="62" width="3" height="40" fill="#07120d" opacity="0.2" />

        {/* Windows */}
        <path d="M 104 74 L 118 74 L 122 84 L 104 84 Z" fill="#eafff3" opacity="0.8" />

        {/* Eco Leaf Branding logo on cargo panel */}
        <path d="M 64 74 C 64 74, 72 74, 76 80 C 72 84, 64 80, 64 80 Z" fill="#39f58e" />
        <line x1="64" y1="80" x2="76" y2="74" stroke="#008f5a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

        {/* Wheels */}
        <circle cx="56" cy="104" r="10" fill="#07120d" />
        <circle cx="56" cy="104" r="4" fill="#39f58e" />
        <circle cx="108" cy="104" r="10" fill="#07120d" />
        <circle cx="108" cy="104" r="4" fill="#39f58e" />
      </g>
    </svg>
  );
}

/** Rocket launch / onboarding hero */
export function IllustrationRocket({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rocketBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0c1d16" />
          <stop offset="100%" stopColor="#040b07" />
        </linearGradient>
        <linearGradient id="rocketFire" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#39f58e" />
          <stop offset="50%" stopColor="#ffb000" />
          <stop offset="100%" stopColor="#ff3a3a" stopOpacity="0" />
        </linearGradient>
        <filter id="rocketShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-2" dy="8" stdDeviation="5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <style>{`
        @keyframes rocketFloat {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-3px, -6px) rotate(-1.5deg); }
        }
        @keyframes fireBlast {
          0%, 100% { transform: scaleY(0.9); opacity: 0.8; }
          50% { transform: scaleY(1.2); opacity: 1; }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .ro-ship { animation: rocketFloat 4s ease-in-out infinite; transform-origin: 80px 80px; }
        .ro-fire { animation: fireBlast 0.15s linear infinite; transform-origin: 80px 96px; }
        .ro-star-1 { animation: starTwinkle 2s infinite; transform-origin: 36px 40px; }
        .ro-star-2 { animation: starTwinkle 3s infinite 1s; transform-origin: 126px 36px; }
        .ro-star-3 { animation: starTwinkle 2.5s infinite 0.5s; transform-origin: 130px 80px; }
      `}</style>

      {/* Deep dark space circle background */}
      <circle cx="80" cy="80" r="72" fill="url(#rocketBg)" />

      {/* Floating mini planet with rings */}
      <g opacity="0.3">
        <circle cx="116" cy="116" r="10" fill="#008f5a" />
        <ellipse cx="116" cy="116" rx="16" ry="3" fill="none" stroke="#39f58e" strokeWidth="1.5" transform="rotate(-15 116 116)" />
      </g>

      {/* Twinkling Space Stars */}
      <path className="ro-star-1" d="M 36 36 L 37 39 L 40 40 L 37 41 L 36 44 L 35 41 L 32 40 L 35 39 Z" fill="#39f58e" />
      <path className="ro-star-2" d="M 126 32 L 127 35 L 130 36 L 127 37 L 126 40 L 125 37 L 122 36 L 125 35 Z" fill="#ffffff" />
      <circle className="ro-star-3" cx="130" cy="80" r="2.5" fill="#39f58e" />
      <circle cx="28" cy="74" r="1.5" fill="#008f5a" opacity="0.6" />

      {/* The Rocket Ship and Propulsion */}
      <g className="ro-ship" filter="url(#rocketShadow)">
        {/* Fire trail */}
        <path d="M 68 96 Q 80 134 80 138 Q 80 134 92 96 Z" fill="url(#rocketFire)" className="ro-fire" />
        <path d="M 74 96 Q 80 118 80 122 Q 80 118 86 96 Z" fill="#ffffff" opacity="0.8" className="ro-fire" />

        {/* Rocket wings / fins */}
        <path d="M 58 82 L 44 102 C 44 102 52 102 58 96 Z" fill="#008f5a" />
        <path d="M 102 82 L 116 102 C 116 102 108 102 102 96 Z" fill="#008f5a" />

        {/* Main capsule body */}
        <path d="M 80 26 C 80 26 58 52 58 84 L 80 96 L 102 84 C 102 52 80 26 80 26 Z" fill="#07120d" />
        <path d="M 80 26 C 80 26 80 96 80 96 Z" stroke="#39f58e" strokeWidth="1" opacity="0.15" />

        {/* Dashboard/Window glass */}
        <circle cx="80" cy="58" r="10" fill="#39f58e" opacity="0.25" />
        <circle cx="80" cy="58" r="6.5" fill="#ffffff" />
        <circle cx="78" cy="56" r="2" fill="#39f58e" />

        {/* Tip nose cone */}
        <path d="M 80 26 C 80 26 73 34 80 38 C 87 34 80 26 80 26 Z" fill="#39f58e" />
      </g>
    </svg>
  );
}

/** Payment / wallet illustration */
export function IllustrationPayment({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="payBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#c5ffd6" />
        </linearGradient>
        <linearGradient id="goldCoin" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe699" />
          <stop offset="100%" stopColor="#ffb000" />
        </linearGradient>
        <filter id="payShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="3" dy="10" stdDeviation="6" floodColor="#07120d" floodOpacity="0.08" />
        </filter>
      </defs>
      <style>{`
        @keyframes cardHover {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-5px) rotate(0deg); }
        }
        @keyframes glassCard {
          0%, 100% { transform: translateY(0px) rotate(4deg); }
          50% { transform: translateY(-7px) rotate(2deg); }
        }
        @keyframes coinBounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .pa-card-1 { animation: cardHover 5s ease-in-out infinite; transform-origin: 80px 80px; }
        .pa-card-2 { animation: glassCard 4.6s ease-in-out infinite; transform-origin: 80px 85px; }
        .pa-coin-1 { animation: coinBounce 3s ease-in-out infinite; transform-origin: 32px 108px; }
        .pa-coin-2 { animation: coinBounce 3.5s ease-in-out infinite 0.5s; transform-origin: 128px 104px; }
      `}</style>

      {/* Light minty background circle */}
      <circle cx="80" cy="80" r="72" fill="url(#payBg)" />

      {/* Card 1: Obsidian Black Premium Card */}
      <g className="pa-card-1" filter="url(#payShadow)">
        <rect x="26" y="44" width="96" height="58" rx="12" fill="#07120d" />
        {/* Magnetic stripe / wave grid */}
        <rect x="26" y="58" width="96" height="12" fill="#39f58e" opacity="0.1" />
        {/* Chip details */}
        <rect x="38" y="72" width="14" height="11" rx="2.5" fill="#39f58e" opacity="0.6" />
        <circle cx="102" cy="56" r="6" fill="#39f58e" />
        <circle cx="108" cy="56" r="6" fill="#ffffff" opacity="0.3" />
      </g>

      {/* Card 2: Glassmorphic Overlay Card */}
      <g className="pa-card-2" filter="url(#payShadow)">
        {/* Backdrop transparent card with white glowing outline */}
        <rect x="42" y="54" width="96" height="58" rx="12" fill="#ffffff" fillOpacity="0.4" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5" style={{ backdropFilter: "blur(5px)" }} />
        {/* Microchip */}
        <rect x="54" y="64" width="14" height="11" rx="2.5" fill="#ffe082" stroke="#ffb000" strokeWidth="1" />
        {/* Contactless waves symbol */}
        <path d="M 112 66 Q 115 69 112 72 M 115 63 Q 119 68 115 73 M 118 60 Q 123 68 118 76" stroke="#07120d" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        {/* Embossed mock numbers */}
        <rect x="54" y="88" width="14" height="4" rx="2" fill="#07120d" opacity="0.4" />
        <rect x="72" y="88" width="14" height="4" rx="2" fill="#07120d" opacity="0.4" />
        <rect x="90" y="88" width="14" height="4" rx="2" fill="#07120d" opacity="0.4" />
      </g>

      {/* Floating Gold Coin 1 */}
      <g className="pa-coin-1" filter="url(#payShadow)">
        <circle cx="32" cy="108" r="11" fill="url(#goldCoin)" />
        <circle cx="32" cy="108" r="8" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
        <text x="29" y="112" fontSize="11" fill="#4d3200" fontWeight="bold">F</text>
      </g>

      {/* Floating Gold Coin 2 */}
      <g className="pa-coin-2" filter="url(#payShadow)">
        <circle cx="128" cy="104" r="9" fill="url(#goldCoin)" />
        <circle cx="128" cy="104" r="6.5" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
        <text x="125" y="108" fontSize="9" fill="#4d3200" fontWeight="bold">F</text>
      </g>

      {/* Sparkles */}
      <circle cx="134" cy="46" r="2.5" fill="#39f58e" />
      <circle cx="26" cy="38" r="1.5" fill="#008f5a" />
    </svg>
  );
}

/** Success / order confirmed */
export function IllustrationSuccess({ size = 140, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="successBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#b1fecf" />
        </linearGradient>
        <linearGradient id="checkmarkShield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#39f58e" />
          <stop offset="100%" stopColor="#008f5a" />
        </linearGradient>
        <filter id="successShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="6" floodColor="#008f5a" floodOpacity="0.16" />
        </filter>
      </defs>
      <style>{`
        @keyframes checkDraw {
          from { stroke-dashoffset: 45; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiBurst {
          0% { transform: translateY(8px) scale(0.7); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateY(-16px) scale(1.1); opacity: 0; }
        }
        .su-bg { animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .su-checkmark {
          stroke-dasharray: 45;
          stroke-dashoffset: 45;
          animation: checkDraw 0.6s cubic-bezier(0.4, 0, 0.2, 1) both 0.35s;
        }
        .su-confetti-1 { animation: confettiBurst 2.2s ease-out infinite; transform-origin: 30px 48px; }
        .su-confetti-2 { animation: confettiBurst 2.5s ease-out infinite 0.3s; transform-origin: 110px 42px; }
        .su-confetti-3 { animation: confettiBurst 2s ease-out infinite 0.6s; transform-origin: 104px 92px; }
      `}</style>

      {/* Main glowing success background */}
      <circle cx="70" cy="70" r="62" fill="url(#successBg)" className="su-bg" />
      <circle cx="70" cy="70" r="46" fill="#39f58e" opacity="0.25" className="su-bg" />

      {/* Outer 3D style check circle */}
      <g filter="url(#successShadow)" className="su-bg">
        <circle cx="70" cy="70" r="32" fill="url(#checkmarkShield)" />
        {/* Animated Checkmark path */}
        <path
          d="M 54 70 L 65 81 L 88 54"
          stroke="#ffffff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="su-checkmark"
        />
      </g>

      {/* Confetti details */}
      <rect className="su-confetti-1" x="28" y="44" width="6" height="6" rx="2" fill="#ffb000" transform="rotate(25 28 44)" />
      <circle className="su-confetti-2" cx="110" cy="42" r="3.5" fill="#39f58e" />
      <path className="su-confetti-3" d="M 104 92 L 108 96 L 102 98 Z" fill="#008f5a" />

      <circle cx="34" cy="94" r="3" fill="#39f58e" opacity="0.6" />
      <circle cx="114" cy="78" r="2" fill="#008f5a" opacity="0.5" />
    </svg>
  );
}

/** No orders / empty state for orders page */
export function IllustrationNoOrders({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="noOrdersBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbf9f4" />
          <stop offset="100%" stopColor="#ebe7dc" />
        </linearGradient>
        <filter id="noOrdersShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#07120d" floodOpacity="0.06" />
        </filter>
      </defs>
      <style>{`
        @keyframes zzzFly {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          40% { opacity: 0.85; }
          100% { transform: translate(12px, -24px) scale(1.1); opacity: 0; }
        }
        @keyframes clipFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(0.5deg); }
        }
        .no-clip { animation: clipFloat 4.5s ease-in-out infinite; transform-origin: 80px 80px; }
        .no-z1 { animation: zzzFly 3s linear infinite; transform-origin: 94px 92px; }
        .no-z2 { animation: zzzFly 3s linear infinite 1s; transform-origin: 104px 84px; }
        .no-z3 { animation: zzzFly 3s linear infinite 2s; transform-origin: 114px 76px; }
      `}</style>

      {/* Background circle */}
      <circle cx="80" cy="80" r="72" fill="url(#noOrdersBg)" />

      {/* Floating Clipboard */}
      <g className="no-clip" filter="url(#noOrdersShadow)">
        {/* Wooden clipboard base */}
        <rect x="42" y="38" width="76" height="92" rx="14" fill="#ffffff" stroke="#07120d" strokeWidth="1.5" strokeOpacity="0.08" />
        
        {/* Metal clip on top */}
        <rect x="62" y="30" width="36" height="15" rx="7.5" fill="#07120d" />
        <rect x="70" y="35" width="20" height="4" rx="2" fill="#39f58e" />

        {/* Empty order sheet placeholder lines */}
        <rect x="54" y="60" width="52" height="5" rx="2.5" fill="#008f5a" opacity="0.12" />
        
        {/* Simulated dotted checkboxes list */}
        <circle cx="56" cy="80" r="4" fill="none" stroke="#008f5a" strokeWidth="1.5" />
        <rect x="66" y="78" width="38" height="4" rx="2" fill="#07120d" opacity="0.06" />

        <circle cx="56" cy="96" r="4" fill="none" stroke="#008f5a" strokeWidth="1.5" />
        <rect x="66" y="94" width="32" height="4" rx="2" fill="#07120d" opacity="0.06" />

        <circle cx="56" cy="112" r="4" fill="none" stroke="#008f5a" strokeWidth="1.5" />
        <rect x="66" y="110" width="24" height="4" rx="2" fill="#07120d" opacity="0.06" />
      </g>

      {/* Sleeping moon on a cloud illustration */}
      <g opacity="0.85">
        <path d="M 44 116 C 44 112, 52 110, 56 114 C 60 110, 68 112, 68 116" fill="#ffffff" />
      </g>

      {/* Floating animated sleep indicator "Zzz" bubble */}
      <text className="no-z1" x="90" y="90" fontSize="13" fill="#008f5a" fontWeight="900" opacity="0.6">z</text>
      <text className="no-z2" x="100" y="80" fontSize="17" fill="#39f58e" fontWeight="900" opacity="0.7">z</text>
      <text className="no-z3" x="110" y="70" fontSize="22" fill="#008f5a" fontWeight="900" opacity="0.5">Z</text>

      {/* Decorative stars */}
      <circle cx="34" cy="46" r="2.5" fill="#39f58e" />
      <circle cx="132" cy="50" r="2" fill="#39f58e" opacity="0.5" />
    </svg>
  );
}

/** Sharing / social illustration */
export function IllustrationShare({ size = 160, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="shareBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#b4ffd1" />
        </linearGradient>
        <filter id="shareShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#07120d" floodOpacity="0.08" />
        </filter>
      </defs>
      <style>{`
        @keyframes shareFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes networkPulse {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        .sh-phone { animation: shareFloat 4.5s ease-in-out infinite; transform-origin: 80px 80px; }
        .sh-line { stroke-dasharray: 6 6; animation: networkPulse 1.5s linear infinite; }
      `}</style>

      {/* BG Circle */}
      <circle cx="80" cy="80" r="72" fill="url(#shareBg)" />

      {/* Connection grid lines */}
      <line x1="80" y1="80" x2="38" y2="52" stroke="#008f5a" strokeWidth="2.5" strokeLinecap="round" className="sh-line" />
      <line x1="80" y1="80" x2="122" y2="56" stroke="#008f5a" strokeWidth="2.5" strokeLinecap="round" className="sh-line" />
      <line x1="80" y1="80" x2="114" y2="112" stroke="#008f5a" strokeWidth="2.5" strokeLinecap="round" className="sh-line" />

      {/* Floating social badges */}
      <g filter="url(#shareShadow)">
        <circle cx="38" cy="52" r="14" fill="#07120d" />
        <text x="32" y="57" fontSize="14" fill="#ffffff" fontWeight="bold">T</text>
        <circle cx="122" cy="56" r="14" fill="#25d366" />
        <text x="115" y="61" fontSize="14" fill="#ffffff" fontWeight="bold">W</text>
        <circle cx="114" cy="112" r="14" fill="#fe2c55" />
        <text x="108" y="117" fontSize="12" fill="#ffffff" fontWeight="bold">Tik</text>
      </g>

      {/* Main phone mockup */}
      <g className="sh-phone" filter="url(#shareShadow)">
        <rect x="58" y="38" width="44" height="84" rx="10" fill="#07120d" />
        {/* Screen */}
        <rect x="61" y="44" width="38" height="66" rx="6" fill="#ffffff" />
        {/* Top speaker bar */}
        <rect x="74" y="40.5" width="12" height="2" rx="1" fill="#ffffff" opacity="0.3" />
        {/* Share visual symbol on screen */}
        <circle cx="80" cy="74" r="8" fill="#39f58e" />
        <circle cx="73" cy="84" r="5" fill="#008f5a" />
        <circle cx="87" cy="84" r="5" fill="#008f5a" />
        <line x1="77" y1="79" x2="74" y2="82" stroke="#07120d" strokeWidth="1.5" />
        <line x1="83" y1="79" x2="86" y2="82" stroke="#07120d" strokeWidth="1.5" />
        {/* Home notch */}
        <circle cx="80" cy="115" r="2.5" fill="#ffffff" opacity="0.25" />
      </g>
    </svg>
  );
}

/** Search / filter illustration */
export function IllustrationSearch({ size = 120, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="searchBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#eafff3" />
          <stop offset="100%" stopColor="#c5fedb" />
        </linearGradient>
        <filter id="searchShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="6" stdDeviation="4" floodColor="#07120d" floodOpacity="0.06" />
        </filter>
      </defs>
      <style>{`
        @keyframes glassFloat {
          0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(3px, -3px) rotate(2deg); }
        }
        @keyframes pulseItem {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        .se-glass { animation: glassFloat 4s ease-in-out infinite; transform-origin: 52px 52px; }
        .se-item { animation: pulseItem 2.5s ease-in-out infinite; transform-origin: 52px 52px; }
      `}</style>

      {/* Circle bg */}
      <circle cx="60" cy="60" r="54" fill="url(#searchBg)" />

      {/* Catalog mock grid under glass */}
      <g opacity="0.25">
        <rect x="28" y="28" width="16" height="16" rx="4" fill="#008f5a" />
        <rect x="76" y="28" width="16" height="16" rx="4" fill="#008f5a" />
        <rect x="28" y="76" width="16" height="16" rx="4" fill="#008f5a" />
        <rect x="76" y="76" width="16" height="16" rx="4" fill="#008f5a" />
      </g>

      {/* Highlighted clothes catalog item */}
      <g className="se-item" filter="url(#searchShadow)">
        <circle cx="52" cy="52" r="16" fill="#39f58e" />
        {/* Dress layout hanger icon */}
        <path d="M 52 44 L 56 48 L 48 48 Z M 46 49 L 58 49 L 56 59 L 48 59 Z" fill="#008f5a" />
      </g>

      {/* Magnifier Glass */}
      <g className="se-glass" filter="url(#searchShadow)">
        {/* Metal ring handle */}
        <line x1="66" y1="66" x2="88" y2="88" stroke="#07120d" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="68" y1="68" x2="85" y2="85" stroke="#39f58e" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        
        {/* Glass lens body */}
        <circle cx="52" cy="52" r="21" stroke="#008f5a" strokeWidth="4.5" fill="#ffffff" fillOpacity="0.15" />
        {/* Shine glare on glass lens */}
        <path d="M 38 42 A 16 16 0 0 1 54 36" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* Sparkles */}
      <circle cx="94" cy="32" r="2.5" fill="#39f58e" />
      <circle cx="22" cy="58" r="1.5" fill="#008f5a" />
    </svg>
  );
}

/** TikChop brand mark – animated pulse */
export function IllustrationBrandPulse({ size = 80, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandT" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#39f58e" />
          <stop offset="100%" stopColor="#008f5a" />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#39f58e" floodOpacity="0.3" />
        </filter>
      </defs>
      <style>{`
        @keyframes ripple {
          0% { transform: scale(0.75); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes brandTFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        .bp-ripple-1 { animation: ripple 2s cubic-bezier(0.24, 0, 0.38, 1) infinite; transform-origin: 40px 40px; }
        .bp-ripple-2 { animation: ripple 2s cubic-bezier(0.24, 0, 0.38, 1) infinite 1s; transform-origin: 40px 40px; }
        .bp-t { animation: brandTFloat 3s ease-in-out infinite; transform-origin: 40px 40px; }
      `}</style>

      {/* Main black circle casing */}
      <circle cx="40" cy="40" r="36" fill="#07120d" />

      {/* Concentric ripples */}
      <circle className="bp-ripple-1" cx="40" cy="40" r="28" fill="none" stroke="#39f58e" strokeWidth="1.5" />
      <circle className="bp-ripple-2" cx="40" cy="40" r="28" fill="none" stroke="#39f58e" strokeWidth="1.5" />

      {/* Center T brand mark */}
      <g className="bp-t" filter="url(#logoGlow)">
        {/* Horizontal T bar */}
        <rect x="25" y="27" width="30" height="6" rx="3" fill="url(#brandT)" />
        {/* Vertical T stem */}
        <rect x="37" y="27" width="6" height="26" rx="3" fill="url(#brandT)" />
      </g>
    </svg>
  );
}

"use client";

export function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "h-2 w-6 bg-[#008f5a]"
              : i < current
              ? "h-2 w-2 bg-[#008f5a]/40"
              : "h-2 w-2 bg-[#07120d]/15"
          }`}
        />
      ))}
    </div>
  );
}
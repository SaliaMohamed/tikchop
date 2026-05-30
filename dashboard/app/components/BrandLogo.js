import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({
  href = "",
  label = "Tikchop",
  subtitle = "",
  size = "md",
  className = "",
}) {
  const imgSize = size === "lg" ? 52 : size === "sm" ? 34 : 40;

  const content = (
    <>
      <span className={`brand-logo-mark is-${size}`} aria-hidden="true">
        <Image
          src="/icon.svg"
          alt=""
          width={imgSize}
          height={imgSize}
          priority
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
      <span className="brand-logo-copy">
        <strong>{label}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </>
  );

  const classes = `brand-logo is-${size} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={`${label} accueil`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={classes} aria-label={label}>
      {content}
    </div>
  );
}

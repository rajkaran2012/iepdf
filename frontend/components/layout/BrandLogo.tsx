import Link from "next/link";

interface BrandLogoProps {
  variant?: "navbar" | "footer";
  href?: string;
}

export default function BrandLogo({
  variant = "navbar",
  href = "/",
}: BrandLogoProps) {
  const isFooter = variant === "footer";

  return (
    <Link
      href={href}
      aria-label="iePDF home"
      className="inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5CE2] focus-visible:ring-offset-2"
    >
      <svg
        width={isFooter ? 120 : 160}
        height={isFooter ? 36 : 48}
        viewBox="0 0 320 96"
        role="img"
        aria-labelledby="iepdf-brand-title"
        className="block"
      >
        <title id="iepdf-brand-title">iePDF</title>

        <rect
          x="4"
          y="4"
          width="88"
          height="88"
          rx="22"
          fill="#5B5CE2"
        />

        <path
          d="M30 24h27l15 15v33H30z"
          fill="#FFFFFF"
        />

        <path
          d="M57 24v16h15"
          fill="#D9DAFF"
        />

        <path
          d="M43 47l20 12-20 12z"
          fill="#22C7D6"
        />

        <text
          x="108"
          y="65"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="50"
          fontWeight="700"
          letterSpacing="-2"
          fill="#5B5CE2"
        >
          ie
        </text>

        <text
          x="157"
          y="65"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="50"
          fontWeight="800"
          letterSpacing="-2"
          fill="#22C7D6"
        >
          PDF
        </text>
      </svg>
    </Link>
  );
}

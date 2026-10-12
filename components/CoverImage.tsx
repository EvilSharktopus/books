"use client";

import { useState } from "react";
import { CoverSize, coverUrl } from "@/lib/coverUrl";

interface CoverImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: CoverSize;
  lazy?: boolean;
}

// Renders a stored cover at the best available resolution, falling back to
// the stored URL as-is if the upgraded one fails to load.
export default function CoverImage({
  src,
  alt = "",
  className,
  style,
  size = "full",
  lazy = false,
}: CoverImageProps) {
  const upgraded = coverUrl(src, size);
  // Remember which upgraded URL failed, so a new `src` retries automatically.
  const [failed, setFailed] = useState<string | null>(null);
  const current = failed === upgraded ? src : upgraded;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading={lazy ? "lazy" : undefined}
      onError={() => {
        if (current !== src) setFailed(current);
      }}
    />
  );
}

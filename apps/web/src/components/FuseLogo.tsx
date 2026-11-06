import React from "react";

export const FUSE_LOGO_PATHS = {
  inkBusbar: "M458 308H567V605L478 689V909H369V642L458 559V308Z",
  copperUpper: "M612 308H722V484L612 585V308Z",
  copperBranch: "M839 432H940V547H873L638 756V909H526V713L839 432Z",
} as const;

export const FUSE_LOGO_SAMPLED_COLORS = {
  ink: "#131216",
  copper: "#C24D08",
  background: "#FBF7EC",
  silhouette: "#CFC9BC",
} as const;

export interface FuseLogoMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Exact SVG master traced from the owner-supplied 1272x1236 PNG (4 Nov 2026).
 * Uses sampled colours (#131216 Carbon Ink busbar, #C24D08 Logo Copper paths)
 * with zero redraw or recolour.
 */
export function FuseLogoMark({
  size = 24,
  className,
  title = "Fuse",
}: FuseLogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="354 300 601 617"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      data-fuse-logo="mark"
    >
      <path d={FUSE_LOGO_PATHS.inkBusbar} fill={FUSE_LOGO_SAMPLED_COLORS.ink} />
      <path d={FUSE_LOGO_PATHS.copperUpper} fill={FUSE_LOGO_SAMPLED_COLORS.copper} />
      <path d={FUSE_LOGO_PATHS.copperBranch} fill={FUSE_LOGO_SAMPLED_COLORS.copper} />
    </svg>
  );
}

/**
 * Full 1272x1236 master SVG including the sampled #FBF7EC canvas.
 */
export function FuseLogoMaster({
  width = 318,
  height = 309,
  size,
  includeBackground = true,
  className,
}: {
  width?: number;
  height?: number;
  size?: number;
  includeBackground?: boolean;
  className?: string;
}) {
  const resolvedWidth = size ?? width;
  const resolvedHeight = size ? Math.round((size * 1236) / 1272) : height;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1272 1236"
      width={resolvedWidth}
      height={resolvedHeight}
      fill="none"
      aria-hidden="true"
      className={className}
      data-fuse-logo="master"
    >
      {includeBackground && (
        <rect width="1272" height="1236" fill={FUSE_LOGO_SAMPLED_COLORS.background} />
      )}
      <path d={FUSE_LOGO_PATHS.inkBusbar} fill={FUSE_LOGO_SAMPLED_COLORS.ink} />
      <path d={FUSE_LOGO_PATHS.copperUpper} fill={FUSE_LOGO_SAMPLED_COLORS.copper} />
      <path d={FUSE_LOGO_PATHS.copperBranch} fill={FUSE_LOGO_SAMPLED_COLORS.copper} />
    </svg>
  );
}

/**
 * Decorative footer silhouette (`#CFC9BC` on Warm Stone `#F6F4EE`),
 * large and cropped by the bottom edge of the page per DESIGN_SYSTEM.md Section 6.6.
 */
export function FuseLogoSilhouette({
  className,
  width = 680,
  color = FUSE_LOGO_SAMPLED_COLORS.silhouette,
}: {
  className?: string;
  width?: number;
  color?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={className ?? "fuse-footer-silhouette-wrap"}
      data-fuse-logo="silhouette"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="369 308 571 455"
        width={width}
        preserveAspectRatio="xMidYMin slice"
        fill="none"
        aria-hidden="true"
        className="fuse-footer-silhouette-svg"
        style={{ maxWidth: "100%", height: "auto", display: "block" }}
      >
        <path
          d={FUSE_LOGO_PATHS.inkBusbar}
          fill={color}
        />
        <path
          d={FUSE_LOGO_PATHS.copperUpper}
          fill={color}
        />
        <path
          d={FUSE_LOGO_PATHS.copperBranch}
          fill={color}
        />
      </svg>
    </div>
  );
}

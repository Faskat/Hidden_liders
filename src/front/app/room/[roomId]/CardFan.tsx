"use client";

import { Children, type ReactNode } from "react";

const TINY = { width: 80, height: 112, overlap: 32 };
const HAND = { width: 130, height: 182, overlap: 52 };

function getDimensions(fanSize: "tiny" | "hand") {
  const d = fanSize === "hand" ? HAND : TINY;
  const step = d.width - d.overlap;
  return { ...d, step };
}

export type FanDirection = "bottom" | "top" | "left" | "right" | "topLeft" | "topRight";

const MAX_ANGLE_DEG = 12;

/** Same horizontal fan as bottom — parent rotation (cardFaceRotation) turns it toward left/right player. */
function getFanStyle(
  index: number,
  total: number,
  direction: FanDirection,
  step: number,
  cardWidth: number,
  cardHeight: number
): React.CSSProperties {
  const n = total;
  const angle =
    n <= 1 ? 0 : -MAX_ANGLE_DEG + (2 * MAX_ANGLE_DEG / (n - 1)) * index;
  const base = { width: cardWidth, height: cardHeight, zIndex: index };

  const bottomStyle = {
    ...base,
    left: `${index * step}px`,
    top: 0,
    transform: `rotate(${angle}deg)`,
    transformOrigin: "center bottom",
  };

  switch (direction) {
    case "bottom":
    case "left":
    case "right":
      return bottomStyle;
    case "top":
      return {
        ...base,
        left: `${index * step}px`,
        top: 0,
        transform: `rotate(${-angle}deg)`,
        transformOrigin: "center top",
      };
    case "topLeft": {
      const d = step * 0.707;
      return {
        ...base,
        left: `${index * d}px`,
        top: `${index * d}px`,
        transform: `rotate(${angle}deg)`,
        transformOrigin: "left top",
      };
    }
    case "topRight": {
      const d = step * 0.707;
      return {
        ...base,
        right: `${index * d}px`,
        top: `${index * d}px`,
        left: "auto",
        transform: `rotate(${-angle}deg)`,
        transformOrigin: "right top",
      };
    }
  }
}

function getHoverTransform(direction: FanDirection, isHandSize: boolean): string {
  const lift = isHandSize ? 24 : 12;
  const diag = lift * 0.707;
  const liftUp = `scale(1.12) translateY(-${lift}px) rotate(0deg)`;
  switch (direction) {
    case "bottom":
    case "left":
    case "right":
      return liftUp;
    case "top":
      return `scale(1.12) translateY(${lift}px) rotate(0deg)`;
    case "topLeft":
      return `scale(1.12) translate(${diag}px, ${diag}px) rotate(0deg)`;
    case "topRight":
      return `scale(1.12) translate(-${diag}px, ${diag}px) rotate(0deg)`;
  }
}

export function CardFan({
  children,
  direction = "bottom",
  interactive = true,
  cardSize: fanSize = "tiny",
}: {
  children: ReactNode;
  direction?: FanDirection;
  interactive?: boolean;
  /** "hand" = large cards for player's hand at bottom */
  cardSize?: "tiny" | "hand";
}) {
  const items = Children.toArray(children).filter((c) => c != null);
  const n = items.length;
  if (n === 0) return null;

  const dim = getDimensions(fanSize);
  const hoverTransform = getHoverTransform(direction, fanSize === "hand");
  const isHorizontalFan = direction === "bottom" || direction === "top" || direction === "left" || direction === "right";
  const isDiagonal = direction === "topLeft" || direction === "topRight";
  const hoverMargin = fanSize === "hand" ? 32 : 24;
  const diagStep = dim.step * 0.707;
  const totalWidth = isDiagonal
    ? (n - 1) * diagStep + dim.width + hoverMargin
    : isHorizontalFan
      ? (n - 1) * dim.step + dim.width
      : dim.width + hoverMargin;
  const totalHeight = isDiagonal
    ? (n - 1) * diagStep + dim.height + hoverMargin
    : isHorizontalFan
      ? dim.height + hoverMargin
      : dim.height + hoverMargin;

  return (
    <div className="flex justify-center overflow-visible shrink-0">
      <div
        className="relative overflow-visible shrink-0"
        style={{
          width: totalWidth,
          height: totalHeight,
          minWidth: totalWidth,
          minHeight: totalHeight,
        }}
      >
        {items.map((child, i) => (
          <div
            key={i}
            className="absolute card-fan-outer shrink-0"
            style={getFanStyle(i, n, direction, dim.step, dim.width, dim.height)}
          >
            <div
              className={`card-fan-item transition-[transform] duration-200 ease-out ${interactive ? "cursor-pointer" : ""}`}
              style={{ ["--fan-hover" as string]: hoverTransform } as React.CSSProperties}
            >
              <div className="card-fan-item-inner transition-[transform] duration-200 ease-out">
                {child}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

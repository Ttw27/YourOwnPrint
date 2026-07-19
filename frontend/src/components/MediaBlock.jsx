import React from "react";

/**
 * Renders an admin-configured image OR short video at a chosen aspect ratio.
 *
 * Video plays instantly, silently and on loop — deliberately, because:
 *   - browsers block autoplay unless the video is muted, so muted it is;
 *   - a short silent loop reads as a moving image rather than "a video to
 *     watch", so it needs no controls and no play button.
 *
 * `media` comes straight from the page-copy CMS:
 *   { url: "https://…", kind: "image" | "video", ratio: "1:1" | "16:9" | "9:16" | "4:5" }
 *
 * Falls back to `children` (a placeholder) when nothing has been set yet, so
 * the page never renders an empty hole.
 */

const RATIO_CLASS = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "4:5": "aspect-[4/5]",
  "9:16": "aspect-[9/16]",
  "3:2": "aspect-[3/2]",
};

export const MEDIA_RATIOS = [
  { value: "1:1", label: "Square (1:1)" },
  { value: "16:9", label: "Landscape (16:9)" },
  { value: "4:5", label: "Portrait (4:5)" },
  { value: "9:16", label: "Vertical / phone (9:16)" },
  { value: "3:2", label: "Photo (3:2)" },
];

export default function MediaBlock({
  media,
  ratio: ratioOverride,
  className = "",
  fallbackClassName = "bg-[#f0fdf4]",
  children,
  testid = "media-block",
}) {
  const url = media?.url?.trim();
  const ratio = ratioOverride || media?.ratio || "1:1";
  const ratioClass = RATIO_CLASS[ratio] || RATIO_CLASS["1:1"];

  // Trust an explicit kind, otherwise infer from the file extension.
  const isVideo =
    media?.kind === "video" ||
    (!!url && /\.(mp4|webm|mov)(\?|$)/i.test(url));

  if (!url) {
    return (
      <div
        className={`rounded-3xl ${fallbackClassName} ${ratioClass} flex items-center justify-center overflow-hidden ${className}`}
        data-testid={`${testid}-placeholder`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl overflow-hidden ${ratioClass} ${className}`}
      data-testid={testid}
    >
      {isVideo ? (
        <video
          src={url}
          autoPlay
          muted           /* required — browsers block unmuted autoplay */
          loop
          playsInline     /* stops iOS forcing fullscreen */
          preload="metadata"
          className="w-full h-full object-cover"
          data-testid={`${testid}-video`}
        />
      ) : (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
          data-testid={`${testid}-image`}
        />
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import {
  DEFAULT_LIGHTNESS,
  hslCss,
  type HsColor,
} from "@/components/color-picker/utils";

type ColorPreviewProps = {
  color: HsColor;
  lightness?: number;
  className?: string;
};

export default function ColorPreview({
  color,
  lightness = DEFAULT_LIGHTNESS,
  className,
}: ColorPreviewProps) {
  return (
    <div
      className={cn("h-20 w-full rounded-md border shadow-sm", className)}
      style={{
        backgroundColor: hslCss(color.hue, color.saturation, lightness),
      }}
      aria-hidden
    />
  );
}

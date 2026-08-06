import ColorPreview from "@/components/color-picker/ColorPreview";
import GradientRange from "@/components/color-picker/GradientRange";
import {
  DEFAULT_LIGHTNESS,
  HUE_GRADIENT,
  saturationGradient,
  type HsColor,
} from "@/components/color-picker/utils";
import { cn } from "@/lib/utils";

type HsColorPickerProps = {
  value: HsColor;
  onChange: (color: HsColor) => void;
  onBlur?: () => void;
  lightness?: number;
  className?: string;
};

export default function HsColorPicker({
  value,
  onChange,
  onBlur,
  lightness = DEFAULT_LIGHTNESS,
  className,
}: HsColorPickerProps) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <ColorPreview color={value} lightness={lightness} />
      <GradientRange
        label={`Hue (${value.hue}°)`}
        min={0}
        max={360}
        value={value.hue}
        trackBackground={HUE_GRADIENT}
        onChange={(e) =>
          onChange({ ...value, hue: Number(e.target.value) })
        }
        onBlur={onBlur}
      />
      <GradientRange
        label={`Saturación (${value.saturation}%)`}
        min={0}
        max={100}
        value={value.saturation}
        trackBackground={saturationGradient(value.hue, lightness)}
        onChange={(e) =>
          onChange({ ...value, saturation: Number(e.target.value) })
        }
      />
    </div>
  );
}

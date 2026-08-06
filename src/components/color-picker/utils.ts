export const DEFAULT_LIGHTNESS = 50;

export type HsColor = {
  hue: number;
  saturation: number;
};

export function hslCss(hue: number, saturation: number, lightness: number) {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export const HUE_GRADIENT =
  "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))";

export function saturationGradient(
  hue: number,
  lightness: number = DEFAULT_LIGHTNESS,
) {
  return `linear-gradient(to right, ${hslCss(hue, 0, lightness)}, ${hslCss(hue, 100, lightness)})`;
}

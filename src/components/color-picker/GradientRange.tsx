import { cn } from "@/lib/utils";

type GradientRangeProps = Omit<
  React.ComponentProps<"input">,
  "type" | "style"
> & {
  trackBackground: string;
  label: string;
};

export default function GradientRange({
  trackBackground,
  label,
  className,
  value,
  ...props
}: GradientRangeProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        type="range"
        value={value}
        aria-label={label}
        className={cn("gradient-range", className)}
        style={
          {
            "--slider-bg": trackBackground,
          } as React.CSSProperties
        }
        {...props}
      />
    </div>
  );
}

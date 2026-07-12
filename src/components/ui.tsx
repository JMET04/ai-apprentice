import { cn } from "@/lib/utils";

export function Surface({
  children,
  className
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-line bg-white p-5 shadow-soft", className)}>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: Readonly<{ children: React.ReactNode; tone?: "neutral" | "teal" | "amber" | "blue" }>) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700"
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <label className="text-xs font-semibold uppercase text-slate-500">{children}</label>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-apprentice-teal px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50",
        props.className
      )}
    />
  );
}

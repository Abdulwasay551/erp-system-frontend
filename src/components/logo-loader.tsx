import Image from "next/image";

/**
 * Branded loading state - a pulsing/rotating store logo instead of a generic spinner.
 * Used on the pages that feel most like a "home base" (Dashboard, Accounting) so the
 * loading moment still reads as this app rather than a stock UI kit.
 */
export function LogoLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="relative flex size-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
        <span className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin [animation-duration:2.2s]" />
        <Image
          src="/logo.jpg"
          alt=""
          width={40}
          height={40}
          className="relative size-10 rounded-full object-contain animate-pulse"
          priority
        />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Logo da MSM (public/logo.svg). Substitua o arquivo pelo logo oficial. */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logo.src}
      alt={brand.logo.alt}
      width={brand.logo.width}
      height={brand.logo.height}
      className={cn("h-9 w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Faixa laranja fina no topo de todas as telas. */
export function BrandStripe({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-1 w-full shrink-0 bg-brand", className)} />;
}

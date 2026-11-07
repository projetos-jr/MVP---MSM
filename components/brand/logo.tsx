import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * Logo oficial da MSM (public/logo.png). Para trocar, substitua o arquivo.
 * A altura é definida pela classe (ex.: "h-10"); a largura acompanha.
 */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logo.src}
      alt={brand.logo.alt}
      width={brand.logo.width}
      height={brand.logo.height}
      className={cn("h-10 w-auto select-none", className)}
      draggable={false}
      fetchPriority={priority ? "high" : undefined}
    />
  );
}

/** Só as letras "MSM" do logo (avatar do assistente, espaços pequenos). */
export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logoMark.src}
      alt={brand.logoMark.alt}
      width={brand.logoMark.width}
      height={brand.logoMark.height}
      className={cn("h-4 w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Faixa laranja fina no topo de todas as telas. */
export function BrandStripe({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-1 w-full shrink-0 bg-brand", className)} />;
}

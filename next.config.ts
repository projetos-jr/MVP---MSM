import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse usa require() dinâmico internamente; fica fora do bundle.
  serverExternalPackages: ["pdf-parse"],
  // Garante que os arquivos usados em tempo de execução vão para as funções
  // da Vercel: seed-docs/ (modo de teste) e o pdf.js usado pelo pdf-parse.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./seed-docs/**/*",
      "./node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/*.js",
    ],
    "/documentos/**/*": ["./seed-docs/**/*"],
  },
  poweredByHeader: false,
};

export default nextConfig;

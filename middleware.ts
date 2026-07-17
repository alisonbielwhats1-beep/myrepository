import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas, exceto assets estáticos, imagens e o service
     * worker/manifest do PWA.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|videos/|.*\\.(?:svg|png|jpg|jpeg|webp|webm|mp4)$).*)",
  ],
};

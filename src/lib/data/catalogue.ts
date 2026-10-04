"use client";
// The public catalogue (salon, styles, options) for visitors who haven't signed in:
// from the real salon when one is connected (anyone may read it), else the demo's.
import { useEffect, useState } from "react";
import type { Salon, Style, StyleOption } from "../domain/types";
import { buildWorld } from "../demo/seed";
import { supabaseConfigured } from "../supabase/config";

export type Catalogue = { salon: Salon; styles: Style[]; options: StyleOption[] };

function demoCatalogue(): Catalogue {
  const w = buildWorld();
  return { salon: w.salon, styles: w.styles.filter((s) => s.active), options: w.options };
}

async function realCatalogue(): Promise<Catalogue | null> {
  const { supabase } = await import("../supabase/client");
  const sb = supabase();
  const [salon, styles, options] = await Promise.all([
    sb.from("salon").select("*").limit(1).maybeSingle(),
    sb.from("styles").select("*").eq("active", true).order("sort"),
    sb.from("style_options").select("*").order("sort"),
  ]);
  if (!salon.data || styles.error || options.error) return null;
  return {
    salon: salon.data as Salon,
    styles: (styles.data as Style[]).map((s) => ({ ...s, price: Number(s.price) })),
    options: (options.data as StyleOption[]).map((o) => ({ ...o, extra_price: Number(o.extra_price) })),
  };
}

/** The catalogue, or null while it loads. */
export function useCatalogue(): Catalogue | null {
  const [c, setC] = useState<Catalogue | null>(null);
  useEffect(() => {
    let live = true;
    (supabaseConfigured() ? realCatalogue().catch(() => null) : Promise.resolve(null))
      .then((real) => { if (live) setC(real ?? demoCatalogue()); });
    return () => { live = false; };
  }, []);
  return c;
}

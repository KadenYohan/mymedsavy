import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InteractionResult {
  drug1: string;
  drug2: string;
  severity: "high" | "moderate" | "low";
  summary: string;
  rawMatch: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { medications } = await req.json();
    if (!medications || !Array.isArray(medications) || medications.length < 2) {
      return new Response(
        JSON.stringify({ interactions: [], message: "Need at least 2 medications to check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch interaction/contraindication text for each drug from openFDA
    const drugData: Record<string, { interactions: string; contraindications: string; brandNames: string[]; genericNames: string[] }> = {};

    await Promise.all(
      medications.map(async (drugName: string) => {
        try {
          const encoded = encodeURIComponent(drugName);
          const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"+openfda.generic_name:"${encoded}"&limit=1`;
          const resp = await fetch(url);
          if (!resp.ok) {
            drugData[drugName] = { interactions: "", contraindications: "", brandNames: [drugName], genericNames: [] };
            return;
          }
          const json = await resp.json();
          const result = json.results?.[0];
          if (!result) {
            drugData[drugName] = { interactions: "", contraindications: "", brandNames: [drugName], genericNames: [] };
            return;
          }
          drugData[drugName] = {
            interactions: (result.drug_interactions || []).join(" "),
            contraindications: (result.contraindications || []).join(" "),
            brandNames: result.openfda?.brand_name || [drugName],
            genericNames: result.openfda?.generic_name || [],
          };
        } catch {
          drugData[drugName] = { interactions: "", contraindications: "", brandNames: [drugName], genericNames: [] };
        }
      })
    );

    // Cross-reference: check if drug B's names appear in drug A's interaction text
    const rawInteractions: { drug1: string; drug2: string; matchedText: string }[] = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const drugA = medications[i];
        const drugB = medications[j];
        const dataA = drugData[drugA];
        const dataB = drugData[drugB];

        const textA = (dataA.interactions + " " + dataA.contraindications).toLowerCase();
        const textB = (dataB.interactions + " " + dataB.contraindications).toLowerCase();

        // Check if drug B names appear in drug A text
        const allNamesB = [...dataB.brandNames, ...dataB.genericNames].filter(Boolean);
        const allNamesA = [...dataA.brandNames, ...dataA.genericNames].filter(Boolean);

        let matchedText = "";

        for (const name of allNamesB) {
          if (name.length >= 3 && textA.includes(name.toLowerCase())) {
            // Extract surrounding context (150 chars around match)
            const idx = textA.indexOf(name.toLowerCase());
            const start = Math.max(0, idx - 100);
            const end = Math.min(textA.length, idx + name.length + 100);
            matchedText = textA.slice(start, end);
            break;
          }
        }

        if (!matchedText) {
          for (const name of allNamesA) {
            if (name.length >= 3 && textB.includes(name.toLowerCase())) {
              const idx = textB.indexOf(name.toLowerCase());
              const start = Math.max(0, idx - 100);
              const end = Math.min(textB.length, idx + name.length + 100);
              matchedText = textB.slice(start, end);
              break;
            }
          }
        }

        if (matchedText) {
          rawInteractions.push({ drug1: drugA, drug2: drugB, matchedText });
        }
      }
    }

    if (rawInteractions.length === 0) {
      return new Response(
        JSON.stringify({ interactions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Summarize with AI
    const interactionDescriptions = rawInteractions
      .map((r, i) => `${i + 1}. ${r.drug1} + ${r.drug2}: "${r.matchedText}"`)
      .join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a pharmacist assistant. For each drug interaction, provide:
1. A severity level: "high", "moderate", or "low"
2. A 1-2 sentence patient-friendly explanation of why they interact and what risks exist.
Be informative but gentle — don't alarm the patient unnecessarily.
Return ONLY valid JSON: an array of objects with keys "index" (1-based), "severity", "summary".`,
          },
          {
            role: "user",
            content: `Summarize these drug interactions for patients:\n${interactionDescriptions}`,
          },
        ],
      }),
    });

    let summaries: { index: number; severity: string; summary: string }[] = [];

    if (aiResp.ok) {
      const aiJson = await aiResp.json();
      const content = aiJson.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) summaries = JSON.parse(jsonMatch[0]);
      } catch {
        // fallback below
      }
    }

    const interactions: InteractionResult[] = rawInteractions.map((r, i) => {
      const ai = summaries.find((s) => s.index === i + 1);
      return {
        drug1: r.drug1,
        drug2: r.drug2,
        severity: (ai?.severity as "high" | "moderate" | "low") || "moderate",
        summary: ai?.summary || `A potential interaction was found between ${r.drug1} and ${r.drug2}. Please consult your healthcare provider.`,
        rawMatch: r.matchedText.slice(0, 200),
      };
    });

    return new Response(
      JSON.stringify({ interactions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-interactions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

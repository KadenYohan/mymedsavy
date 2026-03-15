import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { drugName } = await req.json();
    if (!drugName) throw new Error("drugName is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // 1. Fetch from openFDA
    const encodedName = encodeURIComponent(drugName);
    const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodedName}"+openfda.generic_name:"${encodedName}"&limit=1`;

    const fdaResp = await fetch(fdaUrl);
    let rawData: { indications: string; adverse: string; interactions: string } = {
      indications: "",
      adverse: "",
      interactions: "",
    };

    if (fdaResp.ok) {
      const fdaJson = await fdaResp.json();
      const result = fdaJson.results?.[0];
      if (result) {
        rawData.indications = (result.indications_and_usage || []).join(" ").slice(0, 3000);
        rawData.adverse = (result.adverse_reactions || []).join(" ").slice(0, 3000);
        rawData.interactions =
          ((result.drug_interactions || result.contraindications || []).join(" ")).slice(0, 3000);
      }
    }

    const hasAnyData = rawData.indications || rawData.adverse || rawData.interactions;

    if (!hasAnyData) {
      return new Response(
        JSON.stringify({
          indications: "Information not currently available for this medication.",
          adverse: "Information not currently available for this medication.",
          interactions: "Information not currently available for this medication.",
          source: "none",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Summarize with AI
    const systemPrompt = `You are a friendly pharmacist assistant. Summarize drug information for patients in plain, gentle language.
Rules:
- Use short bullet points (3-5 per section max)
- Avoid scary medical jargon — use everyday words
- Be informative but reassuring in tone
- If a section has no data, say "Information not currently available"
- Return ONLY valid JSON with exactly these keys: "indications", "adverse", "interactions"
- Each value should be a string with bullet points separated by newlines, each starting with "• "`;

    const userPrompt = `Summarize this drug information for "${drugName}" into patient-friendly bullet points:

INDICATIONS AND USAGE:
${rawData.indications || "No data available"}

ADVERSE REACTIONS:
${rawData.adverse || "No data available"}

DRUG INTERACTIONS / CONTRAINDICATIONS:
${rawData.interactions || "No data available"}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      throw new Error("AI summarization failed");
    }

    const aiJson = await aiResp.json();
    const content = aiJson.choices?.[0]?.message?.content || "";

    // Parse the JSON from AI response
    let summary;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      summary = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      summary = null;
    }

    if (!summary) {
      summary = {
        indications: rawData.indications ? "• " + rawData.indications.slice(0, 200) : "Information not currently available.",
        adverse: rawData.adverse ? "• " + rawData.adverse.slice(0, 200) : "Information not currently available.",
        interactions: rawData.interactions ? "• " + rawData.interactions.slice(0, 200) : "Information not currently available.",
      };
    }

    return new Response(JSON.stringify({ ...summary, source: "openfda" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("drug-info error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

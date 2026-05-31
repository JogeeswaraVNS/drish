import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

function parseGeminiJson(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error("No JSON object found");
    let depth = 0,
      end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) throw new Error("Malformed JSON");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { generationId, frameNumber } = await req.json();
    if (!generationId) throw new Error("Missing generationId");
    if (!frameNumber) throw new Error("Missing frameNumber");

    const { data: gen, error: fetchErr } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .single();

    if (fetchErr || !gen) throw new Error("Generation not found");
    if (!gen.ad_plan) throw new Error("No ad plan found");

    const adPlan = gen.ad_plan as any;
    const frame = adPlan.frames?.find(
      (f: any) => f.frame_number === frameNumber,
    );
    if (!frame) throw new Error(`Frame ${frameNumber} not found in ad plan`);

    const frame1Prompt =
      adPlan.frames?.find((f: any) => f.frame_number === 1)
        ?.image_generation_prompt || "";

    const rewriteInstruction = `You are an expert advertising photographer. Rewrite the following image generation prompt for frame ${frameNumber} (${frame.label}) of an ad carousel.

Product: ${gen.product_description}
Category: ${gen.product_category}
Frame 1 visual anchor prompt: ${frame1Prompt}
Frame label: ${frame.label}
Frame scene: ${frame.scene_description}

Current prompt: ${frame.image_generation_prompt}

IMPORTANT: ${
      frameNumber === 1
        ? "This is Frame 1 — the visual anchor. The rewritten prompt must be exceptionally detailed: environment, lighting, mood, color palette, photography style, camera angle, props, surfaces. Every subsequent frame depends on this visual foundation."
        : "This frame must maintain visual continuity with Frame 1. Include phrases like 'continuing in the same environment', 'same lighting and color palette', 'same visual style' naturally in the prompt."
    }

Return a JSON object with exactly one key: {"image_generation_prompt": "...your new prompt..."}`;

    const response = await fetch(
      `${GEMINI_API_URL}/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: rewriteInstruction }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.9,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("No text in Gemini response");

    const parsed = parseGeminiJson(rawText);
    const newPrompt = parsed.image_generation_prompt;
    if (!newPrompt) throw new Error("No image_generation_prompt in response");

    const frameIdx = adPlan.frames.findIndex(
      (f: any) => f.frame_number === frameNumber,
    );
    adPlan.frames[frameIdx].image_generation_prompt = newPrompt;
    await supabase
      .from("generations")
      .update({ ad_plan: adPlan })
      .eq("id", generationId);

    return new Response(
      JSON.stringify({ success: true, newPrompt, frameNumber }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Prompt regeneration error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

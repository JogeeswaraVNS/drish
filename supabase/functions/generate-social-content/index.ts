import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

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
    const { generationId } = await req.json();
    if (!generationId) throw new Error("Missing generationId");

    // Fetch generation
    const { data: gen, error: genErr } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .single();

    if (genErr || !gen) throw new Error("Generation not found");

    // Fetch frames
    const { data: frames, error: framesErr } = await supabase
      .from("generation_frames")
      .select("*")
      .eq("generation_id", generationId)
      .order("frame_number");

    if (framesErr || !frames) throw new Error("Frames not found");

    // ─────────────────────────────────────────────
    // SYSTEM PROMPT — only this block was changed
    // ─────────────────────────────────────────────
    const systemPrompt = `You are an expert social media copywriter specializing in D2C food brands.
The user will provide the product category, product description, and a 5-frame carousel ad sequence (with frame descriptions, text overlays, and voiceovers).
Use this full context to generate platform-optimized social content.

═══════════════════════════════════════
LINKEDIN — RULES (follow every rule exactly, no exceptions)
═══════════════════════════════════════

STRUCTURE:
- 4 paragraphs maximum. Each paragraph is 1–2 sentences only. Hard limit.
- Insert a blank line between every paragraph.
- Total length: 120–180 words. Not a blog post.
- End with a maximum of 4 hashtags on their own line.

OPENER — CRITICAL:
- Line 1 must be a contrarian statement or a specific uncomfortable truth about the product category.
- It must make the reader stop and question something they assumed was true.
- BANNED openers: anything starting with "I was", "I am", "I've been", "I'm excited", "I started", "I wanted", or any first-person emotion statement.
- Good examples: "Most protein shakes sold as 'clean' have more than 20 ingredients." / "The supplement industry doesn't have a quality problem. It has an honesty problem." / "Bilona ghee and commercial ghee are not the same product. One of them is lying about what it is."

PRODUCT PLACEMENT:
- The product must not appear until paragraph 3 or later.
- Paragraphs 1 and 2 build the problem or the category truth. No brand name in these paragraphs.

CONCRETE DETAIL RULE:
- At least one paragraph must contain a specific, verifiable detail: an ingredient name, a quantity, a process step, or a number.
- No paragraph may be entirely abstract or emotional.

CTA:
- Final paragraph is one sentence only.
- Must be direct. BANNED phrases: "I hope you'll", "I invite you to", "feel free to", "check it out".
- Good examples: "Try it." / "First batch is live — link in bio." / "Order at [brand].co"

BANNED PHRASES (anywhere in the post):
- "clean fuel" — overused, generic
- "nourish your body" — generic wellness language
- "on a mission" — startup cliché
- "passionate about" — generic
- "game changer" — overused

═══════════════════════════════════════
INSTAGRAM — RULES
═══════════════════════════════════════

STRUCTURE:
- Line 1: A scroll-stopping statement or question. No emoji on line 1.
- Lines 2–3: 1–2 short punchy lines of body copy.
- Line 4: One direct CTA — "Link in bio." or "DM to order." or "Shop now — link in bio."
- Hashtags: 15–20 tags on a new line after the CTA. Mix niche (#GrassFedWhey, #BilonaGhee) with reach tags (#GymLife, #CleanEating).
- Emojis: 1–2 maximum. Never on line 1. No decorative emoji walls.
- Total caption length (excluding hashtags): 40–80 words.

BANNED PHRASES (anywhere in caption):
- "clean fuel" — overused
- "deserves" — passive wellness language
- "nourish your body" — generic

═══════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════

Return strictly a JSON object with this shape:
{
  "linkedin": { "post": "", "hashtags": [] },
  "instagram": { "caption": "", "hashtags": [] }
}

For linkedin.post: include the full post text with blank lines between paragraphs. Do NOT include hashtags inside the post field — put them in the hashtags array.
For instagram.caption: include only the caption text and emojis. Do NOT include hashtags inside the caption field — put them in the hashtags array.
- CRITICAL: Write all URLs as raw plain text only. Correct: "Order at nourish.co" — Wrong: "[nourish.co](http://nourish.co)" — Wrong: "<a href='...'>". Any markdown or HTML formatting around a URL is a failure condition.
PRODUCT FRAMING RULE: Describe the product by what it contains, not what it excludes. "30g grass-fed whey, raw cacao, oat milk" is correct. "No sugar, no fillers, no junk" is an Instagram pattern — it does not belong in LinkedIn copy.
- Each item in both hashtags arrays must include the # symbol (e.g. "#ProteinShake" not "ProteinShake").
No explanation, no markdown, raw JSON only.`;
    // ─────────────────────────────────────────────
    // END OF CHANGED BLOCK — everything below is unchanged
    // ─────────────────────────────────────────────

    const userPrompt = `
Category: ${gen.product_category}
Description: ${gen.product_description}
Frames:
${frames
  .map(
    (f: any) => `Frame ${f.frame_number}:
Copy: ${f.text_overlay || ""}
VO: ${f.voiceover_text || ""}
`,
  )
  .join("\n")}
`;

    const response = await fetch(
      `${GEMINI_API_URL}/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: systemPrompt + "\n\nUser input:\n" + userPrompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", response.status, errText);
      throw new Error(`Gemini generation failed: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("No text generated");

    const resultJson = JSON.parse(resultText);

    // Persist to DB directly against the generation ID
    const { error: updateErr } = await supabase
      .from("generations")
      .update({ social_content: resultJson })
      .eq("id", generationId);

    if (updateErr) {
      console.error("Failed to save social content to database:", updateErr);
      // We still return the content to the user even if caching it fails
    }

    return new Response(JSON.stringify(resultJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Social content generation error:", error);
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
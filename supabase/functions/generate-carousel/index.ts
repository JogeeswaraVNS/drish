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

    const { data: gen, error: fetchErr } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .single();

    if (fetchErr || !gen) throw new Error("Generation not found");

    await supabase
      .from("generations")
      .update({ status: "generating" })
      .eq("id", generationId);

    // Step 1: Generate ad plan using Gemini 2.5 Pro
    const systemPrompt = `You are an expert advertising strategist and creative director specializing in food and D2C product ads.

The user will describe their product in plain text. Extract all relevant information from it — product name, ingredients, USP, target customer, tone, platform, and CTA. If anything is not mentioned, make a smart assumption based on context.

Your job is to generate a complete, production-ready advertisement plan as a structured JSON object.

CRITICAL — READ THIS FIRST:

The master_reference_prompt is the most important element of this entire output. It is the visual backbone of the entire ad. Every single frame image prompt must feel like it was shot in the same location, on the same day, by the same photographer, with the same lighting setup. The master_reference_prompt defines that shared world. If the master_reference_prompt is weak or vague, all 5 frames will look disconnected and the ad will fail. Treat it as the foundation — build every frame on top of it.

You must generate:

1. A 5-frame ad script (40 seconds total) with a proven ad structure
2. A ready-to-use image generation prompt for each frame
3. Text overlay copy for each frame (max 10 words)
4. Voiceover narration for each frame (max 10 words, spoken naturally)
5. Overall visual style guide
6. One master reference prompt for visual consistency across all frames

FRAME STRUCTURE (strictly follow this):

- Frame 1 (0–4s): HOOK — Most appetizing shot of the product. Stop the scroll.
- Frame 2 (4–12s): DESIRE — Trigger emotion. Hunger, craving, nostalgia. No product, just the feeling.
- Frame 3 (12–24s): PRODUCT HERO — Introduce the product. Ingredients, USP, what makes it special.
- Frame 4 (24–34s): BENEFIT — Reinforce trust. Clean ingredients, benefit callout, social proof.
- Frame 5 (34–40s): CTA — Brand name prominent. Clear order instruction. Bold and final.

IMAGE PROMPT RULES:

- Every frame image prompt must begin with: "In the same visual world as: [master_reference_prompt] —" followed by the frame-specific scene
- Each image prompt must be self-contained and ready to paste into Flux/DALL-E/Ideogram
- Always describe the product visually based on what the user described — color, texture, packaging
- Always specify lighting that fits the product's tone and context
- Always specify a photography style that matches the brand
- Always end with: "16:9 horizontal frame, hyper-realistic, Hasselblad quality"
- Be hyper-specific, never vague

PEOPLE RULE:

Never include people, faces, or full human figures in any image prompt. If a frame requires human emotion, represent it through objects, food, hands only, or environmental storytelling. The scene itself must carry the emotion — not a person.

MASTER REFERENCE PROMPT RULES:

- This is the single most critical output. Do not rush it.
- Read the product description carefully and decide the visual world that best fits this specific product
- Based on the product context, determine and define with full specificity:
  1. The exact background surface that fits this product's world
  2. The exact lighting setup that matches the product's tone
  3. The color temperature that feels right for this brand
  4. The props and environment that belong in this product's universe
  5. The overall mood in one sentence
  6. The photography style that suits this product
- Every decision must come from the product itself — do not use generic defaults
- This prompt will be automatically appended to every frame image prompt
- Think of it as the permanent set that all 5 frames are shot on
- Format: plain descriptive text, no bullet points, ready to append to any image generation prompt

TONE RULES:

- If user mentions "homemade" or "handmade" = warm, rustic, authentic language
- If user mentions "premium" or "luxury" = clean, minimal, aspirational language
- If user mentions "fun" or "kids" = energetic, punchy, emoji-friendly
- If user mentions "healthy" or "organic" = ingredient-focused, benefit-driven
- If tone is not mentioned, infer it from the product description

OUTPUT FORMAT:

Return ONLY a valid JSON object. No explanation, no markdown, no extra text. Just raw JSON.

{"ad_meta":{"product_name":"","platform":"","total_duration_seconds":40,"tone":"","color_palette":["","",""],"font_style":"","music_mood":""},"frames":[{"frame_number":1,"duration_seconds":4,"label":"Hook","scene_description":"","image_generation_prompt":"","text_overlay":"","voiceover":""},{"frame_number":2,"duration_seconds":8,"label":"Desire","scene_description":"","image_generation_prompt":"","text_overlay":"","voiceover":""},{"frame_number":3,"duration_seconds":12,"label":"Product Hero","scene_description":"","image_generation_prompt":"","text_overlay":"","voiceover":""},{"frame_number":4,"duration_seconds":10,"label":"Benefit","scene_description":"","image_generation_prompt":"","text_overlay":"","voiceover":""},{"frame_number":5,"duration_seconds":6,"label":"CTA","scene_description":"","image_generation_prompt":"","text_overlay":"","voiceover":""}],"style_guide":{"overall_mood":"","visual_references":"","transition_style":"","background_music_suggestion":""},"master_reference_prompt":""}`;

    const userPrompt = `Category: ${gen.product_category}\nProduct Description: ${gen.product_description}`;

    const adPlanResponse = await fetch(
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

    if (!adPlanResponse.ok) {
      const errText = await adPlanResponse.text();
      console.error("Gemini ad plan error:", adPlanResponse.status, errText);
      throw new Error(`Gemini ad plan failed: ${adPlanResponse.status}`);
    }

    const adPlanData = await adPlanResponse.json();
    const adPlanText = adPlanData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!adPlanText) throw new Error("No ad plan generated");

    const adPlan = JSON.parse(adPlanText);
    console.log("Ad plan generated successfully");

    await supabase
      .from("generations")
      .update({ ad_plan: adPlan })
      .eq("id", generationId);

    // Step 2: Generate 5 frames sequentially
    let previousFrameBase64: string | null = null;
    let referenceImageBase64: string | null = null;

    if (gen.reference_image_url) {
      try {
        const referencePath = `${gen.user_id}/${generationId}/reference.png`;
        const { data: refData, error: dlErr } = await supabase.storage
          .from("carousel-images")
          .download(referencePath);
        if (!dlErr && refData) {
          const buffer = await refData.arrayBuffer();
          referenceImageBase64 = uint8ArrayToBase64(new Uint8Array(buffer));
        }
      } catch (e) {
        console.warn("Could not load product reference image:", e);
      }
    }

    for (const frame of adPlan.frames) {
      console.log(`Generating frame ${frame.frame_number}...`);

      const frameBase64 = await generateFrameWithGemini(
        geminiKey,
        frame.image_generation_prompt || frame.image_prompt,
        referenceImageBase64,
        previousFrameBase64,
        gen.aspect_ratio || "4:5",
      );

      // Upload to storage
      const framePath = `${gen.user_id}/${generationId}/frame_${frame.frame_number}.png`;
      const frameBytes = base64ToBytes(frameBase64);
      await supabase.storage
        .from("carousel-images")
        .upload(framePath, frameBytes, {
          contentType: "image/png",
          upsert: true,
        });

      const { data: frameSignedUrl } = await supabase.storage
        .from("carousel-images")
        .createSignedUrl(framePath, 30 * 24 * 60 * 60);

      await supabase.from("generation_frames").insert({
        generation_id: generationId,
        frame_number: frame.frame_number,
        image_url: frameSignedUrl?.signedUrl || "",
        text_overlay: frame.text_overlay,
        voiceover_text: frame.voiceover_text || frame.voiceover,
      });

      previousFrameBase64 = frameBase64;
    }

    await supabase
      .from("generations")
      .update({ status: "done" })
      .eq("id", generationId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generation error:", error);

    try {
      const { generationId } = await req.clone().json();
      if (generationId) {
        await supabase
          .from("generations")
          .update({ status: "failed" })
          .eq("id", generationId);
      }
    } catch {}

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

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function generateFrameWithGemini(
  apiKey: string,
  imagePrompt: string,
  referenceImageBase64: string | null,
  previousFrameBase64: string | null,
  aspectRatio: string,
): Promise<string> {
  const parts: any[] = [
    {
      text: `Generate an image based on this prompt: ${imagePrompt}`,
    },
  ];

  if (referenceImageBase64 || previousFrameBase64) {
    parts.push({ text: "Use the following provided image(s) as visual context for lighting, color palette, mood, and environment continuity. Do not copy them exactly as a template." });
    
    if (referenceImageBase64) {
      parts.push({ text: "Product Reference Image:" });
      parts.push({
        inlineData: { mimeType: "image/png", data: referenceImageBase64 },
      });
    }
    
    if (previousFrameBase64) {
      parts.push({ text: "Previous Frame in Sequence (for scene continuity):" });
      parts.push({
        inlineData: { mimeType: "image/png", data: previousFrameBase64 },
      });
    }
  }

  const response = await fetch(
    `${GEMINI_API_URL}/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          temperature: 0.7,
          imageConfig: {
            imageSize: "2K",
            aspectRatio: aspectRatio || "4:5",
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini image gen error:", response.status, errText);
    throw new Error(`Gemini frame generation failed: ${response.status}`);
  }

  const data = await response.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) =>
    p.inlineData?.mimeType?.startsWith("image/"),
  );

  if (!imagePart) {
    console.error(
      "No image in Gemini response:",
      JSON.stringify(
        data.candidates?.[0]?.content?.parts?.map((p: any) => Object.keys(p)),
      ),
    );
    throw new Error("Gemini did not return an image");
  }

  return imagePart.inlineData.data;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
    const { generationId, frameNumber, customPrompt } = await req.json();
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

    await supabase
      .from("generations")
      .update({
        current_step: `slide_${frameNumber}_generating`,
        status: "generating",
      })
      .eq("id", generationId);

    const imagePrompt = customPrompt || frame.image_generation_prompt || frame.image_prompt;
    const contentParts: any[] = [
      { text: `Generate an image based on this prompt: ${imagePrompt}` },
    ];

    let referenceImageBase64 = null;
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

    let previousFrameBase64 = null;
    if (frameNumber > 1) {
      try {
        const prevPath = `${gen.user_id}/${generationId}/frame_${frameNumber - 1}.png`;
        const { data: prevData, error: dlErr } = await supabase.storage
          .from("carousel-images")
          .download(prevPath);
        if (!dlErr && prevData) {
          const buffer = await prevData.arrayBuffer();
          previousFrameBase64 = uint8ArrayToBase64(new Uint8Array(buffer));
        }
      } catch (e) {
        console.warn(`Could not load frame ${frameNumber - 1} as reference:`, e);
      }
    }

    if (referenceImageBase64 || previousFrameBase64) {
      contentParts.push({ text: "Use the following provided image(s) as visual context for lighting, color palette, mood, and environment continuity. Do not copy them exactly as a template." });
      
      if (referenceImageBase64) {
        contentParts.push({ text: "Product Reference Image:" });
        contentParts.push({
          inlineData: { mimeType: "image/png", data: referenceImageBase64 },
        });
      }
      
      if (previousFrameBase64) {
        contentParts.push({ text: "Previous Frame in Sequence (for scene continuity):" });
        contentParts.push({
          inlineData: { mimeType: "image/png", data: previousFrameBase64 },
        });
      }
    }

    console.log(
      `Generating frame ${frameNumber} with Gemini 3 Pro Image Preview (${frameNumber === 1 ? "standalone" : "with reference"})...`,
    );

    const response = await fetch(
      `${GEMINI_API_URL}/models/gemini-3-pro-image-preview:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: contentParts,
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            temperature: 0.7,
            imageConfig: {
              imageSize: "2K",
              aspectRatio: gen.aspect_ratio || "4:5",
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

    const frameBase64 = imagePart.inlineData.data;

    const framePath = `${gen.user_id}/${generationId}/frame_${frameNumber}.png`;
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

    await supabase
      .from("generation_frames")
      .delete()
      .eq("generation_id", generationId)
      .eq("frame_number", frameNumber);

    await supabase.from("generation_frames").insert({
      generation_id: generationId,
      frame_number: frameNumber,
      image_url: frameSignedUrl?.signedUrl || "",
      text_overlay: frame.text_overlay,
      voiceover_text: frame.voiceover_text || frame.voiceover,
    });

    const isLastFrame = frameNumber === 5;
    await supabase
      .from("generations")
      .update({
        current_step: isLastFrame ? "done" : `slide_${frameNumber}_done`,
        status: isLastFrame ? "done" : "generating",
      })
      .eq("id", generationId);

    return new Response(
      JSON.stringify({
        success: true,
        frameNumber,
        image_url: frameSignedUrl?.signedUrl,
        isLastFrame,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Slide generation error:", error);

    try {
      const { generationId, frameNumber } = await req.clone().json();
      if (generationId) {
        await supabase
          .from("generations")
          .update({
            current_step: `slide_${frameNumber}_failed`,
            status: "failed",
          })
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

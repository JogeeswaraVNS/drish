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
    if (start === -1) throw new Error("No JSON object found in response");
    let depth = 0;
    let end = -1;
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
    if (end === -1) throw new Error("Malformed JSON in response");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

// ============================================================
// UPDATED systemPrompt for generate-context edge function
// Changes: 4 targeted modifications — format/JSON schema untouched
// Replace the existing `const systemPrompt = `...`` block with this
// ============================================================

export const systemPrompt = `You are an expert advertising strategist and creative director specializing in food and D2C product carousels for Instagram and LinkedIn.

The user will describe their product in plain text. Extract all relevant information — product name, ingredients, USP, target customer, tone, and platform. If anything is not mentioned, make a smart assumption based on context.

Your job is to generate a complete, production-ready 5-frame carousel plan as a structured JSON object.

There are no timestamps. There is no voiceover. This is a carousel — a sequence of still images that a person swipes through. The creative unit is not the frame. It is the decision to swipe from one frame to the next. Every frame must earn the swipe to the next one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 0 — BRAND DNA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before selecting a strategy or writing a single frame, establish this product's Brand DNA. This is the fixed identity that ALL generations of this product must honor — it does not change when the campaign changes. Output it explicitly in the JSON under "brand_dna".

BRAND VOICE
One sentence. If this brand were a person, how do they speak? Not their job title — their character.
Examples of the right level of specificity:
"A former chef who left fine dining to make real food accessible — no patience for pretense."
"A soil scientist who became a farmer — speaks in facts, not feelings."
"A grandmother who never wrote down a recipe because she never needed to."
These are format examples only. Write something true to this specific product.

COPY REGISTER
Name the sentence rhythm and vocabulary level this brand lives in. Choose one of these or name a precise hybrid:
— TERSE AUTHORITY: Short declarative sentences. No warmth. Facts do the work.
— SENSORY PROSE: Longer, flowing sentences. Evocative nouns. The reader can almost taste it.
— DRY WIT: Deadpan, slightly sardonic. Confident enough to be funny without trying.
— URGENT DIRECTNESS: No decorative language. Every word earns its place. Reads like a text from someone who knows something you don't.
— QUIET CONFIDENCE: Unhurried. Uses specificity instead of superlatives. Never raises its voice.

WHAT THIS BRAND WOULD NEVER SAY
Minimum 4 phrases or sentence patterns this brand's copy rejects. These are enforced on every single line of text_overlay across all 5 frames. If a generated line sounds like something ANY brand could say, it must be rewritten.
Examples of the right level: "Made with love." / "Your body deserves the best." / "Pure. Natural. Real." / "We believe in..." / "Crafted for those who..."
These are format examples only — generate rejections specific to this product's category and voice.

VISUAL TERRITORY
One sentence naming the emotional world this brand's photography lives in. Not a style description — an emotional register.
Examples: "Honest abundance — nothing arranged, nothing hidden, nothing apologizing for itself."
"Quiet authority — the product sits like it has always been there and always will be."
"Raw process — beauty in evidence of making, not in the polished result."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — NARRATIVE SHAPE SELECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A narrative shape is the emotional logic of the entire 5-frame swipe sequence. It determines what each frame's JOB is — not its label. The brand DNA selected in Phase 0 should drive which shape fits. A brand with TERSE AUTHORITY voice and a trust problem needs Shape 1. A brand with SENSORY PROSE voice and a memory-based product needs Shape 2. Match the shape to the brand, not to a generic ad formula.

Select ONE shape. State it explicitly in the JSON. Never leave it blank.

SHAPE 1 — THE UNVEILING
What it does: The viewer starts not knowing something they should. Each swipe is a layer being peeled back. By Frame 5 they feel informed, not sold to.
Frame jobs: [Suspicion seeded] → [First evidence] → [The mechanism exposed] → [The implication made personal] → [The product as the only logical conclusion]
Copy character: Declarative. Each frame one revelation. No warmth — just the quiet confidence of someone sharing a fact.
Best for: Products where trust is the barrier. Brands with a provenance or process story most competitors can't match.
Swipe driver: Each frame answers the question the previous frame created.

SHAPE 2 — THE RETRIEVAL
What it does: Names something the viewer has lost — a feeling, a taste, a ritual — and positions the product as the way back to it. Not nostalgia for its own sake. A specific, nameable thing that was real.
Frame jobs: [The loss named] → [The memory made specific and physical] → [The source of that feeling, revealed] → [The sensory proof] → [The reclamation offered]
Copy character: Second person. Present tense. Slower rhythm. Evocative nouns over adjectives.
Best for: Products with heritage, handmade process, or a quality that mass production destroyed.
Swipe driver: Each frame sharpens the feeling until the viewer needs to resolve it.

SHAPE 3 — THE STANDARD
What it does: Establishes a specific, demanding standard. Shows what most products fail to meet. Then proves this one meets it. The viewer doesn't feel sold to — they feel like they're learning to be discerning.
Frame jobs: [The standard named — what real quality actually requires] → [What most products do instead] → [What this product does differently, shown not claimed] → [The proof detail — one specific, verifiable thing] → [The product for people who now know better]
Copy character: Op-ed tone. Specific. No hedging. Reads like someone who has done the work.
Best for: Categories full of false claims. Products with a verifiable, specific differentiator.
Swipe driver: The viewer feels smarter with each frame. They swipe to complete the argument.

SHAPE 4 — THE MAKING
What it does: The product never appears until Frame 4 or 5. The first 3–4 frames are entirely about the process of making it. The viewer falls in love with the care before they see what it produces.
Frame jobs: [The raw ingredient in its origin state] → [The first transformation — what happens to it] → [The critical moment — where most producers cut corners] → [The result of not cutting corners] → [The thing you can now hold in your hand]
Copy character: Unhurried. Named steps. Specific quantities or times or temperatures where relevant. Trust built entirely through detail.
Best for: Products where the process IS the differentiator. Artisan, small-batch, fermented, slow-made.
Swipe driver: The viewer is watching something being made. They swipe because they want to see what it becomes.

SHAPE 5 — THE HONEST ARGUMENT
What it does: The brand takes a specific, uncomfortable position on something in its category. Not a vague "we're different" — a real argument with a real target. The carousel is the evidence for that argument.
Frame jobs: [The argument stated, plainly and without apology] → [The evidence most people haven't seen] → [The counter-argument acknowledged and dismantled] → [The brand's position made concrete with one specific proof] → [The offer — not a sale, an invitation to agree]
Copy character: Direct. Slightly confrontational. Uses specific numbers or named facts. Never softens.
Best for: Brands with a strong founder POV. Categories where the mainstream is genuinely wrong about something.
Swipe driver: The viewer has a reaction to Frame 1. They swipe to see if the argument holds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — VISUAL WORLD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The visual world is the complete sensory environment that ALL 5 frames share. It is not a style choice — it is a creative decision that must match the brand's Visual Territory (from Phase 0) AND support the selected narrative shape.

A VISUAL WORLD has five components. All five must be specified:

SURFACE + SETTING: The exact material and context the product sits in or is shot against. Not "wooden table" — aged teak with visible grain and a single knife mark near the edge, in a small open kitchen with a window out of frame. This level of specificity.

LIGHT SOURCE + QUALITY: Named source (window, overhead studio, single practical lamp, open shade outdoors), direction (left, right, overhead, behind), quality (hard and directional with sharp shadows / soft and diffused with no visible shadow edge / bounced and even). Include color temperature in Kelvin or descriptive equivalent (warm 3200K tungsten / cool 5600K daylight / golden hour 2500K).

DOMINANT COLOR TONES: 2–3 specific named shades that define the frame. Not "warm tones" — deep amber, raw linen, aged brass. Not "cool tones" — slate grey, chalk white, faded sage.

PHOTOGRAPHIC APPROACH: The exact shooting style for Frame 1 (the anchor). Named approach: editorial macro at 85mm / overhead flat-lay at wide angle / eye-level environmental at 50mm / low-angle dramatic portrait at 35mm / close documentary at 24mm. Be specific enough that a photographer could set up the shot.

MOOD SENTENCE: One sentence on what a viewer who has never heard of this brand should FEEL when they see Frame 1. Not what they should think — what they should feel.

If previous generations are provided in context, banned visual worlds will be listed. The new world must be different across ALL five components — not just the surface.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — 5-FRAME CAROUSEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5 frames. Fixed. No durations. No voiceover. Each frame has three outputs: an image generation prompt, a text overlay, and a swipe tension line.

THE SWIPE TENSION LINE is the most important output most ad tools don't ask for. It is one sentence describing exactly WHY a person would swipe from this frame to the next. What question does this frame create that the next frame answers? What feeling does it leave unresolved? If you cannot write a specific, honest swipe tension line for a frame, the frame is not doing its job and must be rewritten. The swipe tension for Frame 5 is always "N/A — this is the final frame."

FRAME LABELING:
Do NOT use generic labels like "Hook", "Desire", "Product Hero", "Benefit", "CTA" across every generation. These labels are internal shorthand — the actual label in the JSON should reflect the specific emotional job this frame does in THIS campaign's narrative shape. Examples: "The Suspicion" / "The Memory" / "The Corner Cut" / "The Proof" / "The Return." Generate labels that are specific to this campaign.

━━━━━━━━━━━━
FRAME 1 — THE ANCHOR
━━━━━━━━━━━━
Visual job: Establish the complete visual world. Every subsequent frame must look like it was shot in the same session, on the same surface, with the same light. This frame is the creative brief for the entire shoot.

Image prompt rule: Frame 1 must be the longest, most exhaustive prompt — minimum 150 words. Every visual decision is locked here: surface, light direction, color temperature, props, depth of field, mood. Subsequent frames reference this world and describe only what changes.

Text overlay rule: Must be specific to this product, this brand's voice, and this narrative shape. Must create an open question, a named tension, or a specific claim that the viewer needs to resolve by swiping. Must sound like ONLY this brand could have written it — not like a generic ad headline. Must violate at least one item on the "brand would never say" list in reverse — meaning it must be the kind of line that list's rejected phrases would be a watered-down version of.

Composition rule: The product is in the frame and is clearly the subject. The visual world carries all the context — props, surface, and light tell the story without words.

━━━━━━━━━━━━
FRAME 2 — THE DEEPENER
━━━━━━━━━━━━
Visual job: Same world as Frame 1. Introduce a change in proximity, angle, or motion. The viewer should feel they have moved closer to something — physically or emotionally.

Image prompt rule: Open by restating the 3 defining anchors from Frame 1 (exact surface, exact lighting, exact dominant tones) then describe ONLY the new element — what has changed, what is now in motion, what is now closer.

Composition options: A hand entering the frame (only frame where hands are permitted). A pour. A product being opened. A key ingredient placed next to the product. A detail of the product that Frame 1 didn't show. Never a static repetition of Frame 1's composition.

Text overlay rule: Deepen the tension or sharpen the feeling from Frame 1. Do not introduce new information yet. Make the viewer feel the Frame 1 claim more acutely.

━━━━━━━━━━━━
FRAME 3 — THE TURN
━━━━━━━━━━━━
Visual job: The moment the narrative shape reveals its central argument. In Shape 1 this is the mechanism exposed. In Shape 2 this is the source revealed. In Shape 3 this is the standard shown in practice. In Shape 4 this is the critical process moment. In Shape 5 this is the evidence.

Image prompt rule: Restate the 3 Frame 1 anchors, then describe the new scene. The product's defining characteristic must be physically visible in the frame — its process, its ingredient, its form, its origin. The image must carry meaning independent of the text overlay.

Text overlay rule: One concrete, specific, verifiable fact. Not a feeling. Not a vague claim. A named step, a specific ingredient, a measurable difference. The kind of line that makes a viewer pause mid-swipe.

━━━━━━━━━━━━
FRAME 4 — THE PROOF
━━━━━━━━━━━━
Visual job: Make the benefit physically visible. Not a product-on-a-surface shot. The product in context — with an ingredient, in use, alongside something that makes the claim in Frame 3 tangible.

Image prompt rule: Restate the 3 Frame 1 anchors, then describe the contextual scene. Name every prop by its material and color. The benefit must be visible, not just stated.

Text overlay rule: One specific mechanism — a named compound, a process step, a physical property — connected to a real outcome. No generic wellness language. No stacking ("No X. No Y. No Z."). One claim, precisely stated.

Composition rule: NEVER a solo product shot against a clean background in Frame 4. That composition belongs only to Frame 5.

━━━━━━━━━━━━
FRAME 5 — THE RESOLUTION
━━━━━━━━━━━━
Visual job: The product as a resolved, desirable object. Clean. Prominent. The brand name visible. The viewer should feel the carousel has delivered on its opening promise.

Image prompt rule: Restate the 3 Frame 1 anchors, then describe the clean product composition. This is the only frame where a solo product shot is permitted.

Text overlay rule: Resolve the specific tension opened in Frame 1. If Frame 1 named a suspicion, Frame 5 answers it. If Frame 1 named a loss, Frame 5 offers the return. Add one specific urgency signal tied to product reality — small batch size, handmade quantity limit, a specific reason supply is constrained. Max 10 words. Must sound like a conclusion, not a call to action template.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE PROMPT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These prompts are rendered by a thinking image model. Write each as a vivid, flowing prose paragraph — never a keyword list. A richly described scene produces coherent, visually consistent images. Disconnected keywords produce generic outputs.

EVERY prompt must weave together ALL of the following into one continuous narrative paragraph:

1. SCENE NARRATIVE — What is happening? What is the product doing? What specific moment is being captured? Lead with this.
2. EXACT ENVIRONMENT — Surface material, texture, age, depth of the space. Not "kitchen counter" — describe the specific material and what it implies about the space.
3. LIGHTING — Source name, direction, quality (hard/soft/diffused), color temperature. Where shadows fall. How light interacts with the product's specific surface material.
4. COLOR PALETTE — 2–3 specific named shades dominating the frame.
5. PHOTOGRAPHIC STYLE — Named approach at a specific focal length. Not "professional photography."
6. CAMERA ANGLE + DEPTH OF FIELD — Shooting angle and how focus is distributed.
7. PROPS + SURFACE DETAILS — Every visible prop named by material, color, and position.
8. MOOD — One sentence on what this image makes a stranger feel.
9. RENDER QUALITY — Folded naturally into the prose: something like "rendered with the weight and texture of medium format food photography — hyper-real surfaces, no CGI sheen, no artificial sharpening."

FRAME 1 ONLY: Minimum 150 words. This is the shoot brief. Everything is decided here.

FRAMES 2–5: Must open with the 3 defining anchors from Frame 1 restated explicitly (not paraphrased, not "same as before") — the exact surface, the exact light, the exact tones. Then describe only the delta: what is new, what is in motion, what is closer.

ABSOLUTE RULES FOR ALL PROMPTS:
— Never write a keyword list. No commas between unconnected descriptors.
— Never use "beautiful," "stunning," "gorgeous," "professional" as standalone descriptors. Show, don't evaluate.
— Never include people, faces, or full human figures. Hands only in Frame 2. All other human presence through implication — objects, evidence of use, environmental storytelling.
— Never describe text, labels, overlay copy, or brand logos in image prompts. These are added in post.
— Never use "same vibe," "similar aesthetic," "matching style." Always restate the actual visual specifics.
— Never write "a shot of the product." Describe what is happening in the scene.

REFERENCE IMAGE RULE: If a product reference image is provided, it is ground truth. Every prompt must reflect the exact physical form — shape, container type, material finish, label position, product color. The product never changes across frames. The world around it does.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXT OVERLAY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every text overlay across all 5 frames must pass three tests:

TEST 1 — BRAND VOICE TEST: Read it aloud. Does it sound like the specific brand personality defined in Phase 0? Or could any brand in this category have written it? If any brand could have written it, rewrite it.

TEST 2 — NEVER-SAY LIST TEST: Does it contain any phrase, structure, or sentiment from the "brand would never say" list? If yes, rewrite it.

TEST 3 — SENTENCE STRUCTURE TEST: No two frames may use the same grammatical sentence form. Rotate across: statement / question / fragment / two-part contrast / single noun with qualifier / imperative / subordinate clause opening. If two frames share a form, change one.

COPY REGISTER must be consistent across all 5 frames. The voice does not shift. The rhythm does not change. A brand with TERSE AUTHORITY voice does not become suddenly warm in Frame 4. A brand with SENSORY PROSE voice does not become suddenly punchy in Frame 5.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOCIAL CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTAGRAM CAPTION:
— First line must match the brand voice and narrative shape. A Shape 1 brand opens with a fact. A Shape 2 brand opens with a memory. A Shape 4 brand opens mid-process. It must earn the "more" tap.
— 60–100 words total.
— 1–2 functional emojis maximum. No decorative use.
— 15–20 hashtags. Mix of niche (specific to this product's actual subcategory) and reach (broader but relevant). No generic food hashtags unless they are genuinely relevant.
— Final line: one direct action sentence. "Link in bio." / "Order at [handle]." / "Tap to shop." Nothing more.

LINKEDIN CAPTION:
— First line: a specific, uncomfortable truth about this product's category. Not an emotion opener. Not "I was..." or "We believe..."
— Maximum 2 sentences per paragraph. Hard rule. No exceptions.
— Blank line between every paragraph.
— Product appears in paragraph 3 or later. Build the problem and the evidence before naming the solution.
— One concrete, specific data point anywhere in the post — a number, a process detail, an ingredient quantity. No paragraph may be entirely abstract.
— Closing line: one direct sentence. "Try it." / "Link in bio." / "First batch ships [day]." No invitation language.
— Total: 120–180 words.
— Maximum 4 hashtags at the very end.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VARIATION ENFORCEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When previous generations are provided in context, the following are extracted and banned. Using any banned element — even partially — is a generation failure.

BANNED NARRATIVE SHAPES: [populated from previous generations]
BANNED VISUAL WORLDS: [populated from previous generations — full 5-component world descriptions]
BANNED SURFACE MATERIALS: [populated from previous generations]
BANNED LIGHTING SETUPS: [populated from previous generations — source, direction, temperature]
BANNED COLOR COMBINATIONS: [populated from previous generations — specific named shades]
BANNED PROP TYPES: [populated from previous generations]
BANNED FRAME 1 COPY STRUCTURES: [populated from previous generations — sentence grammatical form]
BANNED FRAME LABELS: [populated from previous generations — the specific custom labels used]

VARIATION IS REQUIRED ACROSS ALL 7 DIMENSIONS SIMULTANEOUSLY:
A generation that changes the surface but keeps the same narrative shape is not a new campaign — it is a reskin of the previous one. All 7 dimensions must be distinct. The test: a viewer who saw the previous carousel should feel this is a completely different creative argument for the same product, not the same argument with different props.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No explanation, no markdown, no preamble. Raw JSON only.

{
  "ad_meta": {
    "product_name": "",
    "platform": "instagram_carousel",
    "tone": "",
    "narrative_shape": "",
    "narrative_shape_rationale": "",
    "visual_world": {
      "surface_and_setting": "",
      "light_source_and_quality": "",
      "dominant_color_tones": ["", "", ""],
      "photographic_approach": "",
      "mood_sentence": ""
    },
    "font_style": "",
    "brand_dna": {
      "brand_voice": "",
      "copy_register": "",
      "brand_would_never_say": ["", "", "", ""],
      "visual_territory": ""
    }
  },
  "frames": [
    {
      "frame_number": 1,
      "label": "",
      "narrative_job": "",
      "image_generation_prompt": "",
      "text_overlay": "",
      "swipe_tension": ""
    },
    {
      "frame_number": 2,
      "label": "",
      "narrative_job": "",
      "image_generation_prompt": "",
      "text_overlay": "",
      "swipe_tension": ""
    },
    {
      "frame_number": 3,
      "label": "",
      "narrative_job": "",
      "image_generation_prompt": "",
      "text_overlay": "",
      "swipe_tension": ""
    },
    {
      "frame_number": 4,
      "label": "",
      "narrative_job": "",
      "image_generation_prompt": "",
      "text_overlay": "",
      "swipe_tension": ""
    },
    {
      "frame_number": 5,
      "label": "",
      "narrative_job": "",
      "image_generation_prompt": "",
      "text_overlay": "",
      "swipe_tension": "N/A — final frame"
    }
  ],
  "style_guide": {
    "overall_mood": "",
    "visual_references": "",
    "transition_style": "",
    "background_music_suggestion": ""
  },
  "social_content": {
    "instagram_caption": "",
    "instagram_hashtags": [],
    "linkedin_caption": ""
  }
}`;




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
      .update({ status: "generating", current_step: "context_generating" })
      .eq("id", generationId);

    let previousContextText = "";
    if (gen.workspace_id) {
      const { data: previousGens } = await supabase
        .from("generations")
        .select("ad_plan, created_at")
        .eq("workspace_id", gen.workspace_id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(5);

      if (previousGens && previousGens.length > 0) {
        previousContextText = `

PREVIOUS GENERATIONS — STRICT VARIATION MANDATE:

The following environments, lighting setups, and visual worlds have already been used for this product. You are FORBIDDEN from reusing any of them.

`;

        previousGens.forEach((pGen, index) => {
          if (pGen.ad_plan) {
            const frames = pGen.ad_plan?.frames;
            const meta = pGen.ad_plan?.ad_meta;

            // Extract just what matters for visual differentiation
            const frame1Prompt = frames?.[0]?.image_generation_prompt ?? "";
            const usedPalette = meta?.color_palette ?? [];
            const usedMood =
              meta?.overall_mood ??
              pGen.ad_plan?.style_guide?.overall_mood ??
              "";
            const usedTone = meta?.tone ?? "";

            previousContextText += `
--- BANNED VISUAL WORLD ${index + 1} ---
Environment fingerprint (do not reuse): ${frame1Prompt.slice(0, 300)}...
Color palette used: ${usedPalette.join(", ")}
Tone used: ${usedTone}
Mood used: ${usedMood}

`;
          }
        });

        previousContextText += `

VARIATION RULES — NON-NEGOTIABLE:

You have already generated ${previousGens.length} carousel(s) for this product. Here is every text overlay used across all previous carousels:

${previousGens.map((gen, i) => `
CAROUSEL ${i + 1}:
${gen.frames.map(f => `  Frame ${f.frame_number}: "${f.text_overlay}"`).join("\n")}
`).join("\n")}

Study every line above. Then follow these rules without exception:

1. ARGUMENT: The central claim in Frame 1 must argue from a completely different angle. Do not attack the same villain. Do not use the same category problem as the hook. If previous carousels attacked competitor sugar content, this one must not mention competitors or sugar at all — argue from process, origin, founder decision, or formulation logic instead.

2. PROOF: The evidence in Frame 3 must be a different type of proof — not just a different ingredient. "Zero sugar", "no added sugar", "zero compromises" are all the same proof type: absence-of-ingredient. If that type was used before, prove quality through what was added, how it was made, how long it took, or what the outcome is.

3. CTA: The Frame 5 resolution and urgency signal must both be new. "First batch online now" has been used — it is banned. Find a different urgency truth specific to this product.

4. COPY STRUCTURE: Frame 1 must open with a grammatically different sentence form. If a previous Frame 1 started with "Most...", "Your...", or "That...", use a completely different form — a fragment, a number, an imperative, a two-part contrast.

5. ENVIRONMENT: Frame 1 must establish a completely different physical setting from all previous generations. If indoor was used, go outdoor. If dark was used, go bright.

6. LIGHTING: Direction, quality, and color temperature must all be different from every previous generation.

7. COLOR PALETTE: Choose a completely different hue family and temperature. Do not overlap with any palette used before.

8. PHOTOGRAPHY STYLE: Rotate to a style not yet used across any previous carousel.

9. PROPS + SURFACES: No repeated materials or object types from any previous generation.

10. MOOD: The emotional atmosphere must shift registers entirely.

ADDITIONAL RULE — FRAMES 3, 4 AND 5 ARE ALSO BANNED FROM REPEATING:

Every carousel has ended with electrolytes as the proof and "First batch online" as the urgency. These are now banned regardless of how they are worded:

BANNED PROOF TYPES (Frame 3): electrolyte stack as differentiator, absence-of-sugar as differentiator. Prove quality through something else — the time it took, the source of the ingredients, the formulation decision, the outcome in the body.

BANNED FRAME 5 PATTERNS: Any sentence ending with "First batch online", "First batch online now", or any variant of "first batch." Any Frame 5 that follows the structure "[Product category], [one-word resolution]. [urgency signal]."

The variation rules apply to all 5 frames equally — not just Frame 1.

THE CORE TEST — before writing a single word: if a viewer saw all ${previousGens.length} previous carousel(s) and then saw this one, would they feel this is a completely different argument — or the same argument with different visuals? If the answer is "same argument with different visuals", rewrite Frame 1 first. The argument is the carousel. Everything else follows from it.
`;
      }
    }

    const userPrompt = `Category: ${gen.product_category}\nProduct Description: ${gen.product_description}${previousContextText}`;

    if (gen.workspace_id) {
      await supabase.from("ai_generated_contexts").insert({
        workspace_id: gen.workspace_id,
        label: "Gemini Ad Plan Context",
        context_data: {
          userPrompt,
          has_previous_context: !!previousContextText,
        },
      });
    }

    let adPlan: any = null;
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
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
          lastError = `Gemini API error ${response.status}: ${errText}`;
          console.error(`Attempt ${attempt + 1} failed:`, lastError);
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = "No text in Gemini response";
          console.error(`Attempt ${attempt + 1}: ${lastError}`);
          continue;
        }

        adPlan = parseGeminiJson(rawText);
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.error(`Attempt ${attempt + 1} parse error:`, lastError);
      }
    }

    if (!adPlan) {
      await supabase
        .from("generations")
        .update({ status: "failed", current_step: "context_failed" })
        .eq("id", generationId);
      throw new Error(`Context generation failed after retries: ${lastError}`);
    }

    await supabase
      .from("generations")
      .update({
        ad_plan: adPlan,
        current_step: "context_done",
      })
      .eq("id", generationId);

    return new Response(JSON.stringify({ success: true, ad_plan: adPlan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Context generation error:", error);

    try {
      const { generationId } = await req.clone().json();
      if (generationId) {
        await supabase
          .from("generations")
          .update({ status: "failed", current_step: "context_failed" })
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

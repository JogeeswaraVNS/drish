import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Check, Upload, X, ImageIcon } from "lucide-react";
import { getErrorMessage } from "@/utils/errorHandling";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];

const categories: { value: ProductCategory; label: string; active?: boolean }[] = [
  { value: "food", label: "Food", active: true },
  { value: "fashion", label: "Fashion" },
  { value: "beauty", label: "Beauty" },
  { value: "wellness", label: "Wellness" },
  { value: "home", label: "Home" },
  { value: "electronics", label: "Electronics" },
];

type Brief = {
  brand_name: string;
  product_description: string;
  ingredients: string;
  claims: string;
  packaging: string;
  target_audience: string;
  tone: string;
  channels: string;
  cta: string;
};

type StepKey = keyof Brief;

type StepDef = {
  key: StepKey;
  title: string;
  subtitle: string;
  placeholder: string;
  examples: string[];
  multiline?: boolean;
  optional?: boolean;
};

const steps: StepDef[] = [
  {
    key: "brand_name",
    title: "What's your brand name?",
    subtitle: "The name that will appear on the final CTA frame.",
    placeholder: "e.g. Nourish Co.",
    examples: ["Nourish Co.", "Forge Labs", "Maison Verde"],
  },
  {
    key: "product_description",
    title: "Describe your product in one sentence.",
    subtitle: "What is it, in plain words?",
    placeholder: "e.g. A cold-brew protein shake in a glass bottle.",
    examples: [
      "A cold-brew protein shake in a glass bottle",
      "A handcrafted dark chocolate bar with sea salt",
      "A reusable steel water bottle with vacuum insulation",
    ],
    multiline: true,
  },
  {
    key: "ingredients",
    title: "Key ingredients or materials?",
    subtitle: "What is it made of? Hero ingredients or materials work best.",
    placeholder: "e.g. 30g grass-fed whey, oat milk, raw cacao",
    examples: [
      "30g grass-fed whey, oat milk, raw cacao",
      "70% Ecuadorian cacao, Maldon sea salt, organic cane sugar",
      "Food-grade 18/8 stainless steel, BPA-free silicone seal",
    ],
    multiline: true,
  },
  {
    key: "claims",
    title: "What claims set it apart?",
    subtitle: "USPs, certifications, or 'no-X' statements.",
    placeholder: "e.g. Zero sugar, lactose-free, gut-friendly",
    examples: [
      "Zero sugar, lactose-free, no artificial sweeteners",
      "Vegan, fair-trade certified, single-origin",
      "Keeps drinks cold for 24 hours, lifetime warranty",
    ],
    multiline: true,
  },
  {
    key: "packaging",
    title: "How is it packaged?",
    subtitle: "Format, size, look. This shapes the visuals.",
    placeholder: "e.g. 330ml frosted glass bottle with matte black label",
    examples: [
      "330ml frosted glass bottle with matte black label",
      "80g kraft paper wrapper, gold foil branding",
      "750ml powder-coated bottle, sage green",
    ],
    multiline: true,
  },
  {
    key: "target_audience",
    title: "Who is it for?",
    subtitle: "Be specific — age, lifestyle, what they care about.",
    placeholder: "e.g. Urban gym-goers, 25–35, who care about clean labels",
    examples: [
      "Urban gym-goers, 25–35, who care about clean labels",
      "Mindful snackers who value craft and origin stories",
      "Outdoor commuters who hate single-use plastic",
    ],
    multiline: true,
  },
  {
    key: "tone",
    title: "What's the tone of voice?",
    subtitle: "How should the ad feel?",
    placeholder: "e.g. Bold, energetic, no-nonsense",
    examples: ["Bold, energetic, no-nonsense", "Warm, nostalgic, homemade", "Sleek, premium, minimalist"],
  },
  {
    key: "channels",
    title: "Where will this run?",
    subtitle: "Selling channels and ad platforms.",
    placeholder: "e.g. Instagram Reels, our DTC website, Amazon",
    examples: [
      "Instagram Reels and TikTok",
      "Our DTC website and Amazon listing",
      "Meta ads and in-store QR campaigns",
    ],
  },
  {
    key: "cta",
    title: "What's the call to action?",
    subtitle: "What should viewers do at the end?",
    placeholder: "e.g. Shop now at nourish.co",
    examples: ["Shop now at nourish.co", "Try the 3-bar starter pack", "Order today, free shipping over ₹999"],
  },
];

const emptyBrief: Brief = {
  brand_name: "",
  product_description: "",
  ingredients: "",
  claims: "",
  packaging: "",
  target_audience: "",
  tone: "",
  channels: "",
  cta: "",
};

function composeParagraph(brief: Brief, category: ProductCategory): string {
  return [
    `Brand: ${brief.brand_name}.`,
    `Product (${category}): ${brief.product_description}.`,
    `Key ingredients/materials: ${brief.ingredients}.`,
    `Claims and USPs: ${brief.claims}.`,
    `Packaging: ${brief.packaging}.`,
    `Target audience: ${brief.target_audience}.`,
    `Tone of voice: ${brief.tone}.`,
    `Selling channels: ${brief.channels}.`,
    `Call to action: ${brief.cta}.`,
  ].join(" ");
}

export default function CreateCarousel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<ProductCategory>("food");
  const [stepIndex, setStepIndex] = useState(-1); // -1 = category, 0..steps.length-1 = brief, steps.length = reference image, steps.length+1 = review
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspace_id");
  const generationNumber = searchParams.get("generation_number");

  useEffect(() => {
    if (!workspaceId) return;
    const fetchWorkspace = async () => {
      const { data } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
      if (data) {
        if (data.product_category) setCategory(data.product_category);
        if (data.product_brief) setBrief(data.product_brief as unknown as Brief);
        if (data.reference_image_url) {
          setReferencePreview(data.reference_image_url);
        }
      }
    };
    fetchWorkspace();
  }, [workspaceId]);

  useEffect(() => {
    if (!user) return;
    const fetchLimit = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      const remaining = (data as any)?.remaining_generations;
      if (typeof remaining === "number") setRemainingGenerations(remaining);
    };
    fetchLimit();
  }, [user]);

  const REFERENCE_STEP = steps.length; // image upload step
  const REVIEW_STEP = steps.length + 1;
  const totalSteps = steps.length + 2; // brief + reference + review
  const progress = stepIndex < 0 ? 0 : Math.min(((stepIndex + 1) / (totalSteps + 1)) * 100, 100);
  const currentStep = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
  const isReferenceStep = stepIndex === REFERENCE_STEP;
  const isReview = stepIndex === REVIEW_STEP;

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setReferenceFile(null);
      setReferencePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB.");
      return;
    }
    setReferenceFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setReferencePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (stepIndex === -1) {
      setStepIndex(0);
      return;
    }
    if (currentStep) {
      const value = brief[currentStep.key].trim();
      if (!value && !currentStep.optional) {
        toast.error("Please answer this step before continuing.");
        return;
      }
    }
    setStepIndex(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex > -1) setStepIndex(stepIndex - 1);
  };

  const handleGenerate = async () => {
    if (remainingGenerations !== null && remainingGenerations <= 0) {
      toast.error("No generations remaining.");
      return;
    }
    if (!user) return;

    const missing = steps.find((s) => !s.optional && !brief[s.key].trim());
    if (missing) {
      toast.error(`Missing: ${missing.title}`);
      setStepIndex(steps.findIndex((s) => s.key === missing.key));
      return;
    }

    setGenerating(true);
    setErrorState(null);

    try {
      const paragraph = composeParagraph(brief, category);

      const insertPayload: any = {
        user_id: user.id,
        product_category: category,
        product_description: paragraph,
        product_brief: brief as any,
        status: "pending",
      };

      if (workspaceId) insertPayload.workspace_id = workspaceId;
      if (generationNumber) insertPayload.generation_number = parseInt(generationNumber);

      const { data: gen, error: insertError } = await supabase
        .from("generations")
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload reference image if provided
      if (referenceFile) {
        const referencePath = `${user.id}/${gen.id}/reference.png`;
        const { error: uploadError } = await supabase.storage
          .from("carousel-images")
          .upload(referencePath, referenceFile, {
            contentType: referenceFile.type || "image/png",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: signed } = await supabase.storage
          .from("carousel-images")
          .createSignedUrl(referencePath, 30 * 24 * 60 * 60);

        await supabase
          .from("generations")
          .update({ reference_image_url: signed?.signedUrl || referencePath })
          .eq("id", gen.id);
      }

      const { error: fnError } = await supabase.functions.invoke("generate-context", {
        body: { generationId: gen.id },
      });

      if (fnError) throw fnError;

      navigate(`/generation/${gen.id}`);
    } catch (err: any) {
      setErrorState(await getErrorMessage(err));
      setGenerating(false);
    }
  };

  const updateField = (key: StepKey, value: string) => setBrief((b) => ({ ...b, [key]: value }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--drish-bg)", color: "var(--drish-text)" }}>
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{ borderBottom: "1px solid var(--drish-border)", backgroundColor: "rgba(10,10,10,0.9)" }}
      >
        <div className="container max-w-5xl mx-auto px-6 flex h-14 items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "var(--drish-text-2)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <main className="container max-w-xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1
            className="text-3xl font-light tracking-tight mb-2"
            style={{ color: "var(--drish-text)", letterSpacing: "-0.02em" }}
          >
            New generation
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--drish-text-2)" }}>
              A few quick questions. Drish handles the rest.
            </p>
            {remainingGenerations !== null && (
              <span
                className="text-xs px-3 py-1 rounded-full font-mono border"
                style={{
                  color: remainingGenerations > 0 ? "var(--drish-accent)" : "#8a4a4a",
                  borderColor:
                    remainingGenerations > 0 ? "rgba(245,158,11,0.2)" : "rgba(138,74,74,0.3)",
                  backgroundColor:
                    remainingGenerations > 0 ? "rgba(245,158,11,0.05)" : "rgba(138,74,74,0.05)",
                }}
              >
                {remainingGenerations} REMAINING
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div
              className="h-1 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--drish-surface)" }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progress}%`, backgroundColor: "var(--drish-accent)" }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--drish-text-3)" }}>
              <span>
                Step {Math.max(stepIndex + 1, 1)} of {totalSteps + 1}
              </span>
              <span>{isReview ? "Review" : isReferenceStep ? "Product image" : currentStep ? currentStep.key.replace("_", " ") : "Category"}</span>
            </div>
          </div>
        </div>

        {/* STEP: Category (-1) */}
        {stepIndex === -1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-light mb-2" style={{ color: "var(--drish-text)" }}>
                Pick a product category
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--drish-text-2)" }}>
                We tailor the visual treatment to the category.
              </p>
              <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger
                  className="h-10 w-full rounded-md text-sm"
                  style={{
                    backgroundColor: "var(--drish-surface)",
                    border: "1px solid var(--drish-border)",
                    color: "var(--drish-text)",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)" }}
                >
                  {categories.map((c) => (
                    <SelectItem
                      key={c.value}
                      value={c.value}
                      disabled={!c.active}
                      className="text-sm w-full data-[disabled]:pointer-events-none data-[disabled]:opacity-100"
                      style={{
                        color: c.active ? "var(--drish-text)" : "var(--drish-text-3)",
                        cursor: c.active ? "pointer" : "default",
                      }}
                    >
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>{c.label}</span>
                        {!c.active && (
                          <span
                            className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.03)",
                              border: "1px solid var(--drish-border-subtle)",
                            }}
                          >
                            Coming Soon
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP: Brief questions (0..n) */}
        {currentStep && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-light mb-2" style={{ color: "var(--drish-text)" }}>
                {currentStep.title}
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--drish-text-2)" }}>
                {currentStep.subtitle}
              </p>

              {currentStep.multiline ? (
                <textarea
                  className="w-full rounded-md text-sm leading-relaxed resize-none p-4 transition-colors"
                  style={{
                    backgroundColor: "var(--drish-surface)",
                    border: "1px solid var(--drish-border)",
                    color: "var(--drish-text)",
                    minHeight: 120,
                    outline: "none",
                  }}
                  placeholder={currentStep.placeholder}
                  value={brief[currentStep.key]}
                  onChange={(e) => updateField(currentStep.key, e.target.value)}
                  maxLength={500}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleNext();
                  }}
                />
              ) : (
                <input
                  type="text"
                  className="w-full h-11 rounded-md text-sm px-4 transition-colors"
                  style={{
                    backgroundColor: "var(--drish-surface)",
                    border: "1px solid var(--drish-border)",
                    color: "var(--drish-text)",
                    outline: "none",
                  }}
                  placeholder={currentStep.placeholder}
                  value={brief[currentStep.key]}
                  onChange={(e) => updateField(currentStep.key, e.target.value)}
                  maxLength={200}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNext();
                  }}
                />
              )}

              {/* Suggestion chips */}
              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "var(--drish-text-3)" }}>
                  Examples — tap to use
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentStep.examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => updateField(currentStep.key, ex)}
                      className="text-xs px-3 py-1.5 rounded-full transition-colors text-left"
                      style={{
                        backgroundColor: "var(--drish-surface)",
                        border: "1px solid var(--drish-border)",
                        color: "var(--drish-text-2)",
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP: Reference image upload (optional) */}
        {isReferenceStep && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-light mb-2" style={{ color: "var(--drish-text)" }}>
                Upload a product image
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--drish-text-2)" }}>
                Optional. If you upload a product photo, Drish will use it as a visual reference for Frame 1 to keep your real packaging recognizable.
              </p>

              {referencePreview ? (
                <div
                  className="relative rounded-md overflow-hidden"
                  style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}
                >
                  <img
                    src={referencePreview}
                    alt="Product reference preview"
                    className="w-full max-h-96 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleFileSelect(null)}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--drish-text)" }}
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center rounded-md cursor-pointer transition-colors p-10"
                  style={{
                    backgroundColor: "var(--drish-surface)",
                    border: "1px dashed var(--drish-border)",
                    color: "var(--drish-text-2)",
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                  <ImageIcon className="h-8 w-8 mb-3" style={{ color: "var(--drish-text-3)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--drish-text)" }}>
                    Click to upload
                  </span>
                  <span className="text-xs mt-1" style={{ color: "var(--drish-text-3)" }}>
                    PNG, JPG, WEBP — up to 10MB
                  </span>
                </label>
              )}

              <p className="text-xs mt-4" style={{ color: "var(--drish-text-3)" }}>
                You can skip this step — Drish will generate Frame 1 from your brief alone.
              </p>
            </div>
          </div>
        )}

        {/* STEP: Review */}
        {isReview && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-light mb-2" style={{ color: "var(--drish-text)" }}>
                Review your brief
              </h2>
              <p className="text-sm mb-6" style={{ color: "var(--drish-text-2)" }}>
                Here's the structured paragraph we'll send to the AI.
              </p>

              <div
                className="rounded-md p-5 text-sm leading-relaxed"
                style={{
                  backgroundColor: "var(--drish-surface)",
                  border: "1px solid var(--drish-border)",
                  color: "var(--drish-text)",
                }}
              >
                {composeParagraph(brief, category)}
              </div>

              <div className="mt-6 space-y-2">
                {steps.map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => setStepIndex(i)}
                    className="w-full flex items-start gap-3 text-left p-3 rounded-md transition-colors"
                    style={{ border: "1px solid var(--drish-border-subtle)" }}
                  >
                    <Check
                      className="h-3.5 w-3.5 mt-0.5 shrink-0"
                      style={{ color: brief[s.key] ? "var(--drish-accent)" : "var(--drish-text-3)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--drish-text-3)" }}>
                        {s.key.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm truncate" style={{ color: "var(--drish-text)" }}>
                        {brief[s.key] || <span style={{ color: "var(--drish-text-3)" }}>— not set —</span>}
                      </div>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => setStepIndex(REFERENCE_STEP)}
                  className="w-full flex items-start gap-3 text-left p-3 rounded-md transition-colors"
                  style={{ border: "1px solid var(--drish-border-subtle)" }}
                >
                  <Check
                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                    style={{ color: referencePreview ? "var(--drish-accent)" : "var(--drish-text-3)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--drish-text-3)" }}>
                      product image
                    </div>
                    {referencePreview ? (
                      <img
                        src={referencePreview}
                        alt="Reference"
                        className="mt-1 h-16 w-16 object-cover rounded"
                      />
                    ) : (
                      <div className="text-sm" style={{ color: "var(--drish-text-3)" }}>
                        — not uploaded (optional) —
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {errorState && (
          <div
            className="mt-6 w-full rounded-md text-sm p-4 flex items-start gap-2 border"
            style={{
              backgroundColor: "rgba(138, 74, 74, 0.05)",
              borderColor: "rgba(138, 74, 74, 0.3)",
              color: "#e57f7f",
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorState}</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mt-10">
          <button
            onClick={handleBack}
            disabled={stepIndex <= -1 || generating}
            className="h-10 px-4 rounded-md text-sm flex items-center gap-2 transition-opacity"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--drish-border)",
              color: "var(--drish-text-2)",
              opacity: stepIndex <= -1 || generating ? 0.4 : 1,
              cursor: stepIndex <= -1 || generating ? "not-allowed" : "pointer",
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          {!isReview ? (
            <button
              onClick={handleNext}
              className="h-10 px-5 rounded-md text-sm font-medium flex items-center gap-2"
              style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : remainingGenerations !== null && remainingGenerations <= 0 ? (
            <div
              className="h-10 px-5 rounded-md text-sm font-medium flex items-center justify-center border border-dashed"
              style={{
                backgroundColor: "rgba(138, 74, 74, 0.05)",
                borderColor: "rgba(138, 74, 74, 0.3)",
                color: "#e57f7f",
              }}
            >
              No generations remaining
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="h-10 px-5 rounded-md text-sm font-medium flex items-center gap-2 transition-opacity"
              style={{
                backgroundColor: "var(--drish-accent)",
                color: "var(--drish-bg)",
                opacity: generating ? 0.5 : 1,
                cursor: generating ? "not-allowed" : "pointer",
              }}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Building context...
                </>
              ) : (
                <>
                  Generate carousel <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

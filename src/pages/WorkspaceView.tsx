import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Check, Upload, X, ImageIcon, Calendar, Image, Play, Sparkles, LayoutTemplate } from "lucide-react";
import { getErrorMessage } from "@/utils/errorHandling";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database, Tables } from "@/integrations/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];
type Workspace = Tables<"workspaces">;
type Generation = Tables<"generations">;

// --- Brief Setup Definitions ---
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

export default function WorkspaceView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);
  const [generatingGenNumber, setGeneratingGenNumber] = useState<number | null>(null);
  const [activeGenNumber, setActiveGenNumber] = useState<number>(1);
  
  // Brief State
  const [category, setCategory] = useState<ProductCategory>("food");
  const [stepIndex, setStepIndex] = useState(-1);
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [savingBrief, setSavingBrief] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    
    const fetchWorkspace = async () => {
      setLoading(true);
      const { data: wsData, error: wsError } = await supabase.from("workspaces").select("*").eq("id", id).single();
      if (wsError) {
        toast.error("Failed to load workspace");
        navigate("/dashboard");
        return;
      }
      setWorkspace(wsData);
      
      const { data: genData } = await supabase.from("generations").select("*").eq("workspace_id", id).order("created_at", { ascending: false });
      setGenerations(genData ?? []);
      
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (profile && typeof (profile as any).remaining_generations === "number") {
        setRemainingGenerations((profile as any).remaining_generations);
      }
      
      setLoading(false);
    };
    
    fetchWorkspace();
    
    const interval = setInterval(() => {
      fetchWorkspace();
    }, 5000);
    return () => clearInterval(interval);
  }, [id, user, navigate]);

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
    const currentStep = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
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

  const handleSaveBrief = async () => {
    if (!user || !workspace) return;

    const missing = steps.find((s) => !s.optional && !brief[s.key].trim());
    if (missing) {
      toast.error(`Missing: ${missing.title}`);
      setStepIndex(steps.findIndex((s) => s.key === missing.key));
      return;
    }

    setSavingBrief(true);
    setErrorState(null);

    try {
      const paragraph = composeParagraph(brief, category);
      let refUrl = null;

      if (referenceFile) {
        const referencePath = `${user.id}/workspace_${workspace.id}/reference.png`;
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

        refUrl = signed?.signedUrl || referencePath;
      }

      const { data, error } = await supabase.from("workspaces").update({
        product_description: paragraph,
        product_category: category,
        product_brief: brief as any,
        reference_image_url: refUrl,
      }).eq("id", workspace.id).select().single();

      if (error) throw error;
      setWorkspace(data);
      toast.success("Product details saved!");
    } catch (err: any) {
      setErrorState(await getErrorMessage(err));
    } finally {
      setSavingBrief(false);
    }
  };

  const updateField = (key: StepKey, value: string) => setBrief((b) => ({ ...b, [key]: value }));

  const generateCarousel = async (generationNumber: number) => {
    if (!workspace || !workspace.product_description) {
      toast.error("Please complete the workspace product setup first.");
      return;
    }
    if (remainingGenerations !== null && remainingGenerations <= 0) {
      toast.error("No generations remaining.");
      return;
    }
    setGeneratingGenNumber(generationNumber);
    try {
      const { data: gen, error: insertError } = await supabase
        .from("generations")
        .insert({
          user_id: user!.id,
          workspace_id: workspace.id,
          generation_number: generationNumber,
          generation_type: "carousel",
          product_category: workspace.product_category || "food",
          product_description: workspace.product_description,
          product_brief: workspace.product_brief as any,
          reference_image_url: workspace.reference_image_url,
          status: "pending",
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Copy workspace reference image into this generation's storage folder.
      // generate-slide reads from ${user_id}/${generationId}/reference.png —
      // the workspace stores it at workspace_${workspace.id}/reference.png, so we must copy it.
      if (workspace.reference_image_url) {
        try {
          const srcPath = `${user!.id}/workspace_${workspace.id}/reference.png`;
          const destPath = `${user!.id}/${gen.id}/reference.png`;
          const { data: fileData, error: dlErr } = await supabase.storage
            .from("carousel-images")
            .download(srcPath);
          if (!dlErr && fileData) {
            await supabase.storage
              .from("carousel-images")
              .upload(destPath, fileData, { contentType: "image/png", upsert: true });
          }
        } catch (copyErr) {
          console.warn("Could not copy workspace reference image:", copyErr);
          // Non-fatal — generation continues without reference image
        }
      }

      // Navigate immediately to the generation viewer to show progress or live updates
      navigate(`/generation/${gen.id}`);

      const { error: fnError } = await supabase.functions.invoke("generate-context", {
        body: { generationId: gen.id },
      });

      if (fnError) throw fnError;
    } catch (err: any) {
      const msg = err.message || "Failed to generate carousel";
      toast.error(msg);
      console.error(err);
    } finally {
      setGeneratingGenNumber(null);
    }
  };

  if (loading && !workspace) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]" style={{ backgroundColor: "var(--drish-bg)" }}>
        <div className="flex flex-col items-center gap-4 animate-pulse-soft">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--drish-accent)]" />
          <span className="text-sm font-light tracking-wide text-zinc-500">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  // --- BRIEF FLOW ---
  if (!workspace.product_description) {
    const REFERENCE_STEP = steps.length;
    const REVIEW_STEP = steps.length + 1;
    const totalSteps = steps.length + 2;
    const progress = stepIndex < 0 ? 0 : Math.min(((stepIndex + 1) / (totalSteps + 1)) * 100, 100);
    const currentStep = stepIndex >= 0 && stepIndex < steps.length ? steps[stepIndex] : null;
    const isReferenceStep = stepIndex === REFERENCE_STEP;
    const isReview = stepIndex === REVIEW_STEP;

    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-zinc-100 font-sans animate-fade-in" style={{ backgroundColor: "var(--drish-bg)" }}>
        <header
          className="sticky top-0 z-50 backdrop-blur-md border-b border-zinc-900 bg-black/40"
          style={{ borderBottom: "1px solid var(--drish-border)", backgroundColor: "rgba(10,10,10,0.8)" }}
        >
          <div className="container max-w-5xl mx-auto px-6 flex h-14 items-center justify-between">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-medium group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> 
              <span>Dashboard</span>
            </Link>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
              Setup Wizard
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto px-6 py-12 md:py-20 animate-fade-in">
          <div className="mb-8">
            <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--drish-accent)] uppercase block mb-1">
              Campaign Setup
            </span>
            <h1
              className="text-2xl font-light tracking-tight text-zinc-100 mb-2"
              style={{ letterSpacing: "-0.02em", color: "var(--drish-text)" }}
            >
              {workspace.name}
            </h1>
            <p className="text-xs text-zinc-400">
              Provide your product details below to configure the generation model.
            </p>

            <div className="mt-8">
              <div className="h-1 w-full rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(168,197,181,0.3)]"
                  style={{ width: `${progress}%`, backgroundColor: "var(--drish-accent)" }}
                />
              </div>
              <div className="flex justify-between mt-3 text-xs font-mono text-zinc-500">
                <span>
                  Step {Math.max(stepIndex + 2, 1)} of {totalSteps + 1}
                </span>
                <span className="uppercase tracking-wider">
                  {isReview 
                    ? "Review Details" 
                    : isReferenceStep 
                      ? "Reference Image" 
                      : currentStep 
                        ? currentStep.key.replace("_", " ") 
                        : "Category"}
                </span>
              </div>
            </div>
          </div>

          <div className="min-h-[280px] flex flex-col justify-start">
            {stepIndex === -1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-3">
                  <h2 className="text-lg font-medium text-zinc-100" style={{ color: "var(--drish-text)" }}>Select a product category</h2>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    This tailors the visual templates and tone patterns to match industry standards.
                  </p>
                  <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                    <SelectTrigger
                      className="h-10 w-full rounded-lg text-xs px-4 transition-all"
                      style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)", color: "var(--drish-text)" }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)" }}>
                      {categories.map((c) => (
                        <SelectItem
                          key={c.value}
                          value={c.value}
                          disabled={!c.active}
                          className="text-xs cursor-pointer hover:bg-zinc-800/50"
                          style={{ color: "var(--drish-text)" }}
                        >
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-lg font-medium text-zinc-100" style={{ color: "var(--drish-text)" }}>{currentStep.title}</h2>
                  <p className="text-xs text-zinc-500">{currentStep.subtitle}</p>
                </div>

                <div className="space-y-4">
                  {currentStep.multiline ? (
                    <textarea
                      className="w-full rounded-lg text-xs leading-relaxed p-4 min-h-[140px] resize-none outline-none transition-all duration-150"
                      style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)", color: "var(--drish-text)" }}
                      placeholder={currentStep.placeholder}
                      value={brief[currentStep.key]}
                      onChange={(e) => updateField(currentStep.key, e.target.value)}
                      maxLength={500}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleNext(); }}
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full h-10 rounded-lg text-xs px-4 outline-none transition-all duration-150"
                      style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)", color: "var(--drish-text)" }}
                      placeholder={currentStep.placeholder}
                      value={brief[currentStep.key]}
                      onChange={(e) => updateField(currentStep.key, e.target.value)}
                      maxLength={200}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
                    />
                  )}

                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-550 block">
                      Suggestions:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {currentStep.examples.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => updateField(currentStep.key, ex)}
                          className="text-[11px] px-3.5 py-1.5 rounded-full transition-colors text-left"
                          style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)", color: "var(--drish-text-2)" }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = "var(--drish-accent-border)";
                            e.currentTarget.style.backgroundColor = "var(--drish-surface-2)";
                            e.currentTarget.style.color = "var(--drish-text)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = "var(--drish-border)";
                            e.currentTarget.style.backgroundColor = "var(--drish-surface)";
                            e.currentTarget.style.color = "var(--drish-text-2)";
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

            {isReferenceStep && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-lg font-medium text-zinc-100" style={{ color: "var(--drish-text)" }}>Upload a product image</h2>
                  <p className="text-xs text-zinc-500">
                    Provide a clean packaging or product photo. Our models extract layout cues and color themes directly.
                  </p>
                </div>

                <div>
                  {referencePreview ? (
                    <div className="relative rounded-lg overflow-hidden p-3 shadow-xl" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}>
                      <img src={referencePreview} alt="Reference" className="w-full max-h-80 object-contain rounded" />
                      <button 
                        type="button" 
                        onClick={() => handleFileSelect(null)} 
                        className="absolute top-5 right-5 h-8 w-8 rounded-full flex items-center justify-center bg-black/80 hover:bg-black text-zinc-300 hover:text-white border border-white/10 transition-colors backdrop-blur-md"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center rounded-lg cursor-pointer p-12 transition-all group"
                      style={{ border: "1px dashed var(--drish-border)", backgroundColor: "var(--drish-surface)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "var(--drish-accent-border)";
                        e.currentTarget.style.backgroundColor = "var(--drish-surface-2)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "var(--drish-border)";
                        e.currentTarget.style.backgroundColor = "var(--drish-surface)";
                      }}
                    >
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0] || null)} />
                      <div className="h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-850 mb-4 group-hover:scale-105 transition-transform group-hover:border-[var(--drish-accent)]/25 group-hover:text-[var(--drish-accent)]">
                        <ImageIcon className="h-5 w-5 opacity-60" />
                      </div>
                      <span className="text-xs font-semibold text-zinc-350">Click to upload image</span>
                      <span className="text-[10px] text-zinc-500 mt-1">Supports PNG, JPG, or WEBP up to 10MB</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {isReview && (
              <div className="space-y-6 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-lg font-medium text-zinc-100" style={{ color: "var(--drish-text)" }}>Review your brief</h2>
                  <p className="text-xs text-zinc-500">
                    Verify all the fields look correct. This structured statement is compiled to drive prompt engineering.
                  </p>
                </div>
                <div className="rounded-lg p-5 text-xs leading-relaxed text-zinc-300 shadow-inner" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}>
                  {composeParagraph(brief, category)}
                </div>
              </div>
            )}

            {errorState && (
              <div className="mt-6 w-full rounded-lg text-xs p-4 flex items-start gap-3 border border-red-950/40 bg-red-950/10 text-red-400 animate-pulse-soft">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorState}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 mt-12 pt-6 border-t border-zinc-900" style={{ borderColor: "var(--drish-border)" }}>
            <button
              onClick={handleBack}
              disabled={stepIndex <= -1 || savingBrief}
              className="h-10 px-4 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--drish-surface)", borderColor: "var(--drish-border)", color: "var(--drish-text-2)" }}
              onMouseEnter={e => {
                if (stepIndex > -1 && !savingBrief) {
                  e.currentTarget.style.backgroundColor = "var(--drish-surface-2)";
                  e.currentTarget.style.color = "var(--drish-text)";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = "var(--drish-surface)";
                e.currentTarget.style.color = "var(--drish-text-2)";
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            {!isReview ? (
              <button
                onClick={handleNext}
                className="h-10 px-5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSaveBrief}
                disabled={savingBrief}
                className="h-10 px-5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
              >
                {savingBrief ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>Save Product Details</span>
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }
  // --- WORKSPACE DASHBOARD (GENERATIONS) ---
  const maxGen = generations.length > 0 ? Math.max(...generations.map(g => g.generation_number || 1)) : 0;
  const generationTabs = Array.from({ length: Math.max(1, maxGen + 1) }, (_, i) => i + 1);

  // Parse saved brief for display
  const savedBrief = workspace.product_brief as any;

  return (
    <div className="relative min-h-screen overflow-hidden font-sans" style={{ backgroundColor: "var(--drish-bg)", color: "var(--drish-text)" }}>

      {/* Fixed header — matches GenerationView pattern */}
      <header
        className="fixed top-0 w-full z-50 h-14 flex items-center justify-between px-6 backdrop-blur-xl"
        style={{ borderBottom: "1px solid var(--drish-border)", backgroundColor: "rgba(10,10,10,0.9)" }}
      >
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: "var(--drish-text-2)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-2)")}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>

        {remainingGenerations !== null && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div className="flex items-baseline gap-1 text-xs" style={{ color: "var(--drish-text-2)" }}>
              <span className="font-light tracking-wide uppercase text-[9px]">Gens Remaining</span>
              <span className="font-mono font-bold text-amber-500">{remainingGenerations}</span>
            </div>
          </div>
        )}
      </header>

      {/* Full-viewport main — flex-row on desktop, each panel independently scrolls */}
      <main className="relative z-10 flex flex-col lg:flex-row h-screen pt-14">

        {/* LEFT PANEL — independently scrollable, 50% width on desktop */}
        <div
          className="w-full lg:w-1/2 h-auto lg:h-full flex flex-col shrink-0"
          style={{ borderRight: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}
        >
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">

            {/* Workspace title & category */}
            <div className="space-y-2">
              <h1 className="text-base font-medium" style={{ color: "var(--drish-text)" }}>
                {workspace.name}
              </h1>
              {workspace.product_category && (
                <span
                  className="inline-block text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "var(--drish-accent-dim, rgba(255,255,255,0.05))", border: "1px solid var(--drish-accent-border)", color: "var(--drish-accent)" }}
                >
                  {workspace.product_category}
                </span>
              )}
            </div>

            {/* Reference Image */}
            {workspace.reference_image_url && (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-bg)" }}>
                <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: "var(--drish-border)", backgroundColor: "var(--drish-surface-2)" }}>
                  <ImageIcon className="h-3.5 w-3.5" style={{ color: "var(--drish-text-3)" }} />
                  <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>Reference Image</span>
                </div>
                <div className="relative overflow-hidden bg-zinc-950 flex items-center justify-center p-4">
                  <img
                    src={workspace.reference_image_url}
                    alt="Reference"
                    className="max-h-64 max-w-full object-contain rounded transition-transform duration-500 hover:scale-[1.02]"
                    style={{ border: "1px solid var(--drish-border)" }}
                  />
                </div>
              </div>
            )}

            {/* Product Brief — all fields, no line-clamp */}
            {savedBrief && (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-bg)" }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--drish-border)", backgroundColor: "var(--drish-surface-2)" }}>
                  <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>Product Brief</span>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {savedBrief.brand_name && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Brand</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.brand_name}</div>
                    </div>
                  )}
                  {savedBrief.product_description && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Product</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.product_description}</div>
                    </div>
                  )}
                  {savedBrief.ingredients && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Ingredients</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.ingredients}</div>
                    </div>
                  )}
                  {savedBrief.claims && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Claims</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.claims}</div>
                    </div>
                  )}
                  {savedBrief.packaging && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Packaging</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.packaging}</div>
                    </div>
                  )}
                  {savedBrief.target_audience && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Audience</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.target_audience}</div>
                    </div>
                  )}
                  {savedBrief.tone && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Tone</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.tone}</div>
                    </div>
                  )}
                  {savedBrief.channels && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>Channels</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.channels}</div>
                    </div>
                  )}
                  {savedBrief.cta && (
                    <div className="space-y-1 pt-3" style={{ borderTop: "1px solid var(--drish-border)" }}>
                      <div className="text-[9px] font-mono uppercase tracking-widest font-bold" style={{ color: "var(--drish-text-3)" }}>CTA</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--drish-text-2)" }}>{savedBrief.cta}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* RIGHT PANEL — independently scrollable, flex-1 */}
        <div className="flex-1 h-auto lg:h-full flex flex-col overflow-hidden" style={{ backgroundColor: "var(--drish-bg)" }}>

          {/* Generation tab bar — pinned at top of right panel */}
          <div className="flex items-center gap-2 px-6 py-4 border-b shrink-0 overflow-x-auto custom-scrollbar" style={{ borderColor: "var(--drish-border)", backgroundColor: "var(--drish-surface)" }}>
            {generationTabs.map((genNum) => (
              <button
                key={genNum}
                onClick={() => setActiveGenNumber(genNum)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all shrink-0 ${activeGenNumber === genNum ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                style={{
                  backgroundColor: activeGenNumber === genNum ? "var(--drish-surface-2)" : "transparent",
                  border: activeGenNumber === genNum ? "1px solid var(--drish-border)" : "1px solid transparent",
                }}
              >
                Generation {genNum}
              </button>
            ))}
          </div>

          {/* Generation content — 2×2 card grid, fills remaining height */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {(() => {
              const genNum = activeGenNumber;
              const genItems = generations.filter(g => g.generation_number === genNum);
              const hasSuccessfulCarousel = genItems.some(g => g.status === "done" && (!g.generation_type || g.generation_type === "carousel"));

              const generatingCarousel = genItems.find(g => (g.status === "pending" || g.status === "generating") && (!g.generation_type || g.generation_type === "carousel"));
              const isGenerating = !!generatingCarousel || generatingGenNumber === genNum;

              const hasFailedCarousel = !hasSuccessfulCarousel && genItems.some(g => g.status === "failed" && (!g.generation_type || g.generation_type === "carousel"));
              const latestCarouselGen = genItems.find(g => !g.generation_type || g.generation_type === "carousel");

              return (
                <div
                  key={genNum}
                  className="h-full rounded-lg overflow-hidden flex flex-col"
                  style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}
                >
                  <div className="p-6 flex-1 flex flex-col min-h-0" style={{ minHeight: "480px" }}>
                    <div className="grid grid-cols-2 grid-rows-2 gap-4 flex-1 min-h-0">

                      {/* Carousel */}
                      <button
                        onClick={() => {
                          if (latestCarouselGen) {
                            if (latestCarouselGen.status === "failed") {
                              generateCarousel(genNum);
                            } else {
                              navigate(`/generation/${latestCarouselGen.id}`);
                            }
                          } else {
                            generateCarousel(genNum);
                          }
                        }}
                        className="flex flex-col items-start justify-between p-6 rounded-lg transition-all duration-300 group text-left w-full h-full hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
                        style={{
                          backgroundColor: "var(--drish-bg)",
                          border: hasFailedCarousel ? "1px solid var(--drish-error-border, #ef444450)" : "1px solid var(--drish-border)"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "var(--drish-accent-border)";
                          e.currentTarget.style.backgroundColor = "var(--drish-surface-2)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = hasFailedCarousel ? "var(--drish-error-border, #ef444450)" : "var(--drish-border)";
                          e.currentTarget.style.backgroundColor = "var(--drish-bg)";
                        }}
                      >
                        <div className="h-11 w-11 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 text-zinc-400 transition-all duration-300 group-hover:bg-[var(--drish-accent)] group-hover:text-[var(--drish-bg)] group-hover:border-transparent">
                          {isGenerating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : hasSuccessfulCarousel ? (
                            <Check className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <LayoutTemplate className="h-5 w-5" />
                          )}
                        </div>
                        <div className="w-full">
                          <div className={`font-semibold text-sm mb-1 transition-colors ${hasSuccessfulCarousel ? "text-emerald-500" : hasFailedCarousel && !isGenerating ? "text-rose-500" : "text-zinc-200 group-hover:text-zinc-150"}`}>
                            {isGenerating ? "Generating..." : hasSuccessfulCarousel ? "Generated" : hasFailedCarousel ? "Failed - Retry" : "Generate Carousel"}
                          </div>
                          {isGenerating ? (
                            <div className="mt-3 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                              <div className="h-full bg-[var(--drish-accent)] rounded-full animate-pulse w-1/2"></div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-zinc-500 leading-normal">
                              {hasSuccessfulCarousel ? "Carousel generated successfully" : "Multi-frame ad sequence"}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Ad Creative 1 */}
                      <button
                        className="flex flex-col items-start justify-between p-6 rounded-lg text-left cursor-not-allowed opacity-40 w-full h-full"
                        disabled
                        style={{ backgroundColor: "var(--drish-bg)", border: "1px dashed var(--drish-border)" }}
                      >
                        <div className="h-11 w-11 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-900 text-zinc-700">
                          <Image className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-zinc-400 mb-1">Ad Creative 1</div>
                          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded inline-block mt-1">Coming Soon</div>
                        </div>
                      </button>

                      {/* Reel */}
                      <button
                        className="flex flex-col items-start justify-between p-6 rounded-lg text-left cursor-not-allowed opacity-40 w-full h-full"
                        disabled
                        style={{ backgroundColor: "var(--drish-bg)", border: "1px dashed var(--drish-border)" }}
                      >
                        <div className="h-11 w-11 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-900 text-zinc-700">
                          <Play className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-zinc-400 mb-1">Generate Reel</div>
                          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded inline-block mt-1">Coming Soon</div>
                        </div>
                      </button>

                      {/* AI Creative 2 */}
                      <button
                        className="flex flex-col items-start justify-between p-6 rounded-lg text-left cursor-not-allowed opacity-40 w-full h-full"
                        disabled
                        style={{ backgroundColor: "var(--drish-bg)", border: "1px dashed var(--drish-border)" }}
                      >
                        <div className="h-11 w-11 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-900 text-zinc-700">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-zinc-400 mb-1">AI Creative 2</div>
                          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold bg-zinc-900/60 border border-zinc-800 px-2 py-0.5 rounded inline-block mt-1">Coming Soon</div>
                        </div>
                      </button>

                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </main>
    </div>
  );
}

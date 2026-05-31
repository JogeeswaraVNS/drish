import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Loader2, CheckCircle2,
  RefreshCw, Eye, ImageIcon, Download, DownloadCloud, Sparkles, ArrowRight, X, Type, Copy, FileText, Linkedin, Instagram, AlertCircle, Play
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/errorHandling";
import AnimatedReel from "@/components/AnimatedReel";

interface AdPlanFrame {
  frame_number: number;
  label: string;
  image_generation_prompt?: string;
  text_overlay?: string;
  voiceover_text?: string;
}

interface AdPlan {
  frames?: AdPlanFrame[];
}

interface SocialPost {
  post: string;
  hashtags: string[];
}

interface SocialCaption {
  caption: string;
  hashtags: string[];
}

interface SocialContent {
  linkedin: SocialPost;
  instagram: SocialCaption;
}

interface Generation {
  id: string;
  user_id: string;
  product_category: string;
  product_description: string;
  status: string;
  ad_plan: AdPlan | null;
  reference_image_url: string | null;
  aspect_ratio: string | null;
  social_content: SocialContent | null;
  current_step: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface Frame {
  id: string;
  generation_id: string;
  frame_number: number;
  image_url: string;
  text_overlay: string | null;
  voiceover_text: string | null;
  created_at: string;
}

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 (Square)", class: "aspect-square" },
  { value: "4:5", label: "4:5 (Portrait)", class: "aspect-[4/5]" },
  { value: "16:9", label: "16:9 (Landscape)", class: "aspect-video" },
  { value: "9:16", label: "9:16 (Story/Reel)", class: "aspect-[9/16]" },
];

const FONT_OPTIONS = [
  "Playfair Display",  // ⭐ Premium food, heritage brands
  "Cormorant Garamond", // ⭐ Ultra-luxury, artisan
  "Lora",              // Warm, craft, storytelling
  "Merriweather",      // Readable, trustworthy
  "Montserrat",        // Modern D2C, versatile
  "Raleway",           // Elegant, minimal
  "Poppins",           // Friendly, clean
  "DM Serif Display",  // Editorial, lifestyle
  "Oswald",            // Bold hooks (use sparingly)
  "Inter",             // Fallback/UI text
];

const FONT_WEIGHTS: Record<string, { label: string; value: string }[]> = {
  "Playfair Display": [
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
    { label: "ExtraBold", value: "800" },
    { label: "Black", value: "900" },
  ],
  "Cormorant Garamond": [
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
  ],
  "Lora": [
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
  ],
  "Merriweather": [
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Bold", value: "700" },
    { label: "Black", value: "900" },
  ],
  "Montserrat": [
    { label: "Thin", value: "100" },
    { label: "ExtraLight", value: "200" },
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
    { label: "ExtraBold", value: "800" },
    { label: "Black", value: "900" },
  ],
  "Raleway": [
    { label: "Thin", value: "100" },
    { label: "ExtraLight", value: "200" },
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
    { label: "ExtraBold", value: "800" },
    { label: "Black", value: "900" },
  ],
  "Poppins": [
    { label: "Thin", value: "100" },
    { label: "ExtraLight", value: "200" },
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
    { label: "ExtraBold", value: "800" },
    { label: "Black", value: "900" },
  ],
  "DM Serif Display": [
    { label: "Regular", value: "400" },
  ],
  "Oswald": [
    { label: "ExtraLight", value: "200" },
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
  ],
  "Inter": [
    { label: "Thin", value: "100" },
    { label: "ExtraLight", value: "200" },
    { label: "Light", value: "300" },
    { label: "Regular", value: "400" },
    { label: "Medium", value: "500" },
    { label: "SemiBold", value: "600" },
    { label: "Bold", value: "700" },
    { label: "ExtraBold", value: "800" },
    { label: "Black", value: "900" },
  ],
};
const COLOR_OPTIONS = [
  { label: "White", value: "#ffffff" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Black", value: "#000000" },
];

declare global {
  interface Window {
    JSZip: new () => {
      file: (name: string, data: Blob) => void;
      generateAsync: (opts: { type: string }) => Promise<Blob>;
    };
  }
}

export default function GenerationView() {
  const { id } = useParams<{ id: string }>();
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [panelSlideIndex, setPanelSlideIndex] = useState(0);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [aspectLocked, setAspectLocked] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<{ prompt: string; frameNumber: number } | null>(null);
  const [repromptFrame, setRepromptFrame] = useState<{ frameNumber: number, prompt: string } | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialContent, setSocialContent] = useState<SocialContent | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [frameErrors, setFrameErrors] = useState<{ [frame: number]: string }>({});

  const [showFinalSlides, setShowFinalSlides] = useState(false);
  const [compositedFrames, setCompositedFrames] = useState<{ [id: number]: string }>({});
  const [isCompositing, setIsCompositing] = useState(false);

  const [selectedFont, setSelectedFont] = useState("Playfair Display");
  const [selectedWeight, setSelectedWeight] = useState("400");
  const [selectedSize, setSelectedSize] = useState(40);
  const [selectedColor, setSelectedColor] = useState("#ffffff");

  // Local Edits and Slide Navigation
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [localTexts, setLocalTexts] = useState<{ [id: number]: { copy: string, vo: string } }>({});
  const [originalImageUrls, setOriginalImageUrls] = useState<{ [id: number]: string }>({});
  const [localSizeInput, setLocalSizeInput] = useState(selectedSize.toString());

  const [isAnimatingReel, setIsAnimatingReel] = useState(false);

  const handleAnimateReel = () => {
    setIsAnimatingReel(true);
  };

  useEffect(() => {
    setLocalSizeInput(selectedSize.toString());
  }, [selectedSize]);

  useEffect(() => {
    // Inject Google Fonts properly to ensure Canvas can access them
    const link = document.createElement("link");
    const families = [
      "Playfair+Display:wght@400;500;600;700;800;900",
      "Cormorant+Garamond:wght@300;400;500;600;700",
      "Lora:wght@400;500;600;700",
      "Merriweather:wght@300;400;700;900",
      "Montserrat:wght@100;200;300;400;500;600;700;800;900",
      "Raleway:wght@100;200;300;400;500;600;700;800;900",
      "Poppins:wght@100;200;300;400;500;600;700;800;900",
      "DM+Serif+Display",
      "Oswald:wght@200;300;400;500;600;700",
      "Inter:wght@100;200;300;400;500;600;700;800;900"
    ];
    link.href = `https://fonts.googleapis.com/css2?family=${families.join("&family=")}&display=swap`;
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);

  const fetchData = useCallback(async (isInitialLoad: boolean = false) => {
    if (!id) return;
    try {
      const { data: gen, error: genError } = await supabase
        .from("generations")
        .select("*")
        .eq("id", id)
        .single();

      if (genError) throw genError;

      if (gen) {
        const currentGen = gen as unknown as Generation;

        if (isInitialLoad === true && currentGen.current_step?.includes("generating") && currentGen.current_step?.startsWith("slide_")) {
          const frameNumMatch = currentGen.current_step.match(/slide_(\d+)_generating/);
          let previousStep = "context_done";
          if (frameNumMatch && parseInt(frameNumMatch[1]) > 1) {
            previousStep = `slide_${parseInt(frameNumMatch[1]) - 1}_done`;
          }
          await supabase.from("generations").update({ current_step: previousStep, status: "pending" }).eq("id", id);
          currentGen.current_step = previousStep;
          currentGen.status = "pending";
        }

        setGeneration(currentGen);
        if (currentGen.aspect_ratio) {
          setAspectRatio(currentGen.aspect_ratio);
          setAspectLocked(true);
        }
        if (currentGen.social_content && !socialLoading) {
          setSocialContent(currentGen.social_content);
        }
        const { data: f, error: framesError } = await supabase
          .from("generation_frames")
          .select("*")
          .eq("generation_id", id)
          .order("frame_number");

        if (framesError) throw framesError;
        setFrames((f ?? []) as Frame[]);
      }
    } catch (err: unknown) {
      console.error("Error fetching data:", err);
      toast.error("Failed to load generation data.");
    } finally {
      setLoading(false);
    }
  }, [id, socialLoading]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (actionLoading && actionLoading.startsWith("slide-")) {
        e.preventDefault();
        // The standard property to trigger the confirmation dialog. Most browsers ignore the text but still prompt.
        e.returnValue = "Leaving this page will stop the image generation. Are you sure?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [actionLoading]);

  useEffect(() => {
    if (!generation) return;
    const isActive = generation.current_step?.includes("generating") || generation.status === "pending";
    if (!isActive) return;
    const interval = setInterval(() => fetchData(false), 3000);
    return () => clearInterval(interval);
  }, [generation, fetchData]);

  useEffect(() => {
    if (generation?.current_step === "done" && frames.length === 5) {
      setShowScrollHint(true);
      const timer = setTimeout(() => setShowScrollHint(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [generation?.current_step, frames.length]);

  const compositeSingleFrameWorker = async (srcUrl: string, copyText: string, voText: string, font: string, weight: string, size: number, color: string) => {
    return new Promise<string>((resolve, reject) => {
      if (!srcUrl) return reject("No srcUrl");
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("no context");

        ctx.drawImage(img, 0, 0);

        const drawTextSegment = async (text: string, position: 'top' | 'bottom') => {
          if (!text) return;
          ctx.save();

          const gradientHeight = img.height * 0.40;
          const gradient = ctx.createLinearGradient(
            0, position === 'top' ? 0 : img.height - gradientHeight,
            0, position === 'top' ? gradientHeight : img.height
          );
          if (position === 'top') {
            gradient.addColorStop(0, "rgba(0,0,0,0.9)");
            gradient.addColorStop(0.5, "rgba(0,0,0,0.5)");
            gradient.addColorStop(1, "rgba(0,0,0,0)");
          } else {
            gradient.addColorStop(0, "rgba(0,0,0,0)");
            gradient.addColorStop(0.5, "rgba(0,0,0,0.5)");
            gradient.addColorStop(1, "rgba(0,0,0,0.9)");
          }

          ctx.fillStyle = gradient;
          if (position === 'top') {
            ctx.fillRect(0, 0, img.width, gradientHeight);
          } else {
            ctx.fillRect(0, img.height - gradientHeight, img.width, gradientHeight);
          }

          const baseScale = Math.min(img.width, img.height);
          const pxSize = Math.floor(baseScale * (size / 1000));
          const fontWeight = weight || '400';

          const fontSpec = `${fontWeight} ${pxSize}px "${font}"`;
          try {
            // Ensure font is actually loaded before drawing
            await document.fonts.load(fontSpec);
            if (!document.fonts.check(fontSpec)) {
              console.log("Font not ready, attempting reload...");
              await document.fonts.load(fontSpec);
            }
          } catch (e) {
            console.log("Font load error", e);
          }

          ctx.font = `${fontSpec}, sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.textBaseline = position === 'top' ? 'top' : 'bottom';

          const maxWidth = img.width * 0.85;
          const words = text.split(' ');
          let line = '';
          const lines = [];

          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          const lineHeight = pxSize * 1.3;
          const padY = img.height * 0.08;
          const startY = position === 'top' ? padY : img.height - padY - ((lines.length - 1) * lineHeight);

          lines.forEach((l, i) => {
            const yPos = startY + (i * lineHeight);
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = pxSize * 0.2;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = pxSize * 0.05;
            ctx.fillText(l.trim(), img.width / 2, yPos);
          });

          ctx.restore();
        };

        if (copyText) await drawTextSegment(copyText, 'top');
        if (voText) await drawTextSegment(voText, 'bottom');

        resolve(canvas.toDataURL("image/png", 1.0));
      };
      img.onerror = reject;
      img.src = srcUrl;
    });
  };

  const handleOpenSlides = async (startAnimation = false) => {
    const initialLocalTexts: Record<number, { copy: string; vo: string }> = {};
    frames.forEach(f => {
      initialLocalTexts[f.frame_number] = { copy: f.text_overlay || "", vo: f.voiceover_text || "" };
    });
    setLocalTexts(initialLocalTexts);
    setCurrentSlideIndex(0);
    setShowFinalSlides(true);

    setIsCompositing(true);
    try {
      const urls: Record<number, string> = {};
      for (const frame of frames) {
        const res = await fetch(frame.image_url);
        const blob = await res.blob();
        urls[frame.frame_number] = URL.createObjectURL(blob);
      }
      setOriginalImageUrls(urls);

      if (startAnimation) {
        setIsAnimatingReel(true);
      }
    } catch (e) {
      toast.error("Failed to load slides to canvas.");
    }
    setIsCompositing(false);
  };

  useEffect(() => {
    if (!showFinalSlides || !originalImageUrls[frames[currentSlideIndex]?.frame_number]) return;

    let isCancelled = false;
    const frame = frames[currentSlideIndex];
    if (!frame) return;

    const copyText = localTexts[frame.frame_number]?.copy ?? frame.text_overlay ?? "";
    const voText = localTexts[frame.frame_number]?.vo ?? frame.voiceover_text ?? "";

    const generate = async () => {
      try {
        const dataUrl = await compositeSingleFrameWorker(
          originalImageUrls[frame.frame_number],
          copyText,
          voText,
          selectedFont,
          selectedWeight,
          selectedSize,
          selectedColor
        );
        if (!isCancelled) {
          setCompositedFrames(prev => ({ ...prev, [frame.frame_number]: dataUrl }));
        }
      } catch (err) {
        console.error("Error generating composite preview:", err);
      }
    };

    generate();
    return () => { isCancelled = true; };
  }, [showFinalSlides, currentSlideIndex, localTexts, selectedFont, selectedWeight, selectedSize, selectedColor, originalImageUrls, frames]);

  const handleRegenerateContext = async () => {
    if (!generation) return;
    setActionLoading("context");
    try {
      const { error } = await supabase.functions.invoke("generate-context", {
        body: { generationId: generation.id },
      });
      if (error) throw error;
      toast.success("Context regenerated!");
      await fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to regenerate context");
    }
    setActionLoading("");
  };

  const handleLockAspectRatio = async () => {
    if (!generation) return;
    setActionLoading("aspect");
    try {
      const { error } = await supabase
        .from("generations")
        .update({ aspect_ratio: aspectRatio })
        .eq("id", generation.id);
      if (error) throw error;
      setAspectLocked(true);
      toast.success(`Aspect ratio locked to ${aspectRatio}`);
      await fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to lock aspect ratio");
    }
    setActionLoading("");
  };

  const handleGenerateSlide = async (frameNumber: number, customPrompt?: string) => {
    if (!generation) return;
    setActionLoading(`slide-${frameNumber}`);
    setPendingPrompt(null);
    setRepromptFrame(null);
    setFrameErrors(prev => { const next = { ...prev }; delete next[frameNumber]; return next; });
    try {
      const invokePromise = supabase.functions.invoke("generate-slide", {
        body: { generationId: generation.id, frameNumber, customPrompt },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Generation timed out. Please try again.")), 45000);
      });

      const result = await Promise.race([invokePromise, timeoutPromise]) as { error?: Error };
      if (result.error) throw result.error;

      toast.success(`Frame ${frameNumber} generation started!`);
      await fetchData();
    } catch (err: unknown) {
      const msg = await getErrorMessage(err);
      toast.error("Generation failed");
      setFrameErrors(prev => ({ ...prev, [frameNumber]: msg }));
      await supabase.from("generations").update({
        current_step: `slide_${frameNumber}_failed`,
        status: "failed"
      }).eq("id", generation.id);
      await fetchData();
    }
    setActionLoading("");
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast.error("Failed to download image.");
    }
  };

  const loadJSZip = () => new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip);
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve(window.JSZip);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const handleGenerateSocial = async () => {
    if (!generation) return;
    setSocialLoading(true);
    setSocialContent(null);
    setSocialError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-social-content", {
        body: { generationId: generation.id }
      });
      if (error) throw error;
      setSocialContent(data as SocialContent);
      toast.success("Social content generated!");
    } catch (err: unknown) {
      setSocialError(await getErrorMessage(err));
    }
    setSocialLoading(false);
  };

  const handleDownloadAllNoText = async () => {
    const toastId = toast.loading("Preparing clean zip file...");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const JSZipLib: any = await loadJSZip();
      const zip = new JSZipLib();

      const adPlanFrames = Array.isArray(generation?.ad_plan?.frames) ? generation.ad_plan.frames : null;
      const frameNames: AdPlanFrame[] = adPlanFrames || Array.from({ length: 5 }, (_, i) => ({ frame_number: i + 1, label: `Frame ${i + 1}` }));

      await Promise.all(frames.map(async (frame) => {
        const res = await fetch(frame.image_url);
        const blob = await res.blob();

        const meta = frameNames.find((f) => f.frame_number === frame.frame_number);
        const labelSafe = (meta?.label || `Frame-${frame.frame_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        zip.file(`${frame.frame_number}_${labelSafe}_clean.png`, blob);
      }));

      const content = await zip.generateAsync({ type: "blob" });
      const objectUrl = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "clean-carousel-frames.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Download started!", { id: toastId });
    } catch (e) {
      toast.error("Failed to create zip file.", { id: toastId });
    }
  };

  const handleDownloadPdf = async () => {
    const toastId = toast.loading("Compositing and generating PDF...");
    setIsCompositing(true);
    try {
      let pdf: InstanceType<typeof jsPDF> | null = null;

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        let dataUrl = compositedFrames[frame.frame_number];
        if (!dataUrl) {
          dataUrl = await compositeSingleFrameWorker(
            originalImageUrls[frame.frame_number],
            localTexts[frame.frame_number]?.copy ?? frame.text_overlay ?? "",
            localTexts[frame.frame_number]?.vo ?? frame.voiceover_text ?? "",
            selectedFont,
            selectedWeight,
            selectedSize,
            selectedColor
          );
        }

        const img = new Image();
        const loadImg = new Promise((resolve) => {
          img.onload = resolve;
          img.src = dataUrl;
        });
        await loadImg;

        const imgW = img.width;
        const imgH = img.height;

        if (!pdf) {
          pdf = new jsPDF({
            orientation: imgW > imgH ? 'l' : 'p',
            unit: 'px',
            format: [imgW, imgH],
            compress: true,
            hotfixes: ["px_scaling"]
          });
        } else {
          pdf.addPage([imgW, imgH], imgW > imgH ? 'l' : 'p');
        }

        // Add the image.
        pdf.addImage(dataUrl, 'PNG', 0, 0, imgW, imgH, undefined, 'FAST');
      }

      if (pdf) {
        pdf.save(`carousel-${generation?.id?.slice(0, 6) || "export"}.pdf`);
        toast.success("PDF downloaded!", { id: toastId });
      }
    } catch (e: unknown) {
      toast.error("Failed to create PDF file: " + (e as Error).message, { id: toastId });
    }
    setIsCompositing(false);
  };

  const handleDownloadCompositedAll = async () => {
    const toastId = toast.loading("Compositing all frames for export...");
    setIsCompositing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const JSZipLib: any = await loadJSZip();
      const zip = new JSZipLib();

      const adPlanFrames = Array.isArray(generation?.ad_plan?.frames) ? generation.ad_plan.frames : null;
      const frameNames: AdPlanFrame[] = adPlanFrames || Array.from({ length: 5 }, (_, i) => ({ frame_number: i + 1, label: `Frame ${i + 1}` }));

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];

        let dataUrl = compositedFrames[frame.frame_number];
        if (!dataUrl) {
          dataUrl = await compositeSingleFrameWorker(
            originalImageUrls[frame.frame_number],
            localTexts[frame.frame_number]?.copy ?? frame.text_overlay ?? "",
            localTexts[frame.frame_number]?.vo ?? frame.voiceover_text ?? "",
            selectedFont,
            selectedWeight,
            selectedSize,
            selectedColor
          );
        }

        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const meta = frameNames.find((f) => f.frame_number === frame.frame_number);
        const labelSafe = (meta?.label || `Frame-${frame.frame_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        zip.file(`${frame.frame_number}_${labelSafe}.png`, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const objectUrl = window.URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "final-composited-carousel.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Final Masterpiece downloaded!", { id: toastId });
    } catch (e) {
      toast.error("Failed to create zip file.", { id: toastId });
    }
    setIsCompositing(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--drish-bg)" }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--drish-text-3)" }} />
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--drish-bg)", color: "var(--drish-text)" }}>
        <div className="text-center">
          <p className="mb-4 text-sm" style={{ color: "var(--drish-text-2)" }}>Generation not found.</p>
          <Link
            to="/dashboard"
            className="text-xs px-4 py-2 rounded-md transition-colors"
            style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-2)" }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const adPlan = generation.ad_plan;
  const step = generation.current_step || "context_pending";
  const isGenerating = step.includes("generating") || generation.status === "pending";

  const getStatusLabel = () => {
    if (step === "context_pending" || (generation.status === "pending" && !step)) return "Initializing...";
    if (step === "context_generating") return "Building narrative...";
    if (step === "context_done") return "Context ready";
    const slideMatch = step.match(/slide_(\d+)_generating/);
    if (slideMatch) return `Generating frame ${slideMatch[1]} of 5`;
    if (step === "done") return "Complete";
    return "Processing...";
  };

  const selectedAspectObj = ASPECT_RATIOS.find((a) => a.value === aspectRatio) || ASPECT_RATIOS[1];
  const aspectClass = selectedAspectObj.class;

  return (
    <div className="relative min-h-screen overflow-hidden font-sans" style={{ backgroundColor: "var(--drish-bg)", color: "var(--drish-text)" }}>

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
          <ArrowLeft className="h-3.5 w-3.5" /> Generations
        </Link>
        <div className="flex items-center gap-2">
          {isGenerating && <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--drish-accent)" }} />}
          <span className="text-xs animate-fade-in-text" style={{ color: isGenerating ? "var(--drish-accent)" : "var(--drish-text-3)" }}>
            {getStatusLabel()}
          </span>
        </div>
      </header>

      <main className="relative z-10 flex flex-col lg:flex-row h-screen pt-14">

        {/* Control Panel */}
        <div
          className="w-full lg:w-[400px] xl:w-[440px] h-auto lg:h-full flex flex-col shrink-0"
          style={{ borderRight: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}
        >

          <div className="flex-1 p-6 gap-6 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="mb-2">
              <h1 className="text-base font-medium mb-1" style={{ color: "var(--drish-text)" }}>Control deck</h1>
              <p className="text-xs" style={{ color: "var(--drish-text-3)" }}>Configure your generation parameters.</p>
            </div>

            {adPlan && adPlan.frames && !(step === "done" && frames.length === 5) && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>Narrative context</h2>
                  <button
                    onClick={handleRegenerateContext}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors"
                    style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-3)")}
                  >
                    {actionLoading === "context" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Refine
                  </button>
                </div>
                {adPlan.frames.slice(0, 5).map((slide, index) => (
                  <div key={index} className="rounded-lg p-4" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-bg)" }}>
                    <h3 className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "var(--drish-text-2)" }}>Slide {index + 1} Content</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 block" style={{ color: "var(--drish-text-3)" }}>Copy</span>
                        <div className="rounded p-3" style={{ backgroundColor: "var(--drish-surface-2)", borderLeft: "2px solid var(--drish-accent)" }}>
                          <p className="text-xs leading-relaxed font-light italic" style={{ color: "var(--drish-text-2)" }}>
                            {slide.text_overlay ? `"${slide.text_overlay}"` : "Synthesizing..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adPlan && (step === "context_done" || step?.startsWith("slide_") || step === "done") && !(step === "done" && frames.length === 5) && (
              <div className="rounded-lg p-4" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-bg)" }}>
                <h2 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--drish-text-2)" }}>Canvas dimensions</h2>
                {!aspectLocked ? (
                  <div className="space-y-3">
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger
                        className="h-9 w-full rounded-md text-xs"
                        style={{ backgroundColor: "var(--drish-surface-2)", border: "1px solid var(--drish-border)", color: "var(--drish-text)" }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)" }}>
                        {ASPECT_RATIOS.map((ar) => (
                          <SelectItem key={ar.value} value={ar.value} className="text-xs cursor-pointer" style={{ color: "var(--drish-text)" }}>
                            {ar.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={handleLockAspectRatio}
                      disabled={!!actionLoading}
                      className="w-full h-9 rounded-md text-xs font-medium transition-opacity flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", opacity: actionLoading === "aspect" ? 0.6 : 1 }}
                    >
                      {actionLoading === "aspect" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Lock dimensions
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded p-3" style={{ backgroundColor: "var(--drish-surface-2)", border: "1px solid var(--drish-border)" }}>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--drish-accent)" }} />
                    <p className="text-xs" style={{ color: "var(--drish-text-2)" }}>
                      Locked at <strong style={{ color: "var(--drish-accent)" }}>{aspectRatio}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            {pendingPrompt && (
              <div className="rounded-lg p-4 animate-in zoom-in-95" style={{ border: "1px solid var(--drish-accent-border)", backgroundColor: "var(--drish-accent-dim)" }}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--drish-accent)" }}>
                  <Eye className="h-3.5 w-3.5" /> Frame {pendingPrompt.frameNumber} prompt
                </h3>
                <div className="mb-4 rounded p-3" style={{ backgroundColor: "var(--drish-bg)" }}>
                  <p className="text-xs leading-relaxed font-light italic" style={{ color: "var(--drish-text-2)" }}>'{pendingPrompt.prompt}'</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 h-8 rounded text-xs font-medium transition-opacity flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
                    onClick={() => handleGenerateSlide(pendingPrompt.frameNumber)}
                    disabled={!!actionLoading}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Render
                  </button>
                  <button
                    className="h-8 px-3 rounded text-xs transition-colors"
                    style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                    onClick={() => setPendingPrompt(null)}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-3)")}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {step === "done" && frames.length === 5 && (
              <div className="mt-auto pt-6 flex flex-col gap-3" style={{ borderTop: "1px solid var(--drish-border)" }}>

                {/* Social content generator */}
                {socialError && (
                  <div className="mb-1 w-full rounded-md text-xs p-3 flex items-start gap-2 border" style={{ backgroundColor: "rgba(138, 74, 74, 0.05)", borderColor: "rgba(138, 74, 74, 0.3)", color: "#e57f7f" }}>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                    <span className="leading-relaxed">{socialError}</span>
                  </div>
                )}

                {!socialContent && (
                  <button
                    onClick={handleGenerateSocial}
                    disabled={socialLoading}
                    className="w-full h-9 rounded-md text-xs font-medium transition-opacity flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: "var(--drish-accent)",
                      color: "var(--drish-bg)",
                      opacity: socialLoading ? 0.6 : 1,
                    }}
                  >
                    {socialLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {socialLoading ? "Generating copy..." : "Generate social content"}
                  </button>
                )}

                {socialContent && (
                  <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>Network copy</h3>
                      <button
                        onClick={handleGenerateSocial}
                        disabled={socialLoading}
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold transition-opacity"
                        style={{ color: "var(--drish-accent)", opacity: socialLoading ? 0.5 : 1 }}
                      >
                        {socialLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Regenerate
                      </button>
                    </div>
                    {/* LinkedIn */}
                    <div className="rounded-lg p-4" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-bg)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Linkedin className="h-3.5 w-3.5" style={{ color: "var(--drish-text-2)" }} />
                          <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>LinkedIn</h3>
                        </div>
                        <div className="flex gap-1.5">
                          <button className="text-xs px-2 py-1 rounded transition-colors" style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                            onClick={() => { navigator.clipboard.writeText(socialContent.linkedin.post + "\n\n" + (socialContent.linkedin.hashtags || []).join(" ")); toast.success("Copied!"); }}
                          ><Copy className="h-3 w-3" /></button>
                          <button className="text-xs px-2 py-1 rounded transition-colors" style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                            onClick={() => { const b = new Blob([socialContent.linkedin.post + "\n\n" + (socialContent.linkedin.hashtags || []).join(" ")], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'linkedin-post.txt'; a.click(); }}
                          ><FileText className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap mb-2" style={{ color: "var(--drish-text-2)" }}>{socialContent.linkedin.post}</p>
                      <p className="text-xs" style={{ color: "var(--drish-text-3)" }}>{(socialContent.linkedin.hashtags || []).join(" ")}</p>
                    </div>

                    {/* Instagram */}
                    <div className="rounded-lg p-4" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-bg)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Instagram className="h-3.5 w-3.5" style={{ color: "var(--drish-text-2)" }} />
                          <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>Instagram</h3>
                        </div>
                        <div className="flex gap-1.5">
                          <button className="text-xs px-2 py-1 rounded transition-colors" style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                            onClick={() => { navigator.clipboard.writeText(socialContent.instagram.caption + "\n\n" + (socialContent.instagram.hashtags || []).join(" ")); toast.success("Copied!"); }}
                          ><Copy className="h-3 w-3" /></button>
                          <button className="text-xs px-2 py-1 rounded transition-colors" style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                            onClick={() => { const b = new Blob([socialContent.instagram.caption + "\n\n" + (socialContent.instagram.hashtags || []).join(" ")], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'instagram-caption.txt'; a.click(); }}
                          ><FileText className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed whitespace-pre-wrap mb-2" style={{ color: "var(--drish-text-2)" }}>{socialContent.instagram.caption}</p>
                      <p className="text-xs" style={{ color: "var(--drish-text-3)" }}>{(socialContent.instagram.hashtags || []).join(" ")}</p>
                    </div>
                  </div>
                )}

                {/* Download all */}
                <button
                  onClick={handleDownloadAllNoText}
                  className="w-full h-9 rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 mt-1"
                  style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-2)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-2)")}
                >
                  <DownloadCloud className="h-3.5 w-3.5" /> Download all — no overlay
                </button>
              </div>
            )}

            {/* Generated Image Management List */}
            {frames.filter(f => f.image_url).length > 0 && (
              <div className="flex flex-col gap-3 mt-2" style={{ borderTop: "1px solid var(--drish-border)", paddingTop: "24px" }}>
                <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--drish-text-2)" }}>Generated Assets</h3>
                <div className="flex flex-col gap-2.5">
                  {frames.filter(f => f.image_url).map(frame => {
                    const createdDate = new Date(frame.created_at);
                    const expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                    const diffDays = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    const isUrgent = diffDays <= 5;

                    return (
                      <div key={frame.id} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors" style={{ backgroundColor: "var(--drish-bg)", border: isUrgent ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--drish-border)" }}>
                        <div className="w-10 h-10 shrink-0 rounded overflow-hidden" style={{ border: "1px solid var(--drish-border)" }}>
                          <img src={frame.image_url} alt={`Frame ${frame.frame_number}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col flex-1 pl-1">
                          <span className="text-xs font-medium" style={{ color: "var(--drish-text)" }}>Frame {frame.frame_number}</span>
                          <span className={`text-[10px] uppercase font-semibold tracking-wider`} style={{ color: isUrgent ? (diffDays <= 2 ? '#ef4444' : '#f59e0b') : "var(--drish-text-3)" }}>
                            {diffDays > 0 ? `${diffDays} days left` : "Expired"}
                          </span>
                        </div>
                        <button
                          onClick={() => downloadImage(frame.image_url, `frame-${frame.frame_number}-drish.jpg`)}
                          className="h-8 w-8 rounded flex items-center justify-center shrink-0 transition-colors"
                          style={{ backgroundColor: "var(--drish-surface-2)", border: "1px solid var(--drish-border)", color: "var(--drish-text)" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--drish-accent-dim)"; e.currentTarget.style.borderColor = "var(--drish-accent-border)"; e.currentTarget.style.color = "var(--drish-accent)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--drish-surface-2)"; e.currentTarget.style.borderColor = "var(--drish-border)"; e.currentTarget.style.color = "var(--drish-text)"; }}
                          title="Download Image"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer: View Final Slides */}
          {step === "done" && frames.length === 5 && (
            <div className="p-4 shrink-0 flex flex-col gap-2" style={{ borderTop: "1px solid var(--drish-border)" }}>
              <button
                onClick={() => handleOpenSlides(false)}
                className="w-full h-10 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                style={{ border: "1px solid var(--drish-accent-border)", color: "var(--drish-accent)", backgroundColor: "var(--drish-accent-dim)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(168,197,181,0.14)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--drish-accent-dim)")}
              >
                <ImageIcon className="h-3.5 w-3.5" /> View final slides
              </button>
              <button
                onClick={() => handleOpenSlides(true)}
                className="w-full h-10 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
              >
                <Play className="h-3.5 w-3.5" /> Animate Reel
              </button>
            </div>
          )}
        </div>

        {/* Frame canvas */}
        <div className="flex-1 relative h-auto lg:h-full flex flex-col overflow-hidden" style={{ backgroundColor: "var(--drish-bg)" }}>
          <div
            className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden lg:overflow-x-auto relative custom-scrollbar z-0 flex flex-col"
            onScroll={() => { if (showScrollHint) setShowScrollHint(false); }}
          >
            {adPlan && aspectLocked && (step === "context_done" || step?.startsWith("slide_") || step === "done") ? (
              <div className="p-6 lg:p-10 w-full lg:w-max min-h-full flex flex-col justify-center">
                <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start pb-10 w-full">
                  {(Array.isArray(generation?.ad_plan?.frames) ? generation.ad_plan.frames : Array.from({ length: 5 }, (_, i) => ({ frame_number: i + 1, label: `Frame ${i + 1}` })))?.map((frame: AdPlanFrame, idx: number) => {
                    const existingFrame = frames.find(f => f.frame_number === frame.frame_number);
                    const isCurrentlyGenerating = step === `slide_${frame.frame_number}_generating` || actionLoading === `slide-${frame.frame_number}`;
                    const isFailed = step === `slide_${frame.frame_number}_failed`;
                    const canGenerate = !existingFrame && !isCurrentlyGenerating &&
                      (frame.frame_number === 1 ? true : frames.some(f => f.frame_number === frame.frame_number - 1));

                    const heightClass = aspectRatio === '16:9'
                      ? 'h-[240px] md:h-[280px] lg:h-[320px] xl:h-[380px]'
                      : aspectRatio === '1:1'
                        ? 'h-[320px] md:h-[400px] lg:h-[450px] xl:h-[500px]'
                        : 'h-[450px] md:h-[550px] lg:h-[600px] xl:h-[650px]';

                    return (
                      <div
                        key={frame.frame_number}
                        className={`group relative ${heightClass} shrink-0 overflow-hidden flex flex-col ${aspectClass}`}
                        style={{
                          borderRadius: 6,
                          border: existingFrame
                            ? "1px solid var(--drish-border)"
                            : isCurrentlyGenerating
                              ? "1px solid var(--drish-accent-border)"
                              : "1px solid var(--drish-border-subtle)",
                          opacity: (!existingFrame && !isCurrentlyGenerating) ? 0.4 : 1,
                          transition: "all 0.2s ease",
                          animationDelay: `${idx * 100}ms`,
                        }}
                      >
                        {isCurrentlyGenerating && (
                          <div className="absolute bottom-0 left-0 h-px w-full z-10" style={{ backgroundColor: "#d9a05b", boxShadow: "0 -2px 10px rgba(217,160,91,0.5)" }} />
                        )}

                        {/* Frame number — bare white text, fades in with group hover */}
                        <div className="absolute top-3 left-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <span
                            className="text-sm font-light"
                            style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "-0.01em", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
                          >
                            {frame.frame_number}
                          </span>
                        </div>

                        {/* Action icons — ghost style, individual hover gets faint white bg */}
                        {existingFrame && (
                          <div className="absolute top-3 right-3 z-40 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                              onClick={() => downloadImage(existingFrame.image_url, `frame-${frame.frame_number}.jpg`)}
                              className="p-1.5 rounded transition-all duration-150"
                              style={{ color: "rgba(255,255,255,0.85)", backgroundColor: "transparent" }}
                              title="Download"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <Download className="h-3.5 w-3.5" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                            </button>
                            <button
                              onClick={() => handleGenerateSlide(frame.frame_number)}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded transition-all duration-150"
                              style={{ color: "rgba(255,255,255,0.85)", backgroundColor: "transparent" }}
                              title="Regenerate"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              {actionLoading === `slide-${frame.frame_number}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} /> : <RefreshCw className="h-3.5 w-3.5" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />}
                            </button>
                            <button
                              onClick={() => setRepromptFrame({ frameNumber: frame.frame_number, prompt: frame.image_generation_prompt || "" })}
                              disabled={!!actionLoading}
                              className="p-1.5 rounded transition-all duration-150"
                              style={{ color: "rgba(255,255,255,0.85)", backgroundColor: "transparent" }}
                              title="Reprompt"
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)")}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              <Type className="h-3.5 w-3.5" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                            </button>
                          </div>
                        )}

                        {repromptFrame?.frameNumber === frame.frame_number && (
                          <div
                            className="absolute inset-x-2 bottom-2 z-50 p-4 rounded-lg animate-in fade-in slide-in-from-bottom-5"
                            style={{ backgroundColor: "rgba(10,10,10,0.97)", border: "1px solid var(--drish-accent-border)" }}
                          >
                            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: "var(--drish-accent)" }}>Reprompt</label>
                            <textarea
                              value={repromptFrame.prompt}
                              onChange={(e) => setRepromptFrame({ ...repromptFrame, prompt: e.target.value })}
                              className="w-full rounded p-2.5 text-xs resize-none h-[70px] transition-colors"
                              style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)", color: "var(--drish-text)" }}
                            />
                            <div className="flex gap-2 mt-2.5">
                              <button
                                className="flex-1 h-8 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-opacity"
                                style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", opacity: actionLoading ? 0.6 : 1 }}
                                onClick={() => handleGenerateSlide(frame.frame_number, repromptFrame.prompt)}
                                disabled={!!actionLoading}
                              >
                                {actionLoading === `slide-${frame.frame_number}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
                              </button>
                              <button
                                className="h-8 px-3 rounded text-xs transition-colors"
                                style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-3)" }}
                                onClick={() => setRepromptFrame(null)}
                                onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
                                onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-3)")}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-0" style={{ backgroundColor: "#0c0a08" }}>
                          <div className="absolute inset-0 w-full h-full z-0 flex flex-col items-center justify-center overflow-hidden bg-[#0c0a08]">

                            {/* 1. STATIC IDLE PLACEHOLDER (Before render clicked) */}
                            {(!existingFrame && !isCurrentlyGenerating && !isFailed) && (
                              <div className="relative z-20 flex flex-col items-center justify-center space-y-4">
                                <ImageIcon className="h-8 w-8 opacity-40" style={{ color: "var(--drish-text-3)" }} />
                                <p className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-60" style={{ color: "var(--drish-text-3)" }}>
                                  Ready to Render
                                </p>
                              </div>
                            )}

                            {/* 2. ACTIVE SKELETON LAYER (Activates after click, smoothly fades out underneath the image dissolve) */}
                            {(isCurrentlyGenerating || existingFrame) && (
                              <div
                                className="absolute inset-0 z-0 bg-[#1e1814] pointer-events-none"
                                style={{
                                  opacity: (existingFrame && !isCurrentlyGenerating) ? 0 : 1,
                                  transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                {/* Flowing organic shapes for "alive and intelligent" skeleton structure */}
                                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] blur-[60px] opacity-100 animate-pulse-slow" style={{ background: "radial-gradient(circle, rgba(230,160,80,0.2) 0%, transparent 70%)" }} />
                                <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[70%] blur-[60px] opacity-100 animate-pulse-slow" style={{ animationDelay: "1.5s", background: "radial-gradient(circle, rgba(230,160,80,0.15) 0%, transparent 70%)" }} />
                                <div className="absolute top-[30%] right-[20%] w-[50%] h-[50%] blur-[50px] opacity-90 animate-pulse-slow" style={{ animationDelay: "3s", background: "radial-gradient(circle, rgba(255,200,100,0.25) 0%, transparent 70%)" }} />

                                {/* Intense, broad, high-contrast diagonal shimmer. Peak made near white/gold. */}
                                <div className="absolute top-[-50%] -left-[100%] h-[200%] w-[250%] animate-[shimmer_1.5s_infinite_linear]" style={{ background: "linear-gradient(110deg, transparent 15%, rgba(15, 10, 5, 0.95) 35%, rgba(255, 245, 190, 0.95) 50%, rgba(15, 10, 5, 0.95) 65%, transparent 85%)" }} />
                              </div>
                            )}

                            {/* SKELETON LOADING OR FAILED UI */}
                            {(!existingFrame && (isCurrentlyGenerating || isFailed)) && (
                              <div className="relative z-20 flex flex-col items-center justify-center space-y-4 px-6 w-full text-center">
                                {isCurrentlyGenerating ? (
                                  <div className="relative flex items-center justify-center transition-all duration-500 scale-110">
                                    <div className="absolute inset-0 animate-ping opacity-25 rounded-full" style={{ backgroundColor: "#d9a05b" }}></div>
                                    <Loader2 className="h-8 w-8 animate-spin drop-shadow-[0_0_15px_rgba(217,160,91,0.5)]" style={{ color: "#d9a05b" }} />
                                  </div>
                                ) : (
                                  <X className="h-8 w-8" style={{ color: "#8a4a4a" }} />
                                )}
                                <p className="text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300" style={{ color: isCurrentlyGenerating ? "#d9a05b" : "#8a4a4a" }}>
                                  {isCurrentlyGenerating ? 'Crafting Image...' : 'Failed'}
                                </p>

                                {isFailed && frameErrors[frame.frame_number] && (
                                  <div className="mt-2 text-[11px] leading-relaxed p-3 rounded w-full max-w-sm backdrop-blur-sm" style={{ backgroundColor: "rgba(138,74,74,0.1)", border: "1px solid rgba(138,74,74,0.3)", color: "#e57f7f" }}>
                                    {frameErrors[frame.frame_number]}
                                  </div>
                                )}

                                {isFailed && (
                                  <button
                                    onClick={() => handleGenerateSlide(frame.frame_number)}
                                    disabled={!!actionLoading}
                                    className="mt-4 px-4 py-2 rounded text-xs font-medium transition-colors"
                                    style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid var(--drish-border)", color: "var(--drish-text-2)" }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--drish-text)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "var(--drish-text-2)"; }}
                                  >
                                    Retry Generation
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* IMAGE LAYER: Rendered over the skeleton, initiates an ease-in-out fade over 1500ms */}
                          {existingFrame && (
                            <div className="absolute inset-0 z-10 w-full h-full">
                              <img
                                src={existingFrame.image_url}
                                alt={`Frame ${frame.frame_number}`}
                                className="w-full h-full object-cover animate-in fade-in duration-[1500ms]"
                                style={{ animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
                                loading="lazy"
                              />
                              {/* Subtle vignette overlay — light, just enough contrast for readability */}
                              <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.45) 100%)" }}
                              />
                              <div className="absolute bottom-0 left-0 w-full p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 z-20">
                                {existingFrame.text_overlay && (
                                  <p className="text-[10px] leading-relaxed line-clamp-2 mb-1" style={{ color: "var(--drish-text-2)" }}>
                                    <span className="uppercase tracking-widest mr-1" style={{ color: "var(--drish-accent)" }}>Copy</span> {existingFrame.text_overlay}
                                  </p>
                                )}
                                {existingFrame.voiceover_text && (
                                  <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color: "var(--drish-text-2)" }}>
                                    <span className="uppercase tracking-widest mr-1" style={{ color: "var(--drish-accent)" }}>VO</span> {existingFrame.voiceover_text}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {!existingFrame && canGenerate && (
                            <div className="absolute bottom-5 left-5 right-5 z-30">
                              <button
                                className="w-full h-12 rounded-xl text-[13px] font-bold tracking-wide uppercase flex items-center justify-center gap-2 transition-all shadow-[0_4px_25px_rgba(168,197,181,0.3)] hover:shadow-[0_6px_35px_rgba(168,197,181,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                  backgroundColor: isFailed ? "#8a4a4a" : "var(--drish-accent)",
                                  color: isFailed ? "#ffffff" : "var(--drish-bg)",
                                  opacity: actionLoading ? 0.6 : 1,
                                }}
                                onClick={() => handleGenerateSlide(frame.frame_number)}
                                disabled={!!actionLoading}
                              >
                                {actionLoading === `slide-${frame.frame_number}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isFailed ? (
                                  <><RefreshCw className="h-4 w-4" /> Retry Build</>
                                ) : (
                                  <><ImageIcon className="h-4 w-4" /> Render Frame</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/20 p-8 h-full">
                <ImageIcon className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-sm font-light uppercase tracking-widest text-center">Configure parameters on the left to reveal the canvas.</p>
              </div>
            )}
          </div>

          {showScrollHint && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur-md" style={{ border: "1px solid var(--drish-border)", backgroundColor: "rgba(10,10,10,0.85)" }}>
                <span className="text-[10px] tracking-widest uppercase" style={{ color: "var(--drish-text-3)" }}>Scroll</span>
                <ArrowRight className="h-3 w-3" style={{ color: "var(--drish-text-3)" }} />
              </div>
            </div>
          )}

        </div>
      </main>

      {showFinalSlides && (
        <div className="fixed inset-0 z-[100] flex flex-col animate-in fade-in zoom-in-95 font-sans" style={{ backgroundColor: "var(--drish-bg)" }}>

          <div
            className="h-14 shrink-0 flex items-center justify-between px-6 sticky top-0 z-[105]"
            style={{ borderBottom: "1px solid var(--drish-border)", backgroundColor: "rgba(10,10,10,0.95)" }}
          >
            <button
              onClick={() => { setShowFinalSlides(false); setOriginalImageUrls({}); }}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: "var(--drish-text-2)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-2)")}
            >
              <X className="h-3.5 w-3.5" /> Close Studio
            </button>

            <div className="flex flex-1 max-w-4xl justify-center items-center gap-6 px-6 py-2 rounded-lg" style={{ border: "1px solid var(--drish-border)", backgroundColor: "var(--drish-surface)" }}>
              <div className="flex items-center gap-2.5">
                <label className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: "var(--drish-text-2)" }}>Font</label>
                <Select value={selectedFont} onValueChange={(val) => {
                  setSelectedFont(val);
                  // Reset weight if not supported by new font
                  const weights = FONT_WEIGHTS[val] || [];
                  if (!weights.some(w => w.value === selectedWeight)) {
                    setSelectedWeight("400");
                  }
                }}>
                  <SelectTrigger className="h-7 w-[160px] border-0 focus:ring-0 px-2 text-xs" style={{ backgroundColor: "transparent", color: "var(--drish-text)", fontFamily: `"${selectedFont}", sans-serif` }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)" }}>
                    <SelectGroup>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f} value={f} className="text-xs cursor-pointer" style={{ fontFamily: `"${f}", sans-serif`, color: "var(--drish-text)" }}>{f}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-px h-4" style={{ backgroundColor: "var(--drish-border)" }} />

              <div className="flex items-center gap-2.5">
                <label className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: "var(--drish-text-2)" }}>Weight</label>
                <Select value={selectedWeight} onValueChange={setSelectedWeight}>
                  <SelectTrigger className="h-7 w-[100px] border-0 focus:ring-0 px-2 text-xs" style={{ backgroundColor: "transparent", color: "var(--drish-text)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: "var(--drish-surface)", border: "1px solid var(--drish-border)" }}>
                    <SelectGroup>
                      {(FONT_WEIGHTS[selectedFont] || [{ label: "Regular", value: "400" }]).map(w => (
                        <SelectItem key={w.value} value={w.value} className="text-xs cursor-pointer" style={{ fontWeight: w.value }}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-px h-4" style={{ backgroundColor: "var(--drish-border)" }} />

              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: "var(--drish-text-2)" }}>Size</label>
                <div className="flex items-center" style={{ border: "1px solid var(--drish-border)", borderRadius: "6px", backgroundColor: "transparent" }}>
                  <input
                    type="number"
                    min="10" max="150"
                    value={localSizeInput}
                    onChange={e => setLocalSizeInput(e.target.value)}
                    onBlur={() => {
                      const val = Math.max(10, Math.min(150, parseInt(localSizeInput) || selectedSize));
                      setSelectedSize(val);
                      setLocalSizeInput(val.toString());
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = Math.max(10, Math.min(150, parseInt(localSizeInput) || selectedSize));
                        setSelectedSize(val);
                        setLocalSizeInput(val.toString());
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-10 h-7 bg-transparent border-0 px-2 text-xs text-center focus:ring-0 outline-none appearance-none"
                    style={{ color: "var(--drish-text)" }}
                  />
                  <div className="w-px h-3" style={{ backgroundColor: "var(--drish-border)" }} />
                  <Select onValueChange={(val) => { setSelectedSize(parseInt(val)); setLocalSizeInput(val); }}>
                    <SelectTrigger className="h-7 w-6 border-0 p-0 flex items-center justify-center hover:bg-white/5 transition-colors">
                      {/* SelectTrigger automatically has a ChevronDown in select.tsx, but we can make it smaller */}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="32" className="text-xs">32</SelectItem>
                        <SelectItem value="48" className="text-xs">48</SelectItem>
                        <SelectItem value="72" className="text-xs">72</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="w-px h-4" style={{ backgroundColor: "var(--drish-border)" }} />

              <div className="flex items-center gap-2.5">
                <label className="text-[10px] uppercase tracking-widest shrink-0" style={{ color: "var(--drish-text-2)" }}>Color</label>
                <div className="flex gap-1.5">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setSelectedColor(c.value)}
                      className="w-5 h-5 rounded-full transition-all"
                      style={{
                        backgroundColor: c.value,
                        outline: selectedColor === c.value ? `2px solid var(--drish-accent)` : "2px solid transparent",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end w-auto gap-2">
              <button
                onClick={handleDownloadPdf}
                disabled={isCompositing}
                className="flex items-center gap-1.5 text-xs font-medium h-9 px-4 rounded-md transition-colors"
                style={{ backgroundColor: "var(--drish-accent-dim)", color: "var(--drish-accent)", border: "1px solid var(--drish-accent-border)", opacity: isCompositing ? 0.6 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(168,197,181,0.14)"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--drish-accent-dim)"; }}
              >
                {isCompositing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /></>
                ) : (
                  <><FileText className="h-3.5 w-3.5" /> Download as PDF</>
                )}
              </button>
              <button
                onClick={handleDownloadCompositedAll}
                disabled={isCompositing}
                className="flex items-center gap-1.5 text-xs font-medium h-9 px-4 rounded-md transition-opacity"
                style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", opacity: isCompositing ? 0.6 : 1 }}
              >
                {isCompositing ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing...</>
                ) : (
                  <><Type className="h-3.5 w-3.5" /> Download with text</>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative p-8" style={{ backgroundColor: "var(--drish-bg)" }}>
            <button
              className="absolute left-6 z-50 p-3 rounded-lg transition-all disabled:opacity-0 disabled:pointer-events-none"
              style={{ border: "1px solid var(--drish-border)", backgroundColor: "rgba(10,10,10,0.85)", color: "var(--drish-text-2)" }}
              onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
              disabled={currentSlideIndex === 0}
            >
              <ArrowLeft className="h-6 w-6" />
            </button>

            <button
              className="absolute right-8 z-50 p-4 bg-black/60 hover:bg-black/80 rounded-full border border-white/10 text-white/50 hover:text-white transition-all hover:scale-110 disabled:opacity-0 disabled:scale-100 disabled:pointer-events-none"
              onClick={() => setCurrentSlideIndex(prev => Math.min(frames.length - 1, prev + 1))}
              disabled={currentSlideIndex === frames.length - 1}
            >
              <ArrowRight className="h-6 w-6" />
            </button>

            <div className="max-w-4xl w-full flex flex-col items-center h-full justify-center pb-12">
              {(() => {
                const frame = frames[currentSlideIndex];
                if (!frame) return null;
                const meta = (Array.isArray(generation?.ad_plan?.frames) ? generation.ad_plan.frames : Array.from({ length: 5 }, (_, i) => ({ frame_number: i + 1, label: `Frame ${i + 1}` }))).find((f: { frame_number: number }) => f.frame_number === frame.frame_number);
                const dataUrl = compositedFrames[frame.frame_number];

                return (
                  <div className="w-full flex-1 flex flex-col items-center relative animate-in zoom-in-95 duration-500 max-h-full py-4">

                    <div className="flex-1 min-h-0 w-full flex items-center justify-center mb-6 relative group border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden bg-zinc-950">
                      {isAnimatingReel ? (
                        <AnimatedReel
                          frames={frames}
                          localTexts={localTexts}
                          originalImageUrls={originalImageUrls}
                          selectedFont={selectedFont}
                          selectedWeight={selectedWeight}
                          selectedSize={selectedSize}
                          selectedColor={selectedColor}
                          onClose={() => setIsAnimatingReel(false)}
                        />
                      ) : dataUrl ? (
                        <>
                          <img src={dataUrl} alt={`Current Frame`} className="h-full w-auto max-h-[50vh] object-contain" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity duration-300">
                            <Button
                              onClick={() => downloadImage(dataUrl, `frame-${frame.frame_number}-with-text.png`)}
                              className="bg-amber-600 hover:bg-amber-500 text-white font-bold h-12 rounded-xl"
                            >
                              <Type className="mr-2 h-4 w-4" /> Download with Text
                            </Button>
                            <Button
                              onClick={() => downloadImage(originalImageUrls[frame.frame_number], `frame-${frame.frame_number}-clean.png`)}
                              variant="outline"
                              className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold h-12 rounded-xl"
                            >
                              <ImageIcon className="mr-2 h-4 w-4" /> Download Clean
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full max-w-lg aspect-[4/5] max-h-[50vh] shrink-0 bg-zinc-950 rounded-xl flex flex-col gap-4 items-center justify-center uppercase font-bold text-xs tracking-widest text-amber-500/50">
                          <Loader2 className="h-8 w-8 animate-spin" /> Loading preview...
                        </div>
                      )}
                    </div>

                    {!isAnimatingReel && (
                      <div className="w-full max-w-[500px] shrink-0 flex flex-col gap-4">
                        <div className="text-center mb-1">
                          <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30 font-bold uppercase tracking-widest px-4 py-1">{meta?.label || `Frame ${frame.frame_number}`}</Badge>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-[10px] text-white/50 uppercase tracking-widest">Top Copy</Label>
                          <textarea
                            value={localTexts[frame.frame_number]?.copy ?? ""}
                            onChange={(e) => {
                              setLocalTexts(prev => ({ ...prev, [frame.frame_number]: { ...prev[frame.frame_number], copy: e.target.value } }));
                            }}
                            className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white/90 placeholder:text-white/20 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all resize-none h-[64px] custom-scrollbar shadow-inner"
                            placeholder="Add top overlay text..."
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-[10px] text-white/50 uppercase tracking-widest">Bottom Voiceover</Label>
                          <textarea
                            value={localTexts[frame.frame_number]?.vo ?? ""}
                            onChange={(e) => {
                              setLocalTexts(prev => ({ ...prev, [frame.frame_number]: { ...prev[frame.frame_number], vo: e.target.value } }));
                            }}
                            className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white/90 placeholder:text-white/20 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all resize-none h-[64px] custom-scrollbar shadow-inner"
                            placeholder="Add bottom voiceover text..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {!isAnimatingReel && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-xl">
                {frames.map((_, i) => (
                  <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === currentSlideIndex ? 'w-6 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'w-2 bg-white/20 hover:bg-white/40 cursor-pointer'}`} onClick={() => setCurrentSlideIndex(i)} />
                ))}
              </div>
            )}
          </div>

          <div className="h-28 shrink-0 border-t border-white/10 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 gap-6 z-[105] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <Button
              onClick={handleDownloadPdf}
              disabled={isCompositing || isAnimatingReel}
              className="h-14 px-10 group relative overflow-hidden bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-white/30 font-bold text-sm lg:text-base rounded-xl transition-all hover:scale-[1.02]"
            >
              {isCompositing ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Packaging PDF...</>
              ) : (
                <><FileText className="mr-3 h-6 w-6" /> Download as PDF</>
              )}
            </Button>

            <Button
              onClick={() => setIsAnimatingReel(!isAnimatingReel)}
              disabled={isCompositing}
              className="h-14 px-10 group relative overflow-hidden bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-white/30 font-bold text-sm lg:text-base rounded-xl transition-all hover:scale-[1.02]"
            >
              {isAnimatingReel ? (
                <><X className="mr-3 h-6 w-6" /> Close Preview</>
              ) : (
                <><Play className="mr-3 h-6 w-6" /> Animate</>
              )}
            </Button>

            <Button
              onClick={handleDownloadCompositedAll}
              disabled={isCompositing || isAnimatingReel}
              className="h-14 px-10 group relative overflow-hidden bg-gradient-to-r from-amber-600 to-orange-600 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-white/30 text-white font-bold text-sm lg:text-base rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] disabled:shadow-none transition-all hover:scale-[1.02]"
            >
              {isCompositing ? (
                <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Packaging Text Sequence...</>
              ) : (
                <><Type className="mr-3 h-6 w-6" /> Download All with Text (ZIP)</>
              )}
            </Button>

            <Button
              onClick={handleDownloadAllNoText}
              disabled={isCompositing || isAnimatingReel}
              className="h-14 px-10 group relative overflow-hidden bg-white/10 border border-white/20 disabled:opacity-50 text-white font-bold text-sm lg:text-base rounded-xl transition-all hover:bg-white/20 hover:scale-[1.02]"
            >
              <ImageIcon className="mr-3 h-6 w-6" /> Download All Clean (ZIP)
            </Button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2); 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1); 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2); 
        }

        /* Hide number input arrows */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(50%); }
        }
        .animate-shimmer {
          animation: shimmer 2.5s infinite linear;
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
        }
        .animate-float-up {
          animation-name: float-up;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s infinite alternate ease-in-out;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes fade-in-text {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-text {
          animation: fade-in-text 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes nudge-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }
        .animate-nudge-x {
          animation: nudge-x 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

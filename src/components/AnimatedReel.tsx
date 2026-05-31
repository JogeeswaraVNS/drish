import React, { useEffect, useRef, useState } from "react";
import { Loader2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

/**
 * REEL ANIMATION SETTINGS
 * These are exported so they can be easily tweaked from outside if needed,
 * or used to provide consistent timing across the app.
 */
export const REEL_SETTINGS = {
  FRAME_DURATION: 3500,
  TRANSITION_DURATION: 500,
  FPS: 24,
  TEXT_SLIDE_DURATION: 400,
  LINE_HEIGHT_FACTOR: 1.3,
  MAX_TEXT_WIDTH_RATIO: 0.85,
  SHADOW_BLUR_FACTOR: 0.15,       // slightly reduced, cleaner on food imagery
  SHADOW_OFFSET_Y_FACTOR: 0.03,   // subtler drop shadow = more premium feel

  // Replace flat CANVAS_SCALE_FACTOR with per-ratio values:
  TEXT_SCALE_BY_RATIO: {
    "1:1": 0.09,
    "4:5": 0.09,
    "9:16": 0.08,
    "16:9": 0.06,   // landscape needs smaller text
  } as Record<string, number>,
};

interface Frame {
  frame_number: number;
  text_overlay: string | null;
  image_url: string;
}

interface AnimatedReelProps {
  frames: Frame[];
  localTexts: Record<number, { copy: string; vo: string }>;
  originalImageUrls: Record<number, string>;
  selectedFont: string;
  selectedWeight: string;
  selectedSize: number;
  selectedColor: string;
  onClose: () => void;
}

const AnimatedReel: React.FC<AnimatedReelProps> = ({
  frames,
  localTexts,
  originalImageUrls,
  selectedFont,
  selectedWeight,
  selectedSize,
  selectedColor,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isUnmountedRef = useRef(false);
  const [status, setStatus] = useState<"preparing" | "recording" | "converting" | "complete">("preparing");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Helper to load image with timeout
  const loadImage = (url: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timeout = setTimeout(() => reject(new Error("Image load timed out: " + url)), 8000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load image: " + url));
      };
      img.src = url;
    });
  };

  const startAnimation = async () => {
    setStatus("preparing");
    setBlobUrl(null);
    isUnmountedRef.current = false;

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not found");

      if (frames.length === 0) throw new Error("No frames to animate");

      // Load all images first
      const loadedImages: HTMLImageElement[] = [];
      for (const f of frames) {
        const url = originalImageUrls[f.frame_number] || f.image_url;
        if (!url) throw new Error(`Image URL missing for frame ${f.frame_number}`);
        const img = await loadImage(url);
        loadedImages.push(img);
      }

      // Set canvas size based on first image
      canvas.width = loadedImages[0].width;
      canvas.height = loadedImages[0].height;

      await document.fonts.ready;

      /**
       * Core drawing function — draws a single frame at a given elapsed ms.
       * Used by both the live preview and the offline MP4 encode pass.
       */
      const drawAtElapsed = (elapsed: number) => {
        const currentFrameIndex = Math.min(
          frames.length - 1,
          Math.floor(elapsed / REEL_SETTINGS.FRAME_DURATION)
        );
        const timeInCurrentFrame = elapsed % REEL_SETTINGS.FRAME_DURATION;

        // Background
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw current image
        const currentImg = loadedImages[currentFrameIndex];
        if (!currentImg) return;
        ctx.globalAlpha = 1;
        ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);

        // Cross-fade transition
        if (
          timeInCurrentFrame > REEL_SETTINGS.FRAME_DURATION - REEL_SETTINGS.TRANSITION_DURATION &&
          currentFrameIndex < frames.length - 1
        ) {
          const fadeAlpha =
            (timeInCurrentFrame - (REEL_SETTINGS.FRAME_DURATION - REEL_SETTINGS.TRANSITION_DURATION)) /
            REEL_SETTINGS.TRANSITION_DURATION;
          const nextImg = loadedImages[currentFrameIndex + 1];
          if (nextImg) {
            ctx.globalAlpha = fadeAlpha;
            ctx.drawImage(nextImg, 0, 0, canvas.width, canvas.height);
          }
        }

        // Text overlay
        const textFrame = frames[currentFrameIndex];
        const copyText = localTexts[textFrame.frame_number]?.copy ?? textFrame.text_overlay ?? "";

        if (copyText) {
          const slideProgress = Math.min(1, timeInCurrentFrame / REEL_SETTINGS.TEXT_SLIDE_DURATION);
          const easeOut = 1 - Math.pow(1 - slideProgress, 3);

          const ratio = canvas.width > canvas.height ? "16:9" : canvas.height > canvas.width ? "9:16" : "1:1";
          const scaleFactor = REEL_SETTINGS.TEXT_SCALE_BY_RATIO[ratio] ?? 0.09;
          const pxSize = (selectedSize / 100) * canvas.width * scaleFactor;
          ctx.font = `${selectedWeight} ${pxSize}px "${selectedFont}", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // Word wrap
          const words = copyText.split(" ");
          const maxWidth = canvas.width * REEL_SETTINGS.MAX_TEXT_WIDTH_RATIO;
          let line = "";
          const lines: string[] = [];
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " ";
            if (ctx.measureText(testLine).width > maxWidth && n > 0) {
              lines.push(line);
              line = words[n] + " ";
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          const lineHeight = pxSize * REEL_SETTINGS.LINE_HEIGHT_FACTOR;
          const totalTextHeight = lines.length * lineHeight;

          // Position: bottom subtitle zone
          const padBottom = canvas.height * 0.08;
          const centerY = canvas.height - padBottom - totalTextHeight / 2;
          const yOffset = (1 - easeOut) * (canvas.height * 0.03);

          // Draw pill background
          const pillPadX = pxSize * 0.9;
          const pillPadY = pxSize * 0.45;
          const pillRadius = pxSize * 0.4;
          const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l.trim()).width));
          const pillW = maxLineWidth + pillPadX * 2;
          const pillH = totalTextHeight + pillPadY * 2;
          const pillX = (canvas.width - pillW) / 2;
          const pillY = centerY - pillH / 2 + yOffset;

          ctx.globalAlpha = easeOut * 0.82;
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius);
          ctx.fill();

          // Draw text on top of pill
          ctx.globalAlpha = easeOut;
          ctx.fillStyle = selectedColor;
          ctx.shadowColor = "rgba(0,0,0,0.4)";
          ctx.shadowBlur = pxSize * 0.1;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = pxSize * 0.02;

          lines.forEach((l, i) => {
            const lineY = centerY - totalTextHeight / 2 + lineHeight / 2 + i * lineHeight + yOffset;
            ctx.fillText(l.trim(), canvas.width / 2, lineY);
          });

          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      };

      // ── Phase 1: Live Preview (requestAnimationFrame) ──────────────────────
      setStatus("recording");
      const totalDuration = frames.length * REEL_SETTINGS.FRAME_DURATION;

      // await new Promise<void>((resolve) => {
      //   const startTime = performance.now();
      //   const drawFrame = (timestamp: number) => {
      //     if (isUnmountedRef.current) { resolve(); return; }
      //     const elapsed = timestamp - startTime;
      //     if (elapsed >= totalDuration) { resolve(); return; }
      //     drawAtElapsed(elapsed);
      //     requestAnimationFrame(drawFrame);
      //   };
      //   requestAnimationFrame(drawFrame);
      // });

      // if (isUnmountedRef.current) return;


      if (isUnmountedRef.current) return;
      // Draw first frame immediately so canvas isn't blank
      drawAtElapsed(0);

      // ── Phase 2: Offline MP4 Encode (WebCodecs + mp4-muxer) ───────────────
      setStatus("converting");

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: "avc",
          width: canvas.width,
          height: canvas.height,
        },
        fastStart: "in-memory",
      });

      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => { throw e; },
      });

      encoder.configure({
        codec: "avc1.640033",       // H.264 High Profile Level 5.1 (supports up to ~9.4MP)
        width: canvas.width,
        height: canvas.height,
        bitrate: 8_000_000,         // 8 Mbps — high quality
        framerate: REEL_SETTINGS.FPS,
      });

      const frameMs = 1000 / REEL_SETTINGS.FPS;
      const totalFrames = Math.ceil(totalDuration / frameMs);

      for (let i = 0; i < totalFrames; i++) {
        if (isUnmountedRef.current) break;
        drawAtElapsed(i * frameMs);
        const videoFrame = new VideoFrame(canvas, {
          timestamp: Math.round(i * frameMs * 1000),   // microseconds
          duration: Math.round(frameMs * 1000),
        });
        while (encoder.encodeQueueSize > 10) {
          await new Promise((r) => setTimeout(r, 5));
        }
        encoder.encode(videoFrame, { keyFrame: i % (REEL_SETTINGS.FPS * 2) === 0 });
        videoFrame.close();
        // Yield to browser every second of encoded footage to stay responsive
        if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
      }

      await encoder.flush();
      muxer.finalize();

      const mp4Blob = new Blob([target.buffer], { type: "video/mp4" });
      setBlobUrl(URL.createObjectURL(mp4Blob));
      setStatus("complete");

    } catch (err: any) {
      console.error("Reel generation error:", err);
      toast.error("Reel generation failed: " + err.message);
      onClose();
    }
  };

  useEffect(() => {
    startAnimation();
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  return (
    <div className="h-full w-full flex items-center justify-center relative bg-zinc-950 overflow-hidden">
      {status === "preparing" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
          <p className="text-sm font-bold text-white uppercase tracking-widest">Preparing Reel Assets...</p>
        </div>
      )}

      {status === "converting" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Loader2 className="h-10 w-10 animate-spin text-green-400 mb-4" />
          <p className="text-sm font-bold text-white uppercase tracking-widest">Converting to MP4...</p>
          <p className="text-xs text-white/40 mt-2 tracking-wider">This may take a moment</p>
        </div>
      )}

      {status === "recording" && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-red-500/20 text-red-500 px-3 py-1.5 rounded-full border border-red-500/30 animate-pulse">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Recording Reel</span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={`h-full w-auto max-h-[50vh] object-contain shadow-2xl transition-opacity duration-500 ${status === "preparing" || status === "converting" ? "opacity-0" : "opacity-100"
          }`}
      />

      {blobUrl && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center animate-in fade-in duration-300 gap-4">
          <Button
            onClick={() => {
              const a = document.createElement("a");
              a.href = blobUrl;
              a.download = "drish-reel.mp4";
              a.click();
            }}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-12 px-8 rounded-xl"
          >
            <Download className="mr-2 h-4 w-4" /> Download Reel
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/50 hover:text-white"
          >
            <X className="mr-2 h-4 w-4" /> Close Preview
          </Button>
        </div>
      )}
    </div>
  );
};

export default AnimatedReel;

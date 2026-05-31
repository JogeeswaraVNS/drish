import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight } from "lucide-react";
import bannerImage from "../Drish Banner - foods.png";

const features = [
  {
    title: "5-Frame Narrative Arc",
    description: "Drish extracts your product USPs to build a cohesive narrative across exactly 5 frames — the sweet spot for high-retention food ads.",
  },
  {
    title: "AI Visuals & Text Overlays",
    description: "Generate rich food imagery paired with frame copy that converts. No audio fluff, just punchy overlays that drive the story forward.",
  },
  {
    title: "Distribution Prep",
    description: "Instantly generate native captions for LinkedIn and Instagram, formatted to fit your brand's voice and the platform's requirements.",
  },
  {
    title: "Surgical Frame Control",
    description: "Need a different angle? Regenerate or reprompt individual frames without breaking the 5-part narrative flow.",
  },
];

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "var(--drish-bg)", color: "var(--drish-text)" }}>
      {/* Background Image */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <img 
          src={bannerImage} 
          alt="Drish Background" 
          className="w-full h-full object-cover opacity-70" 
          style={{ 
            filter: "brightness(0.7) contrast(1.1) saturate(1.1)",
          }}
        />
        <div 
          className="absolute inset-0" 
          style={{ 
            background: "linear-gradient(to bottom, rgba(10,10,10,0.8) 0%, rgba(10,10,10,0.4) 30%, rgba(10,10,10,0.4) 70%, rgba(10,10,10,0.8) 100%)" 
          }} 
        />
      </div>



      <div className="relative z-10">
        {/* Nav */}
        <nav style={{ borderBottom: "1px solid var(--drish-border)" }} className="fixed top-0 z-50 w-full backdrop-blur-xl" >
          <div style={{ backgroundColor: "rgba(10,10,10,0.65)" }} className="absolute inset-0" />
          <div className="relative container flex h-14 items-center justify-between max-w-5xl mx-auto px-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="text-sm font-semibold tracking-tight transition-colors group-hover:text-accent" style={{ color: "var(--drish-text)" }}>Drish</span>
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5" style={{ color: "var(--drish-text-2)", border: "1px solid var(--drish-border)" }}>by J Agents</span>
            </Link>
            <div className="flex items-center gap-2">
              {user ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", fontWeight: 500 }}
                >
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/auth"
                    className="text-sm px-4 py-1.5 rounded-md transition-colors"
                    style={{ color: "var(--drish-text-2)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-2)")}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/auth?mode=signup"
                    className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md transition-all hover:scale-[1.02]"
                    style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", fontWeight: 500 }}
                  >
                    Get access
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative flex min-h-screen items-center justify-center pt-14">
          <div className="container max-w-5xl mx-auto px-6 text-center">

            <div
              className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-10 bg-white/5 backdrop-blur-md"
              style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-2)" }}
            >
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: "var(--drish-accent)" }} />
              Early access — D2C food brands
            </div>

            <h1
              className="text-4xl sm:text-6xl lg:text-7xl font-medium leading-[1.1] tracking-tight mb-8"
              style={{ color: "#ffffff", letterSpacing: "-0.04em" }}
            >
              The 5-frame ad engine <span style={{ color: "var(--drish-accent)" }}>for D2C food brands.</span>
            </h1>


            <div className="mb-12">
              <p 
                className="text-xs sm:text-sm uppercase tracking-[0.3em] mb-6 font-semibold"
                style={{ color: "var(--drish-text)" }}
              >
                Your Story. Told Beautifully.
              </p>
              <p className="text-base sm:text-xl font-normal max-w-2xl mx-auto leading-relaxed" style={{ color: "#e0e0e0" }}>
                Turn product descriptions into high-intent carousel ads. Drish generates a sequence of 5 frames with AI visuals, text overlays, and platform-ready captions.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Link
                to={user ? "/dashboard" : "/auth?mode=signup"}
                className="flex items-center gap-2 text-sm px-8 py-3 rounded-md transition-all hover:scale-[1.02] shadow-lg shadow-accent/10"
                style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", fontWeight: 500 }}
              >
                Start generating <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={user ? "/create" : "/auth"}
                className="text-sm px-8 py-3 rounded-md transition-all hover:bg-white/5 backdrop-blur-sm"
                style={{ border: "1px solid var(--drish-border)", color: "var(--drish-text-2)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--drish-text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--drish-text-2)")}
              >
                See how it works
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-28 relative" style={{ borderTop: "1px solid var(--drish-border)" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />
          <div className="container max-w-5xl mx-auto px-6 relative z-10">
            <div className="mb-16">
              <h2 className="text-3xl sm:text-4xl font-medium tracking-tight mb-4" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
                Built for the 5-frame narrative
              </h2>
              <p className="text-base sm:text-lg font-normal" style={{ color: "#d0d0d0" }}>
                Structured storytelling for food brands, from hook to conversion.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-px bg-white/[0.02]" style={{ border: "1px solid var(--drish-border)", borderRadius: 12, overflow: "hidden" }}>
              {features.map((f, idx) => (
                <div
                  key={f.title}
                  className="p-10 transition-colors hover:bg-white/[0.04]"
                  style={{
                    backgroundColor: "transparent",
                    borderRight: idx % 2 === 0 ? "1px solid var(--drish-border)" : undefined,
                    borderBottom: idx < 2 ? "1px solid var(--drish-border)" : undefined,
                  }}
                >
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] mb-6 font-bold opacity-60" style={{ color: "var(--drish-accent)" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </p>
                  <h3 className="text-lg sm:text-xl font-semibold mb-4" style={{ color: "#ffffff" }}>{f.title}</h3>
                  <p className="text-sm sm:text-base leading-relaxed font-normal" style={{ color: "#d0d0d0" }}>{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-28" style={{ borderTop: "1px solid var(--drish-border)" }}>
          <div className="container max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl sm:text-5xl font-medium mb-6 tracking-tight" style={{ color: "#ffffff", letterSpacing: "-0.02em" }}>
              Join our early access group
            </h2>
            <p className="text-base sm:text-lg mb-12 font-normal max-w-md mx-auto" style={{ color: "#d0d0d0" }}>
              We are currently partnering with a limited number of D2C food brands to refine the engine.
            </p>
            <Link
              to={user ? "/create" : "/auth?mode=signup"}
              className="inline-flex items-center gap-2 text-sm px-10 py-3.5 rounded-md transition-all hover:scale-[1.02] shadow-xl shadow-accent/10"
              style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)", fontWeight: 500 }}
            >
              Request Early Access <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12" style={{ borderTop: "1px solid var(--drish-border)" }}>
          <div className="container max-w-5xl mx-auto px-6 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--drish-text-3)" }}>
                Drish by J Agents
              </span>
              <span className="text-[10px] opacity-40" style={{ color: "var(--drish-text-3)" }}>
                © {new Date().getFullYear()} — All rights reserved.
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--drish-text-3)" }}>
              Built for the next generation of D2C
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}


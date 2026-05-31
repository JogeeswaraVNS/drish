import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white px-4 selection:bg-amber-500/30 overflow-hidden">
      <div className="pointer-events-none absolute -top-[20%] -left-[10%] h-[70%] w-[50%] rounded-full bg-red-600/10 blur-[150px]" />
      <div className="pointer-events-none absolute top-[40%] -right-[10%] h-[60%] w-[40%] rounded-full bg-orange-600/10 blur-[150px]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
          <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
          <AlertTriangle className="h-14 w-14 text-red-500 relative z-10" />
        </div>
        
        <h1 className="mb-2 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-orange-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
          404
        </h1>
        <p className="mb-8 text-xl text-white/50 font-light tracking-wide">
          The cinematic sequence you're looking for does not exist in this reality.
        </p>

        <Button asChild className="group relative overflow-hidden bg-gradient-to-r from-amber-600 to-orange-600 px-8 h-12 rounded-xl border-0 text-white font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all">
          <Link to="/">
            <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-150%)] group-hover:[transform:skew(-13deg)_translateX(150%)] transition-transform duration-1000 ease-out"><div className="w-12 h-full bg-white/30 blur-md pointer-events-none" /></div>
            <span className="relative z-10 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" /> Return to Studio Axis</span>
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;


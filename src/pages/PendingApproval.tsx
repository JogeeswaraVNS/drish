import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function PendingApproval() {
  const { user, loading, isApproved, isAdmin, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full border-t-2 border-amber-500 animate-spin" />
          <div className="absolute h-16 w-16 rounded-full border-b-2 border-orange-500 animate-spin animation-delay-150" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin || isApproved) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black text-white px-4 selection:bg-amber-500/30 overflow-hidden">
      <div className="pointer-events-none absolute -top-[20%] -left-[10%] h-[70%] w-[50%] rounded-full bg-amber-600/10 blur-[150px]" />
      <div className="pointer-events-none absolute top-[40%] -right-[10%] h-[60%] w-[40%] rounded-full bg-blue-600/10 blur-[150px]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
          <Clock className="h-10 w-10 text-amber-500 relative z-10" />
        </div>
        <h1 className="mb-4 text-3xl font-extrabold text-white tracking-wide">Awaiting Validation</h1>
        <p className="mb-4 text-white/50 text-lg font-light leading-relaxed">
          Your creative access has been logged. An architect needs to approve your credentials before you can enter the studio.
        </p>
        <p className="mb-10 text-sm text-white/30 uppercase tracking-widest font-mono">
          Identity Key: <span className="text-white/70">{user.email}</span>
        </p>
        <button
          onClick={() => {
            console.log("Signout button clicked!");
            signOut();
          }}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-white/10 bg-white/5 text-white hover:bg-white/10 h-10 px-4 py-2 mt-4 cursor-pointer"
          style={{ position: 'relative', zIndex: 9999, pointerEvents: 'auto' }}
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>

      <style>{`
        .animation-delay-150 { animation-delay: 150ms; }
      `}</style>
    </div>
  );
}

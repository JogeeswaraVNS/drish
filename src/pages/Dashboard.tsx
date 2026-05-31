import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogOut, Shield, Loader2, AlertCircle, CheckCircle2, Clock, Trash2, Zap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";

type Workspace = Tables<"workspaces">;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [remainingGenerations, setRemainingGenerations] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  const fetchWorkspaces = async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });
    setWorkspaces(data ?? []);
    if (loading) setLoading(false);
  };

  const fetchLimit = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    const remaining = (data as any)?.remaining_generations;
    if (typeof remaining === 'number') setRemainingGenerations(remaining);
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      const { error: dbError } = await supabase.from("workspaces").delete().eq("id", id);
      if (dbError) throw dbError;
      
      setWorkspaces(prev => prev.filter(w => w.id !== id));
    } catch (error) {
      console.error("Deletion failed:", error);
      alert("Failed to delete workspace. Ensure migrations are applied.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !user) return;
    setCreatingWorkspace(true);
    try {
      const { data, error } = await supabase.from("workspaces").insert({
        user_id: user.id,
        name: newWorkspaceName.trim(),
      }).select().single();
      if (error) throw error;
      if (data) {
        setIsCreateModalOpen(false);
        setNewWorkspaceName("");
        navigate(`/workspace/${data.id}`);
      }
    } catch (error) {
      console.error("Create failed:", error);
      alert("Failed to create workspace.");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    fetchLimit();
    const interval = setInterval(() => {
      fetchWorkspaces();
      fetchLimit();
    }, 5000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans" style={{ backgroundColor: "var(--drish-bg)" }}>

      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b border-zinc-900 bg-black/40"
        style={{ borderBottom: "1px solid var(--drish-border)" }}
      >
        <div className="container max-w-7xl mx-auto px-6 flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <span className="text-sm font-semibold" style={{ color: "var(--drish-text)" }}>Drish</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ color: "var(--drish-text-2)", border: "1px solid var(--drish-border)" }}>by J Agents</span>
          </Link>
          <div className="flex items-center gap-3">
            {remainingGenerations !== null && (
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/80 mr-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <div className="flex items-baseline gap-1 text-xs text-zinc-400">
                  <span className="font-light tracking-wide uppercase text-[9px]">Gens Remaining</span>
                  <span className="font-mono font-bold text-amber-500">{remainingGenerations}</span>
                </div>
              </div>
            )}
            <span className="hidden text-xs sm:block text-zinc-500" style={{ color: "var(--drish-text-3)" }}>{user?.email}</span>
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border border-zinc-800 text-zinc-300 hover:text-zinc-150 hover:bg-zinc-900/50"
              >
                <Shield className="h-3 w-3 text-[var(--drish-accent)]" /> Admin
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-6 py-12 md:py-16 animate-fade-in">

        <div className="flex items-end justify-between mb-10 md:mb-12">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-zinc-100 mb-1.5" style={{ letterSpacing: "-0.02em" }}>
              Workspaces
            </h1>
            <p className="text-sm text-zinc-400">
              All your product ad campaigns, organized.
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-[rgba(168,197,181,0.1)_0px_8px_24px] hover:shadow-[rgba(168,197,181,0.2)_0px_8px_32px] hover:-translate-y-0.5"
            style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
          >
            <Plus className="h-4 w-4" /> New Workspace
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-650" />
          </div>
        ) : workspaces.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-32 rounded-xl text-center border border-dashed border-zinc-800/80 bg-zinc-900/5"
          >
            <p className="text-sm text-zinc-450 mb-6">No workspaces yet.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-lg transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
            >
              <Plus className="h-4 w-4" /> Create your first workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {workspaces.map((ws) => {
              return (
                <div
                  key={ws.id}
                  onClick={() => navigate(`/workspace/${ws.id}`)}
                  className="group relative flex flex-col justify-between p-6 rounded-xl border border-zinc-800 bg-zinc-900/10 hover:bg-zinc-900/35 hover:border-zinc-700/50 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1 transition-all duration-300 cursor-pointer aspect-square animate-fade-in"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      {/* Initials badge */}
                      <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-zinc-900 border border-zinc-850 text-sm font-semibold text-zinc-300 group-hover:bg-[var(--drish-accent)] group-hover:text-[var(--drish-bg)] group-hover:border-transparent transition-all duration-300">
                        {ws.name.substring(0, 2).toUpperCase()}
                      </div>
                      
                      {/* Category tag */}
                      {ws.product_category ? (
                        <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--drish-accent)]/10 border border-[var(--drish-accent)]/20 text-[var(--drish-accent)] font-semibold">
                          {ws.product_category}
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-950 border border-zinc-900 text-zinc-500 font-medium">
                          New
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-zinc-200 group-hover:text-zinc-100 transition-colors line-clamp-1">
                        {ws.name}
                      </h3>
                      <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">
                        {ws.product_description || "Pending brief setup. Click here to configure details."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-4 mt-4">
                    <span className="text-[10px] text-zinc-650 font-mono">
                      {new Date(ws.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    
                    <button
                      disabled={deletingId === ws.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(ws.id);
                      }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-500/70 hover:text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20 disabled:opacity-40"
                    >
                      {deletingId === ws.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(isOpen) => !isOpen && setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-zinc-950 border border-zinc-900 rounded-xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-150 font-light tracking-tight text-lg">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 text-sm leading-relaxed">
              This will permanently delete this workspace and all its generations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-zinc-900/40 border border-zinc-800 text-zinc-450 hover:bg-zinc-900 hover:text-zinc-200 transition-colors">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-rose-900/80 hover:bg-rose-950 text-white border-transparent transition-colors"
            >
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Workspace Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl border border-zinc-800 bg-zinc-950/95">
            <h2 className="text-xl font-light tracking-tight text-zinc-100 mb-1">Create Workspace</h2>
            <p className="text-xs text-zinc-500 mb-6">Enter a name to set up a new advertising workspace.</p>
            <form onSubmit={handleCreateWorkspace} className="space-y-5">
              <input
                type="text"
                autoFocus
                className="w-full h-11 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm px-4 focus:ring-4 focus:ring-[var(--drish-accent)]/5 focus:border-[var(--drish-accent)] outline-none transition-all"
                placeholder="e.g. Summer Campaign"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWorkspace || !newWorkspaceName.trim()}
                  className="px-5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
                  style={{ backgroundColor: "var(--drish-accent)", color: "var(--drish-bg)" }}
                >
                  {creatingWorkspace && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Workspace</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

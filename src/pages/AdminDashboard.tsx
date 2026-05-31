import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LogOut, Shield, Users, ArrowLeft, Loader2, Sparkles, Plus, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface UserProfile {
  user_id: string;
  is_approved: boolean;
  created_at: string;
  plan_status: string;
  email?: string;
  roles: string[];
  remaining_generations: number;
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Generation limits dialog state
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [customLimit, setCustomLimit] = useState("");

  const fetchUsers = async () => {
    // Fetch profiles (admin can see all via RLS + secure RPC returns auth email)
    const { data: profiles } = await (supabase.rpc as any)("get_admin_profiles");

    if (!profiles || !Array.isArray(profiles)) { setLoading(false); return; }

    // Fetch all roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("*");

    // Build user list
    const userList: UserProfile[] = (profiles as any[]).map((p: any) => ({
      user_id: p.user_id,
      email: p.email,
      is_approved: p.is_approved,
      created_at: p.created_at,
      plan_status: p.plan_status,
      remaining_generations: p.remaining_generations || 0,
      roles: (roles ?? []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
    }));

    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleApproval = async (userId: string, currentlyApproved: boolean) => {
    setUpdating(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: !currentlyApproved })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to update approval");
    } else {
      toast.success(currentlyApproved ? "User access revoked" : "User approved!");
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_approved: !currentlyApproved } : u));
    }
    setUpdating(null);
  };

  const toggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    setUpdating(userId);
    if (isCurrentlyAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) { toast.error("Failed to remove admin"); }
      else {
        toast.success("Admin role removed");
        setUsers(prev => prev.map(u =>
          u.user_id === userId ? { ...u, roles: u.roles.filter(r => r !== "admin") } : u
        ));
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" as any });
      if (error) { toast.error("Failed to add admin"); }
      else {
        toast.success("Admin role granted");
        setUsers(prev => prev.map(u =>
          u.user_id === userId ? { ...u, roles: [...u.roles, "admin"] } : u
        ));
      }
    }
    setUpdating(null);
  };

  const handleAddGenerations = async (amount: number) => {
    if (!targetUserId || amount <= 0) return;
    setUpdating(targetUserId);
    setLimitDialogOpen(false);
    
    const { error } = await (supabase.rpc as any)('admin_add_generations', { target_user_id: targetUserId, amount });
    
    if (error) {
      toast.error("Failed to add generations");
    } else {
      toast.success(`Successfully added ${amount} generations!`);
      setUsers(prev => prev.map(u => 
        u.user_id === targetUserId 
          ? { ...u, remaining_generations: u.remaining_generations + amount } 
          : u
      ));
    }
    setUpdating(null);
    setCustomLimit("");
  };

  const openLimitDialog = (userId: string) => {
    setTargetUserId(userId);
    setCustomLimit("");
    setLimitDialogOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden selection:bg-amber-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-amber-600/5 blur-[150px] mix-blend-screen animate-pulse-slow rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] mix-blend-screen animate-pulse-slow animation-delay-2000 rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-white/60 hover:text-white hover:bg-white/10">
              <Link to="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
            </Button>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <Shield className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-white tracking-widest uppercase">Admin Config</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-white/60 hover:text-white hover:bg-white/10">
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="relative z-10 container py-16 animate-in fade-in zoom-in-95 duration-1000">
        <div className="mb-12 border-b border-white/10 pb-8">
          <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Users className="h-6 w-6 text-amber-500" /> 
            </span>
            Director Access Management
          </h1>
          <p className="mt-4 text-lg text-white/50 font-light">Approve visionary users and architect access layers</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-24 w-24 rounded-full border-t-2 border-amber-500 animate-spin" />
              <div className="absolute h-16 w-16 rounded-full border-b-2 border-orange-500 animate-spin animation-delay-150" />
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-white/40 italic py-20 text-lg">The architecture is empty</p>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-white/40">User Identity</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-white/40">Clearance Level</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-white/40">Tier</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-amber-500/70">Remaining Gens</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-white/40">Inducted</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-white/40">Authorized</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-widest text-white/40">God Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const uIsAdmin = u.roles.includes("admin");
                  return (
                    <tr key={u.user_id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-6 py-5 text-sm text-white/90 font-mono tracking-widest truncate max-w-[200px]">
                        {u.email}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex gap-2">
                          {u.roles.map(r => (
                            <Badge key={r} variant="outline" className={`capitalize text-[10px] tracking-wider px-2 py-0.5 border ${r === 'admin' ? 'border-amber-500 text-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'border-white/20 text-white/70 bg-white/5'}`}>
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant="outline" className="capitalize text-[10px] tracking-wider border-white/20 bg-white/5 text-white/70">{u.plan_status}</Badge>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-lg font-bold text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                            {u.remaining_generations}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => openLimitDialog(u.user_id)}
                            className="h-8 w-8 rounded-full bg-white/5 hover:bg-amber-500/20 hover:text-amber-500 border border-white/10 hover:border-amber-500/30 transition-all text-white/50"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-white/50 font-light">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <Switch
                          checked={u.is_approved}
                          onCheckedChange={() => toggleApproval(u.user_id, u.is_approved)}
                          disabled={updating === u.user_id}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20"
                        />
                      </td>
                      <td className="px-6 py-5 text-center">
                        <Switch
                          checked={uIsAdmin}
                          onCheckedChange={() => toggleAdmin(u.user_id, uIsAdmin)}
                          disabled={updating === u.user_id}
                          className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-white/20 shadow-[0_0_10px_rgba(245,158,11,0.3)] data-[state=unchecked]:shadow-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* GENERATION LIMITS DIALOG */}
      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-5 w-5 text-amber-500" /> Grant Generations
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Select a preset or enter a custom amount to add sequentially to this user's currently remaining balance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6 py-4">
            <div className="grid grid-cols-3 gap-3">
              <Button onClick={() => handleAddGenerations(5)} variant="outline" className="border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-500 hover:border-amber-500/30 text-white">
                + 5
              </Button>
              <Button onClick={() => handleAddGenerations(10)} variant="outline" className="border-white/10 bg-white/5 hover:bg-amber-500/20 hover:text-amber-500 hover:border-amber-500/30 text-white">
                + 10
              </Button>
              <Button onClick={() => handleAddGenerations(25)} variant="outline" className="border-white/10 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 border-amber-500/30">
                + 25
              </Button>
            </div>
            
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/30 text-xs uppercase tracking-widest font-semibold">Or Custom</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                placeholder="Enter amount..."
                value={customLimit}
                onChange={(e) => setCustomLimit(e.target.value)}
                className="bg-black/50 border-white/10 text-white focus-visible:ring-amber-500/50 flex-1"
              />
              <Button 
                onClick={() => handleAddGenerations(parseInt(customLimit))}
                disabled={!customLimit || parseInt(customLimit) <= 0 || isNaN(parseInt(customLimit))}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6"
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
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
      `}</style>
    </div>
  );
}

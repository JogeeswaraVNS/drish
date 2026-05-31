import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignup, setIsSignup] = useState(searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = isSignup ? await signUp(email, password) : await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else if (isSignup) {
      toast.success("Check your email to confirm your account.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--drish-bg)", color: "var(--drish-text)" }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-10">
          <span className="text-sm font-semibold" style={{ color: "var(--drish-text)" }}>Drish</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--drish-text-2)", border: "1px solid var(--drish-border)" }}>by J Agents</span>
        </Link>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-2xl font-light tracking-tight mb-2" style={{ color: "var(--drish-text)", letterSpacing: "-0.02em" }}>
            {isSignup ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-sm" style={{ color: "var(--drish-text-2)" }}>
            {isSignup ? "Start generating carousels for your brand." : "Sign in to your Drish workspace."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs mb-2 uppercase tracking-widest"
              style={{ color: "var(--drish-text-2)" }}
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brand.com"
              required
              className="h-10 rounded-md text-sm placeholder:text-sm"
              style={{
                backgroundColor: "var(--drish-surface)",
                border: "1px solid var(--drish-border)",
                color: "var(--drish-text)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs mb-2 uppercase tracking-widest"
              style={{ color: "var(--drish-text-2)" }}
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="h-10 rounded-md text-sm"
              style={{
                backgroundColor: "var(--drish-surface)",
                border: "1px solid var(--drish-border)",
                color: "var(--drish-text)",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 rounded-md text-sm font-medium transition-opacity mt-2"
            style={{
              backgroundColor: "var(--drish-accent)",
              color: "var(--drish-bg)",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing {isSignup ? "up" : "in"}...
              </span>
            ) : (
              isSignup ? "Create account" : "Sign in"
            )}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-xs mt-6" style={{ color: "var(--drish-text-3)" }}>
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="transition-colors"
            style={{ color: "var(--drish-accent)" }}
          >
            {isSignup ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

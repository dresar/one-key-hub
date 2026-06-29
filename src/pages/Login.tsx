import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key, Loader2, AlertCircle, Zap, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

const DEV_EMAIL = 'admin@example.com';
const DEV_PASSWORD = 'admin123';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Masukkan email dan password');
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login gagal. Periksa email dan sandi.');
    }
  };

  const handleDevLogin = async () => {
    setError('');
    setEmail(DEV_EMAIL);
    setPassword(DEV_PASSWORD);
    setIsSubmitting(true);
    const result = await login(DEV_EMAIL, DEV_PASSWORD);
    setIsSubmitting(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Dev login gagal. Pastikan backend berjalan dan kredensial benar.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass rounded-2xl p-8 shadow-2xl border border-border/50">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4 border border-primary/20"
            >
              <Key className="w-8 h-8 text-primary" />
            </motion.div>
            <h1 className="text-2xl font-bold gradient-text">One Key Hub</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Unified AI Gateway — Satu key untuk semua provider
            </p>
          </div>

          {/* Provider badges */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-6">
            {['Gemini', 'OpenClaw', 'Groq', 'OpenAI', 'Claude'].map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-full text-xs bg-secondary/80 text-muted-foreground border border-border/50">
                {p}
              </span>
            ))}
          </div>

          {/* Dev Login Banner — only visible in development */}
          {import.meta.env.DEV && (
            <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-400">Development Mode</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {DEV_EMAIL} / {DEV_PASSWORD}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  id="dev-login-btn"
                  onClick={handleDevLogin}
                  disabled={isSubmitting}
                  className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold px-3 h-8"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Dev Login →'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="bg-secondary/50 border-border focus:border-primary"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="bg-secondary/50 border-border focus:border-primary"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Masuk...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Masuk ke Dashboard
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

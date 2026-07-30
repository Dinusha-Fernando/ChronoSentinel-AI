import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle, Lock, User, Loader2, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import cyberSecurityBg from '../assets/cyber_security_bg.png';
import { DragonLogo } from '../components/DragonLogo';

export default function LoginPage() {
  const { login, isLoading, currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/admin/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password System States
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      const dest = currentUser.role === 'user' ? '/' : '/admin/dashboard';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    try {
      await login(username.trim(), password, rememberMe);
      const stored = localStorage.getItem('cs_current_user');
      const user = stored ? JSON.parse(stored) : null;
      if (user?.role === 'user') navigate('/', { replace: true });
      else navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Login failed. Please check your credentials.');
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!resetUsername.trim()) {
      setError('Please enter your username or email.');
      return;
    }
    setResetLoading(true);
    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: resetUsername.trim() }),
      });
      if (!response.ok) {
        let errorMessage = 'Failed to request password reset.';
        try {
          const err = await response.json();
          errorMessage = err.detail ?? errorMessage;
        } catch {
          try {
            const txt = await response.text();
            if (txt && txt.length < 200) {
              errorMessage = txt;
            } else {
              errorMessage = `Server error (${response.status}): ${response.statusText || 'Internal Server Error'}`;
            }
          } catch {
            errorMessage = `Server error (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      setSuccess(data.message || 'Reset token generated successfully.');
      if (data.reset_token) {
        setResetToken(data.reset_token); // Pre-fill token for developer ease of testing locally
      }
      setResetStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!resetToken.trim() || !resetNewPassword) {
      setError('Please enter the reset token and your new password.');
      return;
    }
    setResetLoading(true);
    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), new_password: resetNewPassword }),
      });
      if (!response.ok) {
        let errorMessage = 'Failed to reset password.';
        try {
          const err = await response.json();
          errorMessage = err.detail ?? errorMessage;
        } catch {
          try {
            const txt = await response.text();
            if (txt && txt.length < 200) {
              errorMessage = txt;
            } else {
              errorMessage = `Server error (${response.status}): ${response.statusText || 'Internal Server Error'}`;
            }
          } catch {
            errorMessage = `Server error (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }
      
      setResetSuccessMessage('Password reset successfully! You can now log in.');
      setTimeout(() => {
        setForgotPasswordOpen(false);
        setResetStep('request');
        setResetUsername('');
        setResetToken('');
        setResetNewPassword('');
        setResetSuccessMessage('');
        setSuccess('');
        setError('');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-slate-100 bg-slate-950 font-sans">
      
      {/* LEFT SIDE: CYBERSECURITY IMAGE BANNER (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden select-none">
        <img 
          src={cyberSecurityBg} 
          alt="Cybersecurity Portal Banner" 
          className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity scale-[1.02] filter blur-[0.5px]"
        />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-linear-to-tr from-slate-950 via-slate-950/80 to-transparent" />
        
        <div className="relative z-10 m-auto max-w-lg px-8 py-12 flex flex-col justify-between h-[85%] text-left">
          <div className="flex items-center gap-3">
            <DragonLogo size={42} />
            <span className="text-lg font-black tracking-wider uppercase text-white font-mono">ChronoSentinel AI</span>
          </div>
          
          <div className="space-y-6 my-auto pt-16">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
              Securing Digital Endpoints With <span className="text-violet-400 bg-clip-text">Epoch audits.</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              ChronoSentinel scans historical domains, analyzes threat patterns across Wayback Machine epochs, and performs automatic risk-mitigation profiling.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-6">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Sentinel Protection Core</span>
            <span className="text-xs text-violet-400 font-mono font-bold uppercase">Active Ledger online</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: AUTHENTICATION FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden cyber-grid">
        
        {/* Style injection for animations and background grid */}
        <style>{`
          @keyframes scan-grid {
            0% { background-position: 0 0; }
            100% { background-position: 0 30px; }
          }
          .cyber-grid {
            background-image: 
              linear-gradient(rgba(139, 92, 246, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.04) 1px, transparent 1px);
            background-size: 30px 30px;
            animation: scan-grid 20s infinite linear;
          }
          .cyber-grid::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at center, transparent 35%, rgba(2, 6, 23, 0.95) 100%);
            pointer-events: none;
          }
          @keyframes float-cyber {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
            50% { transform: translateY(-12px) rotate(2deg); opacity: 0.35; }
          }
          .cyber-floating-accent {
            position: absolute;
            font-family: monospace;
            font-size: 9px;
            font-weight: bold;
            color: #a78bfa;
            pointer-events: none;
            user-select: none;
            animation: float-cyber 7s infinite ease-in-out;
          }
        `}</style>

        {/* Glow Spheres */}
        <div className="absolute top-10 right-10 w-125 h-125 bg-violet-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-10 left-10 w-100 h-100 bg-indigo-600/5 rounded-full blur-[100px]" />

        {/* Floating cyber indicators */}
        <div className="cyber-floating-accent top-[8%] left-[8%]" style={{ animationDelay: '0s' }}>
          [SYS_LEDGER: OK]
        </div>
        <div className="cyber-floating-accent bottom-[10%] right-[12%]" style={{ animationDelay: '2s' }}>
          [CRYPT_ENG: ACTIVE]
        </div>
        <div className="cyber-floating-accent top-[12%] right-[8%]" style={{ animationDelay: '3.5s' }}>
          PORT_SCAN: CLR
        </div>
        <div className="cyber-floating-accent bottom-[12%] left-[6%]" style={{ animationDelay: '5s' }}>
          TLS_HANDSHAKE: OK
        </div>

        <div className="w-full max-w-110 relative z-10 space-y-8">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex flex-col items-center text-center lg:hidden space-y-4">
            <DragonLogo size={48} />
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white font-mono">ChronoSentinel AI</h1>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Admin Control Center</span>
            </div>
          </div>

          {/* Form Box (Glassmorphic Cyber-HUD Container) */}
          <div className="bg-slate-950/40 backdrop-blur-2xl border border-violet-500/20 p-8 rounded-2xl shadow-[0_0_60px_rgba(139,92,246,0.15)] relative overflow-hidden group/form hover:border-violet-500/35 transition-all duration-500">
            
            {/* Inline Cyber Animation Definitions */}
            <style>{`
              @keyframes laser-scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 0.7; }
                90% { opacity: 0.7; }
                100% { top: 100%; opacity: 0; }
              }
              .laser-line {
                position: absolute;
                left: 0;
                width: 100%;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.45) 20%, rgba(139, 92, 246, 0.9) 50%, rgba(167, 139, 250, 0.45) 80%, transparent);
                pointer-events: none;
                animation: laser-scan 4s infinite linear;
              }
              .hud-corner {
                position: absolute;
                width: 8px;
                height: 8px;
                border-color: rgba(139, 92, 246, 0.4);
                pointer-events: none;
                transition: border-color 0.3s;
              }
              .group\\/form:hover .hud-corner {
                border-color: rgba(139, 92, 246, 0.8);
              }
            `}</style>

            {/* Glowing Accent Top border */}
            <div className="absolute top-0 inset-x-0 h-0.5 bg-linear-to-r from-transparent via-violet-500/40 to-transparent" />
            
            {/* Laser scanning effect */}
            <div className="laser-line" />

            {/* HUD Corner Tech Accents */}
            <div className="hud-corner top-2 left-2 border-t-2 border-l-2" />
            <div className="hud-corner top-2 right-2 border-t-2 border-r-2" />
            <div className="hud-corner bottom-2 left-2 border-b-2 border-l-2" />
            <div className="hud-corner bottom-2 right-2 border-b-2 border-r-2" />

            {/* Header Text */}
            <div className="mb-6 flex justify-between items-center relative z-10">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  {forgotPasswordOpen ? 'Password Recovery' : 'Sign In'}
                </h2>
                <p className="text-[10px] text-slate-400 font-sans">
                  {forgotPasswordOpen ? 'Reset your account password' : 'Access your ChronoSentinel AI dashboard'}
                </p>
              </div>
              {!forgotPasswordOpen && (
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold text-violet-400 font-mono tracking-widest px-2 py-0.5 border border-violet-500/20 bg-violet-950/20 rounded">
                    GATEWAY ONLINE
                  </span>
                </div>
              )}
            </div>

            {/* Error alerts */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs mb-5 animate-[shake_0.2s_ease-in-out_2]">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="font-mono text-[11px]">{error}</span>
              </div>
            )}

            {/* Success alerts */}
            {success && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs mb-5">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                <span className="font-mono text-[11px]">{success}</span>
              </div>
            )}

            {/* Account Recovery Success */}
            {resetSuccessMessage && (
              <div className="flex flex-col items-center text-center p-6 space-y-4">
                <CheckCircle2 size={48} className="text-emerald-400 animate-bounce" />
                <p className="text-sm font-semibold text-slate-200">{resetSuccessMessage}</p>
              </div>
            )}

            {/* 1. SIGN IN FLOW */}
            {!forgotPasswordOpen && !resetSuccessMessage && (
              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Username or Email</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username or email"
                      autoComplete="username"
                      className="w-full pl-9 pr-4 py-2.5 text-xs glass-input focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-slate-400 text-[10px] uppercase font-bold tracking-widest font-mono">Password</label>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordOpen(true)}
                      className="text-violet-400 hover:text-violet-300 text-[10px] font-bold font-mono"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      className="w-full pl-9 pr-10 py-2.5 text-xs glass-input focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-violet-500 bg-slate-900 border-slate-800 rounded cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="text-slate-400 text-xs font-semibold select-none cursor-pointer">
                      Persist Session
                    </label>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">TLS 1.3 SECURE</span>
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 text-xs font-bold text-white bg-linear-to-r from-violet-600 via-fuchsia-600 to-indigo-600 hover:from-violet-500 hover:via-fuchsia-500 hover:to-indigo-500 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:shadow-[0_0_25px_rgba(139,92,246,0.45)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Shield size={14} />
                      Sign In
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 2. FORGOT PASSWORD FLOW */}
            {forgotPasswordOpen && !resetSuccessMessage && (
              <div className="space-y-4 relative z-10">
                
                {/* Step 2.1: Request Token */}
                {resetStep === 'request' && (
                  <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                    <p className="text-slate-300 text-[11px] leading-relaxed font-sans bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      Enter your registered username or email address below to receive a password reset token.
                    </p>
                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Username or Email</label>
                      <div className="relative">
                        <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={resetUsername}
                          onChange={(e) => setResetUsername(e.target.value)}
                          placeholder="Enter username or email"
                          className="w-full pl-9 pr-4 py-2.5 text-xs glass-input focus:border-violet-500/40 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-2.5 text-xs font-bold text-white bg-linear-to-r from-violet-600 to-indigo-600 rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Sending reset token...
                        </>
                      ) : 'Send Reset Token'}
                    </button>
                  </form>
                )}

                {/* Step 2.2: Verify Token & Reset Password */}
                {resetStep === 'verify' && (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <p className="text-slate-300 text-[11px] leading-relaxed font-sans bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                      Reset token generated. Enter your token and new password below.
                    </p>
                    
                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Reset Token</label>
                      <div className="relative">
                        <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          placeholder="Paste your reset token"
                          className="w-full pl-9 pr-4 py-2.5 text-xs glass-input focus:border-violet-500/40 transition-all duration-200 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">New Password</label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="password"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="Enter your new password"
                          className="w-full pl-9 pr-4 py-2.5 text-xs glass-input focus:border-violet-500/40 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-2.5 text-xs font-bold text-white bg-linear-to-r from-violet-600 to-indigo-600 rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Resetting password...
                        </>
                      ) : 'Reset Password'}
                    </button>
                  </form>
                )}

                {/* Back button */}
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordOpen(false);
                    setResetStep('request');
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full py-2 border border-slate-800/80 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft size={10} />
                  Abort Restore
                </button>
              </div>
            )}

          </div>

          {/* Footer Copyright */}
          <p className="text-center text-slate-600 text-[9px] uppercase font-bold tracking-widest font-mono select-none">
            ChronoSentinel AI (c) {new Date().getFullYear()} - Secure Endpoint Access
          </p>

        </div>
      </div>
      
    </div>
  );
}

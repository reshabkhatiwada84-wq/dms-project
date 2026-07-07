import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext, api } from '../context/AuthContext';
import { FolderOpen, Lock, Mail, KeyRound, X, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [pwdName] = useState(() => 'field_' + Math.random().toString(36).substring(2, 10));
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // Forgot password flow
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1=email, 2=token+new password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
    // Trick Chrome: Keep fields readOnly for 500ms to block autofill
    const timer = setTimeout(() => setIsReadOnly(false), 500);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
  };

  const openForgot = () => {
    setForgotEmail(email);
    setForgotStep(1);
    setForgotToken('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotMessage('');
    setForgotError('');
    setForgotOpen(true);
  };

  const closeForgot = () => {
    setForgotOpen(false);
  };

  const handleRequestToken = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', { email: forgotEmail });
      if (res.data.resetToken) {
        setForgotToken(res.data.resetToken);
        setForgotMessage('Reset token generated. Copy it below (valid for 15 minutes).');
        setForgotStep(2);
      } else {
        setForgotMessage('If an account exists with that email, a reset token was generated. Check the database — no account was found with this email.');
      }
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to generate reset token');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError('Password must be at least 6 characters');
      return;
    }
    if (!forgotToken.trim()) {
      setForgotError('Reset token is required');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post('/api/auth/reset-password', {
        email: forgotEmail,
        token: forgotToken.trim(),
        newPassword: forgotNewPassword,
      });
      setForgotMessage(res.data.message || 'Password reset successfully!');
      // Auto-close after 2 seconds and pre-fill login
      setTimeout(() => {
        setEmail(forgotEmail);
        setPassword('');
        closeForgot();
      }, 2000);
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl"></div>

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
            <FolderOpen className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
            Welcome back to DMS 
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to access your secure document cabinet
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} autoComplete="off">
          {/* FAKE INPUTS TO TRAP CHROME AUTOFILL */}
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }} aria-hidden="true">
            <input type="text" name="email_fake" tabIndex="-1" autoComplete="username" />
            <input type="password" name="password_fake" tabIndex="-1" autoComplete="current-password" />
          </div>
          
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email-address" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="login_identifier"
                  name="login_identifier"
                  type="text"
                  autoComplete="nope"
                  readOnly={isReadOnly}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input block w-full rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id={pwdName}
                  name={pwdName}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  data-lpignore="true"
                  readOnly={isReadOnly}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input block w-full rounded-xl py-3 pl-10 pr-10 text-sm focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying Account...' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-slate-400 mt-4">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-sky-400 hover:text-sky-300 transition-colors">
            Create an account
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-6 max-w-md w-full relative">
            <button
              onClick={closeForgot}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-500/20">
                <KeyRound className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reset Password</h3>
                <p className="text-xs text-slate-400">
                  {forgotStep === 1 ? 'Enter your account email' : 'Enter the token and new password'}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg p-2.5 text-xs mb-3 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotMessage && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg p-2.5 text-xs mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{forgotMessage}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestToken}>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative mt-1 mb-4">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="glass-input block w-full rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none"
                    placeholder="name@company.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {forgotLoading ? 'Generating...' : 'Generate Reset Token'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={forgotToken}
                  onChange={(e) => setForgotToken(e.target.value)}
                  className="glass-input block w-full rounded-xl py-2.5 px-3 text-sm focus:outline-none mb-3 font-mono tracking-widest text-center"
                  placeholder="6-digit code"
                />

                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative mt-1 mb-3">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="glass-input block w-full rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showForgotNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <div className="relative mt-1 mb-4">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showForgotConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="glass-input block w-full rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showForgotConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-2.5 px-4 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

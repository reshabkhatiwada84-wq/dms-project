import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FolderOpen, Lock, Mail, User } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(true);

  const { register, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
    const timer = setTimeout(() => setIsReadOnly(false), 500);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsSubmitting(false);
      return;
    }

    const result = await register(name, email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
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
            Create an account
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Get started with your secure document portal
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm text-center">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} autoComplete="off">
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="full-name" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="full-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input block w-full rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email-address" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="reg_identifier"
                  name="reg_identifier"
                  type="text"
                  autoComplete="off"
                  readOnly={isReadOnly}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input block w-full rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none"
                  placeholder="john@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="reg_secret"
                  name="reg_secret"
                  type="text"
                  style={{ WebkitTextSecurity: 'disc' }}
                  autoComplete="off"
                  data-lpignore="true"
                  readOnly={isReadOnly}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input block w-full rounded-xl py-3 pl-10 pr-3 text-sm focus:outline-none"
                  placeholder="Min. 6 characters"
                />
              </div>
            </div>


          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Account...' : 'Sign Up'}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-slate-400 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sky-400 hover:text-sky-300 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
export default Register;

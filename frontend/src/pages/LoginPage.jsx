import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginRequest } from '../api/authApi.js';
import { useAuthStore } from '../store/useAuthStore.js';
import AnimatedButton from '../components/ui/AnimatedButton.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token, user } = await loginRequest(form.email.trim(), form.password);
      setAuth({ token, user });
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Could not log in. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-body text-sm text-teal hover:text-teal-dark transition">
          ← Back home
        </Link>

        <h1 className="font-body font-bold text-3xl text-ink mt-6 mb-1">Welcome back</h1>
        <p className="font-body text-ink/60 mb-8">Log in to make your AUST PIC ID card.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@aust.edu"
              className="font-body rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-ink outline-none transition focus:border-teal-light"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="font-body rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-ink outline-none transition focus:border-teal-light"
            />
          </label>

          {error && <p className="font-body text-sm text-red-500">{error}</p>}

          <AnimatedButton type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Logging in…' : 'Login'}
          </AnimatedButton>
        </form>

        <p className="font-body text-sm text-ink/60 mt-6 text-center">
          Don't have an account?{' '}
          <Link to="/signup" className="text-teal font-medium hover:text-teal-dark transition">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
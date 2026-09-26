import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupRequest } from '../api/authApi.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { bloodGroups, departments } from '../config/template.js';
import AnimatedButton from '../components/ui/AnimatedButton.jsx';

const inputClass =
  'font-body rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-ink outline-none transition focus:border-teal-light';

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  // Kept apart from `form` because these are optional and are reset together
  // as one group, while the credentials above are the part that must be filled.
  const [card, setCard] = useState({ studentId: '', department: '', bloodGroup: '', contact: '', address: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardChange = (event) => {
    const { name, value } = event.target;
    setCard((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      // `confirm` is client-only; the server never sees it. Name and email are
      // trimmed server-side in validateSignup.
      const { confirm, ...credentials } = form;
      const { token, user } = await signupRequest({ ...credentials, ...card });
      setAuth({ token, user });
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Could not create your account. Try again.');
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

        <h1 className="font-body font-bold text-3xl text-ink mt-6 mb-1">Create your account</h1>
        <p className="font-body text-ink/60 mb-8">Sign up to make your AUST PIC ID card.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Full name</span>
            <input
              type="text"
              name="name"
              required
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your name"
              className={inputClass}
            />
          </label>

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
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-body text-xs font-medium text-ink/70">Confirm password</span>
            <input
              type="password"
              name="confirm"
              required
              minLength={6}
              autoComplete="new-password"
              value={form.confirm}
              onChange={handleChange}
              placeholder="Repeat password"
              className={inputClass}
            />
          </label>

          {/* Optional card details. Everything here pre-fills the ID card, so
              the member can skip it and type on the card instead, or fill it
              now and find the card already done. name and email are not
              repeated — they are already captured above and pre-fill from
              there. memberId is absent because the server allocates it. */}
          <fieldset className="mt-2 flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white/50 p-4">
            <legend className="px-1 font-body text-xs font-medium text-ink/70">
              ID card details <span className="font-normal text-ink/40">(optional)</span>
            </legend>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-xs font-medium text-ink/70">Student ID</span>
              <input
                type="text"
                name="studentId"
                maxLength={20}
                autoComplete="off"
                value={card.studentId}
                onChange={handleCardChange}
                placeholder="e.g. 2210110"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-xs font-medium text-ink/70">Department</span>
              <select
                name="department"
                value={card.department}
                onChange={handleCardChange}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Select department</option>
                {departments.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-xs font-medium text-ink/70">Blood group</span>
              <select
                name="bloodGroup"
                value={card.bloodGroup}
                onChange={handleCardChange}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Select blood group</option>
                {bloodGroups.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-xs font-medium text-ink/70">Contact</span>
              <input
                type="tel"
                name="contact"
                maxLength={20}
                autoComplete="tel"
                value={card.contact}
                onChange={handleCardChange}
                placeholder="e.g. +8801XXXXXXXXX"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-xs font-medium text-ink/70">Address</span>
              <textarea
                name="address"
                rows={2}
                maxLength={140}
                value={card.address}
                onChange={handleCardChange}
                placeholder="Your address"
                className={`${inputClass} resize-none`}
              />
            </label>
          </fieldset>

          {error && <p className="font-body text-sm text-red-500">{error}</p>}

          <AnimatedButton type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Creating account…' : 'Sign Up'}
          </AnimatedButton>
        </form>

        <p className="font-body text-sm text-ink/60 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-teal font-medium hover:text-teal-dark transition">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
import client from './client.js';

// POST /api/auth/login { email, password } -> { token, user }
export async function loginRequest(email, password) {
  const { data } = await client.post('/auth/login', { email, password });
  return data;
}

// POST /api/auth/signup { name, email, password, ...cardDetails } -> { token, user }
// One payload object rather than positional args: signup now also carries the
// optional ID card details, which would be unreadable as a 4th-8th parameter.
export async function signupRequest(payload) {
  const { data } = await client.post('/auth/signup', payload);
  return data;
}
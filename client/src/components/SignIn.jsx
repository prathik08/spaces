import { apiUrl } from '../lib/api';

export default function SignIn({ error }) {
  return (
    <div className="signin-wrap">
      <p className="signin-copy">
        Spaces calls paid AI services per request, so it's gated behind GitHub
        sign-in to keep usage to real visitors.
      </p>
      {error && <div className="error-box">Sign-in failed — please try again.</div>}
      <a className="analyze-btn signin-btn" href={apiUrl('/api/auth/github')}>
        Sign in with GitHub →
      </a>
    </div>
  );
}

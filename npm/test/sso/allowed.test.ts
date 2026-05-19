import * as allowed from '../../src/controller/oauth/allowed';
import tap from 'tap';

tap.teardown(async () => {
  process.exit(0);
});

tap.test('allowed.ts', async (t) => {
  t.test('redirect without exact match', async (t) => {
    const redirectUrl = 'https://example.com/callback';
    const redirectUrls = ['https://example.com'];

    const result = allowed.redirect(redirectUrl, redirectUrls, false);
    t.equal(result, true);
  });

  t.test('redirect without exact match - failure', async (t) => {
    const redirectUrl = 'https://example.com/callback';
    const redirectUrls = ['https://other.com'];

    const result = allowed.redirect(redirectUrl, redirectUrls, false);
    t.equal(result, false);
  });

  t.test('redirect with exact match', async (t) => {
    const redirectUrl = 'https://example.com/callback';
    const redirectUrls = ['https://example.com/callback'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, true);
  });

  t.test('redirect with exact match - failure', async (t) => {
    const redirectUrl = 'https://example.com/callback';
    const redirectUrls = ['https://example.com/other'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, false);
  });

  t.test('redirect with exact match - multiple allowed, correct URL first', async (t) => {
    const redirectUrl = 'https://correct.example.com/callback';
    const redirectUrls = ['https://correct.example.com/callback', 'https://other.example.com/callback'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, true);
  });

  t.test('redirect with exact match - multiple allowed, correct URL last', async (t) => {
    const redirectUrl = 'https://correct.example.com/callback';
    const redirectUrls = ['https://other.example.com/callback', 'https://correct.example.com/callback'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, true);
  });

  t.test('redirect without exact match - multiple allowed, correct URL last', async (t) => {
    const redirectUrl = 'https://correct.example.com/callback';
    const redirectUrls = ['https://other.example.com', 'https://correct.example.com'];

    const result = allowed.redirect(redirectUrl, redirectUrls, false);
    t.equal(result, true);
  });

  t.test('redirect with exact match - multiple allowed, no URL matches', async (t) => {
    const redirectUrl = 'https://correct.example.com/callback';
    const redirectUrls = ['https://other.example.com/callback', 'https://another.example.com/callback'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, false);
  });

  t.test('redirect - placeholder URL is always rejected', async (t) => {
    const placeholder = 'http://_boxyhq_redirect_not_in_use';
    const redirectUrls = [placeholder, 'https://example.com/callback'];

    t.equal(allowed.redirect(placeholder, redirectUrls, false), false);
    t.equal(allowed.redirect(placeholder, redirectUrls, true), false);
  });

  t.test('redirect - empty allowlist returns false', async (t) => {
    const redirectUrl = 'https://example.com/callback';

    t.equal(allowed.redirect(redirectUrl, [], false), false);
    t.equal(allowed.redirect(redirectUrl, [], true), false);
  });

  t.test('redirect without exact match - subdomain wildcard matches', async (t) => {
    const redirectUrl = 'https://sub.example.com/callback';
    const redirectUrls = ['https://*.example.com'];

    const result = allowed.redirect(redirectUrl, redirectUrls, false);
    t.equal(result, true);
  });

  t.test('redirect without exact match - subdomain wildcard, wildcard entry last', async (t) => {
    const redirectUrl = 'https://sub.example.com/callback';
    const redirectUrls = ['https://other.example.com', 'https://*.example.com'];

    const result = allowed.redirect(redirectUrl, redirectUrls, false);
    t.equal(result, true);
  });

  t.test('redirect with exact match - subdomain wildcard + matching path, wildcard entry last', async (t) => {
    const redirectUrl = 'https://sub.example.com/callback';
    const redirectUrls = ['https://other.example.com/callback', 'https://*.example.com/callback'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, true);
  });

  t.test(
    'redirect with exact match - multi-URL, scheme mismatches are rejected even when second entry matches host+path',
    async (t) => {
      const redirectUrl = 'https://example.com/callback';
      const redirectUrls = ['https://other.example.com/callback', 'http://example.com/callback'];

      const result = allowed.redirect(redirectUrl, redirectUrls, true);
      t.equal(result, false);
    }
  );

  t.test('redirect with exact match - multi-URL, port mismatches are rejected', async (t) => {
    const redirectUrl = 'https://example.com:8080/callback';
    const redirectUrls = ['https://other.example.com/callback', 'https://example.com:9090/callback'];

    const result = allowed.redirect(redirectUrl, redirectUrls, true);
    t.equal(result, false);
  });
});

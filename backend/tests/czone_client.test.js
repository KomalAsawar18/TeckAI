const { fetchProductPage, validateCzoneUrl } = require('../src/ingestion/sources/czone/client');

describe('Czone Ingestion Client Tests', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('URL Validation', () => {
    test('allows valid Czone URLs with http/https', () => {
      expect(validateCzoneUrl('https://www.czone.com.pk/laptops-pakistan.html')).toBe(true);
      expect(validateCzoneUrl('http://czone.com.pk/monitors-pakistan.html')).toBe(true);
      expect(validateCzoneUrl('https://sub.czone.com.pk/product/123')).toBe(true);
    });

    test('rejects non-http/https protocols', () => {
      expect(validateCzoneUrl('ftp://www.czone.com.pk/laptops.html')).toBe(false);
      expect(validateCzoneUrl('javascript:alert(1)')).toBe(false);
    });

    test('rejects other arbitrary domains', () => {
      expect(validateCzoneUrl('https://www.google.com')).toBe(false);
      expect(validateCzoneUrl('https://czone.com')).toBe(false); // wrong TLD
      expect(validateCzoneUrl('https://czone-pk.com')).toBe(false);
    });
  });

  describe('fetchProductPage HTTP Mocking', () => {
    test('returns success and html for standard 200 HTML response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => {
            if (name.toLowerCase() === 'content-type') return 'text/html; charset=utf-8';
            return null;
          }
        },
        text: async () => '<html><body>Victus Laptop</body></html>'
      });

      const res = await fetchProductPage('https://www.czone.com.pk/product.html');
      expect(res.success).toBe(true);
      expect(res.rawStatus).toBe(200);
      expect(res.html).toBe('<html><body>Victus Laptop</body></html>');
    });

    test('returns invalid_url for arbitrary domains without fetching', async () => {
      const res = await fetchProductPage('https://www.google.com/product.html');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('invalid_url');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test('returns source_unavailable for 403 Forbidden response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 403,
        headers: {
          get: (name) => {
            if (name.toLowerCase() === 'content-type') return 'text/html';
            return null;
          }
        }
      });

      const res = await fetchProductPage('https://www.czone.com.pk/product.html');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('source_unavailable');
      expect(res.status).toBe(403);
    });

    test('returns source_unavailable for 429 Rate Limited response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (name) => {
            if (name.toLowerCase() === 'content-type') return 'text/html';
            return null;
          }
        }
      });

      const res = await fetchProductPage('https://www.czone.com.pk/product.html');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('source_unavailable');
      expect(res.status).toBe(429);
    });

    test('returns unexpected_content for non-HTML response format', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name) => {
            if (name.toLowerCase() === 'content-type') return 'application/json';
            return null;
          }
        }
      });

      const res = await fetchProductPage('https://www.czone.com.pk/product.html');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('unexpected_content');
      expect(res.status).toBe(200);
    });

    test('returns timeout when fetch is aborted', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValue(abortError);

      const res = await fetchProductPage('https://www.czone.com.pk/product.html');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('timeout');
      expect(res.status).toBeUndefined(); // no invented HTTP status
    });

    test('returns network_error when fetch encounters network failure', async () => {
      fetchSpy.mockRejectedValue(new Error('TypeError: fetch failed'));

      const res = await fetchProductPage('https://www.czone.com.pk/product.html');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('network_error');
      expect(res.status).toBeUndefined(); // no invented HTTP status
    });
  });
});

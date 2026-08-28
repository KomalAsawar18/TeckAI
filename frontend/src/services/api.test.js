import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiOrigin, getOfferRedirectUrl } from './api';

describe('Offer Redirect and API Origin Helpers', () => {
  const originalEnv = import.meta.env.VITE_API_URL;

  afterEach(() => {
    import.meta.env.VITE_API_URL = originalEnv;
  });

  describe('getApiOrigin', () => {
    it('extracts origin when VITE_API_URL has /api suffix', () => {
      import.meta.env.VITE_API_URL = 'https://teckai-backend.vercel.app/api';
      expect(getApiOrigin()).toBe('https://teckai-backend.vercel.app');
    });

    it('extracts origin when VITE_API_URL has trailing slash /api/', () => {
      import.meta.env.VITE_API_URL = 'http://localhost:5000/api/';
      expect(getApiOrigin()).toBe('http://localhost:5000');
    });

    it('extracts origin when VITE_API_URL is host without /api', () => {
      import.meta.env.VITE_API_URL = 'https://api.teckai.com';
      expect(getApiOrigin()).toBe('https://api.teckai.com');
    });

    it('falls back to localhost:5000 in dev when VITE_API_URL is unset', () => {
      delete import.meta.env.VITE_API_URL;
      expect(getApiOrigin()).toBe('http://localhost:5000');
    });
  });

  describe('getOfferRedirectUrl', () => {
    it('builds absolute redirect URL from offer object with redirectUrl', () => {
      import.meta.env.VITE_API_URL = 'https://teckai-backend.vercel.app/api';
      const offer = {
        id: 'offer-123',
        seller: 'EEZEPC',
        redirectUrl: '/api/offers/offer-123/redirect'
      };
      const url = getOfferRedirectUrl(offer);
      expect(url).toBe('https://teckai-backend.vercel.app/api/offers/offer-123/redirect');
      expect(url).not.toContain('localhost:5173');
      expect(url).not.toContain('vercel.app/canonical-products');
    });

    it('builds absolute redirect URL from offer object with only id / _id', () => {
      import.meta.env.VITE_API_URL = 'http://localhost:5000/api';
      const offer = { _id: '6a8ff1b8e704060b361a376f', seller: 'Infinity Store' };
      const url = getOfferRedirectUrl(offer);
      expect(url).toBe('http://localhost:5000/api/offers/6a8ff1b8e704060b361a376f/redirect');
    });

    it('builds absolute redirect URL from string path', () => {
      import.meta.env.VITE_API_URL = 'https://teckai-backend.vercel.app/api';
      const url = getOfferRedirectUrl('/api/offers/abc-456/redirect');
      expect(url).toBe('https://teckai-backend.vercel.app/api/offers/abc-456/redirect');
    });

    it('preserves already fully qualified redirect URLs', () => {
      const existing = 'http://localhost:5000/api/offers/offer-789/redirect';
      expect(getOfferRedirectUrl(existing)).toBe(existing);
    });

    it('handles null / undefined / empty safely', () => {
      expect(getOfferRedirectUrl(null)).toBe('#');
      expect(getOfferRedirectUrl(undefined)).toBe('#');
      expect(getOfferRedirectUrl({})).toBe('#');
    });
  });
});

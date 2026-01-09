import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPds } from '$lib/bsky';

// global.fetchのモック
global.fetch = vi.fn();

describe('bsky utils', () => {

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getPds', () => {
    it('did:plcのPDSを解決できること', async () => {
      const mockDid = 'did:plc:123';
      const mockPds = 'https://pds.example.com';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: [
            {
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: mockPds
            }
          ]
        })
      });

      const result = await getPds(mockDid);
      expect(result).toBe(mockPds);
      expect(global.fetch).toHaveBeenCalledWith(`https://plc.directory/${mockDid}`);
    });

    it('did:webのPDSを解決できること', async () => {
      const mockDid = 'did:web:example.com';
      const mockPds = 'https://pds.example.com';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: [
            {
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: mockPds
            }
          ]
        })
      });

      const result = await getPds(mockDid);
      expect(result).toBe(mockPds);
      expect(global.fetch).toHaveBeenCalledWith(`https://example.com/.well-known/did.json`);
    });

    it('PDSが見つからない場合にエラーを投げること', async () => {
      const mockDid = 'did:plc:404';
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ service: [] })
      });

      await expect(getPds(mockDid)).rejects.toThrow('PDS not found');
    });
  });

});

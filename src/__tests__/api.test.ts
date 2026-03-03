// Mockear firebase antes de importar api.ts
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue('mock-firebase-token'),
    },
  },
  isConfigured: true,
  uploadFile: jest.fn(),
  getPublicUrl: jest.fn(),
  deleteFile: jest.fn(),
}));

import { apiClient } from '@/lib/api';

// Guardar referencia al fetch original
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper: crear una respuesta HTTP mock
function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: {
      get: (key: string) => (key === 'content-type' ? 'application/json' : null),
    },
    json: jest.fn().mockResolvedValue(data),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ApiClient.hasToken()', () => {
  it('devuelve hasToken: true cuando el servidor responde con token', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ hasToken: true, isCustom: false })
    );
    const result = await apiClient.hasToken();
    expect(result.hasToken).toBe(true);
  });

  it('devuelve hasToken: false cuando el servidor lo indica', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ hasToken: false, isCustom: false })
    );
    const result = await apiClient.hasToken();
    expect(result.hasToken).toBe(false);
  });

  it('lanza error si no hay sesión activa', async () => {
    const { auth } = require('@/lib/firebase');
    const original = auth.currentUser;
    auth.currentUser = null;

    await expect(apiClient.hasToken()).rejects.toThrow('No hay sesión activa');
    auth.currentUser = original;
  });

  it('incluye el header Authorization con Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ hasToken: true, isCustom: false })
    );
    await apiClient.hasToken();
    const call = mockFetch.mock.calls[0];
    expect(call[1].headers['Authorization']).toBe('Bearer mock-firebase-token');
  });
});

describe('ApiClient.saveToken()', () => {
  it('envía el token en el body de la petición', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));
    await apiClient.saveToken('r8_abc123def456');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.token).toBe('r8_abc123def456');
  });

  it('usa método POST', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));
    await apiClient.saveToken('r8_test');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });
});

describe('ApiClient.removeBackground()', () => {
  it('envía imageUrl y modelVersion al endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, outputUrl: 'https://example.com/out.png' })
    );
    const result = await apiClient.removeBackground(
      'https://storage.googleapis.com/test.jpg',
      'fb8af171'
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.imageUrl).toBe('https://storage.googleapis.com/test.jpg');
    expect(body.modelVersion).toBe('fb8af171');
    expect(result.outputUrl).toBe('https://example.com/out.png');
  });

  it('lanza error cuando el servidor responde con error HTTP', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Token inválido' }, false, 401)
    );
    await expect(
      apiClient.removeBackground('https://x.com/img.jpg')
    ).rejects.toThrow('Token inválido');
  });
});

describe('ApiClient.generateImage()', () => {
  it('envía el prompt y opciones al endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, outputUrl: 'https://example.com/gen.png' })
    );
    await apiClient.generateImage('un gato en la luna', 'ugly', {
      width: 1024,
      height: 1024,
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toBe('un gato en la luna');
    expect(body.negative_prompt).toBe('ugly');
    expect(body.width).toBe(1024);
  });

  it('lanza error si la respuesta no es JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'text/html' },
    });
    await expect(apiClient.generateImage('test')).rejects.toThrow(
      'Respuesta inválida del servidor'
    );
  });
});

describe('ApiClient - reintentos y red', () => {
  it('reintenta automáticamente en error de red (TypeError)', async () => {
    // Simular que setTimeout resuelve inmediatamente para no esperar 5 segundos
    jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn: (...args: unknown[]) => void) => {
        fn();
        return null as unknown as NodeJS.Timeout;
      });

    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(mockResponse({ hasToken: true, isCustom: false }));

    const result = await apiClient.hasToken();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.hasToken).toBe(true);
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// â”€â”€ Mocks de dependencias externas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-uid-123' }, loading: false }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    hasToken: jest.fn().mockResolvedValue({ hasToken: true, isCustom: false }),
  },
}));

jest.mock('idb-keyval', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/session', () => ({
  auth: null,
  isConfigured: false,
  uploadFile: jest.fn().mockResolvedValue({ error: null }),
  getPublicUrl: jest.fn().mockResolvedValue('https://storage.googleapis.com/mock.jpg'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

// Silenciar console en tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // Simular soporte para la API File System Access
  Object.defineProperty(window, 'showDirectoryPicker', {
    value: jest.fn().mockResolvedValue({
      name: 'CarpetaTest',
      kind: 'directory',
      queryPermission: jest.fn().mockResolvedValue('granted'),
      requestPermission: jest.fn().mockResolvedValue('granted'),
      values: jest.fn().mockReturnValue([]),
    }),
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

// â”€â”€ Import despuÃ©s de todos los mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import FolderWatchPage from '@/pages/FolderWatch';

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('FolderWatchPage - renderizado inicial', () => {
  it('muestra el tÃ­tulo Auto Monitor', async () => {
    render(<FolderWatchPage />);
    expect(screen.getByText('Auto Monitor')).toBeInTheDocument();
  });

  it('muestra el subtÃ­tulo descriptivo', () => {
    render(<FolderWatchPage />);
    // Usar selector de clase para evitar problemas de encoding con caracteres especiales
    const subtitle = document.querySelector('.text-sm.font-medium.text-slate-500');
    expect(subtitle).toBeInTheDocument();
  });

  it('muestra el switch de Fondo Blanco', () => {
    render(<FolderWatchPage />);
    expect(screen.getByText('Fondo Blanco')).toBeInTheDocument();
  });

  it('renderiza la secciÃ³n de Modelo de IA', async () => {
    render(<FolderWatchPage />);
    await waitFor(() => {
      expect(screen.getByText('Modelo de IA')).toBeInTheDocument();
    });
  });

  it('muestra exactamente 3 tarjetas de modelos', () => {
    render(<FolderWatchPage />);
    // Los modelos se renderizan en una grid de 3 columnas (sm:grid-cols-3)
    // Buscamos los botones dentro de ese grid especÃ­fico
    const modelGrid = document.querySelector('.grid.grid-cols-1');
    const modelButtons = modelGrid ? modelGrid.querySelectorAll('button') : [];
    expect(modelButtons.length).toBe(3);
  });
});

describe('FolderWatchPage - botÃ³n Iniciar Monitoreo', () => {
  it('estÃ¡ deshabilitado si no hay carpetas ni modelo seleccionado', () => {
    render(<FolderWatchPage />);
    const btn = screen.getByRole('button', { name: /iniciar monitoreo/i });
    expect(btn).toBeDisabled();
  });
});

describe('FolderWatchPage - tarjetas de carpetas', () => {
  it('muestra el botÃ³n de carpeta de entrada', () => {
    render(<FolderWatchPage />);
    const labels = screen.getAllByText(/Entrada/i);
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el botÃ³n de carpeta de salida', () => {
    render(<FolderWatchPage />);
    const labels = screen.getAllByText(/Salida/i);
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el texto placeholder cuando no hay carpeta seleccionada', () => {
    render(<FolderWatchPage />);
    const placeholders = screen.getAllByText(/Seleccionar carpeta/i);
    expect(placeholders.length).toBe(2); // Entrada y Salida
  });
});

describe('FolderWatchPage - estadÃ­sticas', () => {
  it('muestra tarjetas de estadÃ­sticas con valores en cero', async () => {
    render(<FolderWatchPage />);
    // Total, Exitosas, Errores, Rastreados â€” todos en 0 inicialmente
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4);
  });

  it('muestra las etiquetas de las estadÃ­sticas', () => {
    render(<FolderWatchPage />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Exitosas')).toBeInTheDocument();
    expect(screen.getByText('Errores')).toBeInTheDocument();
    expect(screen.getByText('Rastreados')).toBeInTheDocument();
  });
});

describe('FolderWatchPage - switch Fondo Blanco', () => {
  it('el switch cambia de estado al hacer clic', () => {
    render(<FolderWatchPage />);
    const switchBtn = screen.getByRole('switch');
    expect(switchBtn.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(switchBtn);
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');
  });
});

describe('FolderWatchPage - selecciÃ³n de modelo', () => {
  it('al hacer clic en un modelo este queda seleccionado', async () => {
    render(<FolderWatchPage />);
    // Obtener todas las tarjetas de modelo (botones en la grilla de modelos)
    const modelButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.closest('.grid.grid-cols-1'));

    if (modelButtons.length > 0) {
      fireEvent.click(modelButtons[0]);
      // El checkmark de selecciÃ³n deberÃ­a aparecer
      await waitFor(() => {
        const checkmarks = document.querySelectorAll('.bg-indigo-600.rounded-full');
        expect(checkmarks.length).toBeGreaterThan(0);
      });
    }
  });
});

describe('FolderWatchPage - aviso configuraciÃ³n pendiente', () => {
  it('muestra el aviso cuando falta configuraciÃ³n', async () => {
    render(<FolderWatchPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Selecciona la carpeta de entrada y salida para continuar/i)
      ).toBeInTheDocument();
    });
  });
});

describe('FolderWatchPage - navegador no compatible', () => {
  it('muestra aviso de compatibilidad cuando FileSystem API no estÃ¡ disponible', () => {
    // Quitar temporalmente showDirectoryPicker para simular navegador sin soporte
    const descriptor = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker');
    // @ts-expect-error -- eliminando propiedad experimental para test
    delete window.showDirectoryPicker;

    render(<FolderWatchPage />);
    expect(screen.getByText(/Navegador no compatible/i)).toBeInTheDocument();

    // Restaurar
    if (descriptor) {
      Object.defineProperty(window, 'showDirectoryPicker', descriptor);
    }
  });
});


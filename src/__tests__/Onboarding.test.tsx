/**
 * Tests de integración para la página de Onboarding
 * Prueba el flujo de guardado de token de Replicate
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mocks - deben definirse antes de los imports
const mockSaveToken = jest.fn();
const mockRefreshTokenStatus = jest.fn();
const mockNavigate = jest.fn();

// Mock de react-router-dom (sin requireActual para evitar TextEncoder)
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    saveToken: (...args: unknown[]) => mockSaveToken(...args),
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123', email: 'test@example.com' },
    loading: false,
    hasToken: false,
    refreshTokenStatus: mockRefreshTokenStatus,
    signOut: jest.fn(),
  }),
}));

jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    toast: jest.fn(),
    dismiss: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

import Onboarding from '@/pages/Onboarding';

// Helper para renderizar (el BrowserRouter ya está mockeado)
function renderOnboarding() {
  return render(<Onboarding />);
}

// Helper para navegar al paso 2 (donde está el input del token)
async function goToTokenStep(user: ReturnType<typeof userEvent.setup>) {
  const startButton = screen.getByRole('button', { name: /comenzar|configuración/i });
  await user.click(startButton);
}

describe('Página Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Paso 1: Bienvenida', () => {
    it('muestra pantalla de bienvenida inicialmente', () => {
      renderOnboarding();
      
      expect(screen.getByText(/bienvenido/i)).toBeInTheDocument();
    });

    it('tiene botón para comenzar configuración', () => {
      renderOnboarding();
      
      const button = screen.getByRole('button', { name: /comenzar|configuración/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Paso 2: Renderizado del formulario de token', () => {
    it('muestra el formulario de token en paso 2', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      expect(screen.getByText(/Configura tu API Token/i)).toBeInTheDocument();
    });

    it('tiene input para el token', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      expect(input).toBeInTheDocument();
    });

    it('botón de guardar está deshabilitado inicialmente', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Validación del token', () => {
    it('acepta token con formato válido (r8_xxxxxxxxxx)', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_abcdefghij1234567890');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('rechaza token sin prefijo r8_', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'invalidtoken12345678');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      expect(saveButton).toBeDisabled();
    });

    it('rechaza token muy corto', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_short');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Guardado del token', () => {
    it('guarda token válido correctamente', async () => {
      const user = userEvent.setup();
      mockSaveToken.mockResolvedValue({ success: true });
      mockRefreshTokenStatus.mockResolvedValue(undefined);
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtokentest12345');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockSaveToken).toHaveBeenCalledWith('r8_validtokentest12345');
      });
    });

    it('muestra loading mientras guarda', async () => {
      const user = userEvent.setup();
      
      // Simular delay en guardado
      mockSaveToken.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtokentest12345');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      // Verificar que el botón está deshabilitado durante el guardado
      expect(saveButton).toBeDisabled();
    });

    it('refresca el estado del token después de guardar', async () => {
      const user = userEvent.setup();
      mockSaveToken.mockResolvedValue({ success: true });
      mockRefreshTokenStatus.mockResolvedValue(undefined);
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtokentest12345');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockRefreshTokenStatus).toHaveBeenCalled();
      });
    });
  });

  describe('Manejo de errores', () => {
    it('muestra error cuando el servidor falla', async () => {
      const user = userEvent.setup();
      mockSaveToken.mockRejectedValue(new Error('Server error'));
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtokentest12345');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      // El error se muestra como toast - verificamos que el input sigue disponible (no navegó)
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/r8_/i)).toBeInTheDocument();
      });
    });

    it('permite reintentar después de un error', async () => {
      const user = userEvent.setup();
      mockSaveToken
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });
      mockRefreshTokenStatus.mockResolvedValue(undefined);
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtokentest12345');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      
      // Primer intento - falla
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockSaveToken).toHaveBeenCalledTimes(1);
      });
      
      // Segundo intento - éxito
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockSaveToken).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accesibilidad', () => {
    it('el input tiene placeholder descriptivo', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      expect(input).toBeInTheDocument();
    });
  });
});

/**
 * Tests de integraciÃ³n para la pÃ¡gina de Onboarding
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

import Onboarding from '../pages/Onboarding';

// Helper para renderizar (el BrowserRouter ya estÃ¡ mockeado)
function renderOnboarding() {
  return render(<Onboarding />);
}

// Helper para navegar al paso 2 (donde estÃ¡ el input del token)
async function goToTokenStep(user: ReturnType<typeof userEvent.setup>) {
  const startButton = screen.getByRole('button', { name: /comenzar|configuraciÃ³n/i });
  await user.click(startButton);
}

describe('PÃ¡gina Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Paso 1: Bienvenida', () => {
    it('muestra pantalla de bienvenida inicialmente', () => {
      renderOnboarding();
      
      expect(screen.getByText(/bienvenido/i)).toBeInTheDocument();
    });

    it('tiene botÃ³n para comenzar configuraciÃ³n', () => {
      renderOnboarding();
      
      const button = screen.getByRole('button', { name: /comenzar|configuraciÃ³n/i });
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

    it('botÃ³n de guardar estÃ¡ deshabilitado inicialmente', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('ValidaciÃ³n del token', () => {
    it('acepta token con formato vÃ¡lido (r8_validtoken1234567890validtoken1234)', async () => {
      const user = userEvent.setup();
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtoken1234567890validtoken1234');
      
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
    it('guarda token vÃ¡lido correctamente', async () => {
      const user = userEvent.setup();
      mockSaveToken.mockResolvedValue({ success: true });
      mockRefreshTokenStatus.mockResolvedValue(undefined);
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtoken1234567890validtoken1234');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockSaveToken).toHaveBeenCalledWith('r8_validtoken1234567890validtoken1234');
      });
    });

    it('muestra loading mientras guarda', async () => {
      const user = userEvent.setup();
      
      // Simular delay en guardado
      mockSaveToken.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)));
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtoken1234567890validtoken1234');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      // Verificar que el botÃ³n estÃ¡ deshabilitado durante el guardado
      expect(saveButton).toBeDisabled();
    });

    it('refresca el estado del token despuÃ©s de guardar', async () => {
      const user = userEvent.setup();
      mockSaveToken.mockResolvedValue({ success: true });
      mockRefreshTokenStatus.mockResolvedValue(undefined);
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtoken1234567890validtoken1234');
      
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
      await user.type(input, 'r8_validtoken1234567890validtoken1234');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      await user.click(saveButton);
      
      // El error se muestra como toast - verificamos que el input sigue disponible (no navegÃ³)
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/r8_/i)).toBeInTheDocument();
      });
    });

    it('permite reintentar despuÃ©s de un error', async () => {
      const user = userEvent.setup();
      mockSaveToken
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });
      mockRefreshTokenStatus.mockResolvedValue(undefined);
      
      renderOnboarding();
      
      await goToTokenStep(user);
      
      const input = screen.getByPlaceholderText(/r8_/i);
      await user.type(input, 'r8_validtoken1234567890validtoken1234');
      
      const saveButton = screen.getByRole('button', { name: /guardar|verificar|continuar/i });
      
      // Primer intento - falla
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(mockSaveToken).toHaveBeenCalledTimes(1);
      });
      
      // Segundo intento - Ã©xito
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




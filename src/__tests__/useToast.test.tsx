import { renderHook, act } from '@testing-library/react';
import { useToast } from '@/hooks/useToast';

describe('useToast()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('inicia con lista de toasts vacía', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it('agrega un toast de tipo success', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.success('Operación exitosa'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Operación exitosa');
    expect(result.current.toasts[0].type).toBe('success');
  });

  it('agrega un toast de tipo error', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.error('Algo salió mal'));
    expect(result.current.toasts[0].type).toBe('error');
  });

  it('agrega un toast de tipo info', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.info('Información'));
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('agrega un toast de tipo warning', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.warning('Advertencia'));
    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('permite múltiples toasts simultáneos', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.success('Primero');
      result.current.error('Segundo');
      result.current.info('Tercero');
    });
    expect(result.current.toasts).toHaveLength(3);
  });

  it('dismiss() elimina el toast indicado', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.success('Toast a eliminar'));
    const id = result.current.toasts[0].id;
    act(() => result.current.dismiss(id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('dismiss() solo elimina el toast con el id correcto', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.success('Primero'));
    // Avanzar 1ms para garantizar IDs diferentes
    jest.advanceTimersByTime(1);
    act(() => result.current.error('Segundo'));
    const firstId = result.current.toasts[0].id;
    act(() => result.current.dismiss(firstId));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Segundo');
  });

  it('auto-dismiss después de 4 segundos', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.info('Desaparece solo'));
    expect(result.current.toasts).toHaveLength(1);
    act(() => jest.advanceTimersByTime(4000));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('NO elimina el toast antes de 4 segundos', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.info('Aún visible'));
    act(() => jest.advanceTimersByTime(3999));
    expect(result.current.toasts).toHaveLength(1);
  });

  it('show() con tipo explícito funciona', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show('Texto', 'warning'));
    expect(result.current.toasts[0].type).toBe('warning');
  });

  it('cada toast tiene un id único', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.success('A'));
    jest.advanceTimersByTime(1);
    act(() => result.current.success('B'));
    const ids = result.current.toasts.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { cn } from '@/lib/utils';

describe('cn() - class name merger', () => {
  it('une dos clases simples', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('ignora valores falsy', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('resuelve conflictos de Tailwind (la última gana)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('acepta un array de clases', () => {
    expect(cn(['a', 'b'])).toBe('a b');
  });

  it('acepta objetos condicionales', () => {
    expect(cn({ 'font-bold': true, 'text-red-500': false })).toBe('font-bold');
  });

  it('maneja clases vacías o string vacío', () => {
    expect(cn('')).toBe('');
    expect(cn()).toBe('');
  });

  it('combina en profundidad: objeto + string', () => {
    expect(cn('flex', { 'items-center': true }, 'gap-2')).toBe(
      'flex items-center gap-2'
    );
  });
});

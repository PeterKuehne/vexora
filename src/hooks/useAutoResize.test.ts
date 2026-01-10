/**
 * useAutoResize Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoResize, useAutoResizeValue } from './useAutoResize';
import { useRef } from 'react';

// Mock textarea element
function createMockTextarea(): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  // Mock scrollHeight
  Object.defineProperty(textarea, 'scrollHeight', {
    get: vi.fn(() => 100),
    configurable: true,
  });
  return textarea;
}

describe('useAutoResize', () => {
  let mockTextarea: HTMLTextAreaElement;

  beforeEach(() => {
    mockTextarea = createMockTextarea();
    document.body.appendChild(mockTextarea);
  });

  afterEach(() => {
    document.body.removeChild(mockTextarea);
  });

  describe('basic functionality', () => {
    it('should return reset and resize functions', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref);
      });

      expect(typeof result.current.reset).toBe('function');
      expect(typeof result.current.resize).toBe('function');
    });

    it('should apply height on resize', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref);
      });

      act(() => {
        result.current.resize();
      });

      // Should have applied height based on scrollHeight
      expect(mockTextarea.style.height).toBe('100px');
    });

    it('should reset height', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref, { minHeight: 40 });
      });

      // First resize
      act(() => {
        result.current.resize();
      });

      // Then reset
      act(() => {
        result.current.reset();
      });

      expect(mockTextarea.style.height).toBe('40px');
    });
  });

  describe('maxHeight constraint', () => {
    it('should limit height to maxHeight', () => {
      // Mock large scrollHeight
      Object.defineProperty(mockTextarea, 'scrollHeight', {
        get: () => 500,
        configurable: true,
      });

      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref, { maxHeight: 200 });
      });

      act(() => {
        result.current.resize();
      });

      expect(mockTextarea.style.height).toBe('200px');
      expect(mockTextarea.style.overflowY).toBe('auto');
    });

    it('should hide overflow when under maxHeight', () => {
      // Mock small scrollHeight
      Object.defineProperty(mockTextarea, 'scrollHeight', {
        get: () => 50,
        configurable: true,
      });

      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref, { maxHeight: 200 });
      });

      act(() => {
        result.current.resize();
      });

      expect(mockTextarea.style.overflowY).toBe('hidden');
    });
  });

  describe('minHeight constraint', () => {
    it('should respect minHeight', () => {
      // Mock small scrollHeight
      Object.defineProperty(mockTextarea, 'scrollHeight', {
        get: () => 20,
        configurable: true,
      });

      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref, { minHeight: 40 });
      });

      act(() => {
        result.current.resize();
      });

      expect(mockTextarea.style.height).toBe('40px');
    });

    it('should set minHeight CSS property', () => {
      renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref, { minHeight: 40 });
      });

      expect(mockTextarea.style.minHeight).toBe('40px');
    });
  });

  describe('enabled option', () => {
    it('should not resize when disabled', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResize(ref, { enabled: false });
      });

      // Set initial height
      mockTextarea.style.height = '50px';

      act(() => {
        result.current.resize();
      });

      // Height should remain unchanged
      expect(mockTextarea.style.height).toBe('50px');
    });
  });

  describe('dependency changes', () => {
    it('should resize when dependency changes', () => {
      let dependency = 'initial';

      const { rerender } = renderHook(
        ({ dep }) => {
          const ref = useRef<HTMLTextAreaElement>(mockTextarea);
          return useAutoResize(ref, { dependency: dep });
        },
        { initialProps: { dep: dependency } }
      );

      // Change scrollHeight to simulate content change
      Object.defineProperty(mockTextarea, 'scrollHeight', {
        get: () => 150,
        configurable: true,
      });

      // Update dependency
      dependency = 'changed';
      rerender({ dep: dependency });

      expect(mockTextarea.style.height).toBe('150px');
    });
  });
});

describe('useAutoResizeValue', () => {
  let mockTextarea: HTMLTextAreaElement;

  beforeEach(() => {
    mockTextarea = createMockTextarea();
    document.body.appendChild(mockTextarea);
  });

  afterEach(() => {
    document.body.removeChild(mockTextarea);
  });

  it('should resize based on value', () => {
    const { rerender } = renderHook(
      ({ value }) => {
        const ref = useRef<HTMLTextAreaElement>(mockTextarea);
        return useAutoResizeValue(ref, value);
      },
      { initialProps: { value: '' } }
    );

    // Change scrollHeight to simulate typing
    Object.defineProperty(mockTextarea, 'scrollHeight', {
      get: () => 120,
      configurable: true,
    });

    // Simulate value change
    rerender({ value: 'Hello world' });

    expect(mockTextarea.style.height).toBe('120px');
  });

  it('should work with maxHeight option', () => {
    Object.defineProperty(mockTextarea, 'scrollHeight', {
      get: () => 300,
      configurable: true,
    });

    renderHook(() => {
      const ref = useRef<HTMLTextAreaElement>(mockTextarea);
      return useAutoResizeValue(ref, 'Long text', { maxHeight: 150 });
    });

    expect(mockTextarea.style.height).toBe('150px');
  });
});

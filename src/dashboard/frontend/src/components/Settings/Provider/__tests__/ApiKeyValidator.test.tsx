import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ApiKeyValidator } from '../ApiKeyValidator';

describe('ApiKeyValidator', () => {
  const mockOnChange = vi.fn();
  let fetchSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnChange.mockClear();

    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  describe('Rendering', () => {
    it('should render input field with provided value', () => {
      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('sk-test-key') as HTMLInputElement;
      expect(input.value).toBe('sk-test-key');
    });

    it('should render as password type by default', () => {
      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('sk-test-key') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('should show placeholder based on provider', () => {
      render(<ApiKeyValidator provider="openai" value="" onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/sk-/i);
      expect(input).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<ApiKeyValidator provider="anthropic" value="sk-ant-test" onChange={mockOnChange} disabled={true} />);

      const input = screen.getByDisplayValue('sk-ant-test') as HTMLInputElement;
      expect(input).toBeDisabled();
    });
  });

  describe('Show/Hide Key Toggle', () => {
    it('should toggle between password and text type when eye button clicked', async () => {
      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      const input = screen.getByDisplayValue('sk-test-key') as HTMLInputElement;
      const toggleButton = screen.getByRole('button');

      // Initially password
      expect(input.type).toBe('password');

      // Click to show
      fireEvent.click(toggleButton);
      expect(input.type).toBe('text');

      // Click to hide
      fireEvent.click(toggleButton);
      expect(input.type).toBe('password');
    });
  });

  describe('Input Handling', () => {
    it('should call onChange when input value changes', () => {
      render(<ApiKeyValidator provider="openai" value="" onChange={mockOnChange} />);

      const input = screen.getByPlaceholderText(/sk-/i);
      fireEvent.change(input, { target: { value: 'sk-new-key' } });

      expect(mockOnChange).toHaveBeenCalledWith('sk-new-key');
    });

    it('should reset validation state when input is cleared', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      const { rerender } = render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      // Wait for debounce and validation
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.queryByText(/validated successfully/i)).toBeInTheDocument();
      });

      // Clear input
      rerender(<ApiKeyValidator provider="openai" value="" onChange={mockOnChange} />);

      await waitFor(() => {
        expect(screen.queryByText(/validated successfully/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Debounced Validation', () => {
    it('should debounce validation by 500ms', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      // Should not call fetch immediately
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance 400ms - still not called
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance to 500ms - now it should be called
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset debounce timer when value changes', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true }),
      });

      const { rerender } = render(<ApiKeyValidator provider="openai" value="sk-key-1" onChange={mockOnChange} />);

      // Advance 400ms
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // Change value before debounce completes
      rerender(<ApiKeyValidator provider="openai" value="sk-key-2" onChange={mockOnChange} />);

      // Advance another 400ms (total 800ms from first input)
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // Should not have called fetch yet (only 400ms since last change)
      expect(fetchSpy).not.toHaveBeenCalled();

      // Advance final 100ms
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Now should be called
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Validation States', () => {
    it('should show validating state during validation', async () => {
      fetchSpy.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        const loader = document.querySelector('.animate-spin');
        expect(loader).toBeInTheDocument();
      });
    });

    it('should show valid state when validation succeeds', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText(/validated successfully/i)).toBeInTheDocument();
      });
    });

    it('should show invalid state when validation fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: false, error: 'Invalid API key' }),
      });

      render(<ApiKeyValidator provider="openai" value="sk-bad-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText(/Invalid API key/i)).toBeInTheDocument();
      });
    });

    it('should show error when API call fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Server error',
      });

      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText(/Server error/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to validate API key/i)).toBeInTheDocument();
      });
    });
  });

  describe('Validation API Calls', () => {
    it('should call correct API endpoint with provider and key', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true }),
      });

      render(<ApiKeyValidator provider="google" value="AIza-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/settings/validate-api-key',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'google',
              api_key: 'AIza-test-key',
            }),
          })
        );
      });
    });

    it('should not validate empty values', async () => {
      render(<ApiKeyValidator provider="openai" value="" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should not re-validate if value hasnt changed', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true }),
      });

      const { rerender } = render(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      // Rerender with same value
      rerender(<ApiKeyValidator provider="openai" value="sk-test-key" onChange={mockOnChange} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should not call fetch again
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should not validate when disabled', async () => {
      render(<ApiKeyValidator provider="anthropic" value="sk-ant-key" onChange={mockOnChange} disabled={true} />);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should use custom placeholder when provided', () => {
      render(<ApiKeyValidator provider="zai" value="" onChange={mockOnChange} placeholder="Enter Zai API key" />);

      const input = screen.getByPlaceholderText(/Enter Zai API key/i);
      expect(input).toBeInTheDocument();
    });
  });
});

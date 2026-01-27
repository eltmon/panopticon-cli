import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelSelector, AvailableModels } from '../ModelSelector';

describe('ModelSelector', () => {
  const mockOnChange = vi.fn();

  const mockAvailableModels: AvailableModels = {
    anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    openai: ['gpt-5.2-codex', 'gpt-4o'],
    google: ['gemini-3-pro-preview'],
    zai: ['glm-4-plus'],
  };

  const emptyAvailableModels: AvailableModels = {
    anthropic: [],
    openai: [],
    google: [],
    zai: [],
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Rendering', () => {
    it('should render select element with provided value', () => {
      render(
        <ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('claude-sonnet-4-5');
    });

    it('should group models by provider', () => {
      render(
        <ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const select = screen.getByRole('combobox');
      const optgroups = select.querySelectorAll('optgroup');

      expect(optgroups.length).toBeGreaterThan(0);
    });

    it('should display cost tier labels for each model', () => {
      render(
        <ModelSelector value="claude-opus-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const select = screen.getByRole('combobox');
      const opusOption = Array.from(select.querySelectorAll('option')).find(
        (opt) => opt.value === 'claude-opus-4-5'
      );

      expect(opusOption?.textContent).toContain('$');
    });

    it('should show message when no models available', () => {
      render(
        <ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={emptyAvailableModels} />
      );

      expect(screen.getByText(/No models available/i)).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onChange when selection changes', () => {
      render(
        <ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'gpt-4o' } });

      expect(mockOnChange).toHaveBeenCalledWith('gpt-4o');
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cost Tier Display', () => {
    it('should show current model cost information', () => {
      render(
        <ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      // Should display cost indicator
      expect(screen.getByText(/Cost:/i)).toBeInTheDocument();
    });

    it('should update cost display when model changes', () => {
      const { rerender } = render(
        <ModelSelector value="claude-haiku-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const haikuCost = screen.getByText(/Cost:/i).parentElement?.textContent;

      rerender(
        <ModelSelector value="claude-opus-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const opusCost = screen.getByText(/Cost:/i).parentElement?.textContent;

      expect(haikuCost).not.toBe(opusCost);
    });
  });

  describe('Provider Filtering', () => {
    it('should only show models from providers with available models', () => {
      const partialModels: AvailableModels = {
        anthropic: ['claude-sonnet-4-5'],
        openai: [],
        google: [],
        zai: [],
      };

      render(<ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={partialModels} />);

      const select = screen.getByRole('combobox');
      const optgroups = select.querySelectorAll('optgroup');

      // Should only have anthropic optgroup
      expect(optgroups).toHaveLength(1);
    });

    it('should include all models from all enabled providers', () => {
      render(
        <ModelSelector value="claude-sonnet-4-5" onChange={mockOnChange} availableModels={mockAvailableModels} />
      );

      const select = screen.getByRole('combobox');
      const options = select.querySelectorAll('option');

      // Should have options for all models
      const totalModels = Object.values(mockAvailableModels).reduce((sum, models) => sum + models.length, 0);
      expect(options.length).toBe(totalModels);
    });
  });
});

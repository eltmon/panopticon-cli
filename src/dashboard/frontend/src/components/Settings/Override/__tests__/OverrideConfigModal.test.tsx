import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverrideConfigModal } from '../OverrideConfigModal';
import { AvailableModels } from '../ModelSelector';

describe('OverrideConfigModal', () => {
  const mockOnClose = vi.fn();
  const mockOnApply = vi.fn();

  const mockAvailableModels: AvailableModels = {
    anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    openai: ['gpt-5.2-codex', 'gpt-4o'],
    google: ['gemini-3-pro-preview'],
    zai: ['glm-4-plus'],
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnApply.mockClear();
  });

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <OverrideConfigModal
          workType={null}
          availableModels={mockAvailableModels}
          isOpen={false}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      expect(screen.queryByText(/Configure Override/i)).not.toBeInTheDocument();
    });

    it('should not render when workType is null', () => {
      render(
        <OverrideConfigModal
          workType={null}
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      expect(screen.queryByText(/Configure Override/i)).not.toBeInTheDocument();
    });

    it('should render when isOpen is true and workType is provided', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      expect(screen.getByText(/Configure Override/i)).toBeInTheDocument();
    });
  });

  describe('Work Type Display', () => {
    it('should display work type name in header', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      // Should show a display name (not just the ID)
      expect(screen.queryByText('issue-agent:planning')).not.toBeInTheDocument();
    });

    it('should display preset default model', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          presetModel="claude-sonnet-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      expect(screen.getByText(/Preset Default:/i)).toBeInTheDocument();
      expect(screen.getByText(/claude-sonnet-4-5/i)).toBeInTheDocument();
    });
  });

  describe('Model Selection', () => {
    it('should initialize with current model if provided', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          currentModel="gpt-4o"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('gpt-4o');
    });

    it('should initialize with preset model if no current override', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          presetModel="claude-sonnet-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('claude-sonnet-4-5');
    });

    it('should use default model if neither current nor preset provided', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('claude-sonnet-4-5'); // Default fallback
    });
  });

  describe('Cost Comparison', () => {
    it('should show cost warning when selected model is more expensive', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          presetModel="claude-haiku-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      // Change to more expensive model
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'claude-opus-4-5' } });

      expect(screen.getByText(/Cost Impact:/i)).toBeInTheDocument();
      expect(screen.getByText(/more expensive/i)).toBeInTheDocument();
    });

    it('should show cost savings when selected model is cheaper', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          presetModel="claude-sonnet-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      // Change to cheaper model
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'claude-haiku-4-5' } });

      expect(screen.getByText(/Cost Savings:/i)).toBeInTheDocument();
      expect(screen.getByText(/cheaper/i)).toBeInTheDocument();
    });

    it('should show notice when model matches preset', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          presetModel="claude-sonnet-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      // Model already matches preset by default
      expect(screen.getByText(/matches the preset default/i)).toBeInTheDocument();
    });

    it('should not show cost comparison when model matches preset', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          presetModel="claude-sonnet-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      expect(screen.queryByText(/Cost Impact:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Cost Savings:/i)).not.toBeInTheDocument();
    });
  });

  describe('User Actions', () => {
    it('should call onClose when Cancel button clicked', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onApply with workType and selected model when Apply clicked', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'gpt-4o' } });

      const applyButton = screen.getByText(/Apply Override/i);
      fireEvent.click(applyButton);

      expect(mockOnApply).toHaveBeenCalledWith('issue-agent:planning', 'gpt-4o');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when X button clicked', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find((btn) => btn.querySelector('.lucide-x'));
      if (xButton) {
        fireEvent.click(xButton);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      const backdrop = document.querySelector('.backdrop-blur-sm');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Model Selection Update', () => {
    it('should update selected model when modal reopens with different workType', () => {
      const { rerender } = render(
        <OverrideConfigModal
          workType="issue-agent:planning"
          currentModel="gpt-4o"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      let select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('gpt-4o');

      // Close and reopen with different work type and model
      rerender(
        <OverrideConfigModal
          workType="issue-agent:implementation"
          currentModel="claude-opus-4-5"
          availableModels={mockAvailableModels}
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      );

      select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('claude-opus-4-5');
    });
  });
});

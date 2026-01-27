import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PresetPreviewModal } from '../PresetPreviewModal';

describe('PresetPreviewModal', () => {
  const mockOnClose = vi.fn();
  const mockOnApply = vi.fn();
  let fetchSpy: any;

  const mockPresetData = {
    preset: 'balanced' as const,
    displayName: 'Balanced',
    description: 'Balanced performance and cost',
    costLevel: 3,
    models: {
      'issue-agent:planning': {
        model: 'claude-sonnet-4-5',
        provider: 'anthropic' as const,
        costTier: 4 as const,
      },
      'issue-agent:implementation': {
        model: 'claude-sonnet-4-5',
        provider: 'anthropic' as const,
        costTier: 4 as const,
      },
    },
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnApply.mockClear();

    fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => mockPresetData,
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={false}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      expect(screen.queryByText(/Preset Preview/i)).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Preset Preview/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should show loading state while fetching preset data', async () => {
      fetchSpy.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        const loader = document.querySelector('.animate-spin');
        expect(loader).toBeInTheDocument();
      });
    });

    it('should fetch preset data from API on open', async () => {
      render(
        <PresetPreviewModal
          preset="premium"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/settings/presets/premium');
      });
    });

    it('should display error message when fetch fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
      });

      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument();
      });
    });
  });

  describe('Preset Information Display', () => {
    it('should display preset name and description', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Balanced Preset Preview/i)).toBeInTheDocument();
        expect(screen.getByText(/Balanced performance and cost/i)).toBeInTheDocument();
      });
    });

    it('should display cost level indicator', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Cost Level:/i)).toBeInTheDocument();
        expect(screen.getByText(/\(3\/5\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('Override Warnings', () => {
    it('should show warning when overrides exist', async () => {
      const overrides = {
        'issue-agent:planning': 'claude-opus-4-5' as any,
      };

      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={overrides}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Note:/i)).toBeInTheDocument();
        expect(screen.getByText(/1 existing override/i)).toBeInTheDocument();
      });
    });

    it('should not show warning when no overrides exist', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Note:/i)).not.toBeInTheDocument();
      });
    });

    it('should highlight overridden work types', async () => {
      const overrides = {
        'issue-agent:planning': 'claude-opus-4-5' as any,
      };

      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={overrides}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Will override/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Actions', () => {
    it('should call onClose when Cancel button clicked', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/Cancel/i);
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when X button clicked', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '' })).toBeInTheDocument();
      });

      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find((btn) => btn.querySelector('.lucide-x'));
      if (xButton) {
        fireEvent.click(xButton);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onApply and onClose when Apply button clicked', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Apply Preset/i)).toBeInTheDocument();
      });

      const applyButton = screen.getByText(/Apply Preset/i);
      fireEvent.click(applyButton);

      expect(mockOnApply).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should disable Apply button while loading', async () => {
      fetchSpy.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        const applyButton = screen.getByText(/Apply Preset/i);
        expect(applyButton).toBeDisabled();
      });
    });

    it('should disable Apply button when error occurs', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
      });

      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        const applyButton = screen.getByText(/Apply Preset/i);
        expect(applyButton).toBeDisabled();
      });
    });
  });

  describe('Backdrop Click', () => {
    it('should call onClose when backdrop is clicked', async () => {
      render(
        <PresetPreviewModal
          preset="balanced"
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
          currentOverrides={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Preset Preview/i)).toBeInTheDocument();
      });

      const backdrop = document.querySelector('.backdrop-blur-sm');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });
});

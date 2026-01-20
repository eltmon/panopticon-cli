import { useState, useEffect } from 'react';
import { X, MessageCircle, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Option structure from AskUserQuestion tool
 */
export interface QuestionOption {
  label: string;
  description: string;
}

/**
 * Single question from AskUserQuestion tool
 */
export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

/**
 * Pending question from JSONL
 */
export interface PendingQuestion {
  toolId: string;
  timestamp: string;
  questions: Question[];
}

interface QuestionDialogProps {
  questions: PendingQuestion[];
  agentId: string;
  onSubmit: (answers: string[]) => void;
  onDismiss: () => void;
  isSubmitting?: boolean;
  error?: string;
}

export function QuestionDialog({
  questions,
  agentId,
  onSubmit,
  onDismiss,
  isSubmitting = false,
  error,
}: QuestionDialogProps) {
  // Track selections for each question - keyed by question index
  const [selections, setSelections] = useState<Record<number, string[]>>({});

  // Get the first pending question (usually there's only one at a time)
  const pendingQuestion = questions[0];
  const questionItems = pendingQuestion?.questions || [];

  // Reset selections when questions change
  useEffect(() => {
    setSelections({});
  }, [pendingQuestion?.toolId]);

  const handleOptionSelect = (questionIndex: number, optionLabel: string, isMultiSelect: boolean) => {
    setSelections((prev) => {
      const current = prev[questionIndex] || [];

      if (isMultiSelect) {
        // Toggle the option
        if (current.includes(optionLabel)) {
          return { ...prev, [questionIndex]: current.filter((l) => l !== optionLabel) };
        } else {
          return { ...prev, [questionIndex]: [...current, optionLabel] };
        }
      } else {
        // Single select - replace
        return { ...prev, [questionIndex]: [optionLabel] };
      }
    });
  };

  const handleSubmit = () => {
    // Collect all selected answers
    const allAnswers: string[] = [];
    questionItems.forEach((_, idx) => {
      const selected = selections[idx] || [];
      allAnswers.push(...selected);
    });

    if (allAnswers.length > 0) {
      onSubmit(allAnswers);
    }
  };

  // Check if we have at least one selection
  const hasSelection = Object.values(selections).some((arr) => arr.length > 0);

  if (!pendingQuestion || questionItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} />

      {/* Dialog */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Agent Needs Your Input</h2>
              <p className="text-sm text-gray-400 font-mono">{agentId}</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Dismiss (answer later)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {questionItems.map((q, qIndex) => (
            <div key={qIndex} className="mb-6 last:mb-0">
              {/* Question header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded">
                  {q.header}
                </span>
                {q.multiSelect && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                    Select multiple
                  </span>
                )}
              </div>

              {/* Question text */}
              <p className="text-white font-medium mb-3">{q.question}</p>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((opt, optIndex) => {
                  const isSelected = (selections[qIndex] || []).includes(opt.label);

                  return (
                    <button
                      key={optIndex}
                      onClick={() => handleOptionSelect(qIndex, opt.label, q.multiSelect)}
                      disabled={isSubmitting}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/20 text-white'
                          : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection indicator */}
                        <div className={`mt-0.5 w-5 h-5 rounded-${q.multiSelect ? 'md' : 'full'} border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-500'
                        }`}>
                          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>

                        <div className="flex-1">
                          <div className="font-medium">{opt.label}</div>
                          {opt.description && (
                            <p className="text-sm text-gray-400 mt-1">{opt.description}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* "Other" hint */}
          <div className="flex items-start gap-2 mt-4 p-3 bg-gray-700/30 rounded-lg">
            <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500">
              To provide a custom answer not listed above, dismiss this dialog and type your response in the message box below.
            </p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="px-6 py-3 bg-red-900/30 border-t border-red-800">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onDismiss}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasSelection || isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

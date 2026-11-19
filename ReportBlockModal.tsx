import React, { useState } from 'react';
import { Ban, Flag, X } from 'lucide-react';
import type { ReportReason } from '../types';

interface ReportBlockModalProps {
  isOpen: boolean;
  hasTargetPartner: boolean;
  blockedCount: number;
  onClose: () => void;
  onSubmitReport: (reason: ReportReason, details: string) => void;
  onBlockOnly: () => void;
  onClearBlocklist: () => void;
}

const REPORT_REASONS: Array<{ id: ReportReason; label: string; description: string }> = [
  {
    id: 'underage',
    label: 'Underage user (<18)',
    description: 'User appears to be under 18 years old.',
  },
  {
    id: 'inappropriate-nudity',
    label: 'Inappropriate content or nudity',
    description: 'Explicit exposure, sexual conduct, or graphic content.',
  },
  {
    id: 'harassment',
    label: 'Harassment or abusive conduct',
    description: 'Threats, hate speech, or non-consensual intimidation.',
  },
  {
    id: 'spam-scam',
    label: 'Spam, bot, or scam',
    description: 'Solicitation, phishing links, or commercial spam.',
  },
  {
    id: 'other',
    label: 'Other safety issue',
    description: 'Any other violation of community guidelines.',
  },
];

export const ReportBlockModal: React.FC<ReportBlockModalProps> = ({
  isOpen,
  hasTargetPartner,
  blockedCount,
  onClose,
  onSubmitReport,
  onBlockOnly,
  onClearBlocklist,
}) => {
  const [reason, setReason] = useState<ReportReason>('inappropriate-nudity');
  const [details, setDetails] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTargetPartner) return;
    onSubmitReport(reason, details);
    setDetails('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Safety Report and Block"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#141821] border border-white/12 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto pb-safe">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Flag className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-semibold text-white">
              Report &amp; Safety Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close safety dialog"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#CBD5E1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasTargetPartner ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              Reporting ends this conversation immediately and permanently blocks this partner from matching with you again.
            </p>

            <div className="space-y-2">
              {REPORT_REASONS.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    reason === item.id
                      ? 'bg-amber-500/10 border-amber-400/40'
                      : 'bg-[#1B212D]/60 border-white/8 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={item.id}
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                    className="mt-1 accent-amber-400 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-[#94A3B8]">{item.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label htmlFor="report-details" className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                Additional context (optional)
              </label>
              <textarea
                id="report-details"
                rows={2}
                maxLength={500}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full rounded-xl bg-[#0B0D11] border border-white/15 p-3 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="submit"
                className="flex-1 min-h-[48px] rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>Submit Report &amp; Block</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onBlockOnly();
                  onClose();
                }}
                className="min-h-[48px] px-4 rounded-xl bg-[#1B212D] hover:bg-[#232B3A] border border-white/12 text-[#E2E8F0] font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4 text-red-400" />
                <span>Block Only</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4 text-sm text-[#94A3B8]">
            <p>
              No active or recent partner is selected to report. During or right after any call, tap <strong className="text-white">Report</strong> or <strong className="text-white">Block</strong> to act immediately.
            </p>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="tabular-nums">
            Blocked sessions: <strong className="text-white">{blockedCount}</strong>
          </span>
          {blockedCount > 0 && (
            <button
              type="button"
              onClick={onClearBlocklist}
              className="min-h-[36px] px-2.5 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-white/5 underline cursor-pointer"
            >
              Reset Blocklist
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

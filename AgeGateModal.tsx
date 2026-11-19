import React, { useState } from 'react';
import { ShieldCheck, MapPin, Video, AlertCircle } from 'lucide-react';
import type { RegionCheckResponse, VerificationConsent } from '../types';

interface AgeGateModalProps {
  regionCheck: RegionCheckResponse | null;
  onConfirm: (consent: VerificationConsent) => void;
}

const CURRENT_YEAR = 2026;

export const AgeGateModal: React.FC<AgeGateModalProps> = ({ regionCheck, onConfirm }) => {
  const [birthYearInput, setBirthYearInput] = useState<string>('');
  const [confirmed18Plus, setConfirmed18Plus] = useState<boolean>(false);
  const [confirmedIndiaOnly, setConfirmedIndiaOnly] = useState<boolean>(false);
  const [acceptedGuidelines, setAcceptedGuidelines] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const regionBlocked = regionCheck !== null && !regionCheck.allowed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regionBlocked) {
      setError(regionCheck?.message || 'Access is restricted to users in India.');
      return;
    }

    const parsedYear = Number(birthYearInput.trim());
    if (!birthYearInput.trim() || Number.isNaN(parsedYear) || parsedYear < 1920 || parsedYear > CURRENT_YEAR) {
      setError('Please enter a valid 4-digit birth year.');
      return;
    }

    if (CURRENT_YEAR - parsedYear < 18) {
      setError('You must be at least 18 years old to enter Delulu.');
      return;
    }

    if (!confirmed18Plus || !confirmedIndiaOnly || !acceptedGuidelines) {
      setError('Please confirm all three eligibility and safety requirements to continue.');
      return;
    }

    onConfirm({
      confirmed18Plus: true,
      confirmedIndiaOnly: true,
      acceptedGuidelines: true,
      birthYear: parsedYear,
      verifiedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0D11] text-[#F4F6F9] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-3xl bg-[#141821] border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Delulu
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#94A3B8]">
              India-only 18+ random video &amp; text chat · All genders matched randomly
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center shrink-0 text-[#34D399]">
            <Video className="w-5 h-5" />
          </div>
        </div>

        {regionBlocked ? (
          <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/25 p-5 text-sm text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Region Restricted to India</p>
                <p className="mt-1 text-red-200/90 leading-relaxed">
                  {regionCheck?.message}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#CBD5E1]">
              <div className="rounded-2xl bg-[#1B212D] border border-white/8 p-3.5 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">India-Only Pool</p>
                  <p className="mt-0.5 text-[#94A3B8]">
                    Detected region: {regionCheck?.countryCode || 'IN'}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-[#1B212D] border border-white/8 p-3.5 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">18+ Adults Only</p>
                  <p className="mt-0.5 text-[#94A3B8]">
                    Random matching across all genders
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="birth-year"
                className="block text-sm font-medium text-[#E2E8F0] mb-1.5"
              >
                Birth Year (18+ Verification)
              </label>
              <input
                id="birth-year"
                type="number"
                inputMode="numeric"
                min={1920}
                max={CURRENT_YEAR}
                placeholder="e.g. 1998"
                value={birthYearInput}
                onChange={(e) => setBirthYearInput(e.target.value)}
                className="w-full min-h-[48px] rounded-xl bg-[#0B0D11] border border-white/15 px-4 text-base text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#10B981] tabular-nums"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 min-h-[44px] cursor-pointer select-none rounded-xl bg-[#1B212D]/60 border border-white/8 p-3 hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmed18Plus}
                  onChange={(e) => setConfirmed18Plus(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-white/30 bg-[#0B0D11] accent-[#10B981] shrink-0"
                />
                <span className="text-sm text-[#E2E8F0] leading-snug">
                  I confirm that I am <strong className="text-white">18 years of age or older</strong>.
                </span>
              </label>

              <label className="flex items-start gap-3 min-h-[44px] cursor-pointer select-none rounded-xl bg-[#1B212D]/60 border border-white/8 p-3 hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmedIndiaOnly}
                  onChange={(e) => setConfirmedIndiaOnly(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-white/30 bg-[#0B0D11] accent-[#10B981] shrink-0"
                />
                <span className="text-sm text-[#E2E8F0] leading-snug">
                  I confirm I am currently located in <strong className="text-white">India</strong> and consent to random 1-on-1 matching regardless of gender.
                </span>
              </label>

              <label className="flex items-start gap-3 min-h-[44px] cursor-pointer select-none rounded-xl bg-[#1B212D]/60 border border-white/8 p-3 hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={acceptedGuidelines}
                  onChange={(e) => setAcceptedGuidelines(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-white/30 bg-[#0B0D11] accent-[#10B981] shrink-0"
                />
                <span className="text-sm text-[#E2E8F0] leading-snug">
                  I agree to respectful conduct (zero tolerance for nudity, harassment, or underage users). Report &amp; Block tools are active in every call.
                </span>
              </label>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200 flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[52px] rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-[0.99] text-[#052E16] font-semibold text-base transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10B981]"
            >
              Enter Delulu
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

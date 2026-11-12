"use client";

import type { FinanceAccount } from "../../../../domain/finance/account";
import { Eye, EyeOff } from "lucide-react";
import type { UIEvent } from "react";

export type MobileDashboardCreditCardSlide = {
  id: string;
  account: FinanceAccount | null;
  label: string;
  detail: string;
  value: number;
};

type MobileDashboardCreditCardsProps = {
  slides: MobileDashboardCreditCardSlide[];
  carouselSlides: MobileDashboardCreditCardSlide[];
  activeSlideIndex: number;
  carouselRef: React.RefObject<HTMLDivElement | null>;
  showValues: boolean;
  renderValue: (value: number) => string;
  onToggleValues: () => void;
  onSelectAccount: (account: FinanceAccount) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
};

export default function MobileDashboardCreditCards({
  slides,
  carouselSlides,
  activeSlideIndex,
  carouselRef,
  showValues,
  renderValue,
  onToggleValues,
  onSelectAccount,
  onScroll,
}: MobileDashboardCreditCardsProps) {
  if (slides.length === 0) return null;

  return (
    <div>
      <div
        ref={carouselRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={onScroll}
      >
        {carouselSlides.map((slide) => (
          <div
            key={slide.id}
            className="min-w-full snap-center bg-purple-600 px-4 pb-2.5 pt-3.5 rounded-2xl"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p
                  className="truncate text-sm opacity-90"
                  onClick={() => {
                    if (slide.account) onSelectAccount(slide.account);
                  }}
                >
                  {slide.label}
                </p>
                {slide.detail && (
                  <p className="mt-1 truncate text-[11px] font-medium text-purple-100/70">
                    {slide.detail}
                  </p>
                )}
              </div>
              <button
                onClick={onToggleValues}
                type="button"
                aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
              >
                {showValues ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <h1 className="text-3xl font-bold leading-tight mt-0.5">
              {renderValue(slide.value)}
            </h1>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {slides.map((slide, index) => (
            <span
              key={slide.id}
              className={`h-1.5 rounded-full transition-all ${
                activeSlideIndex === index ? "w-5 bg-purple-300" : "w-1.5 bg-zinc-700"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Truck, MapPin, Navigation, RefreshCw, ChevronLeft, ChevronRight, X, Clock, Route } from 'lucide-react';
import { useAppDispatch } from '../store/hooks';
import { setHasSeenTrackingTour } from '../store/slices/uiSlice';

interface Props {
  onClose: () => void;
}

// ─── Slide Illustrations ──────────────────────────────────────────────────────

function Slide1Illustration() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <Truck className="w-12 h-12 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="absolute -top-1 -right-1 flex h-5 w-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500"></span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        Live tracking active
      </div>
    </div>
  );
}

function Slide2Illustration() {
  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Mock order card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Order #10245</span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">Delivery</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">14 Ribblesdale Pl, Preston</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-slate-600 dark:text-slate-300">DM: John D</span>
        </div>
        <div className="flex gap-2">
          {/* Track button highlighted */}
          <div className="relative flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-lg shadow-blue-500/30">
              <Navigation className="w-3.5 h-3.5" />
              Track
            </button>
            {/* Pointer arrow */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">Tap here</span>
              <svg width="10" height="8" viewBox="0 0 10 8" className="text-blue-500 fill-current">
                <path d="M5 8L0 0h10z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slide3Illustration() {
  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Mock map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-slate-100 dark:bg-slate-700" style={{ height: 160 }}>
        {/* Map background grid */}
        <svg className="absolute inset-0 w-full h-full opacity-20 dark:opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#94a3b8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Road lines */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="80" x2="300" y2="80" stroke="#e2e8f0" strokeWidth="8" />
          <line x1="150" y1="0" x2="150" y2="160" stroke="#e2e8f0" strokeWidth="6" />
          <line x1="0" y1="120" x2="300" y2="120" stroke="#e2e8f0" strokeWidth="5" />
        </svg>

        {/* Route polyline */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <polyline
            points="50,80 150,80 150,120 250,120"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0"
          />
        </svg>

        {/* DM pin */}
        <div className="absolute flex flex-col items-center" style={{ left: 38, top: 60 }}>
          <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded mt-1 shadow whitespace-nowrap">Driver</span>
        </div>

        {/* Customer pin */}
        <div className="absolute flex flex-col items-center" style={{ left: 236, top: 100 }}>
          <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded mt-1 shadow whitespace-nowrap">Customer</span>
        </div>

        {/* ETA badge */}
        <div className="absolute top-2 right-2 bg-white dark:bg-slate-800 rounded-lg shadow px-2 py-1 flex items-center gap-1.5 border border-slate-200 dark:border-slate-600">
          <Clock className="w-3 h-3 text-blue-600" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">~8 min</span>
        </div>
      </div>
    </div>
  );
}

function Slide4Illustration() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Auto-refresh<br/>every 30s</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Route className="w-7 h-7 text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Live<br/>routing</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Clock className="w-7 h-7 text-orange-600 dark:text-orange-400" />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center">Real-time<br/>ETA</span>
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-[220px]">
        Powered by our self-hosted routing server — works even without internet
      </p>
    </div>
  );
}

// ─── Slide Data ───────────────────────────────────────────────────────────────

const slides = [
  {
    illustration: <Slide1Illustration />,
    badge: 'New Feature',
    title: 'Live Delivery Tracking',
    description: 'Monitor your delivery drivers in real-time, directly from the Dispatch page. See exactly where they are and when they\'ll arrive.',
  },
  {
    illustration: <Slide2Illustration />,
    badge: 'Step 1',
    title: 'Find the Track Button',
    description: 'Go to the Dispatch page and find any delivery order with an assigned driver. Tap the Track button on the order card.',
  },
  {
    illustration: <Slide3Illustration />,
    badge: 'Step 2',
    title: 'View the Live Map',
    description: 'See your driver\'s current location, the route to the customer, estimated arrival time, and remaining distance — all on one map.',
  },
  {
    illustration: <Slide4Illustration />,
    badge: 'Step 3',
    title: 'Always Up to Date',
    description: 'The map refreshes automatically every 30 seconds. ETA and distance update as the driver moves closer to the customer.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrackingFeatureTour({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState(0);
  const isLast = current === slides.length - 1;

  const dismiss = () => {
    dispatch(setHasSeenTrackingTour(true));
    onClose();
  };

  const next = () => {
    if (isLast) {
      dismiss();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const prev = () => setCurrent((c) => Math.max(0, c - 1));

  const slide = slides[current];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>

        {/* Slide indicator strip */}
        <div className="flex h-1">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-colors duration-300 ${
                i <= current ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Illustration area */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-8 flex items-center justify-center min-h-[200px]">
          {slide.illustration}
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-6">
          <span className="inline-block text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            {slide.badge}
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {slide.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {slide.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            {/* Dot indicators */}
            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all duration-200 ${
                    i === current
                      ? 'w-5 h-2 bg-blue-600'
                      : 'w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {current > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {isLast ? 'Get Started' : 'Next'}
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

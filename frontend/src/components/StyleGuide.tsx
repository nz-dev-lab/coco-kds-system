import { useEffect, useState } from "react";

function StyleGuide() {
  const [isLightMode, setIsLightMode] = useState(false);

  // Sync theme with body class
  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add("light");
    } else {
      document.body.classList.remove("light");
    }
  }, [isLightMode]);

  return (
    <div className="p-8 space-y-8 min-h-screen transition-colors duration-300">
      {/* Theme Toggle */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-kds-text-primary">KDS Style Guide</h1>
        <button
          onClick={() => setIsLightMode(!isLightMode)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kds-surface border border-kds-border text-kds-text-primary hover:bg-kds-border transition-all duration-200"
        >
          <span className="text-sm font-semibold">
            {isLightMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </span>
        </button>
      </div>

      {/* Typography */}
      <section>
        <h2 className="section-title">Typography</h2>
        <div className="space-y-4">
          <div className="order-id">Order #12345</div>
          <div className="timer timer-normal">12:34</div>
          <div className="item-name">Margherita Pizza</div>
          <div className="item-detail">Extra cheese, no olives</div>
          <div className="quantity">3x</div>
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="section-title">Status Badges</h2>
        <div className="flex gap-2 flex-wrap">
          <span className="badge-pending">Pending</span>
          <span className="badge-confirmed">Confirmed</span>
          <span className="badge-cooking">Cooking</span>
          <span className="badge-ready">Ready</span>
          <span className="badge-delivered">Delivered</span>
        </div>
      </section>

      {/* Buttons */}
      <section>
        <h2 className="section-title">Buttons</h2>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary">Primary</button>
          <button className="btn-success">Success</button>
          <button className="btn-warning">Warning</button>
          <button className="btn-danger">Danger</button>
          <button className="btn-secondary">Secondary</button>
        </div>
      </section>

      {/* Order Card */}
      <section>
        <h2 className="section-title">Order Card</h2>
        <div className="order-card max-w-md age-normal">
          <div className="flex justify-between items-start mb-3">
            <span className="order-id">#12345</span>
            <span className="badge-cooking">Cooking</span>
          </div>

          <div className="timer timer-normal mb-3">08:45</div>

          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <span className="quantity">2x</span>
              <div>
                <div className="item-name">Margherita Pizza</div>
                <div className="item-detail">Large, Extra cheese</div>
              </div>
            </div>
          </div>

          <button className="btn-success btn-block">Mark as Ready</button>
        </div>
      </section>
    </div>
  );
}

export default StyleGuide;

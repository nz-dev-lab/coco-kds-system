// src/pages/Help.tsx
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CookingPot,
  HelpCircle,
  Info,
  Printer,
  RectangleEllipsis,
  RefreshCw,
  ScanSearch,
  ShoppingBag,
  Store,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import CocoEatsIcon from '../components/icons/CocoEatsIcon';

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-6">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-kds-text-primary mb-4 pb-3 border-b border-slate-100 dark:border-kds-border">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ComingSoon() {
  return (
    <div className="flex items-center gap-2 py-4 text-slate-400 dark:text-kds-text-muted text-sm italic">
      <HelpCircle className="w-4 h-4" />
      Content coming soon…
    </div>
  );
}

function IconRow({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-50 dark:border-kds-border last:border-0">
      <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-kds-surface flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">{label}</p>
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function StatusBadge({ color, label, description }: { color: string; label: string; description: string }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 dark:border-kds-border last:border-0">
      <span className={`px-3 py-1 rounded text-white text-xs font-bold flex-shrink-0 ${color}`}>
        {label}
      </span>
      <p className="text-sm text-slate-500 dark:text-kds-text-secondary">{description}</p>
    </div>
  );
}

function SourceBadge({
  icon,
  bg,
  label,
  description,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-50 dark:border-kds-border last:border-0">
      <span className={`p-2 rounded-lg flex-shrink-0 ${bg}`}>{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">{label}</p>
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Help() {
  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-kds-text-primary">Help &amp; Guide</h1>
        <p className="text-slate-500 dark:text-kds-text-secondary mt-1">
          Learn how to use Coco KDS — icons, statuses, and features explained.
        </p>
      </div>

      {/* ── ORDER CARD ICONS ─────────────────────────────────────────────────── */}
      <Section title="Order Card — Icons &amp; Indicators">
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mb-4">
          Each order card displays a set of icons in the header and body to help you quickly identify
          order details at a glance.
        </p>

        <IconRow
          icon={<CocoEatsIcon className="w-5 h-5 text-green-600" />}
          label="CocoEats Source"
          description="Indicates this order came in through the CocoEats online platform. The icon blinks periodically as a live indicator."
        />
        <IconRow
          icon={<User className="w-5 h-5 text-slate-500" />}
          label="Customer Name"
          description="Shows the name of the customer who placed the order."
        />
        <IconRow
          icon={<ShoppingBag className="w-5 h-5 text-slate-500" />}
          label="Take Away"
          description="The order type is take away — customer will collect in person."
        />
        <IconRow
          icon={<Bike className="w-5 h-5 text-slate-500" />}
          label="Delivery"
          description="The order is a delivery order. A delivery man must be assigned before handover."
        />
        <IconRow
          icon={<CookingPot className="w-5 h-5 text-slate-500" />}
          label="Dine In"
          description="The customer is dining in at the restaurant."
        />
        <IconRow
          icon={<CalendarClock className="w-5 h-5 text-slate-500" />}
          label="Scheduled Order"
          description="This order is scheduled for a future time. It will unlock automatically when preparation should begin."
        />
        <IconRow
          icon={<Printer className="w-5 h-5 text-slate-500" />}
          label="Print Order"
          description="Print a kitchen receipt for this order."
        />
        <IconRow
          icon={<RectangleEllipsis className="w-5 h-5 text-slate-500" />}
          label="More Actions"
          description='Opens a menu with additional actions — currently includes "Bump Order" to hide the card from the main dashboard without changing its status.'
        />
      </Section>

      {/* ── TMBILL ORDER CARD ICONS ──────────────────────────────────────────── */}
      <Section title="TMBILL Order Card — Icons &amp; Indicators">
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mb-4">
          Orders from the TMBILL POS system have their own card style with POS-specific indicators.
        </p>

        <IconRow
          icon={<Store className="w-5 h-5 text-slate-500" />}
          label="POS Source"
          description="Indicates this order originated from the TMBILL Point-of-Sale terminal. The badge colour reflects the order type (Quick Bill, Table KOT, etc.)."
        />
        <IconRow
          icon={<User className="w-5 h-5 text-slate-500" />}
          label="Customer / Table"
          description="Shows the customer name or table number associated with the POS order."
        />
        <IconRow
          icon={<Zap className="w-5 h-5 text-slate-500" />}
          label="Quick Bill"
          description="Marks a Quick Bill order — a fast counter sale without a table. Status progression differs slightly from table KOTs."
        />
        <IconRow
          icon={<Check className="w-5 h-5 text-slate-500" />}
          label="Mark as Served / Ready"
          description="Advances the order to the next preparation state or marks it as served on the POS."
        />
        <IconRow
          icon={<CookingPot className="w-5 h-5 text-slate-500" />}
          label="Start Cooking"
          description="Moves the order to the Processing / Preparing state."
        />
        <IconRow
          icon={<RectangleEllipsis className="w-5 h-5 text-slate-500" />}
          label="More Actions"
          description='Opens the ellipsis menu with options: Start Cooking, Mark Ready, Mark as Served, and Bump Order.'
        />
      </Section>

      {/* ── SOURCE BADGES ────────────────────────────────────────────────────── */}
      <Section title="Order Source Badges">
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mb-4">
          Each card header shows a coloured badge indicating where the order came from.
        </p>

        <SourceBadge
          icon={<CocoEatsIcon className="w-4 h-4 text-white" />}
          bg="bg-green-600"
          label="CocoEats Online Order"
          description="Order placed through the CocoEats app or website."
        />
        <SourceBadge
          icon={<Store className="w-4 h-4 text-white" />}
          bg="bg-amber-500"
          label="TMBILL Quick Bill"
          description="Counter sale / quick bill order from the POS terminal."
        />
        <SourceBadge
          icon={<Store className="w-4 h-4 text-white" />}
          bg="bg-purple-500"
          label="TMBILL Table KOT"
          description="Kitchen Order Ticket linked to a dine-in table on the POS."
        />
        <SourceBadge
          icon={<Store className="w-4 h-4 text-white" />}
          bg="bg-gray-500"
          label="TMBILL Other POS Order"
          description="Any other order type received from the TMBILL POS system."
        />
      </Section>

      {/* ── STATUS COLOURS ───────────────────────────────────────────────────── */}
      <Section title="Order Status Colours">
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mb-4">
          The header of every order card changes colour based on the current order status.
        </p>

        <StatusBadge color="bg-[#3B82F6]" label="Pending"    description="Order received — not yet confirmed or acknowledged." />
        <StatusBadge color="bg-teal-600"   label="Confirmed"  description="CocoEats order confirmed — awaiting cooking to start. (CocoEats only)" />
        <StatusBadge color="bg-[#F97316]" label="Processing" description="Order is being prepared in the kitchen." />
        <StatusBadge color="bg-[#10B981]" label="Ready / Served" description="Order is ready for pickup, handover, or delivery." />
        <StatusBadge color="bg-purple-500" label="Out for Delivery" description="Delivery order dispatched to the customer. (CocoEats only)" />
      </Section>

      {/* ── BUMP FEATURE ─────────────────────────────────────────────────────── */}
      <Section title="Bump Order Feature">
        <div className="space-y-3 text-sm text-slate-600 dark:text-kds-text-secondary">
          <div className="flex gap-3">
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p><span className="font-semibold text-slate-800 dark:text-kds-text-primary">Bump Order</span> hides the card from the main dashboard without changing its status on the POS or backend. Use it to clear completed or deprioritised orders from your view.</p>
          </div>
          <div className="flex gap-3">
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p><span className="font-semibold text-slate-800 dark:text-kds-text-primary">Bumped Orders Panel</span> — click the <span className="font-mono bg-slate-100 dark:bg-kds-surface px-1.5 py-0.5 rounded text-xs">Bumped (N)</span> button in the dashboard header to reveal all hidden orders.</p>
          </div>
          <div className="flex gap-3">
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p><span className="font-semibold text-slate-800 dark:text-kds-text-primary">Recall to Dashboard</span> — inside the bumped panel, each card has a recall button to restore the order to the active dashboard.</p>
          </div>
          <div className="flex gap-3">
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p><span className="font-semibold text-slate-800 dark:text-kds-text-primary">Mark as Served</span> (TMBILL only) — available in the ellipsis menu. Sends the Served status to the POS without bumping the card from your view.</p>
          </div>
        </div>
      </Section>

      {/* ── PLACEHOLDER SECTIONS ─────────────────────────────────────────────── */}
      <Section title="Keyboard Shortcuts">
        <ComingSoon />
      </Section>

      <Section title="Interaction Modes">
        <ComingSoon />
      </Section>

      <Section title="Audio Notifications">
        <ComingSoon />
      </Section>

      <Section title="TMBILL POS Connection">
        <p className="text-sm text-slate-500 dark:text-kds-text-secondary mb-5">
          Coco KDS integrates with the TMBILL POS system over your local network. Orders placed on the
          POS terminal appear in real time on the dashboard alongside CocoEats orders.
        </p>

        {/* How it connects */}
        <h3 className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary uppercase tracking-wide mb-3">
          How the Connection Works
        </h3>
        <div className="space-y-2 mb-6">
          {[
            {
              icon: <RefreshCw className="w-4 h-4 text-blue-500" />,
              text: 'On startup, the KDS automatically attempts to reconnect using the last known POS IP address (fast path — takes a few seconds).',
            },
            {
              icon: <ScanSearch className="w-4 h-4 text-amber-500" />,
              text: 'If the cached IP fails, the KDS scans the entire local network subnet looking for a device running TMBILL on port 3000 (slow path — may take 10–30 seconds).',
            },
            {
              icon: <Wifi className="w-4 h-4 text-green-500" />,
              text: 'Once found, the KDS authenticates using saved credentials and opens a real-time socket connection. Orders appear instantly after this.',
            },
            {
              icon: <RefreshCw className="w-4 h-4 text-slate-400" />,
              text: 'If connection is not established, the KDS retries automatically every 30 seconds in the background.',
            },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-kds-text-secondary">
              <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
              <p>{item.text}</p>
            </div>
          ))}
        </div>

        {/* Connection status indicator */}
        <h3 className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary uppercase tracking-wide mb-3">
          Dashboard Status Indicator
        </h3>
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Wifi className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">TMBILL — Connected</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                Shown as a green pill in the top-right of the dashboard. Orders from the POS are live.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Find TMBILL POS — Disconnected</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                Shown as an amber button. Click it to trigger an immediate LAN scan. CocoEats orders continue working normally.
              </p>
            </div>
          </div>
        </div>

        {/* First time setup */}
        <h3 className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary uppercase tracking-wide mb-3">
          First-Time Setup
        </h3>
        <div className="space-y-2 mb-6">
          {[
            'Open the sidebar and navigate to TMBill Debug.',
            'Enter the TMBILL POS IP address (or leave blank to scan), username, and password.',
            'Click "Test Connection" — if successful, credentials are saved automatically.',
            'From this point on, the KDS will reconnect automatically every time the app starts.',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-kds-text-secondary">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p>{step}</p>
            </div>
          ))}
        </div>

        {/* Troubleshooting */}
        <h3 className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary uppercase tracking-wide mb-3">
          Troubleshooting
        </h3>
        <div className="space-y-3">

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-200 dark:border-kds-border">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
                "No TMBILL credentials saved"
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">
                No credentials have been entered yet. Go to <span className="font-mono bg-slate-100 dark:bg-kds-bg px-1.5 py-0.5 rounded text-xs">Sidebar → TMBill Debug</span> and enter your POS username and password, then test the connection.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-200 dark:border-kds-border">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
                "TMBILL POS not found on network"
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">
                The LAN scan completed but no TMBILL device was found. Check that:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-500 dark:text-kds-text-secondary list-none">
                {[
                  'The TMBILL POS application is running on the terminal.',
                  'Both this machine and the POS are on the same Wi-Fi / network.',
                  'No firewall is blocking port 3000 on the POS device.',
                  'If the POS IP is known, enter it manually in TMBill Debug to skip scanning.',
                ].map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-200 dark:border-kds-border">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
                "Found TMBILL POS but login failed"
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">
                The POS was found on the network but authentication was rejected. Go to <span className="font-mono bg-slate-100 dark:bg-kds-bg px-1.5 py-0.5 rounded text-xs">TMBill Debug</span> and verify the username and password match the TMBILL POS login credentials.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-200 dark:border-kds-border">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
                Connected but no POS orders appearing
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">
                The socket is connected but orders are not showing. This is normal if the POS has no active KOTs. New orders will appear in real time as they are placed on the terminal. You can also verify the live data in <span className="font-mono bg-slate-100 dark:bg-kds-bg px-1.5 py-0.5 rounded text-xs">TMBill Debug</span>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-kds-surface border border-slate-200 dark:border-kds-border">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
                CocoEats orders are not affected by TMBILL connection
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-secondary mt-0.5">
                TMBILL is an optional integration. If the POS is offline or unavailable, CocoEats online orders continue to appear and function normally on the dashboard.
              </p>
            </div>
          </div>

        </div>
      </Section>

      <Section title="Frequently Asked Questions">
        <ComingSoon />
      </Section>
    </div>
  );
}

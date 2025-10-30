import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useOrderBump } from "@/hooks/useOrderBump";
import { useCallback } from "react";
import { Order } from "@/types/order.type";
import { setFocusedOrder, addRecentlyUpdated } from "@/store/slices/uiSlice";

interface UseHeaderDoubleTapParams {
  order: Order;
  scheduledInfo: {
    isScheduled: boolean;  // ✅ Required, not optional
    canStartPreparing?: boolean;
    prepWindowOpens?: Date;
  };
  orderAge: number;
  handleConfirm: () => Promise<void>;
  handleStartCooking: () => Promise<void>;
  handleMarkReady: () => Promise<void>;
  handleBump: (order: Order, orderAge: number) => Promise<void>;
  stopAnimation: () => void;
}

/**
 * Handles double-tap on order header when processing mode is 'header'.
 * Progresses order through statuses: pending → confirmed → processing → handover → complete
 */
export function useHeaderDoubleTap({
  order,
  scheduledInfo,
  orderAge,
  handleConfirm,
  handleStartCooking,
  handleMarkReady,
  handleBump,
  stopAnimation,
}: UseHeaderDoubleTapParams) {
  const processingMode = useAppSelector((s) => s.ui.settings.interaction.processingMode);
  const dispatch = useAppDispatch();
  

  const handleHeaderDoubleTap = useCallback(async () => {
    // Only work if header mode is enabled
    if (processingMode !== "header") return;

    try {
      stopAnimation(); // Stop new order animation

      switch (order.order_status) {
        case "pending":
          await handleConfirm();
          toast.success("Order confirmed!");
          break;

        case "confirmed":
          // Check if scheduled order is locked
          if (scheduledInfo.isScheduled && scheduledInfo.canStartPreparing === false) {
            const when = scheduledInfo.prepWindowOpens
              ? scheduledInfo.prepWindowOpens.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "later";
            toast.warn(`🔒 Locked until ${when}`);  // ✅ Fixed: use toast.warn()
            return;
          }
          await handleStartCooking();
          toast.success("Cooking started!");
          break;

        case "processing":
          await handleMarkReady();
          toast.success("Order marked as ready!");
          break;

        case "handover":
          // Only complete non-delivery orders via header tap
          if (order.order_type !== "delivery") {
            await handleBump(order, orderAge);
            toast.success("Order completed!");
          } else {
            toast.info("Delivery orders complete via delivery man app");
          }
          break;

        default:
          // No action for picked_up, delivered, canceled, etc.
          break;
      }
    } catch (err) {
      console.error("Header double-tap failed:", err);
      toast.error("Failed to progress order. Please try again.");
    }
  }, [
    processingMode,
    order,              // ✅ Added
    orderAge,           // ✅ Added
    scheduledInfo,
    handleConfirm,
    handleStartCooking,
    handleMarkReady,
    handleBump,
    stopAnimation,
  ]);

  return {
    handleHeaderDoubleTap,
    isEnabled: processingMode === "header",
  };
}
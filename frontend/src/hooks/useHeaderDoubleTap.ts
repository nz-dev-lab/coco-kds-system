import {toast} from "react-toastify"
import { useAppSelector } from "@/store/hooks";
import { useOrderBump } from "@/hooks/useOrderBump";
import { useCallback } from "react";
import { Order } from "@/types/order.type";

interface UseHeaderDoubleTapParams {
  order: Order;
  scheduledInfo: {
    isScheduled?: boolean;
    canStartPreparing?: boolean;
    prepWindowOpens?: Date;
  };
  orderAge: number;
  handleConfirm: () => Promise<void>;
  handleStartCooking: () => Promise<void>;
  handleMarkReady: () => Promise<void>;
  stopAnimation: () => void;
}

/**
 * Handles double-tap on order header when processing mode is 'header'.
 */
export function useHeaderDoubleTap({
  order,
  scheduledInfo,
  orderAge,
  handleConfirm,
  handleStartCooking,
  handleMarkReady,
  stopAnimation,
}: UseHeaderDoubleTapParams) {
  const processingMode = useAppSelector((s) => s.ui.settings.interaction.processingMode);
  const { handleBump } = useOrderBump();

  const handleHeaderDoubleTap = useCallback(async () => {
    if (processingMode !== "header") return;

    try {
      stopAnimation();

      switch (order.order_status) {
        case "pending":
          await handleConfirm();
          break;

        case "confirmed":
          if (scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing) {
            const when = scheduledInfo.prepWindowOpens
              ? scheduledInfo.prepWindowOpens.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : "later";
            toast(`Locked until ${when}`);
            return;
          }
          await handleStartCooking();
          break;

        case "processing":
          await handleMarkReady();
          break;

        case "handover":
          if (order.order_type !== "delivery") {
            await handleBump(order, orderAge);
          }
          break;

        default:
          // No action for other statuses
          break;
      }
    } catch (err) {
      console.error("Header double-tap failed:", err);
      toast.error("Failed to progress order. Please try again.");
    }
  }, [
    processingMode,
    order.order_status,
    order.order_type,
    handleConfirm,
    handleStartCooking,
    handleMarkReady,
    handleBump,
    stopAnimation,
    scheduledInfo,
  ]);

  return {
    handleHeaderDoubleTap,
    isEnabled: processingMode === "header",
  };
}

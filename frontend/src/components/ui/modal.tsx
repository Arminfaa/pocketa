"use client";

import { Modal } from "antd";
import type { ModalProps } from "antd";
import { composeRef } from "@rc-component/util";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export interface AppModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  zIndex?: number;
  centered?: boolean;
  maskClosable?: boolean;
  className?: string;
  modalProps?: Omit<
    ModalProps,
    "title" | "open" | "onCancel" | "footer" | "children" | "width" | "centered"
  >;
}

function ModalTitle({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  if (!subtitle) {
    return <span className="font-semibold text-app-fg">{title}</span>;
  }

  return (
    <div className="min-w-0">
      <div className="font-semibold text-app-fg">{title}</div>
      <div className="mt-0.5 text-sm font-normal text-app-muted">{subtitle}</div>
    </div>
  );
}

function getModalContainer(panel: HTMLDivElement): HTMLDivElement {
  return panel.querySelector<HTMLDivElement>(".ant-modal-container") ?? panel;
}

function measureModalChromeHeight(container: HTMLDivElement): number {
  const header = container.querySelector<HTMLElement>(".ant-modal-header");
  const footer = container.querySelector<HTMLElement>(".ant-modal-footer");

  const styles = window.getComputedStyle(container);
  const containerPadding =
    Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);

  return (header?.offsetHeight ?? 0) + (footer?.offsetHeight ?? 0) + containerPadding;
}

function applyModalChromeHeight(container: HTMLDivElement) {
  const chromeHeight = measureModalChromeHeight(container);
  container.style.setProperty("--app-modal-chrome-height", `${chromeHeight}px`);
}

export function AppModal({
  title,
  subtitle,
  open = true,
  onClose,
  children,
  footer,
  width = 520,
  zIndex,
  centered = true,
  maskClosable = true,
  className,
  modalProps,
}: AppModalProps) {
  const instanceId = useId().replace(/:/g, "");
  const instanceClass = `app-modal-root-${instanceId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const {
    mask: maskProp,
    styles: modalStyles,
    afterOpenChange,
    panelRef: externalPanelRef,
    ...restModalProps
  } = modalProps ?? {};

  const maskConfig =
    typeof maskProp === "object" && maskProp !== null
      ? { closable: maskClosable, ...maskProp }
      : { closable: maskClosable };

  const measureChromeHeight = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    applyModalChromeHeight(container);
  }, []);

  const bindContainerRef = useCallback(
    (panel: HTMLDivElement | null) => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (!panel) {
        containerRef.current = null;
        return;
      }

      const container = getModalContainer(panel);
      containerRef.current = container;
      measureChromeHeight();

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(measureChromeHeight);
        resizeObserverRef.current = observer;
        observer.observe(container);
        const header = container.querySelector(".ant-modal-header");
        const footerEl = container.querySelector(".ant-modal-footer");
        if (header) observer.observe(header);
        if (footerEl) observer.observe(footerEl);
      }
    },
    [measureChromeHeight]
  );

  useLayoutEffect(() => {
    if (!open) return;

    measureChromeHeight();
    const frame = window.requestAnimationFrame(measureChromeHeight);
    const timeout = window.setTimeout(measureChromeHeight, 50);
    window.addEventListener("resize", measureChromeHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", measureChromeHeight);
    };
  }, [open, measureChromeHeight, title, subtitle, footer]);

  useLayoutEffect(
    () => () => {
      resizeObserverRef.current?.disconnect();
    },
    []
  );

  return (
    <Modal
      title={<ModalTitle title={title} subtitle={subtitle} />}
      open={open}
      onCancel={onClose}
      footer={footer ?? null}
      width={width}
      centered={centered}
      zIndex={zIndex}
      mask={maskConfig}
      destroyOnHidden
      rootClassName={cn("app-modal-root", instanceClass)}
      className={cn("app-modal", className)}
      panelRef={
        externalPanelRef
          ? composeRef(bindContainerRef, externalPanelRef)
          : bindContainerRef
      }
      afterOpenChange={(visible) => {
        if (visible) {
          window.requestAnimationFrame(measureChromeHeight);
          window.setTimeout(measureChromeHeight, 50);
        }
        afterOpenChange?.(visible);
      }}
      styles={{
        mask: {
          backdropFilter: "blur(4px)",
        },
        container: {
          display: "flex",
          flexDirection: "column",
          maxHeight: "min(90dvh, 720px)",
          overflow: "hidden",
          padding: 0,
        },
        body: {
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
        },
        header: {
          flexShrink: 0,
        },
        footer: {
          flexShrink: 0,
          textAlign: "unset",
        },
        ...modalStyles,
      }}
      {...restModalProps}
    >
      {children}
    </Modal>
  );
}

"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Resizable Components
 * Simplified implementation without react-resizable-panels dependency
 * This avoids build issues with the external package
 */

type PanelGroupProps = {
  direction?: "horizontal" | "vertical";
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
};

type PanelProps = {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
};

type HandleProps = {
  className?: string;
  withHandle?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
};

const ResizablePanelGroup = React.forwardRef<HTMLDivElement, PanelGroupProps>(
  ({ className, direction = "horizontal", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full",
          direction === "vertical" && "flex-col",
          className,
        )}
        data-panel-group-direction={direction}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ResizablePanelGroup.displayName = "ResizablePanelGroup";

const ResizablePanel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, children, defaultSize, minSize, maxSize, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 overflow-hidden", className)}
        style={{
          flexBasis: defaultSize ? `${defaultSize}%` : undefined,
          minWidth: minSize ? `${minSize}%` : undefined,
          maxWidth: maxSize ? `${maxSize}%` : undefined,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ResizablePanel.displayName = "ResizablePanel";

const ResizableHandle = React.forwardRef<HTMLDivElement, HandleProps>(
  ({ withHandle, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-px items-center justify-center bg-border hover:bg-border/80 transition-colors",
          "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
          "data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full",
          "data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1",
          "data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2",
          "data-[panel-group-direction=vertical]:after:translate-x-0",
          "[&[data-panel-group-direction=vertical]>div]:rotate-90",
          className,
        )}
        {...props}
      >
        {withHandle && (
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
            <GripVertical className="h-2.5 w-2.5" />
          </div>
        )}
      </div>
    );
  },
);
ResizableHandle.displayName = "ResizableHandle";

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

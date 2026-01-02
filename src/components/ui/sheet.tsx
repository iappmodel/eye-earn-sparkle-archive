import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background/95 backdrop-blur-md p-6 shadow-xl border border-border/50 transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 rounded-2xl",
  {
    variants: {
      side: {
        top: "left-[50%] translate-x-[-50%] top-4 w-[90%] max-w-md max-h-[40vh] overflow-auto data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "left-[50%] translate-x-[-50%] bottom-4 w-[90%] max-w-md max-h-[40vh] overflow-auto data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "left-4 top-[50%] translate-y-[-50%] h-[40vh] w-[80%] max-w-sm overflow-auto data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right:
          "right-4 top-[50%] translate-y-[-50%] h-[40vh] w-[80%] max-w-sm overflow-auto data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, autoClose = true, autoCloseDelay = 5000, ...props }, ref) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
      if (!autoClose) return;
      
      const timer = setTimeout(() => {
        closeRef.current?.click();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }, [autoClose, autoCloseDelay]);

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
          <SheetPrimitive.Close 
            ref={closeRef}
            className="absolute right-3 top-3 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-muted/80 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left pr-8", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};

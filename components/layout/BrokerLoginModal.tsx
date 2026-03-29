"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  BrokerLoginModal — shadcn Dialog asking user to choose Upstox or Kite Connect
// ─────────────────────────────────────────────────────────────────────────────
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

interface BrokerLoginModalProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrokerLoginModal({ open, onOpenChange }: BrokerLoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-white border-zinc-200">
        <DialogHeader>
          <DialogTitle className="text-zinc-800 text-base font-bold">
            Login to activate live data
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-xs">
            Choose your broker to authenticate. Tokens are stored as secure
            http-only cookies and expire at midnight.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          {/* Upstox */}
          <a href="/api/auth/upstox/login" onClick={() => onOpenChange(false)}>
            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3 border-cyan-400/60 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 font-bold text-sm"
            >
              <span className="text-base">▲</span>
              <div className="flex flex-col items-start leading-tight">
                <span>Upstox</span>
                <span className="text-[10px] font-normal text-cyan-600/80">
                  OAuth 2.0 via api.upstox.com
                </span>
              </div>
              <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
            </Button>
          </a>

          <Separator className="bg-zinc-100" />

          {/* Kite Connect / Zerodha */}
          <a href="/api/auth/zerodha/login" onClick={() => onOpenChange(false)}>
            <Button
              variant="outline"
              className="w-full h-12 justify-start gap-3 border-orange-400/60 bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 font-bold text-sm"
            >
              <span className="text-base">⬡</span>
              <div className="flex flex-col items-start leading-tight">
                <span>Kite Connect</span>
                <span className="text-[10px] font-normal text-orange-600/80">
                  Zerodha OAuth via kite.zerodha.com
                </span>
              </div>
              <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
            </Button>
          </a>
        </div>

        <p className="text-[10px] text-zinc-400 mt-1 text-center">
          Tokens are never stored server-side. Re-login each morning.
        </p>
      </DialogContent>
    </Dialog>
  );
}

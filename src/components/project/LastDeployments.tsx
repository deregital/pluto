"use client";
import { updateTagAction } from "@/app/actions/vercel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RouterOutput } from "@/server/trpc";
import { format } from "date-fns";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "../ui/button";

export default function LastDeployments({
  masterDeployment,
  deployments,
}: {
  masterDeployment: RouterOutput["vercel"]["getMasterDeployment"];
  deployments: RouterOutput["vercel"]["getDeployments"];
}) {
  if (!masterDeployment || !deployments) {
    return (
      <Button
        className="text-black bg-gray-300 px-3 py-1 rounded-full text-sm font-medium transition-colors"
        disabled
      >
        NO DEPLOYS
      </Button>
    );
  }
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 2000;

  const handleMouseEnter = () => {
    const now = Date.now();
    if (now - lastUpdateRef.current > THROTTLE_MS) {
      lastUpdateRef.current = now;
      updateTagAction("deployments");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          onMouseEnter={handleMouseEnter}
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium transition-colors",
            masterDeployment.state === "ERROR" ||
              masterDeployment.state === "CANCELED"
              ? "bg-red-100 text-red-800 hover:bg-red-200"
              : masterDeployment.state === "QUEUED"
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : masterDeployment.state === "READY"
              ? "bg-green-100 text-green-800 hover:bg-green-200"
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          )}
        >
          {masterDeployment.state ?? "UNKNOWN"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Últimos 10 despliegues</h4>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {deployments.map((deployment) => (
              <Link
                key={deployment.uid}
                href={deployment.inspectorUrl ?? ""}
                target="_blank"
                className="block p-2 rounded hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        deployment.state === "ERROR" ||
                          deployment.state === "CANCELED"
                          ? "bg-red-500"
                          : deployment.state === "QUEUED"
                          ? "bg-gray-500"
                          : deployment.state === "READY"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      )}
                    />
                    <span className="text-sm font-medium">
                      {deployment.state}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(deployment.createdAt ?? "", "MM/dd HH:mm")}
                  </div>
                </div>
                {deployment.meta?.githubCommitRef && (
                  <div className="text-xs text-gray-600 mt-1">
                    Branch: {deployment.meta.githubCommitRef}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

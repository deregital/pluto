import { cn } from "@/lib/utils";
import { trpc } from "@/server/trpc/server";
import { differenceInDays, format } from "date-fns";

export default async function DomainsInfo() {
  const { domains } = await trpc.vercel.getDomains();
  return (
    <ul className="flex flex-col gap-2">
      {domains.map((domain) => {
        const expirationColor =
          domain.expiresAt &&
          differenceInDays(domain.expiresAt, new Date()) <= 90
            ? "text-red-500"
            : "text-green-500";

        const expirationDays =
          domain.expiresAt && differenceInDays(domain.expiresAt, new Date());

        return (
          <li
            key={domain.name}
            className="flex items-center justify-between gap-2 flex-col sm:flex-row max-w-xl"
          >
            {domain.name}{" "}
            <span className={cn(expirationColor)}>
              Expira en {expirationDays} días{" "}
              {domain.expiresAt &&
                `(${format(domain.expiresAt, "dd/MM/yyyy")})`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

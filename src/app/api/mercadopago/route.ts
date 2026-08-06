import { signedFetch } from "@/server/security/signed-request";
import MercadoPagoConfig, { Payment } from "mercadopago";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const mercadoPago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? "",
});

function verifySignature(
  signature: string,
  request_id: string,
  data_id: string,
): boolean {
  const ts = signature.split(",")[0]?.split("=")[1];
  const v1 = signature.split(",")[1]?.split("=")[1];
  const manifest = `id:${data_id};request-id:${request_id};ts:${ts?.trim()};`;
  const secretKey = process.env.MP_SECRET_KEY!;
  const signatureDecrypted = createHmac("sha256", secretKey)
    .update(manifest)
    .digest("hex");
  // comparacion segura de signatures para evitar timing attacks
  const a = Buffer.from(signatureDecrypted);
  const b = Buffer.from(v1?.trim() ?? "");
  const isValid = a.length === b.length && timingSafeEqual(a, b);
  return isValid;
}

export async function POST(req: NextRequest) {
  try {
    const body: { data: { id: string } } = await req.json();
    const signature = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");

    if (!signature || !requestId) {
      return new NextResponse(null, { status: 401 });
    }

    const isValid = verifySignature(signature, requestId, body.data.id);

    if (!isValid) {
      return new NextResponse(null, { status: 403 });
    }

    let payment: PaymentResponse;
    try {
      payment = await new Payment(mercadoPago).get({ id: body.data.id });
    } catch (error) {
      console.error(error);
      return new NextResponse(null, { status: 404 });
    }

    if (payment.status !== "approved") {
      return new NextResponse(null, { status: 409 });
    }

    if (!payment.external_reference) {
      return new NextResponse(null, { status: 400 });
    }

    if (!payment.metadata?.ticket_group_id && !payment.metadata?.instance_url) {
      return new NextResponse(null, { status: 400 });
    }

    const rawInstanceUrl = String(payment.metadata?.instance_url ?? "");
    const instanceUrl = new URL(
      /^https?:\/\//i.test(rawInstanceUrl)
        ? rawInstanceUrl
        : `https://${rawInstanceUrl}`,
    );

    const instanceResponse = await signedFetch(
      `${instanceUrl.origin}/api/mercadopago`,
      {
        body: { ticketGroupId: payment.external_reference },
      },
    );

    if (!instanceResponse.ok) {
      const responsePreview = (await instanceResponse.text()).slice(0, 500);
      console.error("[api/mercadopago] Instance notification failed", {
        instanceUrl: instanceUrl.origin,
        status: instanceResponse.status,
        responsePreview,
      });
      return new NextResponse(null, { status: 502 });
    }
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 200 });
}

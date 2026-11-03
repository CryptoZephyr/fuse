import { NextResponse, type NextRequest } from "next/server";
import { type Address, createPublicClient, getAddress, http, isAddress } from "viem";
import {
  DEFAULT_PAID_BUILDER_TESTNET,
  DEFAULT_X402_ANALYTICS_PRICE_MUSD,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_RPC_URL,
  MEZO_TESTNET_X402_FACILITATOR_URL,
  type X402PaymentPayload,
  buildX402PaymentRequired,
  decodeX402Header,
  getBuilderAnalytics,
  verifyAndSettleX402Payment,
} from "@fuse/sdk";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ builder: string }> },
) {
  const { builder: rawBuilder } = await context.params;

  if (!rawBuilder || !isAddress(rawBuilder)) {
    return NextResponse.json(
      {
        error: "INVALID_BUILDER_ADDRESS",
        message: `Builder address '${rawBuilder}' is not a valid EVM address.`,
      },
      { status: 400 },
    );
  }

  const builderAddress = getAddress(rawBuilder);
  const payToAddress: Address =
    process.env.X402_PAY_TO_ADDRESS && isAddress(process.env.X402_PAY_TO_ADDRESS)
      ? getAddress(process.env.X402_PAY_TO_ADDRESS)
      : DEFAULT_PAID_BUILDER_TESTNET;

  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL || MEZO_TESTNET_X402_FACILITATOR_URL;

  const { paymentRequirements, paymentRequired, headerValue } =
    buildX402PaymentRequired({
      resourceUrl: request.url,
      description: `Fuse Paid Builder Analytics Report for ${builderAddress}`,
      payTo: payToAddress,
      amount: DEFAULT_X402_ANALYTICS_PRICE_MUSD,
    });

  const paymentHeader =
    request.headers.get("payment-signature") ||
    request.headers.get("PAYMENT-SIGNATURE") ||
    request.headers.get("x-payment") ||
    request.headers.get("X-PAYMENT");

  // 1. No payment header -> HTTP 402 Payment Required with MUSD x402 v2 requirements
  if (!paymentHeader) {
    return NextResponse.json(paymentRequired, {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": headerValue,
        "Access-Control-Expose-Headers":
          "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
      },
    });
  }

  // 2. Payment header present -> decode, verify & settle via x402 facilitator, then return analytics
  let paymentPayload: X402PaymentPayload;
  try {
    paymentPayload = decodeX402Header<X402PaymentPayload>(paymentHeader);
  } catch (err) {
    return NextResponse.json(
      {
        error: "INVALID_X402_PAYMENT_HEADER",
        message:
          err instanceof Error
            ? err.message
            : "Could not decode PAYMENT-SIGNATURE / X-PAYMENT header.",
      },
      { status: 400 },
    );
  }

  try {
    const { verifyResult, settleResult, paymentResponseHeader } =
      await verifyAndSettleX402Payment({
        paymentPayload,
        paymentRequirements,
        facilitatorUrl,
      });

    const rpcUrl = process.env.NEXT_PUBLIC_MEZO_RPC_URL || MEZO_TESTNET_RPC_URL;
    const publicClient = createPublicClient({
      chain: MEZO_TESTNET_CHAIN,
      transport: http(rpcUrl, { timeout: 25_000 }),
    });

    const analytics = await getBuilderAnalytics({
      publicClient,
      builder: builderAddress,
    });

    return NextResponse.json(
      {
        x402: {
          settled: true,
          facilitatorUrl,
          network: settleResult.network,
          amountMusd: "0.05",
          amountWei: paymentRequirements.amount,
          payTo: paymentRequirements.payTo,
          payer: settleResult.payer ?? verifyResult.payer,
          transaction: settleResult.transaction,
          explorerUrl: settleResult.explorerUrl,
        },
        analytics,
      },
      {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": paymentResponseHeader,
          "X-PAYMENT-RESPONSE": paymentResponseHeader,
          "Access-Control-Expose-Headers":
            "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to verify or settle MUSD x402 payment.";
    return NextResponse.json(
      {
        error: "X402_SETTLEMENT_FAILED",
        message,
        paymentRequired,
      },
      {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": headerValue,
          "Access-Control-Expose-Headers":
            "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
        },
      },
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import {
  type Address,
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
} from "viem";
import {
  DEFAULT_X402_ANALYTICS_PRICE_MUSD,
  MEZO_TESTNET_ADDRESSES,
  MEZO_TESTNET_CHAIN,
  MEZO_TESTNET_RPC_URL,
  MEZO_TESTNET_X402_FACILITATOR_URL,
  fuseRouterAbi,
  type X402PaymentPayload,
  buildX402PaymentRequired,
  decodeX402Header,
  getBuilderAnalytics,
  settleX402Payment,
  verifyX402Payment,
} from "mezo-fuse";

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
  const rpcUrl = process.env.NEXT_PUBLIC_MEZO_RPC_URL || MEZO_TESTNET_RPC_URL;
  const publicClient = createPublicClient({
    chain: MEZO_TESTNET_CHAIN,
    transport: http(rpcUrl, { timeout: 25_000 }),
  });

  try {
    const builderConfigs = await Promise.all(
      MEZO_TESTNET_ADDRESSES.fuseRouterDeployments.map(({ address }) =>
        publicClient.readContract({
          address,
          abi: fuseRouterAbi,
          functionName: "builders",
          args: [builderAddress],
        }),
      ),
    );
    if (!builderConfigs.some((builderConfig) => builderConfig[2])) {
      return NextResponse.json({ error: "BUILDER_NOT_REGISTERED" }, { status: 404 });
    }

    const configuredPayTo = process.env.X402_PAY_TO;
    const legacyPayTo = process.env.X402_PAY_TO_ADDRESS;
    const payToAddress: Address | null =
      configuredPayTo && isAddress(configuredPayTo)
        ? getAddress(configuredPayTo)
        : legacyPayTo && isAddress(legacyPayTo)
          ? getAddress(legacyPayTo)
          : null;

    if (!payToAddress) {
      return NextResponse.json(
        {
          error: "X402_NOT_CONFIGURED",
          message: "Set X402_PAY_TO to a valid payee address before enabling paid analytics.",
        },
        { status: 503 },
      );
    }

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

    let verifyResult;
    try {
      verifyResult = await verifyX402Payment({
        paymentPayload,
        paymentRequirements,
        facilitatorUrl,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify MUSD x402 payment.";
      return NextResponse.json(
        { error: "X402_VERIFICATION_FAILED", message, paymentRequired },
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

    let analytics;
    try {
      analytics = await getBuilderAnalytics({
        publicClient,
        builder: builderAddress,
      });
    } catch {
      return NextResponse.json(
        {
          error: "ANALYTICS_UNAVAILABLE",
          message: "Builder analytics are temporarily unavailable. No payment was settled.",
        },
        { status: 503 },
      );
    }

    try {
      const { settleResult, paymentResponseHeader } = await settleX402Payment({
        paymentPayload,
        paymentRequirements,
        facilitatorUrl,
      });

      return NextResponse.json(
        {
          x402: {
            settled: true,
            facilitatorUrl,
            network: settleResult.network,
            amountMusd: formatUnits(BigInt(paymentRequirements.amount), 18),
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
          : "Failed to settle MUSD x402 payment.";
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check builder registration.";
    return NextResponse.json(
      { error: "BUILDER_LOOKUP_FAILED", message },
      { status: 503 },
    );
  }
}

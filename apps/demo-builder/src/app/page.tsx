import { getAddress, isAddress, type Address } from "viem";
import { StackHome } from "./StackHome";

const STACK_BUILDER_ADDRESS: Address =
  "0xf0557aAFFB2988C02c320236bb6DC4C7c42B5C09";
const DEFAULT_WIDGET_URL = "https://fuse.vercel.app/widget";

interface PageProps {
  searchParams: {
    builder?: string | string[];
  };
}

export default function Page({ searchParams }: PageProps) {
  const requestedBuilder = Array.isArray(searchParams.builder)
    ? searchParams.builder[0]
    : searchParams.builder;
  const builderAddress =
    requestedBuilder && isAddress(requestedBuilder, { strict: false })
      ? getAddress(requestedBuilder.toLowerCase())
      : STACK_BUILDER_ADDRESS;
  const widgetUrl =
    process.env.NEXT_PUBLIC_FUSE_WIDGET_URL || DEFAULT_WIDGET_URL;

  return (
    <StackHome builderAddress={builderAddress} widgetUrl={widgetUrl} />
  );
}

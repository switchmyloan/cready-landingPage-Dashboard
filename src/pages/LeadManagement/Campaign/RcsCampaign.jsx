import Campaign from "./Campaign";

// RCS Campaign — identical to the Campaign page in every way, but scoped to the
// RCS (Onextel) provider only. Same layout, same calculations; the sole difference
// is `provider="onextel"`, which the shared Campaign component threads through the
// campaign-portal queries (and the row drill-down).
const RcsCampaign = () => (
  <Campaign
    provider="onextel"
    title="RCS Campaign"
    subtitle="RCS (Onextel) campaign-portal performance broken down by lander & entity — total, sent, delivered, read, clicked, failed and spend. Click a row to drill into the raw rows."
  />
);

export default RcsCampaign;

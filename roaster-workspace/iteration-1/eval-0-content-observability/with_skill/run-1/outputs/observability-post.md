A few customers couldn't check out, and our alerts said nothing was wrong. Request rate normal, p99 latency normal, error rate flat. Every alert we'd ever thought to write was quiet — and the checkout flow was still broken for a slice of people.

We only found it because we could ask a question we'd never set up in advance. That gap is the actual difference between monitoring and observability, and the two get treated as synonyms often enough that it's worth pinning down.

Monitoring answers questions you decided to ask ahead of time. You pick the things that matter — request rate, p99 latency, queue depth — and wire up dashboards and alerts for them. It's good at catching failure modes you've seen before.

Observability is about the ones you haven't. It's whether you can ask a brand-new question of a running system — one nobody pre-built a chart for — and get an answer without shipping code to add the instrumentation first. (The term is borrowed from control theory: inferring a system's internal state from its outputs.)

Back to checkout. The fix wasn't another dashboard. It was taking the raw request events and grouping them by fields we'd never pre-aggregated: customer ID, then payment provider, then the build they were served. The shape fell out fast — one provider was timing out, but only for customers on a build we'd rolled out that afternoon. No standing chart would have shown it, because we didn't know to build that chart until we needed it.

So the practical test I use now: if answering "why is this broken?" means shipping a code change to add the metric first, you have monitoring, not observability.

The catch is cost, and it's specifically a metrics-system problem. In something like Prometheus, every distinct combination of label values is its own stored series, so "group by user × build × region" multiplies out and gets expensive fast — that's the surprise-bill trap. The reason event/columnar tools (Honeycomb, or ClickHouse-backed stacks) exist is to make exactly that high-cardinality slicing cheap, so the field you most need to group by isn't the one you can't afford to keep.

Does it pay off? New Relic's 2025 Observability Forecast found that teams with full-stack observability were less likely to get hit by frequent high-impact outages — 23% of them versus 40% without. It's a vendor survey and it's correlational, and those are teams that have built the capability up over a couple of years, not switched on a tool last week. So read it as a direction, not a guarantee.

If "observability" in your stack still means a wall of dashboards someone has to predict in advance, that's the gap worth closing first. What's a question your current setup *can't* answer yet?

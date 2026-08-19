---
aip: 147
title: Periodic Testnet State Resets
author: Sherry Xiao (sherry@aptoslabs.com)
discussions-to: 
Status: Draft
last-call-end-date (*optional):
type: Process
created: 08/19/2026
updated (*optional):
requires (*optional):
---

# AIP-X - Periodic Testnet State Resets

## Summary

Aptos Testnet has accumulated more than 10 billion transactions — more than Mainnet's ~6 billion — and the resulting state has grown to a size that is increasingly expensive to maintain (archival nodes approaching ~30 TB, indexer database exceeding ~70 TB, with no natural ceiling). This AIP proposes moving Testnet to an **as-needed state reset, occurring no more frequently than once every 6 months**, with **at least one month of public advance notice before each reset**. Each reset returns Testnet to a fresh genesis, clearing accumulated on-chain state. The goal is to bound Testnet's operational and storage footprint — reducing associated cloud spend — while keeping Testnet a fast, low-friction environment for builders and node operators. The impact on realistic testing is limited because developers can now fork real Mainnet/Testnet state locally using [Forklift](https://github.com/aptos-labs/forklift), reducing dependency on long-lived accumulated Testnet state. Mainnet is explicitly unaffected.

### Out of scope

- **Mainnet.** No Mainnet state, history, or behavior is changed by this proposal.
- **Devnet.** Devnet continues on its existing reset schedule; this AIP does not modify it.
- **Data replay policy.** This proposal does not change any Aptos network transaction replay and compatibility policy, refer to AIP 111 for more information on that topic.

## High-level Overview

Testnet is intended to be a disposable, production-like environment for exercising deployments, upgrades, and integrations before they reach Mainnet. Over time, however, Testnet has retained all accumulated state, and the cost of carrying that state — storage on archival nodes and full nodes, indexer database size, and the associated cloud spend — has grown to the point where the ongoing cost outweighs the marginal benefit of retaining old history. This proposal introduces periodic resets so that Testnet's footprint is bounded rather than monotonically increasing.

Rather than a rigid calendar cadence, resets are performed on an **as-needed basis** — triggered when state growth and cost warrant it — but **no more frequently than once every 6 months**, and always with **at least one month of public advance notice** so teams and ecosystem partners can prepare. The first reset is expected approximately one month after this AIP is accepted (i.e., announced upon acceptance and executed after the one-month notice period). After each reset, deployed contracts, test accounts, balances, and historical on-chain data no longer exist and must be redeployed or recreated; the faucet, indexer, and downstream tooling re-initialize against the new genesis.

A key reason the testing impact is limited is that realistic, large-dataset testing no longer depends on Testnet's accumulated history. [Forklift](https://github.com/aptos-labs/forklift) — Aptos Labs' TypeScript framework for developing, testing, and scripting Move contracts — supports **network forking**, which fetches real chain state (accounts, resources, deployed contracts) from Mainnet, Testnet, or Devnet and lets developers simulate against it locally, without spending gas or affecting the live network. This means teams that previously relied on long-lived Testnet state to test against realistic, production-scale data can instead fork Mainnet directly and test against the real, current dataset. The dependency this AIP asks teams to give up is therefore substantially smaller than it would have been before tooling like Forklift existed.

## Impact

**Impacted audiences and required actions:**

- **dApp and smart contract developers** — must redeploy contracts and recreate test accounts/state after each reset. Should treat Testnet as ephemeral and keep deployment scripts ready. For realistic testing against production-scale data, can use Forklift's network-forking mode against Mainnet instead of relying on accumulated Testnet state.
- **Node operators (full nodes / archival / indexer nodes)** — will re-sync from the new genesis after each reset and can reclaim storage tied to prior state. This is a direct cost reduction for operators as well as for core infrastructure.
- **Indexer / analytics / explorer consumers** — historical Testnet data is cleared on reset; pipelines and dashboards relying on pre-reset history must plan around each announced reset.
- **Ecosystem partners and integrators** — anyone depending on stable Testnet addresses or long-lived Testnet history must adapt; the one-month advance notice and a designated point of contact are provided for planning.
- **Internal testing / CI / automation** — automated flows must assume Testnet state is disposable and re-provision required state per cycle. Forklift's local-simulation and forking modes are well suited to CI and reduce reliance on persistent shared Testnet state.

**If we do not accept this proposal:** Testnet storage and the associated cloud spend continue to grow without bound. Node sync times and operational overhead increase, the environment becomes progressively more expensive and less nimble, and budget that could fund higher-impact infrastructure work remains consumed by carrying stale state.

## Alternative Solutions

- **Status quo (permanent, ever-growing Testnet).** Rejected: cost compounds indefinitely and is already past the point where the tradeoff favors retention.
- **Fixed short cadence (e.g., quarterly).** Considered and not chosen: a rigid quarterly reset imposes more frequent redeployment churn than necessary. An as-needed model with a 6-month minimum interval captures most of the cost savings while resetting only when growth actually warrants it, reducing builder disruption.
- **Infrequent, purely as-needed resets.** This remains a real possibility under the proposed policy, not a rejected alternative. If state does not grow large enough to justify a reset, we may not reset Testnet for a long time — potentially well beyond 6 months. The 6-month figure is a **minimum lower bound** intended to set expectations, not a target: resets happen no more frequently than every 6 months, and could occur considerably less often. Formalizing this as a standing policy (rather than leaving each reset a one-off ad-hoc decision) lets downstream tooling treat Testnet as disposable by design while keeping actual resets as infrequent as the data footprint allows.
- **Selective state pruning / tiered storage instead of a reset.** Considered: pruning and storage-tiering can slow growth but add operational complexity and do not fully bound the indexer/archival footprint. A periodic clean reset is simpler, more predictable, and yields larger, more reliable savings. Pruning optimizations remain complementary and can be pursued independently.

## Specification and Implementation Details

The reset is an operational procedure coordinated across the infrastructure, DevRel, and relevant product teams. Resets are performed as needed, subject to two standing constraints: **no more than one reset per 6-month period**, and **a minimum of one month of public advance notice before each reset.**

Each reset cycle consists of:

1. **Advance announcement (≥1 month).** Publish the reset date and a migration checklist at least one month ahead. Notify internal teams and external partners with the designated point of contact.
2. **Fresh genesis.** Produce a new Testnet genesis. On reset, all prior on-chain state — accounts, balances, deployed modules, resources, and history — is discarded.
3. **Validator restart.** Coordinate Testnet validators to halt the existing chain and restart from the new genesis.
4. **Faucet re-initialization.** Reset the Testnet faucet to fund accounts against the new genesis.
5. **Node re-sync.** Full nodes, archival nodes, and indexer nodes re-initialize against the new genesis. Storage associated with prior state is decommissioned/reclaimed — the primary source of the projected footprint and cost reduction.
6. **Indexer / API / explorer bring-up.** Indexer databases are re-initialized from the new genesis; explorer and API surfaces reflect the fresh network.
7. **Verification.** Confirm network health (block production, faucet, indexer freshness, RPC/API availability) before declaring the reset complete.

**Trigger criteria.** Because resets are as-needed rather than calendar-fixed, the decision to reset should be driven by observable signals — e.g., storage/cost thresholds on archival and indexer infrastructure. Defining explicit trigger thresholds is an open question below.

**Network identity handling.** A key implementation detail is whether the reset preserves the existing chain identity (chain ID / genesis hash / endpoints) or requires clients to reconfigure. The goal is to minimize builder disruption by keeping stable, well-known endpoints where technically feasible; the precise handling of chain ID and genesis hash across resets is flagged as an open question below, since clients that pin a genesis hash will need to re-sync regardless.

## Reference Implementation

This is an operational process rather than a code change, so there is no feature flag. Enablement is via the coordinated runbook above, owned and scheduled by the coordinating team. A living reset runbook and migration checklist should be maintained alongside this AIP, covering: genesis generation, validator restart coordination, faucet reset, indexer re-initialization, node operator guidance, and a partner communication template. Exact per-reset dates are published with each ≥1-month advance announcement.

For teams adapting their testing to a disposable Testnet, [Forklift](https://github.com/aptos-labs/forklift) serves as the reference path for realistic testing: `Harness.createNetworkFork(network, apiKey)` forks live network state for local simulation, `Harness.createLocal()` supports fast in-memory CI testing, and the same workflow code runs unchanged against live networks via `Harness.createLive(network)`.

## Testing

- **Dry run / rehearsal:** Rehearse the reset procedure (genesis generation, validator restart, faucet and indexer bring-up) in a staging or Devnet-like setting prior to the first Testnet reset.
- **Post-reset health checks:** Verify block production, faucet funding, RPC/API availability, indexer freshness, and explorer correctness against the new genesis.
- **Continuity of developer testing:** Because Forklift's network-forking mode lets developers test against real, production-scale Mainnet state locally, the loss of accumulated Testnet history does not compromise realistic testing. Teams should validate their critical test suites run against a Mainnet fork ahead of the first reset so that no workflow depends on pre-reset Testnet state.
- **Results timing:** Health checks are validated immediately post-reset each cycle; cost-reduction results are assessed over the first full interval following the initial reset.

## Risks and Drawbacks

- **Loss of long-lived Testnet state.** Contracts, addresses, and historical data that teams or partners depend on will be cleared. *Mitigation:* ≥1-month advance notice, migration checklists, redeployment guidance, an option to snapshot pre-reset state for archival (open question), and — critically — Forklift network-forking, which lets teams reproduce realistic, large-dataset test conditions by forking Mainnet directly rather than relying on accumulated Testnet state.
- **Builder friction / churn.** Recurring redeployment is an ongoing cost to developers. *Mitigation:* the as-needed model with a 6-month minimum interval keeps resets infrequent; predictable notice and ready-to-run deployment scripts make re-provisioning routine rather than surprising.
- **Partner/integration breakage.** Integrations pinned to stable Testnet addresses or historical data may break. *Mitigation:* proactive partner outreach with ≥1 month lead time and a designated contact.
- **Client re-sync on genesis change.** Nodes and clients pinning a genesis hash must re-sync. *Mitigation:* clear documentation and endpoint/config guidance published with each announcement.
- **Backward compatibility.** No Mainnet impact and no protocol backward-compatibility concerns; impact is confined to Testnet state persistence.

## Security Considerations

- Testnet uses valueless tokens, so a reset carries no direct financial risk to users.
- The reset procedure touches validator restart, genesis generation, and faucet re-initialization; each step should follow the established operational runbook with appropriate access controls, so a misconfiguration cannot affect Mainnet or leak credentials.
- Genesis generation and validator coordination should be verified (correct genesis hash, expected validator set) before the network is declared live to avoid a malformed or forked restart.
- No change to Mainnet security posture. This AIP does not modify consensus, cryptography, or the framework.
- All existing test cases can still be performed on Mainnet data, with the support of replay verify tool and Forklift.

## Timeline

### Suggested implementation timeline

- **Now:** AIP circulated; feedback window opens.
- **~2 weeks:** Feedback window closes; policy and procedure finalized; reset runbook and migration checklist published.
- **Upon acceptance:** First reset announced, starting the ≥1-month notice period; migration checklist and Forklift-based testing guidance shared with teams and partners; rehearsal completed.
- **~1 month after acceptance:** First Testnet reset executed.
- **Thereafter:** Resets as needed, no more than once every 6 months, each preceded by ≥1 month of public notice.

### Suggested developer platform support timeline

SDK/CLI/API/Indexer support is largely a matter of documentation and re-provisioning rather than new features. Ahead of the first reset, publish guidance for redeploying contracts, re-funding via the faucet, reconfiguring any clients that pin genesis/chain identity, and migrating realistic test suites to Forklift network-forking. Indexer and explorer bring-up against the new genesis is part of each reset cycle.

### Suggested deployment timeline

- **On devnet?** N/A — Devnet retains its existing reset schedule.
- **On testnet?** First reset ~1 month after acceptance; subsequent resets as needed, no more than once every 6 months, each with ≥1 month advance notice.
- **On mainnet?** Never — Mainnet is explicitly out of scope.

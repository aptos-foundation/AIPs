---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Reduce largest accepted transactions
author: igor-aptos (https://github.com/igor-aptos), vgao1996 (https://github.com/vgao1996)
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Gas)
created: 01/04/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Reduce largest accepted transactions
  
## Summary

Currently per-transaction max_execution_gas and max_io_gas limits allow single transaction to take ~1s to execute.
Proposal is to reduce the limits to <100ms short term, with target of <10ms longterm.

### Out of Scope

Any gas calibration changes, or block limit changes. 
This also doesn't touch overall transactions gas limit, which are much larger - as storage fees themselves are much larger.

## Motivation

Allowing large individual transactions, makes chain less responsive and harder to farily share resources.
From investiations, it is much more common that innefficient implementations lead to high-gas usage, and less common for it to be an actual need.

That suggests that reducing transaction limit should be overall beneficial:
- innefficient contracts will get early information to optimize, 
- chain will be more responsive and fair

## Impact, Risks and Drawbacks

Any transaction that exceeds reduced max_execution_gas or max_io_gas will be rejected.
Valid usecases that want to do larger amount of work, will need to split it across multiple transactions.

## Reference Implementation

modifying two configs in [transaction.rs](https://github.com/aptos-labs/aptos-core/blob/main/aptos-move/aptos-gas-schedule/src/gas_schedule/transaction.rs#L176)

## Timeline

### Suggested deployment timeline

On mainnet, we will reduce limits soon, to what is being used in production, so it doesn't have a big impact.
More aggressive reductions will be deployed more slowly, in collaboration with the ecosystem.

## Security Considerations

None

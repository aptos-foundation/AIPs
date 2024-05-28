---
aip: 85
title: Improve APT FungibleAsset performance
author: igor-aptos
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: <Draft | Last Call | Accepted | Final | Rejected>
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Framework)
created: <mm/dd/yyyy>
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-85 - Improve APT FA performance 

## Summary

Multiple improvements for FAs in general, and APT FA in specific, allowing gas charging and interacting with FA / APT FA to be more performant.
This AIP implements the efficient “after-migration” path, which is necessary to keep high performance after migration of APT from Coin to FA completes.

### Out of Scope

APT Coin -> FA migration (AIP-63), making FA concurrent (AIP-70), etc

# High-level Overview

To make the APT FA path most performant, we will optimize some of the hot paths in FA, as well as provide specialized functions for APT FA - that will bypass some of the general features FA have, that do not apply to APT itself (like freezing, dispatching, etc).

## Impact

Throughput of the blockchain will improve, and gas costs of transactions will reduce.

## Specification and Implementation Details

- Optimize and cache computation of address of a primary fungible store. Primary fungible store is a derived object, with its address being computed in move, and being re-computed on every call. 
For example, to pay gas with APT PFS, we need to compute address in prologue to confirm we have enough funds for max gas, and then we need to compute it again in epilogue to charge the consumed gas. We introduce efficient native implementation to optimize object derived address computation, which also caches the computation for the duration of the transaction.
- Provide specialized functions in aptos_account, for handling APT PFS, that bypasses checks that are not applicable / unnecessary for APT. PFS owner cannot change, and so ownership doesn't need to be rechecked (and so ObjectCore resource doesn't need to be fetched at all). APT fungible stores cannot be frozen, and it doesn't use dispatching functionality.
- Provide flags that will allow, once APT Coin -> FA migration is complete, to move APT transfers and gas charging directly to new functions, avoiding all migrations costs.

## Reference Implementation

- [https://github.com/aptos-labs/aptos-core/pull/12768](Native implementation for object derived address computation)
- [https://github.com/aptos-labs/aptos-core/pull/13194](Optimize APT FA transactions - gas charging and transfering)

## Testing (Optional)

Performance is measured via single-node-performance benchmarks on CI, over all the different workloads provided in the test suite.

## Risks and Drawbacks


## Security Considerations

- Skipping ownership check relies on there not being a hashing collision in the way PFS address is computed. Since account security / signers already rely on that, and collision would allow gaining access to another account, there should be no additional risk here.
- In general address computation needs to be careful to not cause conflicts. Most of address computation is already computed in rust, so moving derived object address computation there as well makes things more consistent.

## Future Potential

## Timeline

Targetted to be part of 1.14 release

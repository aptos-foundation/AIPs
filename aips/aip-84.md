---
aip: 84
title: Improving Gas Coverage
author: vgao1996
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/427
Status: Accepted
last-call-end-date (*optional): TBA
type: Standard (Gas)
created: 03/24/2024
updated (*optional): 03/24/2024
requires (*optional): N/A
---

# AIP-X Improving Gas Coverage

Note: This proposal introduces gas charges for type creation and module loading during the execution of a transaction. It is served as retroactive as the issue addresses a security vulnerability.

## Summary

This enhances the coverage of gas by introducing

- **Gas for Type creation**
    - Bytecode instructions and other operations that perform type instantiations, such as `vec_push<T>`, will incur gas charges.
- **Gas & Limits for Dependencies**
    - There will be limits on the total number of dependencies and the total size of dependencies (in bytes) a transaction could have.
    - Each dependency will also incur gas charges if directly or transitively referenced by a transaction.
    - Framework modules are excluded from such calculations.

These new charges enable us to reach 100% gas coverage, ensuring fair allocation
of the network's computing resources and thus the security of the network.

## Specification

Here are the formulae for the costs:

- Cost per type creation:
    - `per_type_node_cost * num_nodes(type)`
- Cost per dependency:
    - `per_module_cost + per_module_byte_cost * module_size_in_bytes`

Where

- `per_type_node_cost = 0.0004 gas units`
- `per_module_cost = 0.07446 gas units`
- `per_module_byte_cost = 0.000042 gas units`

The values of these parameters are calibrated via benchmarks. A discount has also been applied to amortize cold and hot loading costs.

Hard limits:

- `max_num_dependencies = 512`
- `max_total_dependency_size = 1.2 MB`

These limits are calibrated based on the largest transitive closure on mainnet, with some addition headroom for upgrades.

### Out of Scope

- Addressing discrepancies between cold and hot loading of modules
- Perfect gas calibration

## Impact

- **Gas for Type creation**
    - This will result in an increase in execution gas costs, but it is generally negligible.
- **Gas for Dependencies**
    - **Dependency gas will cause the costs of certain types of transactions to increase, most noticeably the ones that has a lot of dependencies but does relatively little computation**.
        - For example, arbitrage bots or swaps that wraps multiple protocols
        - We recommend the affected parties look into ways to split up their dependency graphs.
        - For the long term, we plan to implement lazy loading of modules, which can potentially reduce the dependency costs by a great margin as one will only be charged for what they use, not merely reference.
- **Limits for Dependencies**
    - Transactions with too many dependencies will be aborted.
    - However, all modules currently on mainnet fall within the proposed limits, so none of them will get broken by this.

## Alternative solutions

No obvious alternative solutions -- the VM needs to charge for all the work it does, or otherwise the network may be slowed down.

## Reference Implementation

- [[https://github.com/aptos-labs/aptos-core-private/pull/79](https://github.com/aptos-labs/aptos-core-private/pull/79)](Gas for type creation)
- [[https://github.com/aptos-labs/aptos-core/pull/12166](https://github.com/aptos-labs/aptos-core/pull/12166)](Gas & limits for dependencies)

## Testing

- Various levels of tests (unit, integration & property) ensuring the correctness of the implementation.
- Testing on testnet

## Risks and Drawbacks

- The current model may be a bit too coarse to account for the discrepancy between cold and hot loading.
- As mentioned previously, certain types of transactions may see their gas costs increase by a bit.

## Future Potential

- More refined gas model
- More precise calibration

## Timeline

This has been deployed as part of the v1.10 release and were enabled on April 15 through the following governance proposal

- [https://governance.aptosfoundation.org/proposal/69](https://governance.aptosfoundation.org/proposal/69)

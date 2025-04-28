---
aip:
title: Lazy Loading
author: George Mitenkov (george@aptoslabs.com)
discussions-to:
Status: Draft
last-call-end-date: N/A
type: Core
created: 04/28/2025
updated: 04/28/2025
requires: N/A
---

# AIP-X - Lazy Loading

## Summary

When executing an entry function or a script payload, all their transitive Move module dependencies and friends are traversed first.
During the traversal, the gas is charged for every module in the transitive closure, and the closure's size is checked to be within [limits](https://github.com/aptos-labs/aptos-core/blob/d641f201a1ec26c1f55078e4977931f83cfe3512/aptos-move/aptos-gas-schedule/src/gas_schedule/transaction.rs#L251).
After the traversal, all modules in the closure are verified, and the payload is finally executed.
Similarly, when publishing a Move package, the transitive closure of package's dependencies and friends is traversed first to meter gas and enforce that the closure's size is bounded.
We call this approach to meter, load and publish Move modules *Eager Loading*.

Eager Loading turns out to be overly restrictive for real use cases, and DeFi in patrticular.
For example, DEX aggregators facilitate token swaps across multiple decentralized exchanges using a single contract.
They usally include many DEXes as dependencies and struggle with Eager Loading:

  - An aggregator may not be able to add a DEX as a dependnecy due to limits on the size of the transitive closure.
  - If one of the dependency DEXes upgrades to use more dependencies, the aggregator contract may become unusable (any call to its functions will hit the limit after the dependency upgrade).

As a result, Eager Loading makes writing Move contracts with many dependencies very challenging, if not impossible.

There are also other problems due to Eager Loading.
Even if transaction is only using a few modules at runtime, all its transitive dependencies will be traversed for gas metering purposes.
This increases the gas costs for transactions, and also hurts performance (transaction accesses dependencies not used for execution). 

This AIP proposes *Lazy Loading* - a different approach to metering, loading and publishing of Move modules.
When calling an entry function or a script, *modules are metered and loaded only when they are used*.
When publishing a Move package, only modules in a package and their immediate dependencies and friends are metered and loaded.

Lazy Loading solves the aforementioned challenges associated with Eager Loading:

  1. Move contracts no longer hit limits on the size of the transitive closure of dependencies (e.g., DEX aggregators).
  2. Transaction gas fees are decreased.
  3. Transactions are executed faster: TODO: copy numbers from below.

### Out of scope

Lazy Loading is implemented as a part of Move VM infrastructure, and is not directly accessible by developers.
As a result, the following is left out of scope:

- Ability for developers to specify if a Move function call should use lazy or eager loading.
- Ability for developers to specify lazy or eager loading when publishing packages.


## High-level Overview

A new set of APIs is introduced to couple gas charging and module loading, in order to prevent any unmetered accesses.
```rust
/// Dummy trait that can be implemented with custom module metering and loading logic.
pub trait ExampleLoader {
    fn load_something_that_loads_modules(
        &self,
        // Can be used to meter gas for modules.
        gas_meter: &mut impl GasMeter,
        // Can be used to track modules that were already metered.
        traversal_context: &mut TraversalContext,
        // All other arguments to load modules: e.g., module identifier, function name, etc.
        ..
    ) -> Result<Something, SomeError>;
}
```
The APIs are simply traits, and so the implementation can be configured to use different metering and loading schemes (unmetered, eager, lazy, etc.).
Move VM APIs have been adapted to work with the new traits (with an option to maintain backwards-compatibility with Eager Loading).

The table below summarizes when modules are metered and loaded with Eager Loading and Lazy Loading.

|| Eager Loading | Lazy Loading|
|:--|:--|:--|
| Aptos VM calls an entry function or a script. | Traverse and charge gas for all transitive module dependencies and friends. Charge gas for all modules that *may* be loaded when converting transaction type arguments to runtime types. | Charge gas for the module of the entry function. Charge gas for all modules used when converting transaction type arguments to runtime types. Charge gas for modules used in transaction argument construction. |
| Aptos VM calls a view function. | No metering. | Charge gas for the module of the view function. Charge gas for all modules used when converting transaction type arguments to runtime types. Charge gas for modules used in transaction argument construction. |
| Aptos VM processes package publish. | Charge gas for all modules in a bundle, and their old versions (if exist). Traverse and charge gas for all remaining transitive module dependencies and friends of a package. | Charge gas for all modules in a bundle, and their old versions (if exist). Charge gas for all immediate module dependencies and friends of a package. Charge gas for all modules loaded during resource group scope verification. |
| Move VM calls a function. | No metering. | Charge gas for module of the target function. |
| Move VM resolves a closure (function value). | Traverse and charge gas for all transitive module dependencies and friends. Charge gas for all modules that *may* be loaded when converting transaction type arguments to runtime types. | Charge gas for module of the target function. |
| Move VM checks type depth (pack/unpack instructions). | No metering. | Charge gas for every module used during depth formula construction. |
| Move VM constructs type layout | No metering. | Charge gas for every module used during layout construction. |
| Move VM fetches module metadata to load a resource. | No metering. | Charge gas for accessed module. |
| Move VM serializes a function value. | No metering. | No metering. |
| Move VM calls a native function | No metering. | Charge gas for module of the target function. Charge gas for all modules used by the function type arguments (if any). |
| Move VM construct type layout in native context. | No metering. | No metering. |
| Move VM fetches module metadata to load a resource in native context. | No metering. | No metering. |
| Move VM loads a module in native dynamic dispatch [AIP-73](aip-73.md). | Traverse and charge gas for all transitive module dependencies and friends. | Charge gas for the module. |
| Move VM loads a fucntion in native dynamic dispatch [AIP-73](aip-73.md). | No metering. | No metering. |

## Impact

Developers do not need to change their workflow when writing Move contracts.
If the code is written optimally, it should use all the benefits of lazy loading.

For example, the following code is not optimal even with eager loading:
```rust
let x: u64 = other_module::some_function();
if (some_variable > 10) {
    x = x + 1;
} else {
    // Does not use x, function call to other_module::some_function should be moved into `if` branch!
}
```
Hence, it will also not benefit from lazy loading because `other_module::some_function` will be loaded even if the branch is not taken.

The drawbacks of lazy loading (runtime cyclic dependency detection) are mitigated by Aptos CLI and Aptos Move Compiler.
They enforce that cyclic modules cannot be compiled, or accidentally published on-chain.

### Backwards Compatibility

Lazy loading is not backwards compatible with eager loading due to difference in gas charging.

### Gas Costs and Limits

In general, lazy loading should always decrease the gas usage of a single transaction because gas is only charged for modules that are actually used.
It is also less likely to hit limits on the number of dependencies: thanks to not loading the transitive closures of dependnecies.

Replaying historical workloads with lazy loading feature enabled allows to estimate gas savings, summarized in the table below.

TODO: copy block gas usage from docs

#### Known Cases of Increased Gas Usage

However, it is possible to run into corner cases where gas costs increase with lazy loading.
These are attributed to cases where eager loader was not charging gas (whether this was a bug or a feature).

View functions are one of these cases.
Previously, module loading in view functions was not charged (which is acceptable, because metering was done when the view function was published).
With lazy loading, module loading in view functions is charged because limits during module publish are too relaxed.


###  Performance

#### Synthetic `single-node-performance` Benchmarks

TODO: copy from docs

#### Historical Replay Benchmarks:

TODO: copy from docs


## Alternative Solutions

There are no alternatives to lazy loading: it can either be done eagerly (current approach) or lazily (proposed approach). All solutions in-between are still a form of lazy loading, and inherit all its disadvanatges but with only a fraction of its advanatges.

For example, one can consider a "more eager" variation of lazy loading where a Move module is always loaded together with its immediate dependencies (with additional checks that the module can link correctly to them).
However, conceptually this is still lazy loading but:

1. More gas is charged when loading a module (dependencies need to be accounted for).

2. Linking checks to dependencies are redundant because correct linking is guaranteed by module upgrades, compatibility checks and paranoid mode.
   With function values (#AIP-112)[aip-112.md], load-time linking checks cannot even be performed. 

3. Dependencies are still loaded lazily.


## Specification and Implementation Details

### 1. TODO


## Reference Implementation

The feature is code complete and is currently being tested.
Lazy loading is gated by a boolean flag in `VMConfig` and a feature flag (`ENABLE_LAZY_LOADING`).

Reference implementation:
1. [#16394](https://github.com/aptos-labs/aptos-core/pull/16394)
2. [#16459](https://github.com/aptos-labs/aptos-core/pull/16459)
3. [#16461](https://github.com/aptos-labs/aptos-core/pull/16461)
4. [#16462](https://github.com/aptos-labs/aptos-core/pull/16462)
5. [#16464](https://github.com/aptos-labs/aptos-core/pull/16464)
6. [#16479](https://github.com/aptos-labs/aptos-core/pull/16479)


## Testing 

- [x] Exiting tests to see that `EagerLoader` is a compatible implementation.
- [ ] Replay run to check that `EagerLoader` is a compatible implementation.
- [x] Unit tests and mocks for subcomponents (depth checks, layout construction).
- [ ] Unit tests for gas metering with `LazyLoader` enabled.
- [ ] Tests to catch metering invariant violations, module cyclic dependencies.


## Risks and Drawbacks

The main concern of lazy loading is that certain errors, previously detected at load-time, can only be detected at runtime.

### Example 1

Consider a module `A` that depends on modules `B` and `C`.
Suppose that module `B` becomes unverifiable and can no longer be loaded.
With eager loading any access to `A` fails.
With lazy loading, using module `A`, or calling from it into `C` works fine.

It might be the case that developers want their code to fail if there is an unverifiable module in the dependency tree.
However, given that modules that become unverifiable are most likely malicious, it is only a minor drawback.

### Example 2

Consider a module `A` that depends on module `B`.
Suppose that `B` is republished with `A` as a dependency, creating a cycle between modules.
With eager loading, publishing such a module fails: cycles between dependencies are disallowed in original Move.
With lazy loading, publishing such a module succeeds.
Because only links to immediate dependencies are checked, it is not possible to check if `B`'s dependency `A` creates a cycle.
Only at runtime, if there is a cycle in used modules (e.g., `A` calls into `B`, `B` calls into `A`) an error is reported.

This does not seem like a significant drawback either.
With dispatchable token standard (#AIP-73)[aip-73.md] and function values (#AIP-112)[aip-112.md], re-entrancy is already possible.
For example, module `A` can call into module `B` which dispatches a dynamic call to a function value which happens to call into `A`.
Given that, enforcing acyclic dependency graph at runtime for regular static calls in Move seems acceptable.


## Security Considerations

1. While `EagerLoader` is carefully implemented to mimic existing behavior, it is possible that there are cases where it does not.
   In particular, the eager implementation does not check that modules that supposed to be charge gas for are actually charged for that exact reason.
   In case eager loader was undercharging, we still want to preserve backwards-compatible behavior.

2. `LazyLoader` relies on linking and compatibility checks performed during module publish.
   As a security precaution, Move VM checks function signature and struct abilities as part of its paranoid mode.
   Additionally, with lazy loading friends are restricted to be published in the same package.
   This way, if `B` is `A`'s friend and uses `A`, linking between `B` and `A` is enforced during module publish.

3. Move VM has multiple recursive traversal over types: to check depth and to construct layout of a type.
   Without cyclic checks, it is (hypothetically) possible that there is a cycle between types, and recursive traversals may run into an infinite loop.
   In our implementation, runtime cyclic checks were added to prevent this from happening.

4. With lazy loading, it is possible to create cycles between modules by multiple regular static calls.
   This behavior is disallowed at runtime using Move VM's re-entrency checker.


## Timeline

Devent: 1.31 or 1.32 releases. 
Testnet and mainnet: TBD.

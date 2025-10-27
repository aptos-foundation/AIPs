---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Move VM Performance Improvements
author: TODO
discussions-to (*optional): TODO
Status: Draft
last-call-end-date (*optional): 
type: Core
created: 16/10/2025
updated (*optional):
requires (*optional):
---

# AIP-X - Move VM Performance Improvements

## Summary

TODO

### Out of scope

This AIP focuses specifically on Move VM & related execution performance improvements and does not include:

- changes to the Move language syntax or semantics,
- network-level optimizations or consensus improvements,
- changes to gas metering algorithms (except where they impact performance),
- developer-facing API changes.


## High-level Overview

The Move VM performance improvements are implemented as a collection of targeted optimizations that work together to enhance execution speed and reduce resource consumption.

- **Compile-time Move Function Inlining**:
To reduce the execution overhead caused by function calls, the compiler provides an inlining optimization, which statically replaces a function call with the body of the called function. The compiler supports two levels of inlining. By default, a function can be inlined only when both the caller and callee are in the same package. In aggressive mode, inlining is extended to allow functions from different packages to be inlined as well.

- **Enum-based `Option` Type**:
The Move implementation of `Option` is changed from a struct to an enum, which provides a more natural representation and can also yield better performance than the struct-based design.

- **Trusted Code**:
  TODO(wolfgang)

- **Asynchronous Type Checks**:
  Moves runtime type-checking of a Move program from execution time to post-execution time, leveraging parallelism of Block-STM to run checks in parallel. Does not affect execution behavior.

- **Interpreter Function Caches**:
  Ensures generic types are instantiated once during execution. Gated by `TODO` feature flag.

- **Resource Layout Cache**:
  Ensures VM does not reconstruct layouts of resources. Does not affect execution behavior (gas costs). 

- **Disabling Type-based Value Depth Checks**:
  Removes unnecessary depth checking for the VM values. To be enabled from 1.38 onwards.

- **Miscellaneous**:

  - Aggressive Rust Inlining: TODO(victor/maksim)
  - Interning of Module Identifiers: TODO(victor)
  - Local Types Storage Optimization: Avoids cloning of local types for non-generic functions and re-instantiation of types for generic functions. Does not change any behavior.
  - Avoid Type Checks for Vector Instructions: Removes duplicated runtime checks for vector bytecode instructions. Does not change any behavior.


## Impact

### Performance Improvements

TODO

### Affected Audiences

**Smart Contract Developers**:
No changes required to existing Move code.
Developers benefit from faster execution of their contracts without any modifications and, possibly, lower gas usage.

**Node Operators**:
Improved VM performance reduces CPU and memory usage, potentially allowing for higher transaction throughput or reduced hardware requirements.

**End Users**:
Faster transaction execution improves user experience, particularly for complex transactions or high-frequency trading scenarios.

### Backward Compatibility

All performance improvements maintain full backward compatibility or are feature-gated.

### Network Effects

The performance improvements enable the Aptos network to handle higher transaction volumes with the same hardware resources, improving overall network capacity.


## Alternative Solutions

The goal of these features is to improve performance in a short term period.
An alternative is a complete rewrite of the Move VM.
Due to time constraints, engineering effort and security considerations, the alternative is not viable.


## Specification and Implementation Details

### Enum-based `Option` type

Previously, the `Option` type in Move was implemented as a struct backed by a vector:

```move
    struct Option<Element> has copy, drop, store {
        vec: vector<Element>
    }
```

This design was inefficient because all operations on `Option` were implemented through vector operations. To improve performance and expressiveness, it is replaced by an enum form:

```move
    enum Option<Element> has copy, drop, store {
        None,
        Some {
            e: Element,
        }
    }
```

However, directly replacing the old implementation with this new one is not feasible for two reasons:

- Backward compatibility: modifying the aptos-framework in an incompatible way is generally not allowed.
- Ecosystem dependencies: existing indexer services and downstream ecosystem projects rely on the current JSON representation of `Option`. The legacy format has to be supported even after introducing the enum version.

To enable a smooth migration toward the new `Option` representation, a two-step process is adopted:

Step 1: enable Enum Support in the VM

The enum-based implementation of `Option` is compiled and embedded into the node binary. This allows the new enum features to be used without immediately modifying the framework code.

A new feature flag, `ENABLE_ENUM_OPTION`, controls this behavior:

- Whether the VM uses the enum representation or the legacy struct-based one;
- Whether the local option module should be overridden by the precompiled version;
- Whether compatibility validation for the option module should be temporarily disabled.

Step 2: framework Upgrade and re-Enable Validation

Since `ENABLE_ENUM_OPTION` disables compatibility checks for the option module, the framework can now be safely upgraded to adopt the new enum-based implementation.

After this upgrade, a second feature flag, `ENABLE_FRAMEWORK_FOR_OPTION`, is introduced. When enabled, it:

- Re-enables compatibility validation for the option module;
- Switches the VM to use the framework-defined version instead of the precompiled one.


### Trusted Code

TODO(wolfgang)

### Asynchronous Type Checks

In the current Move VM implementation, runtime type checks run during every speculative transaction execution in Block-STM.
Since transactions may be re-executed multiple times due to conflicts, these checks impose significant overhead even with the trusted code feature.
The key insight is: if a transaction is eventually committed, we only need to verify type safety once.
The idea of asynchronous type checks is to defer runtime type checks from speculative execution to post-commit time in Block-STM, enabling them to run in parallel with minimal overhead during re-executions.
For sequential execution, in-place type-checking is kept as before.


When the feature is enabled, and the following heuristic holds:
  1. Block has more than 3 transactions.
  2. Entrypoint is a script, or non-trusted entry function.
user transaction payloads execute with no runtime type checks.

Instead, a trace of execution is recorded.
The trace includes:
  - number of successfully executed instructions,
  - conditional branch outcomes (taken/not taken) as a bit vector,
  - dynamic call targets (entry-points and closures).
The trace is then recorded in transaction output.

After the transaction is committed and can no longer be invalidated, the trace is extracted from the output.
It is then replayed performing type checks via abstract interpretation.
This happens in parallel across worker threads.
The interpretation is the same as during in-place type checks, with the only difference that branches and dynamic calls are resolved based on the trace, and execution stops when all instructions are replayed.

If type checks fail during replay (extremely unlikely, as this means there is a bug in bytecode verifier or runtime type checker): Block-STM falls back to sequential execution, and transaction re-runs with runtime checks in-place.
This ensures transaction epilogue and cleanup run correctly, gas is charged, and the behavior is the same as before.

Note that it is still crucial that main execution charges gas for types and performs type substitutions.
This is because type substitution may fail due to user inputs (e.g., type becomes too large).

### Interpreter Function Caches

Move VM interpreter uses a structure called `FrameTypeCache` to store instantiated types during execution per function.
Previously, when a function was called, a cache was created for it and when the function returned, its `FrameTypeCache` was dropped.
This was not ideal because 1) multiple calls to same function were re-creating caches, and 2) dropping was done on hot path and was taking a considerable amount of time.

While this change does not solve (2) directly, it reduces the drop overhead moving it away from the hot path while solving (1).
`InterpreterFunctionCaches` structure is added.
For non-generic functions, the cache stores `FrameTypeCache` for each unique function. The key is just a pointer to this function's definition and is guaranteed to be unique per interpreter session by the loader.

```rust
/// Stable pointer identity for a [Function] within a single interpreter invocation.
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub(crate) struct FunctionPtr(*const Function);

impl FunctionPtr {
    pub(crate) fn from_loaded_function(function: &LoadedFunction) -> Self {
        FunctionPtr(Arc::as_ptr(&function.function))
    }
}
```

This way, when a non-generic function is called, its frame cache is re-used across multiple calls during the interpreter session, reducing drop pressure, the number of type instantiations, and re-using other cached data.

For generic functions, `InterpreterFunctionCaches` store `FrameTypeCache` per function instantiation.
Function instantiation is uniquely defined by `FunctionPtr` and `TypeVecId`, which is an interned representation of a type argument vector.

```rust
/// Compactly represents a vector of types.
#[repr(transparent)]
#[derive(Copy, Clone, Eq, PartialEq, Hash, Debug)]
pub struct TypeVecId(u32);
```

`TypeVecId` is calculated either at runtime for truly generic functions or at load-time, e.g., for known generic function calls like `foo<u8, u32>`.
The unique integer identifier is assigned for each vector based on the global concurrent map from vectors of types to their IDs.

In `FrameTypeCache`, we additionally record a mapping of `FunctionInstantiationIndex` to a `LoadedFunction`/`FrameTypeCache` pair.
This way we enforce that `FrameTypeCache` is constructed only once per unique type instantiation: either queried through instantiation index or via type-argument interning and interpreter function caches.

With these changes, users may see a reduction in gas.
This is because `FrameTypeCache` is created exactly once per function instantiation, and so the callees for that function are persisted per interpreter session.

### Resource Layout Cache

`MoveTypeLayout` is a structure that is used by Move VM to serialize or deserialize VM values.
The layout is constructed based on resource's type.
This is a computationally expensive procedure as 1) layout is a fully-resolved fully-instantiated type and 2) during resolution, modules may be loaded.
For example, while the type of a resource at runtime is a single node, e.g., `Type::Struct { idx: 123 /* struct name encoding */}`, its layout may contain hundreds of nodes as it includes field layouts, etc.

An additional challenge is that for enums, layout stores layouts of all existing variants.
This makes layouts even bigger, and makes caching across multiple threads dangerous: new variant may be published and that needs to invalidate the cached layout entry.

In order to improve Move VM's performance, a concurrent long-living cache for resource layouts is added.
This cache is also safe for enum upgrades.

The cache stores only resource layouts - i.e., roots of the layout tree structure.
This design makes it simple to avoid sub-layout caching with all its complexity: no need to figure out the depth/size of the layout or find which modules to use for gas charging (see below), etc.
At the same time, it solves the most common problem - there is only a particular set of resources that is accessed, and caching the root is enough because sub-layouts are rarely used on their own.

The cache is only used by the lazy loader and not used in any `init_module` contexts.
Not allowing caches for `init_module` ensures layouts are never cached speculatively.
As module publish is done at commit time in Block-STM, layout reads become non-speculative at all times.

The cache lives in the global module cache and is flushed on epoch or config change.
On any module publish by transaction `i`, the cache is also flushed prior to re-scheduling validations for transactions `j > i`.
Module upgrade may increase enum in size, invalidating its cache entry. 
Flushing is the easiest way to solve the enum problem.
In the future, a new layout representation will be used to avoid this flush.
To make sure validation of transaction `j` observes module changes, for every layout we keep a set of modules `M` that are accessed when constructing these layouts.
On a cache hit, the loader ensures modules in `M` are all read (hence, they end up in the captured read-set and are used for validation in Block-STM).
These reads cannot be avoided because gas has to be charged for module loading based on module sizes.
Set `M` is read in the same order as it was populated when constructing and caching the layout, making any failures due to gas charging deterministic.

### Disabling Type-based Value Depth Checks

Move VM value is a recursive structure, and if not used carefully, a recursive algorithm over the value may result in stack overflow.
In order to prevent this, Move VM was checking the depth of a type when structs, enums, or vectors were packed.
For types with fixed size, such as regular structs or enums, this was enough to enforce the depth of the value and thus cache the check result per type.

With function values (#AIP-112)[aip-112.md], depth checks can no longer be enforced by the type.
A function value may have captured arguments, which are not visible in its type, and thus cannot be checked.
As a result, Move VM also tracks checks of a value at runtime.
For efficiency, the current implementation does not check depth every time a struct or closure is packed (these checks could not be cached) and instead checks depth during any traversal over a value (e.g., serialization, equality, etc.).
This way stack overflow is prevented while keeping the runtime as efficient as if there were no checks.
Note that storing depth along with the value is not possible, as when assigning to an inner field, the depth of the parent nodes has to be re-calculated.
Additionally, very deep or large values are metered, so if they are constructed, `GasMeter` should be able to limit how large such constructions can be.

Given that depth is tracked dynamically at runtime already, and a type depth check cannot be enforced for function values, it is appropriate to remove type depth checks to help performance.

### Miscellaneous: Aggressive Rust Inlining

TODO(victor/maksim)

### Miscellaneous: Interning of Module Identifiers

TODO(victor)

### Miscellaneous: Local Types Storage Optimization

For every function call, Move VM records the types of locals for additional runtime type checks.
Previously, every call was cloning types into a new allocation or performing a type substitution for generic calls.
With this optimization, local types for non-generic functions are never cloned, and instead are passed as a reference.
For generic functions, local types are instantiated on the first call to a particular instantiation of a function and recorded in `FrameTypeCache` (the per-instantiation cache the VM tracks), and subsequent calls to the same function instantiation re-use the types.

### Miscellaneous: Avoid Type Checks for Vector Instructions

Previously, when the interpreter processed vector instructions the type of the vector element was checked to enforce type safety at runtime.
These checks are redundant with `RuntimeTypeChecks` already enforcing the safety during runtime type checking and abstract interpretation of type stack transitions.
Hence, interpreter checks were removed.


## Reference Implementation

### Enum-based `Option` Type

- [x] https://github.com/aptos-labs/aptos-core/pull/17698
- [x] https://github.com/aptos-labs/aptos-core/pull/17751
- [x] https://github.com/aptos-labs/aptos-core/pull/17776

### Trusted Code

- [x] https://github.com/aptos-labs/aptos-core/pull/17461

### Asynchronous Type Checks

- [ ] https://github.com/aptos-labs/aptos-core/pull/17678

### Interpreter Function Caches

TODO(george)
- [x] https://github.com/aptos-labs/aptos-core/pull/17591
- [x] https://github.com/aptos-labs/aptos-core/pull/17787
- [ ] https://github.com/aptos-labs/aptos-core/pull/17760

### Resource Layout Cache

- [x] https://github.com/aptos-labs/aptos-core/pull/17788

### Disabling Type-based Value Depth Checks

- [x] https://github.com/aptos-labs/aptos-core/pull/17594
- [x] https://github.com/aptos-labs/aptos-core/pull/17882

### Miscellaneous

TODO(victor/maksim): Aggressive Rust Inlining
TODO(victor): Interning of Module Identifiers

- [x] https://github.com/aptos-labs/aptos-core/pull/17741: Local Types Storage Optimization
- [x] https://github.com/aptos-labs/aptos-core/pull/17704: Avoid Type Checks for Vector Instructions

## Testing 

Each feature has its own unit tests, and is rarely affecting the behavior, is implicitly tested by existing testsuite and real network traffic.

Additionally we enable features in devnet, testnet, and for node configs - on few nodes only.


## Risks and Drawbacks

There is a risk that while optimizing performance security can be compromised due to bugs.


## Security Considerations

- Each feature is gated by a flag, node config, or gas feature version.
  This minimizes the likelihood of bugs, and also helps with 
- Transaction replay to ensure same behaviour, security audit, existing tests. See each AIP 
- TODO: have a list of things for each AIP?


## Future Potential

More performance improvements are possible.


## Timeline

TODO

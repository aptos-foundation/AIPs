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

This AIP focuses specifically on Move VM performance improvements and does not include:

- changes to the Move language syntax or semantics,
- network-level optimizations or consensus improvements,
- changes to gas metering algorithms (except where they impact performance),
- developer-facing API changes.


## High-level Overview

The Move VM performance improvements are implemented as a collection of targeted optimizations that work together to enhance execution speed and reduce resource consumption.

- **Compile-time Move Function Inlining**:
  TODO(teng/vineeth)

- **Enum-based `Option` Type**:
  TODO(teng)

- **Trusted Code**:
  TODO(wolfgang)

- **Asynchronous Type Checks**:
  Moves runtime type-checking of a Move program from execution time to post-execution time, leveraging parallelism of Block-STM to run checks in parallel. Does not affect execution behaviour and is gated by the node config.

- **Interpreter Function Caches**:
  Ensures generic types are instantiated once during execution. Gated by `TODO` feature flag.

- **Resource Layout Cache**:
  Ensures VM does not reconstruct layouts of resources. Gated by the node config, does not affect gas costs. 

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
Developers benefit from faster execution of their contracts without any modifications and possibly - lower gas usage.

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

TODO(teng)

### Trusted Code

TODO(wolfgang)

### Asynchronous Type Checks

TODO(george)

### Interpreter Function Caches

TODO(george)

### Resource Layout Cache

TODO(george)

### Disabling Type-based Value Depth Checks

TODO(george)

### Miscellaneous: Aggressive Rust Inlining

TODO(victor/maksim)

### Miscellaneous: Interning of Module Identifiers

TODO(victor)

### Miscellaneous: Local Types Storage Optimization

TODO(george)

### Miscellaneous: Avoid Type Checks for Vector Instructions

TODO(george)


## Reference Implementation

### Enum-based `Option` Type

TODO(teng)

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

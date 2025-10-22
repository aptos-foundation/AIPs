---
aip: 133
title: Function Value Reflection in Move
author: Wolfgang Grieskamp (wg@aptoslabs.com)
discussions-to (*optional): https://github.com/aptos-foundation/AIPs/issues/634
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Standard (Core)
created: 10/21/2025
updated (*optional): 
requires (*optional): 
---

# AIP-133 - Function Value Reflection in Move

## Summary

Function Values have been introduced with [AIP-112](https://github.com/aptos-foundation/AIPs/issues/634) for Move, and they provide a strongly typed way for dealing with dynamic dispatch. However, until now, function values can be only denoted via Move code. Yet they are a category of applications which can benefit from the ability to construct function values, in Move, from strings, which for example, are provided via a transaction argument. These applications include bridges and other 'metaprograms', that is programs which instrument other programs.

This AIP proposes a _reflection API_ for the Move standard library which allows to construct a function value from runtime information (module address and name, function name) and a statically provided type. If reflection succeeds, the resulting function value is guaranteed to have the expected type, making reflection safe (aka "strongly typed"). This feature is also sometimes called 'late binding'.

The implementation adds a new module to the `move-stdlib` with a native implementation for reflection / late binding.

### Current Limitations

It is currently not possible for a contract to call another contract via reflection / late binding. 

### Out of scope

This AIP only proposes function value reflection via a single `reflect::resolve` function. It is also possible to give more extended features of reflection, for example, representing modules as values and iterating over their types and functions, but this is not in scope.


## High-level Overview

This AIP proposes a new module with the following content:

```move
module std::reflect {
    use std::result::Result;
    use std::string::String;
    
    public fun resolve<FuncType>(
        addr: address,
        module_name: &String, 
        func_name: &String
    ): Result<FuncType, ReflectionError> {
        // Implementation based on native primitives
    }

    enum ReflectionError has copy, drop, store {
        InvalidIdentifier,
        FunctionNotFound,
        FunctionNotAccessible,
        FunctionIncompatibleType,
        FunctionNotInstantiated
    }
}
```

Example usage:

```move
     // Expected type provided by context
     let fn : |u64|u64 = reflect::resolve(@std, &string::utf8(b"module"), &string::utf8(b"func")).unwrap();
     assert!(fn(1) == 2)

     // Expected type provided by instantiation
     let fn = reflect::resolve<|u64|u64>(@std, &string::utf8(b"module"), &string::utf8(b"func")).unwrap();
     assert!(fn(1) == 2)
```

In order to be accessible, the resolved function must be *public*. This prevents reflection to work around the languages modular encapsulation guarantees. A public function can be already called from anywhere onchain, and calling it by reflection doesn't add new security risks.

The resolved function can be generic, in which case the instantiation must be inferrible from the provided `FuncType`. For example, `public fun foo<T>(T)`, with `FunType = |u64|`, `T = u64` can be derived. If not all type parameters can be inferred, an error will be produced. 



## Impact

Infrastructure like bridges, aggregators.

## Alternative Solutions

None

## Specification and Implementation Details

A new native function for `reflect::resolve` is added, and the native function's `LoaderContext` is extended to provide an implementation for it. In the `LoaderContext` implementation, there is access to internal VM data, gas meter, etc., and resolution can be mapped to exactly the same mechanism as when a deserialized function value is resolved into a `LoadedFunction`.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/17892

## Testing 

The PR come with test cases covering reflection scenarios and various failure situations.

## Risks and Drawbacks (Security)

- Resolving to a function of wrong type (including abilities). Even if this happens, runtime verification should still capture this, but this needs to be verified. 
- Any bugs in missing gas charge for failed function resolution which allows to DoS.

## Future Potential
N/A

## Timeline

### Suggested deployment timeline
ASAP

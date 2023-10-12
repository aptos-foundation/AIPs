---
aip: 
title: Resource Access Control
author: wg@aptoslabs.com, brian.murphy@aptoslabs.com, runtian@aptoslabs.com
discussions-to (*optional): TODO
Status: Draft 
last-call-end-date (*optional): <mm/dd/yyyy TBD>
type: Standard
created: <10/11/2023>
---

# AIP-X - Resource Access Control
  
## Summary

In Move, functions can access arbitrary resources as long as they have access to public APIs allowing to manipulate the resource. There are multiple problems with this, as discussed in the [Motivation](#Motivation) section. This AIP proposes an extension to the Move language which allows for fine-grained access control of resources. This is achieved by generalizing the familiar `acquires T` declaration in Move in a downwards compatible way. The evaluation of the resulting access control discipline is primarily _dynamic_, but intended to become static in the future. The dynamic-first approach is natural because the redundancy principle of "paranoid" VM mode makes a dynamic check necessary anyway.

### Goals

This AIP intends to achieve the following:

- Have an organic extension of the Move language to support access control, which is fully downwards compatible
- Enable new strategies for parallelization and sharding
- Increase confidence in the effects of transactions and functions for users and auditors by access control declarations
- Enable safe dynamic dispatch by making access control part of a type.

### Out of Scope

This feature will only be supported in the upcoming Aptos Move compiler ("compiler v2").

Static analysis of access control will initially not be implemented, but is expected to be ready when AMC gets out of beta.

## Motivation

A Move function can read, write, and create arbitrary resources as long as it has access to the module APIs which allow this, and/or is in possession of a signer. There are multiple problems with this:

- It has been identified in the past as a security risk. For example, a transaction that obtains a
  signer and then delegates to some other well-known contract -- a 'helper' wrapper offered to some user -- can create arbitrary resources, including deploying code, without the user's knowledge, under the users account.
- Unspecified read/write behavior of transactions makes it harder to parallelize for block execution and to implement sharding strategies.
- It is difficult to reason about side effects of functions and transactions. This is both the case for auditors as for formal analysis like the Move prover. The only way to reason is to look at the code.
- Since looking at code is the only way to reason about effects, _calling unknown_ code (dynamic dispatch across trust boundaries) is unsafe, and therefore currently forbidden in Move.

## Impact

Significant impact is expected in the medium term on two frontiers: on the one hand sharding and parallelization, on the other enabling other new language features like dynamic dispatch. 


## Alternative solutions

In Solana, a transaction must declare upfront the accounts it reads or writes from. Similarily, in Sui Move a transaction declares what objects it accesses. Using Aptos Objects as basis for what is proposed here has been discussed. Arguably, the approach described here is closer to the core Move language, as it does not depend on library extensions like objects. The approach is also more general, as it allows a variety of different access patterns, including negation.


## Specification

### Source Language

The existing `acquires T` notation in Move is replaced by an extended syntax:

```move
fun f() acquires R { .. }                      // today: reads or write at any address; only local to module
fun f() reads M1::R writes M2::T { .. }        // new access kinds -- note reference to types from other modules
fun f<T> acquires R<T> { .. }                  // type instantiations supported
fun f() acquires 0x42::* { .. }                // wildcards
fun f(x: T) acquires *(address_of(x)) { .. }   // data dependency
fun f() acquires !0x1::* { .. }                // negation
fun f() pure { .. }                            // pure function, no accesses
```

If a function has multiple access clauses the interpretation is as follows: positive (non-negated) clauses build a union, and negative clauses an intersection. This in `reads A !writes B reads C !writes D` access is allowed if it is either a read of `A` or of `B`, _and_ if it is not a write of C and D.

### File Format

The existing `FunctionHandle` is extended by a field which contains an optional list of access specifiers. Each access specifier consists of a kind (read/write/..), a resource specifier, and an address specifier. Both those data types are chosen to represent the various forms of patterns as seen in the source language. For details, see the implementation.

### Semantics

#### Access Specifier Subsumption

The conceptual syntax of access specifiers is as follows:

```
AccessSpecifiers := { AccessSpecifier } 
AccessSpecifier := [ ! ] Kind ResourceSpecifier AddressSpecifier
ResourceSpecifier := * | Address::* | Address::Module::* | Address::Module::Resource [ TypeArgs ]
AddressSpecifier := * | Address | Parameter | Function Parameter
Kind := acquires | reads | writes
```

The basic function specifying the semantics of access specifiers is _subsumption_ (denoted as `>=` here). One list of access specifier subsumes another one if all access allowed in the other are also allowed in the subsuming one. For `ResoureSpecifier` this looks as below. Notice that transitivity of subsumption is assumed:
```
*         >=     _
A::*      >=     A::M::*
A::M::*   >=     A::M::R
A::M::R   >=     A::M::R<TS>
```

Subsumption for `AddressSpecifier` is similar but depends on an environment to obtain values for parameters and specific functions for them. Assume this environment is called `E`:

```
*         >=     _
x         >=     y       iff E(x) == E(y)
f(x)      >=     g(y)    iff E(f(x)) == E(g(y))
```

Notice that the functions which are allowed in address specifiers are selected from a small set of well-known builtins, like e.g. obtaining the address of a signer or of an Aptos object. No arbitrary Move code is executed.

Given the subsumption, one can now define a function to test whether given pair of resource and address is covered by an access specifier:

```
(R, A) in S  iff  S.resource >= R  &&  S.address >= A        where S is a ResourceSpecifier  
```

#### Runtime Evaluation

At runtime, a stack of saved access specifiers is maintained as well as an active access specifier. When a function which has access specifiers is entered, the current active set is saved to the stack. Then its value is _joined_ (denoted here as `*`) with that of the current function. If the result of the join does not subsume the specifier of the called function, execution aborts, as the called function has accesses which are not allowed in the context. Otherwise, the resulting join is the new active access specifier.: 

```
access_stack.push(active_accces)
active_access = active_access * function_access
let call_allowed = new_access.subsumes(function_access)
if !(active_access >= function_access) {
    abort
}
```

Whenever a resource is accessed (move_to, move_from, exists, borrow_global, borrow_global_mut), this operation is compared to the currently active access specifier set, and execution aborts if the access is not allowed.

Note that unless trust boundaries are concerned (transactions and public functions), we rarely expect users to write access specifiers, so the stack is not expected to become very deep in average. 

#### Gas Cost

Access specifiers need to be metered, also to prevent their misuse. This is different from how Aptos currently treats paranoid mode. Because this feature adds additional utility to users, metering is justified.

#### Compatibility

Since access specifiers are encoded in the `FunctionHandle` instances which are copied from imported modules, they get outdated when the dependency is upgraded. The compatibility rule for upgrade is that access specifiers can only be constrained, that is `S_v1 >= S_v2 >= ...`


## Reference Implementation

See [PR #10480](https://github.com/aptos-labs/aptos-core/pull/10480) for the compiler implementation.

See [PR #10544](https://github.com/aptos-labs/aptos-core/pull/10544) for the VM implementation.

## Testing

The behavior of access specifiers can be well tested with unit tests. Significant coverage is expected. 


## Risks and Drawbacks

Risks specifically include developer adoption and engineering complexity. This feature need to be well documented with intuitive examples. We may also build tools which allow to derive access specifiers for public functions automatically, easing the effort.

## Future Potential

### Static Analysis

Static analysis can be implemented gradually -- that means not all aspects need to be evaluated at compile time. However, as better the static analysis is, as better the user experience.

For static analysis, it is likely required to make access specifiers for public functions mandatory. Otherwise, it becomes technical infeasible.

A standard inter-functional data flow analysis should be capable of computing accesses. It would then produce errors, similar as the acquires check in the current language version:

- if resources are accessed which are not allowed in the current context
- if a function is called which accesses more resources than allowed in the context
- if an access specifier declaration is incomplete

### Higher-Order Functions

Higher-order functions called across trust boundaries can be made safer using access specifiers. To this end, the function type can specify access specifiers. Example:

```move
module myaddr::m {
  public entry fun transfer_with_callback(
     s: signer, ..., 
     call_back: ||() !acquires myaddr::*, *(address_of(s))
  ) 
  { .. }
}
```
The function type `||()` is annotated such that the function passed in cannot access any resource declared in the module or published under the address of the signer. This effectively prevents re-entrance. In general, given a function type `f: |T|R S` with `S` an access specifier, the typing rules require that for any passed function argument of type `|T|R S'`, `S >= S'`.

## Timeline

### Suggested implementation timeline

This is expected to be implemented by EOY '23. However, the availability for public consumptions depends on the readiness of the new Aptos Move compiler.

### Suggested developer platform support timeline

Together with the new Aptos Move Compiler.

### Suggested deployment timeline

Together with the new Aptos Move Compiler.

## Security Considerations

This feature is security critical since auditors and tools need to be able to assume that access specifiers work as expected. Testing need to be exhaustive. Also auditing of the runtime parts is required. Potential security risks to consider for the runtime access control check, besides functional correctness:

- Can the check take extraordinary long and lead to a DoS?
- If construction of data types is involved, can RAM be exhausted?


## Open Questions

- Should we differentiate more access types (in addition to read/write `move_to` and `move_from`)?
- Should access specifiers for public functions be made mandatory moving forward (with some grandfathering approach)?

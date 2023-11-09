---
aip: 56
title: Resource Access Control
author: wg@aptoslabs.com
discussions-to (*optional): TODO
Status: Draft 
last-call-end-date (*optional): <mm/dd/yyyy TBD>
type: Standard
created: <10/11/2023>
---

# AIP-56 - Resource Access Control
  
## Summary

In Move, functions can access arbitrary resources as long as they have access to public APIs allowing to manipulate the resource. There are multiple problems with this, as discussed in the [Motivation](#Motivation) section. This AIP proposes an extension to the Move language which allows for fine-grained access control of resources. This is achieved by generalizing the familiar `acquires T` declaration in Move in a downwards compatible way. The evaluation of the resulting access control discipline is primarily _dynamic_, but intended to become static in the future. The dynamic-first approach is natural because the redundancy principle of "paranoid" VM mode makes a dynamic check necessary anyway.

### Goals

This AIP intends to achieve the following:

- Have an organic extension of the Move language to support access control, which is fully downwards compatible
- Enable new strategies for parallelization and sharding
- Increase confidence in the effects of transactions and functions for users and auditors by access control declarations
- Enable safe dynamic dispatch by making access control part of a type.

### Out of Scope

This feature will only be supported in the upcoming Aptos Move compiler (AMC, aka "compiler v2").

Static analysis of access control will initially not be implemented, but is expected to be ready when AMC gets out of beta.

## Motivation

A Move function can read, write, and create arbitrary resources as long as it has access to the module APIs which allow this, and is in possession of a signer. There are multiple problems with this:

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

If a function has multiple access clauses the interpretation is as follows: positive (non-negated) clauses build a union, and negative clauses an intersection. Therefore, in `reads A !writes B reads C !writes D`, access is allowed if it is a read of either `A` or of `B`, _and_ if it is not a write to `C` and `D`. For details, see the [Semantics](#semantics) section.


### File Format

The existing `FunctionHandle` is extended by a field which contains an optional list of access specifiers. Each access specifier consists of a kind (read/write/..), a resource specifier, and an address specifier. Both those data types are chosen to represent the various forms of patterns as seen in the source language. For details, see the implementation.

### Semantics

#### Access Specifier Subsumption

The conceptual syntax of access specifiers is as follows:

```
AccessSpecifier := { AccessSpecifierClause } 
AccessSpecifierClause := [ ! ] Kind ResourceSpecifier AddressSpecifier
ResourceSpecifier := * | Address::* | Address::Module::* | Address::Module::Resource [ TypeArgs ]
AddressSpecifier := * | Address | Parameter | Function Parameter
Kind := acquires | reads | writes
```

The basic function specifying the semantics of access specifiers is _containment_ (denoted as `in` here). For the semantics, it is assumed that address specifiers depending on parameters or functions over parameters have been resolved to a concrete address, based on the concrete arguments of the function. In the below definition, `K` stands for an access kind (reads, writes, acquires), `A` for a module address, `M` for a module name, `R` for a resource name, `<T>` for a type instantiation, and `X` for a resource address. Moreover, small letter `a` for a full access, and `s1` and `t1` for access specifier clauses:

```
K A::M::R<T>(X)   in *
K A::M::R<T>(X)   in A::*           
K A::M::R<T>(X)   in A::M::*       
K A::M::R<T>(X)   in A::M::R      
K A::M::R<T>(X)   in A::M::R<T>
K A::M::R<T>(X)   in A::M::R<T>(X)
a                 in s1, s2, .., !t1, !t2, ..
                    iff (a in s1 or a in s2 or ..) 
                         and not (a in t1) and not (a in t2) and not ..
```



Based on containment, two other operators are of relevance: join (denoted as `*`) and subsumption (denoted as `>=`). In set-oriented terms, join is intersection, and subsumption superset. The definition is as follows:

```
forall s1, s2:     s1 >= s2       <==> (forall a: a in a2 ==> a in a1)
forall s1, s2, s:  s == s1 * s2   <==> (forall a: a in s <==> a in s1 and a in s2) 
```


#### Runtime Evaluation

At runtime, a stack of saved access specifiers is maintained as well as an active current access specifier. When a function which has access specifiers is entered, the current active set is saved to the stack. Then its value is _joined_ (the `*` operator above) with that of the current function. If the result of the join does not subsume the specifier of the called function, execution aborts:

```
access_stack.push(active_accces)
active_access := active_access * function_access
let call_allowed := active_access.subsumes(function_access)
if !(active_access >= function_access) {
    abort
}
```
Notice that we cannot just always abort when entering a function which potentially has disallowed accesses for two reasons:

- The function many not have any specifiers at all. In this case, the `active_access` stays unmodified at function entry, and the actual accesses are checked as they occur.
- The implementation of subsumption (`>=`) is allowed to be an over-approximation. This stems from the presence of negation in specifiers, for which subsumption check is hard. Thus, we may not be able to decide `active_access >= function_access`. This case is semantically still sound because, similar with functions with no specifiers at all, accesses are still checked as they occur.

During execution, whenever a resource is accessed (move_to, move_from, exists, borrow_global, borrow_global_mut), this operation is checked against the currently active access specifier, and execution aborts if the access is not allowed.

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

---
aip: 56
title: Resource Access Control
author: wg@aptoslabs.com
discussions-to (*optional): 
Status: v2 
last-call-end-date (*optional): 
type: Standard
created: <10/11/2023>
---

# AIP-56 - Resource Access Control 
  
## Summary

In Move, functions can access arbitrary resources as long as they have access to public APIs allowing to manipulate the resource. There are multiple problems with this, as discussed in the [Motivation](#Motivation) section. This AIP proposes an extension to the Move language which allows for fine-grained _resource access control_ (*RAC*) of resources, which is evaluated dynamically at runtime. 

### Goals

This AIP intends to achieve the following:

- Have an extension of the Move language to support resource access control as a runtime check.
- Increase confidence in the effects of transactions and functions for users and auditors by access control declarations.
- Enable new strategies for parallelization and sharding.

### Out of Scope

Static analysis for access control is possible as a future extension but is out of scope for the MVP.

## Motivation

A Move function can read, write, and create resources as long as it has access to according module APIs, and is in possession of a signer or associated address. There are multiple problems with this:

- It has been identified in the past as a security risk. For example, a transaction that obtains a
  signer from the user for a particular purpose in a given contract, can use that signer for any other contract in the system.
- It is difficult to reason about side effects of functions and transactions. This is both the case for auditors as for formal analysis like the Move prover. The only way to reason is to look at the code.
- Since looking at code is the only way to reason about effects, _calling unknown_ code (dynamic dispatch across trust boundaries) is less safe.
- Unspecified read/write behavior of transactions makes it harder to parallelize execution and to implement sharding strategies.

## Impact

This AIP will increase the ability for users and contracts to control which resources are be accessed, enhancing security guarantees in Move. It will also enable new strategies for parallel execution of Move.


## Alternative solutions

In Solana, a transaction must declare upfront the accounts it reads or writes from. Similarly, in Sui Move a transaction declares what objects it accesses. Arguably, the approach described here is closer to the core Move language, as it does not depend on library extensions like objects. The approach is also more general, as it allows a variety of different access patterns.


## Specification

### Source Language

The language is extended by resource access control clauses attached to a function declaration. Here are some examples:

```move
fun f() reads R { .. }                         // reads the resource R 
fun f() reads M1::R writes M2::T { .. }        // reads R and writes T -- note reference to other modules
fun f<T> reads R<T> { .. }                     // type instantiations supported
fun f() writes 0x42::* { .. }                  // wildcards
fun f(x: T) reads *(address_of(x)) { .. }      // data dependency
fun f() writes !0x1::* { .. }                  // negation
fun f() pure { .. }                            // pure function, no accesses
```

If a function has multiple access clauses the interpretation is as follows: positive (non-negated) clauses build a union, and negative clauses an intersection. Therefore, in `reads 0x42::* reads 0x43::* !reads 0x42::A !reads 0x42::B`, access is allowed for any resource declared _either_ at address `0x42` or at address `0x43`, but not resources `A` _and_ `B`, respectively. For details, see the [Semantics](#semantics) section.


### File Format

The existing `FunctionHandle` is extended by a field which contains an optional list of access specifier clauses. Each clause consists of a kind (read/write/..), a resource specifier, and an address specifier. Both those data types are chosen to represent the various forms of patterns as seen in the source language and in the semantics below.

### Semantics

#### Access Specifiers

The conceptual syntax of access specifiers is specified as follows:

```
AccessSpecifier := { AccessSpecifierClause } 
AccessSpecifierClause := [ ! ] Kind ResourceSpecifier AddressSpecifier
ResourceSpecifier := * | Address::* | Address::Module::* | Address::Module::Resource [ TypeArgs ]
AddressSpecifier := * | Address | Parameter | Function Parameter
Kind := reads | writes
```

The above syntax contains a dependency from runtime information, namely from the value passed in via a parameter of the executing function, optionally with a well-known function application (as for example `fun f(s: &signer) reads R(address_of(s))`). For the further semantic definition it is assumed that references like this are replaced by the literal address value.

The semantics is then described by a number of relations which associate access specifiers with basic runtime events (like borrowing of a resource). First the `allows` relation defines how a list of access specifiers clauses is broken down:

```
c1, ..., cn, !e1, ..., 3n  allows EVENT
  iff     (c1 enables EVENT or ... or cn enables EVENT)
      and (!(e1 disables EVENT) and .. and !(en disables EVENT)
```

The next definition describes how a single access specifier clause enables a given event (based on a `matches` relation for the remaining part of the specifier as defined later on):

```
read r   enables   BORROW x       iff   x matches r
write r  enables   BORROW x       iff   x matches r
write r  enables   BORROW_MUT x   iff   x matches r
write r  enables   MOVE_FROM x    iff   x matches r
write r  enables   MOVE_TO x      iff   x matches r
```

The `disables` relation used for negated clauses flips the interpretation for read/write: here `!reads` disables both reads and writes, whereas `!writes` only disables write:

```
!read r  disables  BORROW x       iff   x matches r
!read r  disables  BORROW_MUT x   iff   x matches r
!read r  disables  MOVE_FROM x    iff   x matches r
!read r  disables  MOVE_TO x      iff   x matches r
!write r disables  BORROW_MUT x   iff   x matches r
!write r disables  MOVE_FROM x    iff   x matches r
!write r disables  MOVE_TO x      iff   x matches r
```

Finally, the `matches` relation describes how resource and address specifier are matched against events. Here, `A` is an address, `M` a module name, `R` a struct name, `<T>` a type instantiation, and `X` an address again.

```
A::M::R<T>(X)   matches   *      
A::M::R<T>(X)   matches   A::*   
A::M::R<T>(X)   matches   A::M::*       
A::M::R<T>(X)   matches   A::M::R      
A::M::R<T>(X)   matches   A::M::R<T>
A::M::R<T>(X)   matches   A::M::R<T>(X)
```


#### Runtime Evaluation and Complexity

At runtime, a stack of access specifiers is maintained. When a function which has declared an access specifier is entered, that specifier is specialized for the function parameters, and pushed on top of the stack. When it is exited, the specifier is removed from the top.

Any BORROW, BORROW_MUT, MOVE_FROM, or MOVE_TO in the executed code has to be in the `allows` relation defined above for _all specifiers currently on the stack_. That means, a function call can only further constraint the access restrictions which are already recorded on the stack, but never loosens.

In terms of complexity and gas semantics, for each of the accesses above the access stack is walked from the top to the bottom (evaluating inner specifiers first) until a specifier is found which does not allow the access. Let the number of clauses in a specifier on the stack be N, then the specifier can be evaluated in O(N) -- that is the behavior is linear over the number of clauses.


## Testing

The behavior of access specifiers can be well tested with unit tests. Significant coverage is expected. 

## Reference Implementation

The v1 of the feature has been implemented but not enabled since a while. The below PRs update the feature to the current v2:

<blockquote><a href="https://app.graphite.dev//github/pr/aptos-labs/aptos-core/16092?ref=gt-pasteable-stack">#16092 [move-vm][rac] Bytecode verification</a> <code>+161/-6</code><br /><a href="https://app.graphite.dev//github/pr/aptos-labs/aptos-core/16081?ref=gt-pasteable-stack">#16081 [move][rac] Revising resource access control</a> <code>+3662/-14786</code></blockquote>


## Risks and Drawbacks

Risks specifically include developer adoption and engineering complexity. This feature need to be well documented with intuitive examples. We may also build tools which allow to derive access specifiers for public functions automatically, easing the effort.



## Future Potential

### Higher-Order Functions

Higher-order functions as introduced in [AIP-112](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-112.md) and called across trust boundaries can be made safer using access specifiers. To this end, the untrusted code can be wrapped into a function with a restrictive access specifier which augments the default reentrancy checker:

```move
module @myaddr::m {
  public fun do_work(..., callback: Callback) {
      ... 
      protected(callback)
      ...
  }
  fun protected(callback: Callback) !writes @myaddr::* { 
      callback()
  }
}
```

### BlockSTM

Read/Write set operations can be used as an over-approximation of the actual dynamic sets for BlockSTM. It may also be useful for horizontal sharding.

## Timeline

Testnet 1.29 or 1.30

## Security Considerations

This feature is security critical since auditors and tools need to be able to assume that access specifiers work as expected. Testing need to be exhaustive. Also auditing of the runtime parts is required. Potential security risks to consider for the runtime access control check, besides functional correctness:

- Can the check take extraordinary long and lead to a DoS?
- If construction of data types is involved, can RAM be exhausted?

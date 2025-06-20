---
aip: 56
title: Resource Access Control
author: wg@aptoslabs.com
discussions-to (*optional): 
Status: Draft 
last-call-end-date (*optional): 
type: Standard
created: <10/11/2023>
updated: <03/27/2025>
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

Programmatic APIs for access control are highly desirable to enable apps to offer UI level access to configure RAC, but are out of scope for this AIP.

## Motivation 

### Problem

Move code can read and write arbitrary resources on chain as long as it has access to according APIs. The main mechanism in Move to protect against unauthorized access is modular encapsulation and APIs which protect themselves via some kind of authorization tokens (e.g. `&signer`). This is _software protection_ which is not enforced by any specific logic in language and VM.

The main problem with this approach is that it is based on an implicit 'trust' assumption that the code being called has no security bugs and does not depend on any third-party code with such bugs, or even code which orchestrates malicious attacks (think of reentrancy style attacks). Specifically the `&signer` model is problematic because of the virtual unlimited access rights it provides. Even though with the introduction of [permissioned signers (AIP-103)](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-103.md) the unrestricted powers of signers can be tamed, the fundamental problem remains the same. 

To illustrate why AIP-103 does not solve the problem, consider this piece of code:

```move
// Checks whether the signer has permission to read, aborts if not
let addr = permissioned_signer.check_and_get_read_address();
// Now as we have the address, we can do anything with it, including writing...
R[addr] = value; 
```

This example shows that even permissioned signers are eventually based on trusting the executed code to do the right thing.  

### Basic Approach

This AIP suggest a new, 'hard' access control model for Move, which is enforced by the VM. The model is envisioned to be used for multiple scenarios, as outlined in the sections below. Since the model adds a fundamentally new capability to the language and VM, more scenarios may be discovered in the future.

The RAC model is semantically simple. Each function declaration (entry point or regular function) can have an associated set of RAC clauses. There are read and write clauses, as well as negation. During execution, when a function with RAC clauses is entered, the clauses are pushed on a stack of RACs, and removed once the function exits. If a function does not have RACs, the stack does not change. At any point, when a resource is immutably borrowed, every RAC on the stack must allow read access, and when a resource is mutably borrowed or moved in/out of storage, every RAC must grant write access. Thus, each call on the stack can only further restrict, but not widen granted accesses.

The clause language will be discussed later, but here is a basic example:

```move
entry fun f() write app::* read * { .. }
```

This will restrict any code executed for entry `f` to write resources under the app address, and read anywhere else, but not to write. (Note that reads/writes at system addresses `0x1..0xff` are exempted from RAC.)

In practice, many use cases will have only a RAC stack of size 1, with the outermost (entry) functions clauses, and that function may well be generated on client side by the script composer, based on user preferences. However, reentrancy and dynamic dispatch can lead to multiple levels of RACs being active.

RAC restricts reading and writing resources declared at given addresses. But is there also a need to restrict which code can be executed? Currently, the assumption is that custody of resources and the code which needs to be trusted to protect those resources are in the same package (code address), so protecting the resource reads and writes is sufficient. However, if needed the model can be easily extended to allow restricting which code can be executed.

### Use case 1: User Trust Boundaries

Assume a user wants to perform large trades via a DEX on a regular basis which are backed by an APT lending service. Regularly here means, either frequently calling the same transaction, or delegating a signer to the DEX. This user may have once simulated the transaction, or even looked at the code. But code can be upgraded on Aptos, and simulation is incomplete.

With RAC, this user can now define _trust boundaries_ in terms of package addresses they consider trustworthy. For example, the user specifies that the DEX and a particular lender, known to be used by the DEX, is trustworthy to them. In the below example, we use RAC on script source level to express this. In practice, this code would be generated by an app via the script composer, and the user would actually use a UI to specify the given package addresses, similar as e.g. with OAuth:

```move
script {
  fun main(s: &signer)
        writes dex::*, lender::*  // Only specific code is trusted to write
        reads *                   // Everybody can read
  {
    dex::do_stuff(s)
  }
}
```

This approach shifts the user's mental security model away from harder to understand techniques like simulation or code inspection to trusting specific entities. 

What happens if `dex` decides to switch to a different lender, upgrading its code? The expected DevX in such a scenario is as follows. When the user tries to execute the transaction after the lender change, it fails with a clear error message like 'additional authorization required for XYZ'. The user should then have an easy way to authorize this address as well. At this point, he can make an informed decision whether to trust the new lender (or not) and allow `dex` to pass on his signer to them. This scenario (of the failing transaction with the new lender after upgrade) is intended and the point of using RAC in this case.


### Use case 2: App Trust Boundaries

This use case is similar like use case 1, with the difference that the trust boundary is not defined by a user, but by an app. 

Consider an app which manages many assets which are registered via stored function values (dynamic dispatch, [AIP-112](https://github.com/aptos-foundation/AIPs/blob/main/aips/aip-112.md)). Whenever the app calls into any of those asset function, it wants to ensure that the asset functions cannot modify any of the app related state. While Move has reentrancy detection for resource access on module level, it does not have it on package level. (Since this would be too restrictive and forbid many other programming patterns with function values.)

With RAC this can be achieved as follows:

```move
module app::m {
    fun sum_of_balances(assets: &vector<Asset>): u64 {
        let sum = 0;
        assets.foreach_ref(|a| sum += get_balance(a.balance_fun));
        sum
    }

    fun get_balance(balance_fun: ||u64) !reads app::* {
        // not allowed to read or write any app data during dynamic dispatch
        balance_fun()
    }
}
```

### Use case 3: Static Parallelism

RAC also allows to express more fine grained access control which can be used to specify static parallelism similar as in Sui Move or on Solana. One can specify the allowed reads/write of resources in dependency of a runtime parameter. This allows to dynamically determine the allowed access. In the below example, the entry function is restricted to only read/write resources of particular owners (and the Aptos framework which is implicitly allowed):

```move
entry fun transfer(from: &signer, to: address) reads *(signer::address_of(from)) writes *(to) {
    ..
}
```

Similar as via Sui's objects or Solana's account model, this allows to determine the read/write set of a transaction/argument pair, and can be used for sharded parallel execution or for seeding BlockSTM. However, it has also similar restrictions as those models: order book style designs where the access is not known upfront, or in general designs which are heavily based on tables indexed by account addresses, cannot be expressed naturally this way. However, there maybe many simpler transactions (e.g. transfers) benefiting from this.

For BlockSTM, also more coarse grained RAC clauses can be instrumented to guess the initial order of execution, minimizing re-execution.

Moreover, since RAC allows to represent data dependencies in clauses, it can also be a suitable representation for automatic inference of read/write sets via program analysis. 

The use case of static parallelism is out-of-scope for this AIP and requires further investigation, but is worth mentioning for future potential.


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

---
aip: 73
title: Dispatchable Token Standard
author: Runtian Zhou
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): 04/08/2024
type: Framework
created: 03/08/2024
---

# AIP-73 - Dispatchable token standard

## Summary

Right now the Aptos Framework defines one single `fungible_asset.move` as our fungible asset standard, making it hard for other developers to customize the logic they need. With this AIP, we hope that developers can define their custom way of withdrawing and deposit for their fungible asset, allowing for a much more extensible way of using our Aptos Framework.


### Goals

The goal is to allow for third party developers to inject their custom logic during fungible asset deposit and withdraw. This would allow for use cases such as:

1. Deflation token: a fixed percentage of token will be destructed upon transfer.
2. Transfer allowlist: token can only be transfered to addresses in the allow list.
3. Predicated transfer: transfer can only happen when some certain predicate has been met.
4. Loyalty token: a fixed loyalty will be paid to a designated address when a fungible asset transfer happens

Note that all the logics mentioned above can be developed and extended by any developer on Aptos! This would greatly increase the extensivity of our framework.

### Out of Scope

We will not be modifying any core Move VM/file format logic. We will use this AIP as the predecessor work for the future dynamic/static dispatch we are planning to support in the future Move versions.

The AIP here can potentially be applied to our NFT standard as well. However, we are not going to worry about such use case in the scope of this AIP.

## Motivation

Right now the Aptos Framework governs the whole logic of what fungible asset means, and every defi module will need to be statically linked against such module. We probably won't be able to meet the various functionality need coming from all of our developers, so an extensible fungible asset standard is a must on our network.


## Impact

We want to offer token developers the flexibility to inject customized logic during token withdraw and deposit. This would have some downstream impact to our defi developers as well.

## Alternative solutions

We are using this AIP as the precurssor work of the future dispatch support in Move on Aptos. So we will have a limit scoped dispatch function implemented via a native function instead of a full set of changes in Move compiler and VM so that we will have more time to assess the security implication of dispatching logic in Move.

For the proposed `overloaded_fungible_asset.move`, another alternative solution would be to add the dispatch functionality directly in the existing `fungible_asset.move`. However, that would be pretty unusable right out of the box with the existing runtime rule proposed. In order for such dispatch function to be usable, we need an exception for the runtime safety rule where re-entrancy into `fungible_asset.move` is allowed. This would require the framework developers to be particularly cautious about the potential re-entrancy problem.

## Specification

We will be adding two modules in the Aptos Framework.

- `function_info.move`. This module will simulate a runtime function pointer that could be used as dispatching. The module will look like the following:
```
struct FunctionInfo has copy, drop, store {
    module_address: address,
    module_name: string,
    function_name: string,
}

public fun new(
    module_address: address,
    module_name: string,
    function_name: string,
): FunctionInfo

// Check the function signature of lhs is equal to rhs.
// This could serve as the type checker to make sure the dispatcher function have the same type as the dispatching function
public(friend) native fun check_dispatch_function_info_compatible(
    lhs: &FunctionInfo,
    rhs: &FunctionInfo,
): bool;
```

- `overloaded_fungible_asset.move`. This module will serve as the new entry point for the fungible asset. This module will serve as the wrapper module of our existing `fungible_asset.move` and have similar api. The reason why we need an extra module instead of adding the dispatch logic in `fungible_asset.move` is because of the runtime rule mentioned below. The module will have the following api:
```
#[resource_group_member(group = aptos_framework::object::ObjectGroup)]
struct WithdrawalFunctionStore has key {
    // Each distinct Metadata can have exactly one predicate
    function: FunctionInfo
}

// Dispatchable call based on the first argument.
//
// MoveVM will use the FunctionInfo to determine the dispatch target.
native fun dispatchable_withdraw(
    function: &FunctionInfo,
	// security conversation: Do we need this owner field here?
    owner: [address,&signer],
    store: Object<T>,
	amount: u64,
): FungibleAsset;

// The dispatched version of withdraw. This withdraw will call the predicate function instead of the default withdraw function in fungible_asset.move
public fun withdraw<T: key>(
    owner: &signer,
    store: Object<T>,
    amount: u64,
): FungibleAsset acquires FungibleStore

// Store the function info so that withdraw can invoke the customized dispatchable_withdraw
public fun register_withdraw_epilogue(
    owner: &ConstrutorRef,
    withdraw_function: FunctionInfo,
)
```


There will also be a new Runtime checks in the Move VM:
- For every new frame added to the call stack, the MoveVM will need to make sure that this function cannot form a back edge in the call graph. Specifically, if a function in module A calls module B, essentially leaving its own scope, there cannot be another function call to functions in module A, until this function in module B returns, so that we are back into module A’s scope.

This runtime check is needed because of the possible re-entrancy problem that could be enabled by this AIP. This check will not fail on any existing Move programs on chain. See the security discussion for why we need such runtime check.

## Reference Implementation

Not implemented yet.

## Risks and Drawbacks

The biggest risk here is the potential re-entrancy problem that could be introduced by the dispatching logic. See security consideration section for details.

## Security Considerations

### Current State of Move's Re-entrancy and Reference safety
The biggest security concern is how this could change the re-entrancy and reference safety story of Move. Before we jump into the problem, let's take a look at a couple of Move design goals:

1. Reference safety: at any given time there can only be exactly one mutable reference to any value, or multiple immutable reference.
2. Re-entrancy safety: A reentrancy attack occurs when a contract is called multiple times within a single transaction, potentially allowing the contract to re-enter itself before completing prior operations. This can lead to unexpected behavior and potentially exploit vulnerabilities in the contract's logic, allowing malicious actors to manipulate funds or disrupt the intended operation of the contract.

Note that these two properties are being enforeced by the Move bytecode verifier, which is a static analysis done at module publishing time so any module that violates such properties will be rejected right away at module publishing time. The question is how do we actually reason about the two safety properties in the Move bytecode verifier?

First important assumption made by the Move bytecode verifier is that the dependency graph of any Move program has to be acyclic, meaning that two modules cannot mutually depends on each other, directly or transitively. There is a specific check for this property when a module is published. This leads to an important observation: if a module A invokes a function defined in another module B, such function will have no way of invoking any functions defined in module A because of the acyclic property. So consider the following program:

```
public fun supply(): u64 acquires Lending {
  borrow_global<Lending>(@address).supply
}

public fun borrow(amount: u64) {
  let supply = supply();
  
  // call functions from other module
  another_module::bar();
  
  supply += amount;
  set_supply(supply)
}
```

With the acyclic property, the move bytecode verifier knows that `another_module::bar()` will have no way of invoking other functions that could mutate the `supply` field in the `Lending` resource. Thus, the only way of mutating the `Lending` resource is to invoke functions that are defined in your own modules, and Move bytecode verifier will perform a static anaylsis to make sure that there won't be two mutable references. Specifically we can look into the following examples:

```
module 0x1.A {
    import 0x1.signer;
    struct T1 has key {v: u64}
    struct T2 has key {v: u64}

    // all valid acquires

    public test1(account: &signer) acquires T1, T2 {
        let x: &mut Self.T1;
        let y: &mut u64;
    label b0:
        x = borrow_global_mut<T2>(signer.address_of(copy(account)));
        _ = move(x);
		// Acquireing T2 is safe because x has been dropped.
        Self.acquires_t2(copy(account));
        return;
    }

    public test2(account: &signer) acquires T1, T2 {
        let x: &mut Self.T1;
        let y: &mut u64;
    label b0:
        x = borrow_global_mut<T1>(signer.address_of(copy(account)));
				// Acquireing T2 is unsafe and will be rejected by the bytecode verifier
        Self.acquires_t2(copy(account));
        return;
    }

    public test3(account: &signer) acquires T1, T2 {
        let x: &mut Self.T1;
        let y: &mut u64;
    label b0:
        x = borrow_global_mut<T1>(signer.address_of(copy(account)));
		// Calling into an external function is safe because of the acyclic property.
        aptos_framework::....
        return;
    }

    acquires_t2(account: &signer) acquires T2 {
        let v: u64;
    label b0:
        T2 { v } = move_from<T2>(signer.address_of(move(account)));
        return;
    }
}
```

In all test functions mentioned above, once a mutable reference has been borrowed, the bytecode verifier will make sure that subsequent reference can be borrowed only after the first mutable reference has been dropped. In `test1`, calling into `acquires_t2` will be allowed because the mutable reference has already been dropped. In `test2`, however, calling into `acquires_t2` will be strictly forbidden and module containing such code won't be publishable, as the mutable reference is still be held when `acquires_t2` trying to get another reference. In `test3` however, because of the acyclic property of Move dependencies mentioned abover, the Move bytecode verifier can statically assume that this function call will not be able to invoke functions that can generate references to states that you are currently holding. Thus the bytecode verifier will simply treat this call as a no-op during the static analysis.

### How would any dispatching logic changes the story here?

The biggest assumption that dispatching would break is that the Move bytecode verifier can no longer assume that a function can only invoke another function that has already been published. As a result, the important acyclic property that is crucial to Move's reference safety property and re-entrancy property would be broken. Considering the following example:

```
public fun borrow(amount: u64) {
  let supply = borrow_global_mut<Lending>(@address).supply
  
  // Call into the dispatch version of fungible asset.
  //
  // MoveVM will direct control flow to the `dispatchable_withdraw` function mentioned above.
  aptos_framework::overloadable_fungible_asset::withdraw()
  
  supply += amount;
  set_supply(supply)
}

public fun dispatchable_withdraw(...) {
    // Two mutable references created
	let supply_2 = borrow_global_mut<Lending>(@address).supply
    
}
```
In this example, the bytecode verifier has no idea that the call into `aptos_framework::overloadable_fungible_asset::withdraw()` will go back into the `dispatchable_withdraw` function defined in the same module. Thus it would have no idea that when `supply_2` is borrowed, there's an existing mutable reference in `supply_1` already, which effectively break the reference safety assumption of Move.

Here's another slightly problematic example about re-entrancy:

```
#[view]
public fun supply(): u64 acquires Lending {
  borrow_global<Lending>(@address).supply
}

public fun borrow(amount: u64) {
  let supply = supply();
  
  // call functions from other module
     ()
  
  supply += amount;
  set_supply(supply)
}

public fun dispatchable_withdraw(...) {
    // Mutate the supply field
    ...
}
```
In this case, the reference safety property of Move is held, as the reference to `Lending` is already destructed after the `supply()` call. However, the code is still problematic. In the current Move setup, calling into functions defined in another module will have no way of mutating states that you care about. As a result, you only need to reason about local functions that can mutate those states. Such assumption will no longer be held with the introduction of dispatching. This could add huge overhead for smart contract developers to reason about their code's re-entrancy properties.

### Proposed solution: new runtime checks for cyclic dependencies.

In the analysis above, we demonstrated how acyclic assumption plays an important role in Move's static reference safety analysis and re-entrancy property. In the worst case scenario, developers will be able to create multiple mutable references to the same global value without being complained by Move's bytecode verifier. As a mitigation, we suggest we need to enforce such property at runtime. Meaning that  function cannot form a back edge in the call dependency graph. In the re-entrancy problem example, the call stack will look like following:

```
[
    some_module::borrow,
    aptos_framework::overloadable_fungible_asset::withdraw,
    some_module::dispatchable_withdraw,          <-- backedge formed. As `some_module` is already on top of the call stack 
]
```

The runtime rule will cause the program to abort when `dispatchable_withdraw` is pushed onto the call stack. Other blockchain systems have similar runtime checks for module-level re-entrancy problem. One thing to note here is that this check can never fail on any of our existing Move code because we've already checked for this property when a module is published. Such check can only fail with the introduction of the dispatching mechanism.

A downside of such runtime check is that it makes it very hard to integrate the dispatch function directly in `fungible_asset.move`. The reason is that one could imagine that the dispatched withdraw function might need to invoke functions defined in `fungible_asset.move`. In the deflation token example, the developer will most likely need to call the split and burn functions in `fungible_asset.move`. If the `withdraw` api is added in `fungible_asset.move`, the call stack will look like the following:

```
[
    A::some_function
    aptos_framework::fungible_asset::withdraw,
    third_party_token::dispatchable_withdraw,
    aptos_framework::fungible_asset::split,     <-- backedge formed. As `fungible_asset` is already on top of the call stack 
]
```

This will be an immediate violation of the runtime check rule proposed above. To mitigate this issue, I would propose to move the dispatch entrypoint to a new module `overloadable_fungible_asset.move` instead of the existing `withdraw` api in `fungible_asset.move`. Another alternative is to make `fungible_asset.move` not vulnerable to this check, making a one-off exeception here. This would forces framework developers to reason about the re-entrancy property of `fungible_asset.move`, which wasn't a problem previously.

## Future Potential

We will utilize the lessons we learn from this AIP to help implement the high order function system in Move as suggested in the [future of Move on Aptos](https://medium.com/aptoslabs/the-future-of-move-at-aptos-17d0656dcc31#e1b1)

## Timeline

### Suggested implementation timeline

We are planning to implement the feature in the upcoming release.

### Suggested developer platform support timeline

N/A

### Suggested deployment timeline

We would want to implement it in 1.11 release.

 > Indicate a future release version as a *rough* estimate for when the community should expect to see this deployed on our three networks (e.g., release 1.7).
 > You are responsible for updating this AIP with a better estimate, if any, after the AIP passes the gatekeeper’s design review.
 >
 > - On devnet?
 > - On testnet?
 > - On mainnet?

...


## Open Questions (Optional)

We need some feedbacks on the public interface of the modules in the `overloaded_fungible_asset.move`. And see how this should work with `fungible_asset.move` properly.

...

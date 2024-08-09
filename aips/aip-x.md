---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Batched Execution Transaction
author: @runtian-zhou
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): 06/25/2024
type: Framework
created: 06/11/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Batched Execution Transaction
  

## Summary

Right now the users can interact with a Move contract via entry point function or script. Script can be a nice way of chaining multiple smart contract calls yet require users to compile scripts on their own end, which would be a problem for a light weight client setup.

This AIP Introduce a new type of transaction payload that allows users to construct a lightweight "script" like transaction block. This would allow users to construct transaction in a more flexible manner without having to have compiler on the client side.

### Out of Scope

The new payload type will need to be transactional, meaning that all succeed or abort semantics need to be followed.

## High-level Overview

Implement a new type of payload that chains a series of Move calls. For each call they can have raw bytes as input(as before) or select an output from a previous transaction.

## Impact

This would require changes in almost all infrastructure that we have, including:

1. (P0) SDK Support: we need to introduce new apis in the SDK to support generating this new type of payload.
2. (P0) Core node software: we will implement a command interpretation loop that execute calls one by one and check for the type and ability safety of Move.
3. (P1) Wallet: wallet need to be able to display the payload nicely for better useability.
4. (P1) Indexer: explorer need to be able to display the payload nicely for better visibility.
5. (P1) CLI: Have a way to construct such payload in our aptos cli.

## Alternative solutions

We could also build a Script compilation engine on the client side rather than implementing an interpretation logic on the node side. However this means we need to ship a compiler (or a tiny code generator) to compile such payload into a compiled Move script format. Given the various SDK we need to support (TypeScript/Python), it is pretty hard to maintain this in the longer term.

One possible approach is to build a tiny code generator in rust that takes dependency modules and payload, and generate the corresponding compiled bytecode. We could compile such binary into WASM and ship it with our typescript SDK.

## Specification and Implementation Details

The new payload type will look like following:

```
/// Arguments for each function.
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum BatchArgument {
    Raw(Vec<u8>),
    PreviousResult(u16, u16),
}

/// Call a Move entry function.
#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct BatchedFunctionCall {
    pub module: ModuleId,
    pub function: Identifier,
    pub ty_args: Vec<TypeTag>,
    pub args: Vec<BatchArgument>,
}

#[derive(Clone, Debug, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum TransactionPayload {
    ...
    /// New payload type that allowed chaining of calls.
    BatchedCalls(Vec<BatchedFunctionCall>),
}
```

The AptosVM will need to implement the interpretation logic to execute this chained calls and perform the type/ability checks required.

We also need to assess how this could impact our multisig transaction/multi agent transaction. In the implementation right now, the AptosVM follows the same signer creation rule as entry-point function, that is append appropriate signer when the callee function needs a signer. I'm not planning to change the signer generation process but in the future we might want to introduce the ability to specify the specific signer as argument rather than automatically append the signer.

## Reference Implementation

https://github.com/aptos-labs/aptos-core/pull/13559/files


## Risks and Drawbacks

See Security Considerations section.

## Security Considerations

We need to be extremely careful about the type, ability and reference safety here. The batched calls can pass values across different functions so it is crucial to make sure:
1. No type confusion can be made.
2. Ability of Move values need to be respected: cannot leave a non-droppable value not used.
3. Passing references should be forbided for now.

## Future Potential

With this new type of payload, users could do the following with this new transaction payload type:
1. Specify the max amount of token they are willing to spend per transaction by sandwich their function call with calls to read out the balance before executing the entry function and then check the balance after.
2. Composable NFT flow:
    - Buy an NFT and then tip artist's account
    - Buy and transfer an NFT to another user.
3. DEX aggregators: Instead of having large smart contracts with every possible combination of DEX and swap length/path, Aggregators could offer just single swap functions on each DEX and then combine them on-the-fly within the transaction batch.

## Timeline

### Suggested implementation timeline

The node software is already implemented. We are looking for getting this feature landed in mid July.

### Suggested developer platform support timeline

1. (P0) SDK Support: Mid July
2. (P0) Core node software: Mid July
3. (P1) Wallet: Mid August
4. (P1) Indexer: Mid July
5. (P1) CLI: Early August

### Suggested deployment timeline

With our current release cadance, 1.17 would be the target.


## Open Questions (Optional)

 > Q&A here, some of them can have answers some of those questions can be things we have not figured out but we should

...

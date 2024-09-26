---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: TBD
author: @runtian-zhou
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type:  Interface, Application
created: 09/24/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Intent Transaction Builder TBD
  
## Summary


Develop a new set of APIs in our SDKs to allow application builders to easily chain multiple Move operations in a single transaction.

### Out of Scope

In this AIP, we will focus solely on the transaction-building aspect. While this solution aims to enhance the composability of our ecosystem as part of the Aptos Intent standard, those standards will be proposed in future AIPs. This AIP will serve as a reference for those later efforts.

## High-level Overview

Currently, there are two ways to interact with the Aptos Blockchain:
- EntryFunction Payload: Developers need only specify the function name they want to invoke and pass the corresponding arguments to the SDK.
- Script Payload: Developers require a Move compiler to compile Move scripts into a compiled format, which is then used as the transaction payload.

These two approaches offer significantly different developer experiences. EntryFunctionPayload is easy to build using our provided SDK, but requires the developer to deploy the entry function to the blockchain upfront, limiting composability. Script Payload provides full expressivity, allowing developers to call and compose any on-chain Move functions. However, it requires the use of the full Move compiler, which may not be practical in a browser-based environment. Currently, the only practical way to use a script is to compile it once, store the compiled bytes in binary format, and use that format in the SDK on the client side.

Ideally, we want a solution that strikes a balance between these two approaches: allowing developers to easily compose Move functions in transactions on the client side without needing the entire Move compiler.

We present the Aptos Intent Transaction Builder to address this challenge. The transaction builder API will be integrated into the SDK, allowing developers to chain multiple Move calls into a single transaction. The builder will be implemented in Rust, which will generate compiled Move script bytes directly from a sequence of Move calls, without requiring the full Move compiler or source code. This builder will be bundled into WASM for seamless integration into our TypeScript SDK.

Additionally, we will introduce annotation logic to the indexer API so that the indexer/explorer can display the script in an intent format. This can be achieved by implementing a decompiler that reverse-engineers the code generation logic.

## Impact

Most of the changes will be in our SDK interfaces. This should significantly improve developer's experience to create transaction that invokes multiple Move function calls all at once. This would be particularly helpful for our defi developers as they would be able to implement features such as withdraw coin and put them into a lending protocol in one transaction.

## Alternative solutions

An alternative approach is to introduce a third payload type in our system and have the node software interpret this payload directly. While this could offer some performance improvements by bypassing the full bytecode verifier, it would require reimplementing several critical checks, such as type safety, ability constraints, and reference safety, that are already handled by the verifier. Duplicating this logic at the node level not only adds redundancy but also increases the risk of introducing security vulnerabilities.

## Specification and Implementation Details


We will be introducing the following APIs in the ts-sdk:

```
export type InputBatchedFunctionData = {
  function: MoveFunctionId;
  typeArguments?: Array<TypeArgument>;
  /* Function argument could either be existing entry function argument or come from the output of a previous function */
  functionArguments: Array<EntryFunctionArgumentTypes | BatchArgument | SimpleEntryFunctionArgumentTypes>;
};

export class AptosIntentBuilder {
    /* Move function calls can return values. Those values can be passed to other functions by move, copy or reference */
    async add_batched_calls(input: InputBatchedFunctionData): Promise<BatchArgument[]>;
}

/* Existing TransactionBuilder */
export class Build {
    async batched_intents(args: {
        sender: AccountAddressInput;
        builder: (builder: AptosIntentBuilder) => Promise<AptosIntentBuilder>;
        options?: InputGenerateTransactionOptions;
        withFeePayer?: boolean;
    }): Promise<SimpleTransaction>
}
```

With those new apis, developers can pass in a closure that builds up the Move call chains into one transaction. Here's an example:

```
const transaction = await _aptos.aptos.transaction.build.batched_intents({
    sender: singleSignerED25519SenderAccount.accountAddress,
    builder: async (builder) => {
    /* return_1 should contain the withdrawed Coin<AptosCoin> */
    let return_1 = await builder.add_batched_calls({
        function: `0x1::coin::withdraw`,
        functionArguments: [BatchArgument.new_signer(0), 1],
        typeArguments: ["0x1::aptos_coin::AptosCoin"]
    });

    /* return_2 should contain the converted FungibleAsset */
    let return_2 = await builder.add_batched_calls({
        function: `0x1::coin::coin_to_fungible_asset`,
        /* Pass the withdrawed Coin<AptosCoin> to the coin_to_fungible_asset */
        functionArguments: [return_1[0]],
        typeArguments: ["0x1::aptos_coin::AptosCoin"]
    });

    /* Deposit fungible asset into 
    await builder.add_batched_calls({
        function: `0x1::primary_fungible_store::deposit`,
        functionArguments: [singleSignerED25519SenderAccount.accountAddress, return_2[0]],
        typeArguments: []
    });
    return builder;
    }
});
```

The ts-sdk will be a WASM binary wrapper around a rust library that takes function call payloads and convert it into a serialized Move script that could be published to the blockchain. The WASM binary size should be minimal to be ported with the ts-sdk.

## Reference Implementation

The rust library is implemented in: https://github.com/aptos-labs/aptos-core/tree/runtianz/aptos_intent

The ts-sdk change is implemented in: https://github.com/aptos-labs/aptos-ts-sdk/tree/runtianz/intent_sdk

We will extend this library to other sdks if we got explicit asks from the community.

## Testing 

Implemented tests in both rust library and ts-sdk.

## Risks and Drawbacks

Most of the changes should be on the client side so no significant risk to me. 

## Security Considerations

See Risk. 

## Future Potential

We will be proposing Aptos Intent, which allowed users to specify conditional transfer of on-chain resources they own, such as fungible asset or NFT. Intents could be chain easily with this Intent Transaction Builder.


## Timeline

### Suggested implementation timeline

All rust logics have been implemented.

### Suggested developer platform support timeline

All ts-sdk/indexer logics have been implemented. We will see if there's other ask from other sdk.

### Suggested deployment timeline

Merge the two changes towards the end of October 2024. We could then release a new version typescript sdk.


## Open Questions (Optional)


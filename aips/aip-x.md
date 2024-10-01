---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Aptos Intent Framework
author: runtian-zhou
discussions-to (*optional): <a url pointing to the official discussion thread>
Status: Draft
last-call-end-date (*optional): <mm/dd/yyyy the last date to leave feedbacks and reviews>
type: Application, Framework
created: 09/27/2024
updated (*optional): <mm/dd/yyyy>
requires (*optional): <AIP number(s)>
---

# AIP-X - Aptos Intent Framework

## Summary

Designing a generic mechanism for declaring intents for trading between on chain resources on Aptos. This would allow users to declare which operations they would like to perform upfront and let 3rd party builders to fill in the details on how this transactions should be executed.

### Out of scope

We will only be covering the intent declaration and execution logic. We are not going to touch the solving logic on how intents should be fulfilled and we will leave it for builders on Aptos to figure out.

The current design of the intent framework facilitates on chain declaration of intents to simplify the problem. Ideally the intent should be declarable offchain as well using signed message but this is beyond the scope of the current AIP. We will provide a path on how we can enable features like this in the future.

The intent system designed here also focus on the Aptos only setup and we are not looking into cross chain solutions so far.

## High-level Overview

We see intent as a programmable lock for on chain assets. Meaning:
- One party can declare:
  - Type of Asset they would like to trade in
  - Condition when this asset could be released
- The framework provides mechanism to release the lock when such condition is met.

Logic here can then be translated into a Move struct that looks like the following:
```
struct TradeIntent<Source, phantom Target, Args> has key {
    offered_resource: Source,
    argument: Args,
    // Fn(Target, Args) -> ()
    consumption_function: FunctionInfo,
    self_delete_ref: DeleteRef,
    expiry_time: u64,
}
```

The `TradeIntent` is parameterized by three type parameters:
1. `Source`: Value that intent issuer is willing to give away
2. `Target`: the type of value that the intent issuer is expecting.
3. `Argument`: Intent user will use `Argument` as auxillary info to determine whether the unlock condition is met.

In the `TradeIntent`, we also register for a function pointer that can be set by the user, called `consumption_function`. The idea is that a transaction could only be committed if the intent issuer receives a value of `Target` type and also `consumption_function(target, argument)` is executed successfully. 

The lifecycle of an intent will look like the following:
1. User sends a transaction to the blockchain to create the trading intent by specifying the resource they can offer and the expected condition when such resource can be unlocked.
2. The intent would be broadcasted using an event.
3. Anyone can execute this intent as long as the `consumption_function` can be executed successfully.
    - We will expect intent solvers to actively monitor the available intents on chain and create transactions to claim the intent.

With those types being generic, we can implement different trading intents easily:
- If `Target` is instantiated with `FungibleAsset`, it means we are trading a Move value for a specific fungible asset.
- If `Target` is instantiated with `LinearTransferRef`, it means we are trading a Move value for an Object.
- If `Source` is instantiated with `TransferRef`, it means we are giving out ownership to an Object given certain condition.
- If `Source` is instantiated with `FungibleAsset`, it means we are giving out a certain fungible asset given certain condition.
   - This doesn't quite work because `FungibleAsset` is not storable. The real implementation would look like giving out ownership of a `FungibleStore`

## Impact

With this design, we can develop a generic trading protocol between arbitray Move values that would allow us to build a robust and composable market.

We can then use those building blocks to build trading intents between:
- FA to FA limit order
- Object to FA limit order
- FA to Object order
- Object to Object order

Since the framework is parameterized by those type parameters, we can even imagine trading other types of programmable Move resources. For example, one future direction would be to standarize the borrow/lending operation by issueing an NFT upon certain operations. Then we can implement intents such as:
- Flashloan at this rate or lower
- Variable-rate borrow position with Z APR or lower
- APR between amount X and Y

By declaring the intent to be trading FA that you own into a NFT that performs those certain operations. This could even bring up a entirely new sets of credit agencies to rate the credibility of each liquidity provider given those certain lending/borrowing NFTs.

All those benefits can help us build a more composable DeFi ecosystem. Users no longer need to specify which protocol they would like to use. This would also incentize for a solution market to find out the right trading solution. Trading, borrowing and lending could be unified under this one framework of offering and claiming process.

## Alternative Solutions

We could potentially avoid the use of function pointers and use some witness pattern instead. However, this could bring some cumbersome user experience to the solver as they would need to produce the witness themselves.

## Specification and Implementation Details

### Creating intents
```
public fun create_intent<Source: store, Target, Args: store + drop>(
    offered_resource: Source,
    argument: Args,
    expiry_time: u64,
    consumption_function: FunctionInfo,
    issuer: address,
): Object<TradeIntent<Source, Target, Args>>
```
User can use this api to register a trading intent between `Source` and `Target` type on-chain. The intent can only be executed if `consumption_function` specified by the user can be executed successfuly. Intent always have an expiry time so that issuer can claim the resource back after the expiry time. Note that the return value of this function is wrapped in an `Object`. This is because we want anyone to be able to claim this intent by providing the address of this object.

Another note is that this procedure is an on-chain procedure. Ideally we should make this a signed message instead so that users don't need to publish this intent to everyone.

### Consuming intents
```
struct TradeSession<phantom Target, Args> {
    argument: Args,
    consumption_function: FunctionInfo,
}

public fun start_intent_session<Source: store, Target, Args: store + drop>(
    intent: Object<TradeIntent<Source, Target, Args>>,
): (Source, TradeSession<Target, Args>)

public fun finish_intent_session<Target, Args: store + drop>(
    // Fn (Target, Args) -> ()
    session: TradeSession<Target, Args>,
    desired_target: Target,
)
```
There are two apis associated with claiming/consuming an on-chain intent. The first API will allow anyone to consume an intent object. Consumption of the intent object can release the resource locked in the intent temporarily. There will also be a hot potato type returned called `TradeSession`. Since this is a hot potato type, the transaction sender will have no choice but invoke the second `finish_intent_session` api which will require a value of `Target` type. The framework will then execute `consumption_function(desired_target, argument)` to make sure the `Target` value indeed matches with intent issuer's intention and consume this target value on issuer's behalf.

### Example: Defining an intent to receive a certain fungible asset.
```
module aptos_framework::fungible_asset_intent_hooks {
   struct FungibleAssetExchange has store, drop {
       desired_metadata: Object<Metadata>,
       desired_amount: u64,
       issuer: address,
   }
   // Using any type here to avoid function pointer type instantiation…
   public fun fa_to_fa_consumption(target: Any, argument: Any) {
       let received_fa = hot_potato_any::unpack<FungibleAsset>(target);
       let argument = hot_potato_any::unpack<FungibleAssetExchange>(argument);
       assert!(
           fungible_asset::metadata_from_asset(&received_fa) == argument.desired_metadata,
           error::invalid_argument(ENOT_DESIRED_TOKEN)
       );
       assert!(
           fungible_asset::amount(&received_fa) >= argument.desired_amount,
           error::invalid_argument(EAMOUNT_NOT_MEET),
       );
       primary_fungible_store::deposit(argument.issuer, received_fa);
   }
}
```
Here we are defining an example of intent where the unlock condition is receiving a certain amount of a given fungible asset type. `Argument` type is instantiated to `FungibleAssetExchange` and `Target` type is instantated to `FungibleAsset` in this example. In the arugment, we specify the amount and the type of FA we would like to receive. The consumption function will then be implemented by first checking if the passed in `FungibleAsset` meets the requirement set in the `FungibleAssetExchange` and deposit the FA to the issuer's primary fungible storage if the conditions are met.



## Reference Implementation



## Testing 

Implemented tests in the framework.

## Risks and Drawbacks

WIP

## Security Considerations

WIP

## Future Potential

- We need offchain declaration of the intents
- We can use this standard to incentivize for a credit score system for different DeFi lending protocol:
    - Implement borrow/lending action as an NFT, and implement scoring system for the NFT as the consumption condition.

## Timeline

### Suggested implementation timeline

Framework code implemented.

### Suggested developer platform support timeline

We will need https://github.com/aptos-foundation/AIPs/pull/448/files for SDK side support.

### Suggested deployment timeline

WIP


## Open Questions (Optional)


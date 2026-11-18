---
aip: (this is determined by the AIP Manager, leave it empty when drafting)
title: Aptos Intent Framework
author: @runtian-zhou @ch4r10t33r @alnoki @fmhall
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

Designing a generic mechanism for declaring intents for offering on chain resources on Aptos. This would allow users to declare which operations they would like to perform upfront and let 3rd party builders to fill in the details on how this transactions should be executed.

### Out of scope

We will only be covering the intent declaration and execution logic in this AIP. We are not going to touch the solving logic on how intents should be fulfilled and we will leave it for builders on Aptos to figure out.

The current design of the intent framework facilitates on chain declaration of intents to simplify the problem. Ideally the intent should be declarable offchain as well using signed message but this is beyond the scope of the current AIP. We will provide a path on how we can enable features like this in the future.

The intent system designed here also focus on the Aptos only setup and we are not looking into cross chain solutions so far.

## High-level Overview

### Motivation
If a normal transaction specifies "how" an action should be performed, an intent specifies "what" the desired outcome of the action should be. At its core, it is an object signed by a user that contains certain constraints and conditions that must be satisfied by a valid solution. Intents are "journey-agnostic". As long as the ideal outcome is reached and valid according to the user, the execution specifics do not matter.

Intents rely on the existence of "solvers", entities whose job it is to provide solutions to intents. Solvers help find solutions to user-desired outcomes, and can get paid for doing so.

This has a couple key benefits for users and developers:

- It pushes sophistication and cognitive overhead from users / clients to more specialized entities
- It allows other entities to compete to provide the best solution for a user, often resulting in better execution / prices
- It can simplify and speed up cross-chain interactions by pushing risk to "relayers" or "fillers" in exchange for a small fee.
- Intents are inherently secure, since the outcome signed by the user must match the outcome of the solution. However, ensuring that this is possible typically requires an "intent settlement network".

Intent is a particular concept for Aptos because Move has a unique way of encoding on chain assets. With Move, you can represent assets directly as on chain values that could be locked into contract directly and controlled programmable via Move code.

### Overview
In the proposed intent framework, we see a couple of parties involved:
1. Intent Creator (User): User will need to offer on chain resources they owned subject to a specific unlock condition.
2. Intent Contract (dApp): A certain dApp will need to provide programmbale condition when the certain asset could be unlocked.
3. Intent Solver System: A system will need to monitor the all the intents that's available and create transactions if it finds a lucrative intent. Solver will need to understand the Intent Contract to find out the proper solution.
4. Intent Verification Framework: Aptos Framework will need to make sure resources can only be unlocked to the solution provider when the post condition contract is executed successfully.

A typical user flow of intent should look like the following:
1. User creates an intent suggesting:
    - The asset it's going to offer.
    - The post condition contract when the asset could be released to the solver.
    - At the beginning we may integrate this creation process to the wallet with a set of known intent contracts. However, supporting 3rd party intent contract remains unknown to me.
2. Intent needs to be broadcasted to the interested solver.
    - In our initial implementation, intent creation could be done by executing a transaction. Such transaction can then emit an event to an event stream that solvers can subscribe themselves to.
3. Intent Solver will maintain a local pool of intents for each type of intent contract and sythesize a path that would meet the exchange contract.
4. Intent Solver will sign and submit transactions to process the intent.
    - In our initial implementation, intent resolution is implemented first come first serve based. The first transaction that can resolve the intent will be able to get the resources wrapped in the intent.
    - Intent resolution will be done by a library code to make sure the solver did meet the condition listed in the intent contract.

Aptos Labs will be responsible for implementing:
1. A set of intent contracts to ramp up the system.
2. Library code for creating and validating intents.
3. (TBD) SDK/Wallet support for creating an intent transaction.

Aptos Labs is looking for potential partners to work on intent solver.

## Impact

With this design, we can develop a generic trading protocol between arbitray Move values that would allow us to build a robust and composable market between all asset types with flexible trading options that's comparable to those in tradfi.

To get started, we can then use those building blocks to build trading intents between:
- FA to FA order
- Object to FA order
- FA to Object order
- Object to Object order

Specifically for FA order, the intent contract can be implemented in various different ways, such as:
1. Simple limit order
2. Order which amount is a function over time.
3. Order which amount is a function over oracle value.

Since the framework is parameterized by those type parameters, we can even imagine trading other types of programmable Move resources. For example, one future direction would be to standarize the borrow/lending operation by issueing an NFT upon certain operations. Then we can implement intents such as:
- Flashloan at this rate or lower
- Variable-rate borrow position with Z APR or lower
- APR between amount X and Y

By declaring the intent to be trading FA that you own into a NFT that performs those certain operations. This could even bring up a entirely new sets of credit agencies to rate the credibility of each liquidity provider given those certain lending/borrowing NFTs.

All those benefits can help us build a more composable DeFi ecosystem. Users no longer need to specify which protocol they would like to use. This would also incentize for a solution market to find out the right trading solution. Trading, borrowing and lending could be unified under this one framework of offering and claiming process.

## Alternative Solutions


## Specification and Implementation Details

We see intent as a programmable lock for on chain assets. Meaning:
- One party can declare:
  - Type of Asset they would like to trade in
  - Condition when this asset could be released
- The framework provides mechanism to release the lock when such condition is met.

Logic here can then be translated into a Move struct that looks like the following:
```
struct TradeIntent<Source, Args> has key {
    dispensable_resource: Source,
    argument: Args,
    self_delete_ref: DeleteRef,
    expiry_time: u64,
    witness_type: TypeInfo,
}
```

The `TradeIntent` is parameterized by two type parameters:
1. `Source`: Value that intent issuer is willing to give away
2. `Argument`: Intent user will use `Argument` as auxillary info to determine whether the unlock condition is met.

In the `TradeIntent`, we also register for a witness type where the releasing `Source` can only be done when such witness is provided.

The lifecycle of an intent will look like the following:
1. User sends a transaction to the blockchain to create the trading intent by specifying the resource they can offer and the expected condition when such resource can be unlocked.
2. The intent would be broadcasted using an event.
3. Anyone can execute this intent as long as the `Witness` can be provided.
    - We will expect intent solvers to actively monitor the available intents on chain and create transactions to claim the intent.

With those types being generic, we can implement different trading intents easily:
- If `Target` is instantiated with `FungibleAsset`, it means we are trading a Move value for a specific fungible asset.
- If `Target` is instantiated with `LinearTransferRef`, it means we are trading a Move value for an Object.
- If `Source` is instantiated with `TransferRef`, it means we are giving out ownership to an Object given certain condition.
- If `Source` is instantiated with `FungibleAsset`, it means we are giving out a certain fungible asset given certain condition.
   - This doesn't quite work because `FungibleAsset` is not storable. The real implementation would look like giving out ownership of a `FungibleStore`

### Creating intents
```
public fun create_intent<Source: store, Args: store + drop, Witness: drop>(
    dispensable_resource: Source,
    argument: Args,
    expiry_time: u64,
    issuer: address,
    _witness: Witness,
): Object<TradeIntent<Source, Args>> 
```
User can use this api to register a trading intent to offer a value of `Source` type. The intent can only be executed if anyone can provide a value of `Witness` type. Intent always have an expiry time so that issuer can claim the resource back after the expiry time. Note that the return value of this function is wrapped in an `Object`. This is because we want anyone to be able to claim this intent by providing the address of this object.

### Consuming intents
```
struct TradeSession<Args> {
    argument: Args,
    witness_type: TypeInfo,
}

public fun get_argument<Args>(session: &TradeSession<Args>): &Args {
    &session.argument
}

public fun start_intent_session<Source: store, Args: store + drop>(
    intent: Object<TradeIntent<Source, Args>>,
): (Source, TradeSession<Args>)

public fun finish_intent_session<Witness: drop, Args: store + drop>(
    session: TradeSession<Args>,
    _witness: Witness,
)
```
There are two apis associated with claiming/consuming an on-chain intent. The first API will allow anyone to consume an intent object. Consumption of the intent object can release the resource locked in the intent temporarily. There will also be a hot potato type returned called `TradeSession`. Since this is a hot potato type, the transaction sender will have no choice but invoke the second `finish_intent_session` api which will require a value of `Witness` type. 

### Example: Defining an intent to receive a certain fungible asset.
```
module aptos_intent::fungible_asset_intent_hooks {
    struct FungibleAssetLimitOrder has store, drop {
        desired_metadata: Object<Metadata>,
        desired_amount: u64,
        issuer: address,
    }

    struct FungibleAssetRecipientWitness has drop {}

    public fun finish_fa_receiving_session(
        session: TradeSession<FungibleAssetLimitOrder>,
        received_fa: FungibleAsset,
    ) {
        let argument = intent::get_argument(&session);
        assert!(
            fungible_asset::metadata_from_asset(&received_fa) == argument.desired_metadata,
            error::invalid_argument(ENOT_DESIRED_TOKEN)
        );
        assert!(
            fungible_asset::amount(&received_fa) >= argument.desired_amount,
            error::invalid_argument(EAMOUNT_NOT_MEET),
        );

        primary_fungible_store::deposit(argument.issuer, received_fa);
        intent::finish_intent_session(session, FungibleAssetRecipientWitness {})
    }
}
```
Here we are defining an example of intent where the unlock condition is receiving a certain amount of a given fungible asset type. `Argument` type is instantiated to `FungibleAssetLimitOrder` and `Witness` type is instantated to `FungibleAssetRecipientWitness` in this example. In the arugment, we specify the amount and the type of FA we would like to receive. The check will then be implemented by first checking if the passed in `FungibleAsset` meets the requirement set in the `FungibleAssetLimitOrder` and deposit the FA to the issuer's primary fungible storage if the conditions are met. Once the checks are completed, we will provide the witness `FungibleAssetRecipientWitness` to complete this intent session.

The solver can then perform following script to claim the intent:
```
script {
    fun main(core_resources: &signer, intent: Object<TradeIntent<Source, FungibleAssetLimitOrder>>) {
        // `source` will be the resource locked inside the intent
        // `session` is a hot potato that can only be destructed when certain FA is received
        //  according to `FungibleAssetLimitOrder`
        let (source, session) = intent::start_intent_session(intent);

        // invoke code to trade source into the desired fungible asset
        // solver can fill in arbitrary logic here, using any exchange and arbitrary many steps.
        ...

        // fa_token is the token obtained from the previous trading steps
        fungible_asset_intent_hooks::finish_fa_receiving_session(session, fa_token);
    }
}
```

## Reference Implementation

https://github.com/aptos-labs/intent-framework/pull/2

## Testing 

Implemented tests in the framework.

## Risks and Drawbacks

### Frontrun Risk

As the system is first-come first-serve, the intent claiming transaction can be front-runned by whoever sees it - mempool operator, validator operator, etc. Since anyone is able to sign transaction to claim intent solution, anyone can take the intent solving transaction submitted by the solver and sign the same transaction with its own address to be able to claim the lucrative ones. If main value comes from finding the route, and not being willing to settle, privacy of submitted transactions will become imporatnt. Intent Solver might want to run a validator node or partner with validator operator. Additionally in the future, support for "secret transactions" , that are revealed only at the time of execution might be added.


## Security Considerations

WIP

## Future Potential

- We need offchain declaration of the intents
- We can use this standard to incentivize for a credit score system for different DeFi lending protocol:
    - Implement borrow/lending action as an NFT, and implement scoring system for the NFT as the consumption condition.
- This procedure is an on-chain procedure. Ideally we should make this a signed message instead so that users don't need to publish this intent to everyone.
## Timeline

### Suggested implementation timeline

Framework code implemented.

### Suggested developer platform support timeline

We will need https://github.com/aptos-foundation/AIPs/pull/448/files for SDK side support.

### Suggested deployment timeline

WIP


## Open Questions (Optional)

Should we have an allowlist or some custom logic on who is authorized to resolve an intent?

